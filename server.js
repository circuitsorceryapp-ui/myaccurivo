// Accurivo — Lite ERP server. Multi-tenant: every company (tenant) sees only its own
// data, enforced by scoping EVERY query on tenant_id from the verified session.
const http = require('http');
const fs = require('fs');
const path = require('path');
const db = require('./db');
const {
  hashPassword, verifyPassword,
  generateTotpSecret, verifyTotp, otpauthUri,
  newSessionId,
} = require('./crypto');

const PORT = process.env.PORT || 3000;
const MAX_USERS_PER_TENANT = 10;
const DB_FILE = db.DB_FILE;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.pdf': 'application/pdf', '.ico': 'image/x-icon',
};

// ---------------- helpers ----------------
const now = () => new Date().toISOString().slice(0, 10);
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const money = (v) => Math.round(num(v) * 100); // euros → cents
function json(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}
const bad = (res, msg, status = 400) => json(res, status, { error: msg });
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s));

function setSetting(tenantId, key, value) {
  db.prepare(`INSERT INTO settings (tenant_id, key, value) VALUES (?, ?, ?)
    ON CONFLICT(tenant_id, key) DO UPDATE SET value = excluded.value`).run(tenantId, key, value == null ? null : String(value));
}
function getSetting(tenantId, key) {
  const r = db.prepare('SELECT value FROM settings WHERE tenant_id = ? AND key = ?').get(tenantId, key);
  return r ? r.value : null;
}

function sessionUser(req) {
  const cookies = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) cookies[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  const sid = cookies.accurivo_sid;
  if (!sid) return null;
  const s = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sid);
  if (!s) return null;
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(s.user_id);
  if (!u) return null;
  if (s.mfa_pending && u.totp_secret) return null; // MFA not completed yet
  return { ...u, sid };
}

const DOC_TYPES = ['invoice', 'quote', 'bill', 'cmr', 'ppd'];
function nextNumber(tenantId, docType) {
  const prefix = { invoice: 'INV', quote: 'QUO', bill: 'PUR', cmr: 'CMR', ppd: 'PPD' }[docType] || 'DOC';
  const rows = db.prepare("SELECT number FROM invoices WHERE tenant_id = ? AND number LIKE ?").all(tenantId, prefix + '-%');
  let max = 0;
  for (const r of rows) { const n = parseInt(String(r.number).split('-')[1], 10); if (n > max) max = n; }
  return `${prefix}-${String(max + 1).padStart(4, '0')}`;
}
function applyAutoStatus(invoice) { // bills paid by payments; invoices sent→paid
  if (invoice.doc_type === 'quote' || invoice.doc_type === 'cmr') return;
  const paid = db.prepare('SELECT COALESCE(SUM(amount_cents),0) s FROM payments WHERE invoice_id = ?').get(invoice.id).s;
  if (paid >= invoice.amount_cents && invoice.amount_cents > 0) return 'paid';
  if (paid > 0) return 'partial';
  return null;
}
function invoiceWithPaid(r) {
  const paid = db.prepare('SELECT COALESCE(SUM(amount_cents),0) s, COUNT(*) c FROM payments WHERE invoice_id = ?').get(r.id);
  return { ...r, items: JSON.parse(r.items || '[]'), info_rows: JSON.parse(r.info_rows || '[]'), banks: undefined, paid_cents: paid.s, payments_count: paid.c };
}

async function readBody(req) {
  const chunks = []; let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 200 * 1024 * 1024) throw new Error('Too large');
    chunks.push(c);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

// ---------------- server ----------------
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    const method = req.method;
    if (url.pathname.startsWith('/api/')) {
      let body = {};
      if (method === 'POST' || method === 'PATCH') { try { body = await readBody(req); } catch (e) { return bad(res, 'Bad request body', 400); } }
      return await api(req, res, url, method, body);
    }
    else serveStatic(req, res, url);
  } catch (e) {
    try { json(res, 500, { error: 'Server error' }); } catch {}
    console.error('Accurivo error:', e.message);
  }
});

