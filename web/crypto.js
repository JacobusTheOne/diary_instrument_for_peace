/*
 * Encryption for the Encrypted Notebook web app.
 *
 * Two file formats:
 *   v2      - the web format. PBKDF2-SHA256 (600k iterations, random salt)
 *             -> AES-256-GCM. Stored as a small JSON envelope.
 *   fernet  - the format written by encrypted_notebook.py: a Fernet token whose
 *             key is base64(SHA-256(password)). Supported so the same files open
 *             in both apps. Weaker (no salt, one hash), so v2 is the default.
 *
 * Everything runs in the browser through WebCrypto; nothing is sent anywhere.
 * Works in Node 18+ too (globalThis.crypto), which the tests rely on.
 */
(function (root) {
  'use strict';

  const subtle = root.crypto.subtle;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const FORMAT_ID = 'encrypted-notebook';
  const PBKDF2_ITERATIONS = 600000;
  const AAD = encoder.encode(FORMAT_ID + ':2');

  class DecryptError extends Error {
    // code: 'wrong-password' or 'invalid-file', so pages can show their own wording.
    constructor(message, code) {
      super(message || 'Wrong password, or the file is damaged.');
      this.name = 'DecryptError';
      this.code = code || 'wrong-password';
    }
  }

  // ---------- encoding helpers ----------

  function b64encode(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(s);
  }

  function b64decode(str) {
    const s = atob(str);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }

  // Fernet uses URL-safe base64 *with* padding.
  const b64urlEncode = (bytes) => b64encode(bytes).replace(/\+/g, '-').replace(/\//g, '_');
  const b64urlDecode = (str) => b64decode(str.replace(/-/g, '+').replace(/_/g, '/'));

  const randomBytes = (n) => root.crypto.getRandomValues(new Uint8Array(n));

  // ---------- key derivation ----------

  async function deriveV2Key(password, salt, iterations) {
    const base = await subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
    return subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
      base,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // Matches password_to_key() in encrypted_notebook.py: the 32-byte SHA-256 digest
  // is the Fernet key; first half signs (HMAC-SHA256), second half encrypts (AES-128-CBC).
  async function deriveFernetKeys(password) {
    const digest = new Uint8Array(await subtle.digest('SHA-256', encoder.encode(password)));
    const sign = await subtle.importKey('raw', digest.slice(0, 16), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
    const aes = await subtle.importKey('raw', digest.slice(16), { name: 'AES-CBC' }, false, ['encrypt', 'decrypt']);
    return { sign, aes };
  }

  async function newV2Key(password) {
    const salt = randomBytes(16);
    return { key: await deriveV2Key(password, salt, PBKDF2_ITERATIONS), salt, iterations: PBKDF2_ITERATIONS };
  }

  // ---------- v2 ----------

  async function sealV2(v2, plaintext) {
    const iv = randomBytes(12);
    const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: AAD }, v2.key, encoder.encode(plaintext)));
    return JSON.stringify({
      format: FORMAT_ID,
      version: 2,
      kdf: 'PBKDF2-SHA256',
      iterations: v2.iterations,
      salt: b64encode(v2.salt),
      iv: b64encode(iv),
      data: b64encode(ct),
    });
  }

  function parseV2(text) {
    let env;
    try { env = JSON.parse(text); } catch (e) { return null; }
    if (!env || env.format !== FORMAT_ID || env.version !== 2) return null;
    return env;
  }

  async function openV2(env, password) {
    const salt = b64decode(env.salt);
    const v2 = { key: await deriveV2Key(password, salt, env.iterations), salt, iterations: env.iterations };
    try {
      const pt = await subtle.decrypt({ name: 'AES-GCM', iv: b64decode(env.iv), additionalData: AAD }, v2.key, b64decode(env.data));
      return { v2, plaintext: decoder.decode(pt) };
    } catch (e) {
      throw new DecryptError();
    }
  }

  // ---------- fernet ----------

  async function sealFernet(keys, plaintext) {
    const header = new Uint8Array(25);
    header[0] = 0x80;
    const ts = BigInt(Math.floor(Date.now() / 1000));
    new DataView(header.buffer).setBigUint64(1, ts, false);
    const iv = randomBytes(16);
    header.set(iv, 9);
    const ct = new Uint8Array(await subtle.encrypt({ name: 'AES-CBC', iv }, keys.aes, encoder.encode(plaintext)));
    const body = new Uint8Array(header.length + ct.length);
    body.set(header);
    body.set(ct, header.length);
    const mac = new Uint8Array(await subtle.sign('HMAC', keys.sign, body));
    const token = new Uint8Array(body.length + mac.length);
    token.set(body);
    token.set(mac, body.length);
    return b64urlEncode(token);
  }

  async function openFernet(token, password) {
    let data;
    try { data = b64urlDecode(token.trim()); } catch (e) { throw new DecryptError('This file is not a valid encrypted notebook.', 'invalid-file'); }
    if (data.length < 57 || data[0] !== 0x80) throw new DecryptError('This file is not a valid encrypted notebook.', 'invalid-file');
    const keys = await deriveFernetKeys(password);
    const ok = await subtle.verify('HMAC', keys.sign, data.slice(-32), data.slice(0, -32));
    if (!ok) throw new DecryptError();
    try {
      const pt = await subtle.decrypt({ name: 'AES-CBC', iv: data.slice(9, 25) }, keys.aes, data.slice(25, -32));
      return { fernet: keys, plaintext: decoder.decode(pt) };
    } catch (e) {
      throw new DecryptError();
    }
  }

  // ---------- public API ----------

  /** 'v2', 'fernet', or null if the text doesn't look like either format. */
  function detect(text) {
    if (parseV2(text)) return 'v2';
    if (/^gAAAAA[A-Za-z0-9_=-]+$/.test(text.trim())) return 'fernet';
    return null;
  }

  /**
   * A session holds derived keys (never the password) for both formats, so the
   * app can save in either format and keep a v2 browser copy without asking again.
   */
  async function createSession(password, format) {
    const [v2, fernet] = await Promise.all([newV2Key(password), deriveFernetKeys(password)]);
    return { format: format === 'fernet' ? 'fernet' : 'v2', v2, fernet };
  }

  /** Decrypt a file's text. Returns { session, plaintext, format }. Throws DecryptError. */
  async function unlock(fileText, password) {
    const format = detect(fileText);
    if (format === 'v2') {
      const { v2, plaintext } = await openV2(parseV2(fileText), password);
      return { session: { format, v2, fernet: await deriveFernetKeys(password) }, plaintext, format };
    }
    if (format === 'fernet') {
      const { fernet, plaintext } = await openFernet(fileText, password);
      return { session: { format, v2: await newV2Key(password), fernet }, plaintext, format };
    }
    throw new DecryptError('This file is not a valid encrypted notebook.', 'invalid-file');
  }

  /** Encrypt plaintext into file text, in the session's format unless one is given. */
  function seal(session, plaintext, format) {
    return (format || session.format) === 'fernet' ? sealFernet(session.fernet, plaintext) : sealV2(session.v2, plaintext);
  }

  root.NBCrypto = { detect, createSession, unlock, seal, DecryptError };
})(typeof window !== 'undefined' ? window : globalThis);
