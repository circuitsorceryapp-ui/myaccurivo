// Accurivo — password hashing, TOTP (two-step verification codes), session ids
const crypto = require('crypto');

// ---- passwords: scrypt with per-user random salt ----
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 32).toString('hex');
  return salt + ':' + hash;
}
function verifyPassword(password, stored) {
  const parts = String(stored || '').split(':');
  if (parts.length !== 2) return false;
  const [salt, hash] = parts;
  try {
    const test = crypto.scryptSync(String(password), salt, 32);
    const want = Buffer.from(hash, 'hex');
    return test.length === want.length && crypto.timingSafeEqual(test, want);
  } catch { return false; }
}

// ---- TOTP (RFC 6238): 6-digit codes from an authenticator app ----
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function generateTotpSecret() {
  const out = [];
  for (let i = 0; i < 20; i++) out.push(B32[crypto.randomInt(0, 32)]);
  return out.join('');
}
function base32Decode(s) {
  let bits = '';
  for (const c of String(s).toUpperCase()) {
    const i = B32.indexOf(c);
    if (i < 0) continue;
    bits += i.toString(2).padStart(5, '0');
  }
  const out = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(out);
}
function totpAt(secret, counter) {
  const key = base32Decode(secret);
  const h = crypto.createHmac('sha1', key)
    .update(Buffer.from(counter.toString(16).padStart(16, '0'), 'hex')).digest();
  const off = h[h.length - 1] & 0xf;
  const code = String(((h[off] & 0x7f) << 24 | h[off + 1] << 16 | h[off + 2] << 8 | h[off + 3]) % 1000000).padStart(6, '0');
  return code;
}
function verifyTotp(secret, code) {
  const c = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(c)) return false;
  const counter = Math.floor(Date.now() / 30000);
  for (const d of [-1, 0, 1]) {
    try { if (totpAt(secret, counter + d) === c) return true; } catch {}
  }
  return false;
}
function otpauthUri(secret, email) {
  const issuer = encodeURIComponent('Accurivo');
  const label = encodeURIComponent('Accurivo:' + (email || 'user'));
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

// ---- session ids ----
function newSessionId() {
  return crypto.randomBytes(24).toString('hex');
}

module.exports = { hashPassword, verifyPassword, generateTotpSecret, verifyTotp, otpauthUri, newSessionId };
