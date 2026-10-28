// Accurivo — database layer (SQLite for the starter; PostgreSQL + row-level security is the production path)
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

// single-file exe: keep the database next to the .exe, so users choose the place by moving the exe
let SEA = null; try { SEA = require('node:sea'); } catch {} // only exists when running as a packaged app
const fs = require('fs');
const dbDir = process.env.DB_PATH ? path.dirname(process.env.DB_PATH) : (SEA ? path.dirname(process.execPath) : __dirname);
const dbTarget = process.env.DB_PATH || path.join(dbDir, 'accurivo.db');
// one-time migration: users of the old "Verdins" version keep their data —
// if only the old verdins.db exists, copy it to accurivo.db and use that from now on
if (!process.env.DB_PATH || process.env.DB_PATH === dbTarget) {
  if (!fs.existsSync(dbTarget)) {
    const oldFile = path.join(path.dirname(dbTarget), 'verdins.db');
    if (fs.existsSync(oldFile)) {
      try { fs.copyFileSync(oldFile, dbTarget); console.log('Accurivo: copied your old verdins.db to accurivo.db (data kept).'); } catch (e) { console.error('Accurivo: could not copy old database:', e.message); }
    }
  }
}
const DB_FILE = dbTarget;

const db = new DatabaseSync(DB_FILE);

db.exec(`
CREATE TABLE IF NOT EXISTS tenants (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner',
  totp_secret TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  mfa_pending INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS company_profile (
  tenant_id INTEGER PRIMARY KEY REFERENCES tenants(id),
  full_name TEXT, reg_no TEXT, vat_no TEXT,
  email TEXT, phone TEXT, address TEXT, logo TEXT, banks TEXT
);
CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  kind TEXT NOT NULL DEFAULT 'company',
  name TEXT NOT NULL,
  reg_no TEXT, vat_no TEXT, email TEXT, phone TEXT, address TEXT,
  bank_name TEXT, iban TEXT, swift TEXT, banks TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  number TEXT NOT NULL,
  doc_type TEXT NOT NULL DEFAULT 'invoice',
  customer TEXT NOT NULL,
  contact_id INTEGER,
  description TEXT,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  vat_rate REAL NOT NULL DEFAULT 21,
  issue_date TEXT, due_date TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  items TEXT NOT NULL DEFAULT '[]',
  bank_id INTEGER,
  scan_warn INTEGER NOT NULL DEFAULT 0,
  cmr_carrier TEXT, cmr_dispatch TEXT, cmr_delivery TEXT, cmr_weight TEXT, cmr_packages TEXT,
  info_lines TEXT, info_rows TEXT, issued_by TEXT, signed_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (tenant_id, number)
);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  invoice_id INTEGER NOT NULL REFERENCES invoices(id),
  amount_cents INTEGER NOT NULL,
  paid_on TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS scans (
  id INTEGER PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  doc_number TEXT,
  filename TEXT NOT NULL,
  mime TEXT NOT NULL,
  data BLOB NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS settings (
  tenant_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  PRIMARY KEY (tenant_id, key)
);
CREATE INDEX IF NOT EXISTS idx_inv_tenant ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pay_inv ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_scan_tenant ON scans(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sess_user ON sessions(user_id);
`);

// migration: older databases (before CMR) get the CMR columns added
try {
  const have = db.prepare("SELECT name FROM pragma_table_info('invoices')").all().map((r) => r.name);
  for (const [col, type] of [
    ['cmr_carrier', 'TEXT'], ['cmr_dispatch', 'TEXT'], ['cmr_delivery', 'TEXT'],
    ['cmr_weight', 'TEXT'], ['cmr_packages', 'TEXT'],
    ['info_lines', 'TEXT'], ['issued_by', 'TEXT'], ['signed_by', 'TEXT'], ['info_rows', 'TEXT'],
  ]) {
    if (!have.includes(col)) db.exec(`ALTER TABLE invoices ADD COLUMN ${col} ${type}`);
  }
} catch {}

// migration: older databases get contact bank columns added
try {
  const haveCon = db.prepare("SELECT name FROM pragma_table_info('contacts')").all().map((r) => r.name);
  for (const [col, type] of [['bank_name', 'TEXT'], ['iban', 'TEXT'], ['swift', 'TEXT'], ['banks', 'TEXT']]) {
    if (!haveCon.includes(col)) db.exec(`ALTER TABLE contacts ADD COLUMN ${col} ${type}`);
  }
} catch {}

module.exports = db;
module.exports.DB_FILE = DB_FILE; // used by backup/restore