async function api(req, res, url, method, body) {
  // ---- public: register / login / mfa verify ----
  if (url.pathname === '/api/register' && method === 'POST') {
    const { companyName, name, email, password } = body || {};
    if (!companyName || !name || !email || !password) return bad(res, 'Company name, your name, email and password are required');
    if (!isEmail(email)) return bad(res, 'This does not look like an email address');
    if (String(password).length < 8) return bad(res, 'Password must be at least 8 characters');
    if (db.prepare('SELECT id FROM users WHERE email = ?').get(String(email).toLowerCase())) return bad(res, 'This email is already registered');
    const t = db.prepare('INSERT INTO tenants (name) VALUES (?)').run(String(companyName).slice(0, 200));
    db.prepare('INSERT INTO users (tenant_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)')
      .run(Number(t.lastInsertRowid), String(name).slice(0, 100), String(email).toLowerCase(), hashPassword(password), 'owner');
    return json(res, 201, { ok: true, me: { email: String(email).toLowerCase(), company: String(companyName) } });
  }
  const setSid = (id, mfaPending) => {
    res.setHeader('Set-Cookie', `accurivo_sid=${id}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60 * 60 * 24 * 14}`);
  };
  if (url.pathname === '/api/login' && method === 'POST') {
    const { email, password } = body || {};
    const u = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').toLowerCase());
    if (!u || !verifyPassword(password, u.password_hash)) return bad(res, 'Wrong email or password');
    const sid = newSessionId();
    const pending = u.totp_secret ? 1 : 0;
    db.prepare('INSERT INTO sessions (id, user_id, mfa_pending) VALUES (?, ?, ?)').run(sid, u.id, pending);
    setSid(sid, pending);
    return json(res, 200, { ok: true, mfaRequired: !!pending });
  }
  if (url.pathname === '/api/mfa/verify' && method === 'POST') {
    const cookies = String(req.headers.cookie || '');
    const sid = (cookies.match(/accurivo_sid=([a-f0-9]+)/) || [])[1];
    const s = sid && db.prepare('SELECT * FROM sessions WHERE id = ?').get(sid);
    if (!s || !s.mfa_pending) return bad(res, 'No login in progress', 401);
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(s.user_id);
    if (!verifyTotp(u.totp_secret, (body || {}).code)) return bad(res, 'Wrong code');
    db.prepare('UPDATE sessions SET mfa_pending = 0 WHERE id = ?').run(sid);
    return json(res, 200, { ok: true, me: { email: u.email, name: u.name } });
  }
  if (url.pathname === '/api/logout' && method === 'POST') {
    res.setHeader('Set-Cookie', 'accurivo_sid=; HttpOnly; Path=/; Max-Age=0');
    return json(res, 200, { ok: true });
  }

  // ---- everything below needs a session ----
  const user = sessionUser(req);
  if (!user) return bad(res, 'Please log in', 401);
  const T = user.tenant_id;

  if (url.pathname === '/api/me') {
    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(T);
    return json(res, 200, { me: { email: user.email, name: user.name, role: user.role, company: tenant.name } });
  }
  if (url.pathname === '/api/mfa/setup' && method === 'POST') {
    const secret = generateTotpSecret();
    db.prepare('UPDATE users SET totp_secret = ? WHERE id = ?').run(secret, user.id);
    return json(res, 200, { secret, uri: otpauthUri(secret, user.email) });
  }
  if (url.pathname === '/api/mfa/enable' && method === 'POST') {
    if (!user.totp_secret) return bad(res, 'Start setup first');
    if (!verifyTotp(user.totp_secret, (body || {}).code)) return bad(res, 'Wrong code');
    return json(res, 200, { ok: true });
  }
  if (url.pathname === '/api/mfa/disable' && method === 'POST') {
    db.prepare('UPDATE users SET totp_secret = NULL WHERE id = ?').run(user.id);
    return json(res, 200, { ok: true });
  }

  // ---- people ----
  if (url.pathname === '/api/users' && method === 'GET') {
    const rows = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE tenant_id = ? ORDER BY id').all(T);
    return json(res, 200, { users: rows, limit: MAX_USERS_PER_TENANT });
  }
  if (url.pathname === '/api/users' && method === 'POST') {
    if (user.role !== 'owner') return bad(res, 'Only the owner can add people', 403);
    const count = db.prepare('SELECT COUNT(*) c FROM users WHERE tenant_id = ?').get(T).c;
    if (count >= MAX_USERS_PER_TENANT) return bad(res, `Limit reached: ${MAX_USERS_PER_TENANT} people per company`);
    const { name, email, password, role } = body || {};
    if (!name || !email || !password) return bad(res, 'Name, email and password are required');
    if (String(password).length < 8) return bad(res, 'Password must be at least 8 characters');
    if (db.prepare('SELECT id FROM users WHERE email = ?').get(String(email).toLowerCase())) return bad(res, 'This email is already registered');
    db.prepare('INSERT INTO users (tenant_id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)')
      .run(T, String(name).slice(0, 100), String(email).toLowerCase(), hashPassword(password), role === 'owner' ? 'owner' : 'user');
    return json(res, 201, { ok: true });
  }

  // ---- documents (invoices, quotes, bills, CMR waybills) ----
  if (url.pathname === '/api/invoices' && method === 'GET') {
    const q = String(url.searchParams.get('q') || '').trim();
    const like = `%${q}%`;
    const rows = q
      ? db.prepare(`SELECT * FROM invoices WHERE tenant_id = ? AND (number LIKE ? OR customer LIKE ? OR description LIKE ?) ORDER BY id DESC LIMIT 200`).all(T, like, like, like)
      : db.prepare('SELECT * FROM invoices WHERE tenant_id = ? ORDER BY id DESC LIMIT 200').all(T);
    return json(res, 200, { invoices: rows.map(invoiceWithPaid) });
  }
  if (url.pathname === '/api/invoices' && method === 'POST') {
    const b = body || {};
    const docType = DOC_TYPES.includes(b.doc_type) ? b.doc_type : 'invoice';
    const number = nextNumber(T, docType);
    const r = db.prepare(`INSERT INTO invoices (tenant_id, number, doc_type, customer, contact_id, description, amount_cents, currency, vat_rate, issue_date, due_date, status, items, bank_id, scan_warn, cmr_carrier, cmr_dispatch, cmr_delivery, cmr_weight, cmr_packages, info_lines, issued_by, signed_by, info_rows)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      T, number, docType, String(b.customer || '').slice(0, 200), b.contact_id || null,
      String(b.description || '').slice(0, 500), money(b.amount), String(b.currency || 'EUR').slice(0, 3),
      num(b.vat_rate ?? 21), String(b.issue_date || now()).slice(0, 10), String(b.due_date || '').slice(0, 10),
      ['draft', 'sent', 'ordered', 'received', 'paid'].includes(b.status) ? b.status : 'draft',
      JSON.stringify(Array.isArray(b.items) ? b.items.slice(0, 100) : []), b.bank_id ?? null, b.scan_warn ? 1 : 0,
      String(b.cmr_carrier || '').slice(0, 200), String(b.cmr_dispatch || '').slice(0, 200),
      String(b.cmr_delivery || '').slice(0, 200), String(b.cmr_weight || '').slice(0, 50), String(b.cmr_packages || '').slice(0, 50),
      String(b.info_lines || '').slice(0, 1000), String(b.issued_by || '').slice(0, 100), String(b.signed_by || '').slice(0, 100),
      JSON.stringify(Array.isArray(b.info_rows) ? b.info_rows.slice(0, 50).map((x) => ({ label: String((x && x.label) || '').slice(0, 100), text: String((x && x.text) || '').slice(0, 500) })) : []));
    const row = db.prepare('SELECT * FROM invoices WHERE id = ?').get(Number(r.lastInsertRowid));
    return json(res, 201, { ok: true, number, id: Number(r.lastInsertRowid), invoice: invoiceWithPaid(row) });
  }
  const invMatch = url.pathname.match(/^\/api\/invoices\/(\d+)$/);
  if (invMatch) {
    const id = Number(invMatch[1]);
    const row = db.prepare('SELECT * FROM invoices WHERE id = ? AND tenant_id = ?').get(id, T);
    if (!row) return json(res, 404, { error: 'Not found' });
    if (method === 'GET') {
      const pays = db.prepare('SELECT id, amount_cents, paid_on, note FROM payments WHERE invoice_id = ? AND tenant_id = ? ORDER BY paid_on, id').all(id, T);
      return json(res, 200, Object.assign(invoiceWithPaid(row), { payments: pays }));
    }
    if (method === 'PATCH') {
      const b = body || {};
      const fields = [];
      const vals = [];
      for (const k of ['customer', 'description', 'issue_date', 'due_date', 'status', 'currency']) if (b[k] !== undefined) { fields.push(k); vals.push(String(b[k]).slice(0, 500)); }
      if (b.amount !== undefined) { fields.push('amount_cents'); vals.push(money(b.amount)); }
      if (b.vat_rate !== undefined) { fields.push('vat_rate'); vals.push(num(b.vat_rate)); }
      if (b.items !== undefined) { fields.push('items'); vals.push(JSON.stringify(Array.isArray(b.items) ? b.items.slice(0, 100) : [])); }
      if (b.contact_id !== undefined) { fields.push('contact_id'); vals.push(b.contact_id); }
      if (b.bank_id !== undefined) { fields.push('bank_id'); vals.push(b.bank_id); }
      for (const k of ['cmr_carrier', 'cmr_dispatch', 'cmr_delivery', 'cmr_weight', 'cmr_packages', 'info_lines', 'issued_by', 'signed_by']) {
        if (b[k] !== undefined) { fields.push(k); vals.push(String(b[k]).slice(0, k === 'info_lines' ? 1000 : 200)); }
      }
      if (b.info_rows !== undefined) {
        fields.push('info_rows');
        vals.push(JSON.stringify(Array.isArray(b.info_rows) ? b.info_rows.slice(0, 50).map((x) => ({ label: String((x && x.label) || '').slice(0, 100), text: String((x && x.text) || '').slice(0, 500) })) : []));
      }
      if (fields.length) db.prepare(`UPDATE invoices SET ${fields.map((f) => f + ' = ?').join(', ')} WHERE id = ? AND tenant_id = ?`).run(...vals, id, T);
      return json(res, 200, invoiceWithPaid(db.prepare('SELECT * FROM invoices WHERE id = ?').get(id)));
    }
    if (method === 'DELETE') {
      db.prepare('DELETE FROM payments WHERE invoice_id = ? AND tenant_id = ?').run(id, T);
      db.prepare('DELETE FROM invoices WHERE id = ? AND tenant_id = ?').run(id, T);
      return json(res, 200, { ok: true });
    }
  }
  if (url.pathname === '/api/invoices/payments' && method === 'POST') {
    const b = body || {};
    const row = db.prepare('SELECT * FROM invoices WHERE id = ? AND tenant_id = ?').get(b.invoice_id, T);
    if (!row) return bad(res, 'Document not found');
    if (money(b.amount) <= 0) return bad(res, 'Payment amount must be positive');
    db.prepare('INSERT INTO payments (tenant_id, invoice_id, amount_cents, paid_on, note) VALUES (?, ?, ?, ?, ?)')
      .run(T, row.id, money(b.amount), String(b.paid_on || now()).slice(0, 10), String(b.note || '').slice(0, 200));
    const auto = applyAutoStatus(row);
    if (auto) db.prepare('UPDATE invoices SET status = ? WHERE id = ?').run(auto, row.id);
    const upd = db.prepare('SELECT * FROM invoices WHERE id = ?').get(row.id);
    return json(res, 201, { ok: true, invoice: invoiceWithPaid(upd) });
  }
  // goods received: create a PPD (Preču piegādes dokuments) from a bill, mark the bill received
  if (url.pathname === '/api/invoices/ppd' && method === 'POST') {
    const b = body || {};
    const bill = db.prepare('SELECT * FROM invoices WHERE id = ? AND tenant_id = ?').get(b.bill_id, T);
    if (!bill) return bad(res, 'Bill not found');
    if (bill.doc_type !== 'bill') return bad(res, 'PPD can only be created from a bill');
    const existing = db.prepare('SELECT * FROM invoices WHERE tenant_id = ? AND doc_type = ? AND source_id = ?').get(T, 'ppd', bill.id);
    if (existing) return json(res, 200, { ok: true, id: existing.id, number: existing.number, existed: true });
    const number = nextNumber(T, 'ppd');
    const r = db.prepare(`INSERT INTO invoices (tenant_id, number, doc_type, customer, contact_id, description, amount_cents, currency, vat_rate, issue_date, due_date, status, items, info_lines, issued_by, signed_by, info_rows, source_id)
      VALUES (?, ?, 'ppd', ?, ?, ?, ?, ?, ?, ?, '', 'sent', ?, ?, ?, ?, ?, ?)`).run(
      T, number, String(bill.customer || '').slice(0, 200), bill.contact_id || null,
      String(bill.description || '').slice(0, 500), bill.amount_cents, String(bill.currency || 'EUR').slice(0, 3),
      num(bill.vat_rate ?? 21), String(now()).slice(0, 10),
      bill.items, String(bill.info_lines || '').slice(0, 1000), String(bill.issued_by || '').slice(0, 100), String(bill.signed_by || '').slice(0, 100),
      bill.info_rows || '[]', bill.id);
    db.prepare('UPDATE invoices SET status = ? WHERE id = ?').run('received', bill.id);
    return json(res, 201, { ok: true, id: Number(r.lastInsertRowid), number });
  }
  const payMatch = url.pathname.match(/^\/api\/payments\/(\d+)$/);
  if (payMatch && method === 'DELETE') {
    const id = Number(payMatch[1]);
    const p = db.prepare('SELECT * FROM payments WHERE id = ? AND tenant_id = ?').get(id, T);
    if (!p) return json(res, 404, { error: 'Not found' });
    db.prepare('DELETE FROM payments WHERE id = ?').run(id);
    const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(p.invoice_id);
    if (inv && (inv.status === 'paid' || inv.status === 'partial')) {
      const auto = applyAutoStatus(inv);
      db.prepare('UPDATE invoices SET status = ? WHERE id = ?').run(auto || 'sent', inv.id);
    }
    return json(res, 200, { ok: true });
  }

  // ---- contacts ----
  if (url.pathname === '/api/contacts' && method === 'GET') {
    const q = String(url.searchParams.get('q') || '').trim();
    const like = `%${q}%`;
    const rows = q
      ? db.prepare(`SELECT * FROM contacts WHERE tenant_id = ? AND
            (name LIKE ? OR email LIKE ? OR phone LIKE ? OR reg_no LIKE ? OR vat_no LIKE ? OR address LIKE ?)
            ORDER BY name LIMIT 50`).all(T, like, like, like, like, like, like)
      : db.prepare('SELECT * FROM contacts WHERE tenant_id = ? ORDER BY name LIMIT 50').all(T);
    return json(res, 200, { contacts: rows.map((r) => {
      let banks = [];
      try { banks = JSON.parse(r.banks || '[]'); } catch {}
      if ((!Array.isArray(banks) || !banks.length) && (r.bank_name || r.iban)) banks = [{ name: r.bank_name || '', iban: r.iban || '', swift: r.swift || '' }];
      return { ...r, banks: Array.isArray(banks) ? banks.filter((b) => b && b.iban) : [] };
    }) });
  }
  if (url.pathname === '/api/contacts' && method === 'POST') {
    const b = body || {};
    const name = String(b.name || '').trim().slice(0, 200);
    if (!name) return bad(res, 'Name is required');
    const banks = Array.isArray(b.banks) ? b.banks.filter((x) => x && x.iban).slice(0, 20)
      .map((x) => ({ name: String(x.name || '').slice(0, 100), iban: String(x.iban || '').slice(0, 50), swift: String(x.swift || '').slice(0, 20) })) : [];
    const first = banks[0] || {};
    const r = db.prepare('INSERT INTO contacts (tenant_id, kind, name, reg_no, vat_no, email, phone, address, bank_name, iban, swift, banks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(T, ['company', 'supplier', 'person'].includes(b.kind) ? b.kind : 'company', name,
        String(b.reg_no || '').slice(0, 50), String(b.vat_no || '').slice(0, 50), String(b.email || '').slice(0, 100),
        String(b.phone || '').slice(0, 50), String(b.address || '').slice(0, 200),
        String(first.name || b.bank_name || '').slice(0, 100), String(first.iban || b.iban || '').slice(0, 50), String(first.swift || b.swift || '').slice(0, 20),
        JSON.stringify(banks));
    return json(res, 201, { ok: true, id: Number(r.lastInsertRowid) });
  }
  const conMatch = url.pathname.match(/^\/api\/contacts\/(\d+)$/);
  if (conMatch && method === 'PATCH') {
    const id = Number(conMatch[1]);
    const row = db.prepare('SELECT * FROM contacts WHERE id = ? AND tenant_id = ?').get(id, T);
    if (!row) return json(res, 404, { error: 'Not found' });
    const b = body || {};
    if (b.kind !== undefined && !['company', 'supplier', 'person'].includes(b.kind)) return bad(res, 'Kind must be company, supplier or person');
    const fields = [];
    const vals = [];
    if (b.kind !== undefined && ['company', 'supplier', 'person'].includes(b.kind)) { fields.push('kind'); vals.push(b.kind); }
    for (const k of ['name', 'reg_no', 'vat_no', 'email', 'phone', 'address']) {
      if (b[k] !== undefined) {
        const v = String(b[k]).trim().slice(0, k === 'name' || k === 'address' ? 200 : 100);
        if (k === 'name' && !v) return bad(res, 'Name is required');
        fields.push(k); vals.push(v);
      }
    }
    if (Array.isArray(b.banks)) {
      const banks = b.banks.filter((x) => x && x.iban).slice(0, 20)
        .map((x) => ({ name: String(x.name || '').slice(0, 100), iban: String(x.iban || '').slice(0, 50), swift: String(x.swift || '').slice(0, 20) }));
      const first = banks[0] || {};
      fields.push('banks'); vals.push(JSON.stringify(banks));
      fields.push('bank_name'); vals.push(String(first.name || ''));
      fields.push('iban'); vals.push(String(first.iban || ''));
      fields.push('swift'); vals.push(String(first.swift || ''));
    }
    else {
      for (const k of ['bank_name', 'iban', 'swift']) {
        if (b[k] !== undefined) { fields.push(k); vals.push(String(b[k]).trim().slice(0, 100)); }
      }
    }
    if (fields.length) db.prepare(`UPDATE contacts SET ${fields.map((f) => f + ' = ?').join(', ')} WHERE id = ? AND tenant_id = ?`).run(...vals, id, T);
    return json(res, 200, { ok: true, contact: db.prepare('SELECT * FROM contacts WHERE id = ?').get(id) });
  }
  if (conMatch && method === 'DELETE') {
    db.prepare('DELETE FROM contacts WHERE id = ? AND tenant_id = ?').run(Number(conMatch[1]), T);
    return json(res, 200, { ok: true });
  }
  if (url.pathname === '/api/contacts/import' && method === 'POST') {
    const list = Array.isArray(body && body.contacts) ? body.contacts.slice(0, 500) : [];
    let added = 0;
    const seen = new Set();
    const existing = new Set(db.prepare('SELECT name, vat_no FROM contacts WHERE tenant_id = ?').all(T)
      .map((c) => (c.vat_no ? 'v:' + c.vat_no : 'n:' + c.name.toLowerCase())));
    for (const c of list) {
      const name = String((c && c.name) || '').trim().slice(0, 200);
      if (!name) continue;
      const vat = String((c && c.vat_no) || '').trim().slice(0, 50);
      const key = vat ? 'v:' + vat : 'n:' + name.toLowerCase();
      if (seen.has(key) || existing.has(key)) continue;
      seen.add(key);
      const banks = Array.isArray(c.banks) ? c.banks.filter((x) => x && x.iban).slice(0, 20)
        .map((x) => ({ name: String(x.name || '').slice(0, 100), iban: String(x.iban || '').slice(0, 50), swift: String(x.swift || '').slice(0, 20) }))
        : ((c.bank_name || c.iban) ? [{ name: String(c.bank_name || '').slice(0, 100), iban: String(c.iban || '').slice(0, 50), swift: String(c.swift || '').slice(0, 20) }] : []);
      const first = banks[0] || {};
      db.prepare('INSERT INTO contacts (tenant_id, kind, name, reg_no, vat_no, email, phone, address, bank_name, iban, swift, banks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(T, (c.kind === 'supplier' ? 'supplier' : c.kind === 'person' ? 'person' : 'company'), name,
          String(c.reg_no || '').slice(0, 50), vat, String(c.email || '').slice(0, 100),
          String(c.phone || '').slice(0, 50), String(c.address || '').slice(0, 200),
          String(first.name || '').slice(0, 100), String(first.iban || '').slice(0, 50), String(first.swift || '').slice(0, 20),
          JSON.stringify(banks));
      added++;
    }
    return json(res, 201, { ok: true, added });
  }

  // ---- company profile ----
  if (url.pathname === '/api/company' && method === 'GET') {
    const r = db.prepare('SELECT * FROM company_profile WHERE tenant_id = ?').get(T);
    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(T);
    return json(res, 200, { company: r ? { ...r, banks: JSON.parse(r.banks || '[]') } : { full_name: tenant.name, banks: [] } });
  }
  if (url.pathname === '/api/company' && method === 'POST') {
    const b = body || {};
    const banks = Array.isArray(b.banks) ? b.banks.filter((x) => x && (x.iban || x.name)).slice(0, 20)
      .map((x) => ({ name: String(x.name || '').slice(0, 100), iban: String(x.iban || '').slice(0, 34), swift: String(x.swift || '').slice(0, 11) })) : [];
    db.prepare(`INSERT INTO company_profile (tenant_id, full_name, reg_no, vat_no, email, phone, address, logo, banks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tenant_id) DO UPDATE SET full_name=excluded.full_name, reg_no=excluded.reg_no, vat_no=excluded.vat_no,
      email=excluded.email, phone=excluded.phone, address=excluded.address, logo=excluded.logo, banks=excluded.banks`)
      .run(T, String(b.full_name || '').slice(0, 200), String(b.reg_no || '').slice(0, 50), String(b.vat_no || '').slice(0, 50),
        String(b.email || '').slice(0, 100), String(b.phone || '').slice(0, 50), String(b.address || '').slice(0, 200),
        typeof b.logo === 'string' && b.logo.startsWith('data:') ? b.logo : null, JSON.stringify(banks));
    return json(res, 200, { ok: true });
  }

  // ---- demo data ----
  if (url.pathname === '/api/demo' && method === 'POST') {
    const names = ['SIA Alfa', 'SIA Beta', 'SIA Gama', 'SIA Delta', 'SIA Eps'];
    const today = new Date();
    for (let i = 0; i < 10; i++) {
      const type = i < 6 ? 'invoice' : i < 8 ? 'quote' : 'bill';
      const d = new Date(today.getTime() - i * 86400000);
      const number = nextNumber(T, type);
      const amount = 80 + i * 37;
      db.prepare(`INSERT INTO invoices (tenant_id, number, doc_type, customer, amount_cents, issue_date, due_date, status, items)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(T, number, type, names[i % 5], money(amount),
        d.toISOString().slice(0, 10), new Date(d.getTime() + 14 * 86400000).toISOString().slice(0, 10),
        i % 3 === 0 ? 'draft' : (type === 'bill' ? 'received' : 'sent'),
        JSON.stringify([{ name: 'Service', qty: 1, price: amount }]));
    }
    return json(res, 201, { ok: true });
  }

  // ---- statistics ----
  if (url.pathname === '/api/stats' && method === 'GET') {
    const docs = db.prepare('SELECT id, doc_type, amount_cents, issue_date, due_date FROM invoices WHERE tenant_id = ?').all(T);
    const pays = db.prepare('SELECT p.amount_cents AS amount_cents, p.paid_on AS paid_on, p.invoice_id AS invoice_id, i.doc_type AS doc_type FROM payments p JOIN invoices i ON i.id = p.invoice_id WHERE i.tenant_id = ?').all(T);
    const paidMap = {}; pays.forEach((p) => { paidMap[p.invoice_id] = (paidMap[p.invoice_id] || 0) + (p.amount_cents || 0); });
    docs.forEach((d) => { d.paid_cents = paidMap[d.id] || 0; });
    const todayS = now().slice(0, 10);
    const inv = docs.filter((d) => d.doc_type === 'invoice');
    const bil = docs.filter((d) => d.doc_type === 'bill');
    const sum = (arr, f) => arr.reduce((a, x) => a + (f(x) || 0), 0);
    const allOpen = docs.filter((d) => (d.doc_type === 'invoice' || d.doc_type === 'bill') && d.amount_cents > d.paid_cents);
    const summary = {
      invoiced: sum(inv, (d) => d.amount_cents),
      received: sum(inv, (d) => d.paid_cents),
      expenses: sum(bil, (d) => d.amount_cents),
      paidOut: sum(bil, (d) => d.paid_cents),
      owedToYou: sum(inv, (d) => Math.max(0, d.amount_cents - d.paid_cents)),
      owedByYou: sum(bil, (d) => Math.max(0, d.amount_cents - d.paid_cents)),
      overdue: sum(allOpen.filter((d) => d.due_date && d.due_date < todayS), (d) => d.amount_cents - d.paid_cents),
      overdueCount: allOpen.filter((d) => d.due_date && d.due_date < todayS).length,
      docsThisMonth: docs.filter((d) => (d.issue_date || '').slice(0, 7) === todayS.slice(0, 7)).length,
    };
    summary.profit = summary.invoiced - summary.expenses;
    summary.saldo = summary.received - summary.paidOut;
    const weekKey = (ds) => { // Monday of the ISO week
      const d = new Date(ds + 'T00:00:00Z'); const day = (d.getUTCDay() + 6) % 7;
      d.setUTCDate(d.getUTCDate() - day); return d.toISOString().slice(0, 10);
    };
    const nowMs = Date.now();
    const mkKeys = (n, stepDays, fn) => Array.from({ length: n }, (_, k) => fn(new Date(nowMs - k * stepDays * 864e5))).reverse();
    const weekStart = (d) => weekKey(d.toISOString().slice(0, 10));
    const quarterKey = (d) => d.getUTCFullYear() + '-Q' + (Math.floor(d.getUTCMonth() / 3) + 1);
    const seriesOf = (keys, keyOf) => {
      const m = {}; keys.forEach((k) => { m[k] = { key: k, invoiced: 0, expenses: 0, received: 0, paidOut: 0 }; });
      const put = (arr, field, keyOf) => arr.forEach((x) => { const k = keyOf(x); if (m[k]) m[k][field] += Number(x.amount_cents) || 0; });
      put(docs.filter((d) => d.doc_type === 'invoice'), 'invoiced', (d) => keyOf(d.issue_date || ''));
      put(docs.filter((d) => d.doc_type === 'bill'), 'expenses', (d) => keyOf(d.issue_date || ''));
      put(pays.filter((p) => p.doc_type === 'invoice'), 'received', (p) => keyOf(p.paid_on || ''));
      put(pays.filter((p) => p.doc_type === 'bill'), 'paidOut', (p) => keyOf(p.paid_on || ''));
      return keys.map((k) => m[k]);
    };
    return json(res, 200, {
      summary,
      weeks: seriesOf(mkKeys(10, 7, weekStart), (x) => (x && x.length >= 10 ? weekKey(x.slice(0, 10)) : null)),
      months: seriesOf(mkKeys(12, 30.44, (d) => d.toISOString().slice(0, 7)), (x) => (x && x.length >= 7 ? x.slice(0, 7) : null)),
      quarters: seriesOf(mkKeys(8, 91.31, quarterKey), (x) => {
        if (!x || x.length < 7) return null;
        const d = new Date(x.slice(0, 10) + 'T00:00:00Z');
        return quarterKey(d);
      }),
    });
  }

  // ---- scanned originals ----
  if (url.pathname === '/api/scans') {
    if (method === 'GET') {
      const rows = db.prepare('SELECT id, doc_number, filename, mime, created_at FROM scans WHERE tenant_id = ? ORDER BY id DESC LIMIT 200').all(T);
      return json(res, 200, { scans: rows });
    }
    if (method === 'POST') {
      const { filename, data, doc_number } = body || {};
      if (!data || typeof data !== 'string') return bad(res, 'File data is required');
      const m = data.match(/^data:([^;]+);base64,(.+)$/);
      if (!m) return bad(res, 'File must be sent as base64 data URL');
      const mime = m[1];
      if (!/^(image\/(png|jpe?g|webp)|application\/pdf)$/.test(mime)) return bad(res, 'Only photos (PNG, JPG) and PDF are allowed');
      const buf = Buffer.from(m[2], 'base64');
      if (!buf.length || buf.length > 15 * 1024 * 1024) return bad(res, 'File is empty or too large (max 15 MB)');
      const r = db.prepare('INSERT INTO scans (tenant_id, doc_number, filename, mime, data) VALUES (?, ?, ?, ?, ?)')
        .run(T, doc_number ? String(doc_number).slice(0, 50) : null, String(filename || 'scan').slice(0, 200), mime, buf);
      return json(res, 201, { ok: true, id: Number(r.lastInsertRowid) });
    }
    if (method === 'PATCH') {
      db.prepare('UPDATE scans SET doc_number = ? WHERE id = ? AND tenant_id = ?')
        .run(String((body || {}).doc_number || '').slice(0, 50), Number((body || {}).id), T);
      return json(res, 200, { ok: true });
    }
    if (method === 'DELETE') {
      db.prepare('DELETE FROM scans WHERE id = ? AND tenant_id = ?').run(Number((body || {}).id), T);
      return json(res, 200, { ok: true });
    }
  }
  const scanMatch = url.pathname.match(/^\/api\/scans\/(\d+)$/);
  if (scanMatch && method === 'GET') {
    const row = db.prepare('SELECT * FROM scans WHERE id = ? AND tenant_id = ?').get(Number(scanMatch[1]), T);
    if (!row) return json(res, 404, { error: 'Not found' });
    res.writeHead(200, { 'Content-Type': row.mime, 'Content-Disposition': 'inline; filename="' + row.filename.replace(/"/g, '') + '"', 'Content-Length': row.data.length });
    return res.end(row.data);
  }

  // ---- backups ----
  const listBackups = (folder) => {
    try { return fs.readdirSync(folder).filter((f) => /^(accurivo|verdins)-backup-.*\.db$/.test(f)).map((f) => ({ name: f, size: fs.statSync(path.join(folder, f)).size })).sort().reverse(); }
    catch { return []; }
  };
  if (url.pathname === '/api/backup') {
    if (method === 'GET') {
      const folder = getSetting(T, 'backup_folder');
      return json(res, 200, { folder, auto: getSetting(T, 'backup_auto') === '1', files: folder ? listBackups(folder) : [] });
    }
    if (method === 'POST') {
      const { folder, auto } = body || {};
      if (typeof folder !== 'string' || folder.length > 300) return bad(res, 'Folder path is required');
      let dir = folder.trim();
      if (dir) {
        try {
          fs.mkdirSync(dir, { recursive: true });
          const probe = path.join(dir, '.accurivo-write-test');
          fs.writeFileSync(probe, 'ok'); fs.unlinkSync(probe);
        } catch (e) { return bad(res, 'Cannot write to that folder: ' + e.message); }
      }
      setSetting(T, 'backup_folder', dir);
      setSetting(T, 'backup_auto', auto ? '1' : '0');
      return json(res, 200, { ok: true, folder: dir, auto: !!auto, files: dir ? listBackups(dir) : [] });
    }
  }
  if (url.pathname === '/api/backup/run' && method === 'POST') {
    const folder = getSetting(T, 'backup_folder');
    if (!folder) return bad(res, 'Set a backup folder first (Settings → Backups)');
    try {
      const dest = path.join(folder, 'accurivo-backup-' + new Date().toISOString().slice(0, 23).replace(/[:T.]/g, '-') + '.db');
      db.exec("VACUUM INTO '" + dest.replace(/'/g, "''") + "'");
      const names = listBackups(folder).map((f) => f.name);
      for (const n of names.slice(30)) { try { fs.unlinkSync(path.join(folder, n)); } catch {} }
      return json(res, 201, { ok: true, file: path.basename(dest), files: listBackups(folder) });
    } catch (e) { return bad(res, 'Backup failed: ' + e.message, 500); }
  }
  if (url.pathname === '/api/backup/download' && method === 'GET') {
    const tmp = path.join(require('os').tmpdir(), 'accurivo-dl-' + Date.now() + '.db');
    try {
      db.exec("VACUUM INTO '" + tmp.replace(/'/g, "''") + "'");
      const bytes = fs.readFileSync(tmp);
      const name = 'accurivo-backup-' + new Date().toISOString().slice(0, 23).replace(/[:T.]/g, '-') + '.db';
      res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': 'attachment; filename="' + name + '"', 'Content-Length': bytes.length });
      return res.end(bytes);
    } catch (e) { return bad(res, 'Could not make a backup file', 500); }
    finally { try { fs.unlinkSync(tmp); } catch {} }
  }
  // RESTORE: upload an Accurivo backup file, put everything back, restart automatically.
  if (url.pathname === '/api/backup/restore' && method === 'POST') {
    const { data } = body || {};
    if (typeof data !== 'string' || !data) return bad(res, 'Backup file data is required');
    const b64 = data.includes(',') && data.startsWith('data:') ? data.split(',')[1] : data.replace(/\s/g, '');
    let buf = null;
    try { buf = Buffer.from(b64, 'base64'); } catch { return bad(res, 'Not a valid backup file'); }
    if (buf.length < 512) return bad(res, 'Not a valid Accurivo backup (file too small)');
    if (buf.subarray(0, 15).toString('utf8') !== 'SQLite format 3') return bad(res, 'Not a valid Accurivo backup (this is not a database file)');
    // validate: openable and contains our tables
    const os = require('os');
    const tmp = path.join(os.tmpdir(), 'accurivo-restore-' + Date.now() + '.db');
    try {
      fs.writeFileSync(tmp, buf);
      const { DatabaseSync } = require('node:sqlite');
      const probe = new DatabaseSync(tmp);
      const tables = probe.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name);
      probe.close();
      for (const need of ['tenants', 'users', 'sessions', 'invoices', 'payments', 'contacts', 'scans', 'settings', 'company_profile']) {
        if (!tables.includes(need)) throw new Error('missing table ' + need);
      }
    } catch (e) {
      try { fs.unlinkSync(tmp); } catch {}
      return bad(res, 'Not a valid Accurivo backup (' + e.message + ')');
    }
    try { fs.unlinkSync(tmp); } catch {}
    // safety: keep a copy of the current data before overwriting
    const safety = DB_FILE + '.before-restore';
    try { fs.copyFileSync(DB_FILE, safety); } catch {}
    // swap in the restored database, then restart so everything reloads
    json(res, 200, { ok: true, restarting: true, safety: path.basename(safety) });
    setTimeout(() => {
      try { db.close(); } catch {}
      try { fs.writeFileSync(DB_FILE, buf); } catch (e) { console.error('Accurivo restore write failed:', e.message); process.exit(1); }
      console.log('Accurivo: database restored from backup. Restarting…');
      const { spawn } = require('child_process');
      try {
        spawn(process.execPath, process.argv.slice(1), { detached: true, stdio: 'ignore' }).unref();
      } catch {}
      process.exit(0);
    }, 200);
    return;
  }

  return json(res, 404, { error: 'Not found' });
}

// periodic cleanup of old sessions (30 days)
setInterval(() => {
  try { db.prepare("DELETE FROM sessions WHERE created_at < datetime('now', '-30 days')").run(); } catch {}
}, 24 * 60 * 60 * 1000).unref();

// daily auto-backup if enabled
function autoBackup() {
  try {
    const rows = db.prepare("SELECT tenant_id FROM settings WHERE key = 'backup_auto' AND value = '1'").all();
    for (const { tenant_id } of rows) {
      const f = db.prepare("SELECT value FROM settings WHERE tenant_id = ? AND key = 'backup_folder'").get(tenant_id);
      const dir = f && f.value;
      if (!dir) continue;
      const files = fs.readdirSync(dir).filter((x) => /^accurivo-backup-.*\.db$/.test(x));
      const today = 'accurivo-backup-' + new Date().toISOString().slice(0, 10);
      if (files.some((x) => x.startsWith(today))) continue;
      const name = 'accurivo-backup-' + new Date().toISOString().slice(0, 23).replace(/[:T.]/g, '-') + '.db';
      db.exec("VACUUM INTO '" + path.join(dir, name).replace(/'/g, "''") + "'");
      console.log('Accurivo auto-backup saved: ' + name);
    }
  } catch (e) { console.error('Accurivo auto-backup failed:', e.message); }
}
setTimeout(autoBackup, 30 * 1000).unref();
setInterval(autoBackup, 6 * 60 * 60 * 1000).unref();

// ---------------- static files (folder or embedded) ----------------
const PUBLIC_DIR = path.join(__dirname, 'public');
const EMBED = global.ACCURIVO_EMBED || null; // set by the single-file build
function assetBytes(rel) {
  if (EMBED) {
    const b64 = EMBED[rel];
    return b64 ? Promise.resolve(Buffer.from(b64, 'base64')) : Promise.reject(new Error('missing'));
  }
  return fs.promises.readFile(path.join(PUBLIC_DIR, rel));
}
async function serveStatic(req, res, url) {
  let file = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
  if (file.includes('..')) { res.writeHead(403); return res.end(); }
  try {
    const bytes = await assetBytes(file);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Content-Length': bytes.length });
    res.end(bytes);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<!DOCTYPE html><html><head><meta charset="utf-8"><title>My Accurivo</title></head><body style="font-family:sans-serif;padding:60px"><h1>Page not found</h1><p><a href="/">Back to My Accurivo</a></p></body></html>');
  }
}

// start listening — retry a few times (the port needs a moment after a restore restart)
let listenTries = 0;
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE' && listenTries < 20) {
    listenTries++;
    setTimeout(() => { try { server.close(() => {}); } catch {} server.listen(PORT); }, 400);
  } else {
    console.error('Accurivo: port ' + PORT + ' is busy. Close the other Accurivo window or set PORT (for example PORT=3001).');
    process.exit(1);
  }
});
server.listen(PORT);
server.once('listening', () => {
  console.log('My Accurivo running at http://localhost:' + PORT);
  // packaged exe only: open the browser automatically
  try {
    const sea = require('node:sea');
    if (!sea || !sea.isSea) return;
    const { spawn } = require('child_process');
    const urlOpen = 'http://localhost:' + PORT;
    const open = (cmd, args) => { try { const p = spawn(cmd, args, { detached: true, stdio: 'ignore' }); p.on('error', () => {}); p.unref(); } catch {} };
    if (process.platform === 'win32') open('cmd', ['/c', 'start', '', urlOpen]);
    else if (process.platform === 'darwin') open('open', [urlOpen]);
    else open('xdg-open', [urlOpen]);
  } catch {}
});
