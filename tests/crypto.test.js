// Round-trip tests for web/crypto.js, including interop with encrypted_notebook.py.
// Run from the project folder:  node tests/crypto.test.js
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
require('../web/crypto.js');
const { NBCrypto } = globalThis;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'enb-'));
// Needs a Python with the cryptography package; set PYTHON to pick one.
const py = (...args) => execFileSync(process.env.PYTHON || 'python', [path.join(__dirname, 'make_fernet.py'), ...args]);
const text = 'Dear diary — héllo ✨\nSecond line.\n';

(async () => {
  // v2 round trip
  const s = await NBCrypto.createSession('pw1', 'v2');
  const v2File = await NBCrypto.seal(s, text);
  assert.strictEqual(NBCrypto.detect(v2File), 'v2');
  assert.strictEqual((await NBCrypto.unlock(v2File, 'pw1')).plaintext, text);
  await assert.rejects(NBCrypto.unlock(v2File, 'nope'), { name: 'DecryptError' });
  console.log('ok  v2 round trip + wrong password rejected');

  // Python writes -> web reads
  const pyFile = path.join(tmp, 'from_python.enc');
  py('write', pyFile, 'secret', text);
  const pyText = fs.readFileSync(pyFile, 'utf8');
  assert.strictEqual(NBCrypto.detect(pyText), 'fernet');
  const opened = await NBCrypto.unlock(pyText, 'secret');
  assert.strictEqual(opened.plaintext, text);
  assert.strictEqual(opened.session.format, 'fernet');
  await assert.rejects(NBCrypto.unlock(pyText, 'wrong'), { name: 'DecryptError' });
  console.log('ok  Python-written file opens in web app');

  // web writes fernet -> Python reads
  const webFile = path.join(tmp, 'from_web.enc');
  fs.writeFileSync(webFile, await NBCrypto.seal(opened.session, text));
  assert.strictEqual(py('read', webFile, 'secret').toString('utf8'), text);
  console.log('ok  web-written Python-compatible file opens in Python');

  // same session can also write v2 (used for the browser copy)
  const v2FromFernet = await NBCrypto.seal(opened.session, text, 'v2');
  assert.strictEqual((await NBCrypto.unlock(v2FromFernet, 'secret')).plaintext, text);
  console.log('ok  fernet session can seal v2');
  fs.rmSync(tmp, { recursive: true, force: true });
})().catch((e) => { console.error(e); process.exit(1); });
