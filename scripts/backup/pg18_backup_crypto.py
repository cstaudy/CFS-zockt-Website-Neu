#!/usr/bin/env python3
"""Versioned authenticated encryption for a PostgreSQL custom dump.

The input is a local file. This utility never connects to PostgreSQL or GitHub.
Production use requires an independently generated, private 32-byte key supplied
via CFS_BACKUP_KEY_B64. Never pass the key as a CLI argument.
"""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import secrets
import sys
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

MAGIC = b"CFSBKP01"
AAD = b"CFS-Zockt-PostgreSQL18-backup-v1"
MAX_BYTES = 1024 * 1024 * 1024  # Avoid accidentally exhausting a runner's RAM.

def key_from_env():
    raw = os.environ.get("CFS_BACKUP_KEY_B64", "")
    try:
        key = base64.b64decode(raw, validate=True)
    except (ValueError, base64.binascii.Error):
        raise ValueError("CFS_BACKUP_KEY_B64 must be valid base64") from None
    if len(key) != 32:
        raise ValueError("CFS_BACKUP_KEY_B64 must decode to exactly 32 bytes")
    return key

def read_limited(path):
    if path.stat().st_size > MAX_BYTES:
        raise ValueError("Input exceeds 1 GiB; streaming implementation required")
    return path.read_bytes()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["encrypt", "decrypt"])
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    if args.destination.exists():
        raise ValueError("Refusing to overwrite destination")
    if args.source.resolve() == args.destination.resolve():
        raise ValueError("Input and output must differ")
    key = key_from_env()
    plaintext = read_limited(args.source) if args.mode == "encrypt" else None
    if args.mode == "encrypt":
        if not plaintext.startswith(b"PGDMP"):
            raise ValueError("Input is not a PostgreSQL custom-format dump")
        nonce = secrets.token_bytes(12)
        result = MAGIC + nonce + AESGCM(key).encrypt(nonce, plaintext, AAD)
    else:
        blob = read_limited(args.source)
        if not blob.startswith(MAGIC) or len(blob) < len(MAGIC) + 12 + 16:
            raise ValueError("Invalid encrypted backup format")
        result = AESGCM(key).decrypt(blob[8:20], blob[20:], AAD)
        if not result.startswith(b"PGDMP"):
            raise ValueError("Decrypted file is not a PostgreSQL custom-format dump")
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
    fd = os.open(args.destination, flags, 0o600)
    try:
        with os.fdopen(fd, "wb") as handle:
            handle.write(result)
    except BaseException:
        args.destination.unlink(missing_ok=True)
        raise
    print(json.dumps({"mode": args.mode, "bytes": len(result),
                      "sha256": hashlib.sha256(result).hexdigest()}))

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        # Do not print file contents or environment variables.
        print(f"Backup cryptography failed: {type(exc).__name__}", file=sys.stderr)
        sys.exit(1)
