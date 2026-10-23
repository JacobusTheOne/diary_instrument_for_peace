# Writes a Fernet file exactly the way encrypted_notebook.py does, then
# optionally decrypts one written by the web app. Usage:
#   python make_fernet.py write <out> <password> <text>
#   python make_fernet.py read  <in>  <password>
import sys, base64, hashlib
from cryptography.fernet import Fernet

def key(pw):
    return base64.urlsafe_b64encode(hashlib.sha256(pw.encode()).digest())

mode, path, pw = sys.argv[1:4]
if mode == "write":
    with open(path, "wb") as f:
        f.write(Fernet(key(pw)).encrypt(sys.argv[4].encode("utf-8")))
else:
    with open(path, "rb") as f:
        sys.stdout.buffer.write(Fernet(key(pw)).decrypt(f.read()))
