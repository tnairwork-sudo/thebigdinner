#!/usr/bin/env python3
"""Build hashed Room allowlists.

Emails come from the accepted-email CSV (name, email, city, month).
Phones come from the SHA-256 map already compiled into the Room HTML.
Plaintext emails and phones are not written out.
"""
import csv
import hashlib
import json
import sys
from pathlib import Path


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def clean_name(name: str) -> str:
    raw = (name or "").strip()
    stripped = raw.lstrip("~").strip()
    return stripped or raw


def load_emails(csv_path: Path) -> dict:
    merged = {}
    with csv_path.open(newline="", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            raw = row.get("email") or ""
            parts = [part.strip().lower() for part in raw.replace(";", ",").split(",")]
            parts = [part for part in parts if part]
            city = (row.get("city") or "").strip()
            month = (row.get("month") or "").strip()
            list_name = clean_name(row.get("name") or "")
            for email in parts:
                if "@" not in email:
                    continue
                digest = sha256(email)
                current = merged.get(digest)
                if current is None:
                    merged[digest] = {
                        "city": city,
                        "months": [month] if month else [],
                        "listName": list_name,
                    }
                    continue
                if month and month not in current["months"]:
                    current["months"].append(month)
                if not current["city"] and city:
                    current["city"] = city
                if not current["listName"] and list_name:
                    current["listName"] = list_name
    return merged


def load_phones(html_path: Path) -> dict:
    for line in html_path.read_text(encoding="utf-8").splitlines():
        if line.startswith("const ALLOWLIST = "):
            payload = line[len("const ALLOWLIST = ") :].rstrip().rstrip(";")
            return json.loads(payload)
    raise SystemExit(f"no ALLOWLIST in {html_path}")


def write_module(path: Path, comment: str, const: str, data: dict, count_name: str) -> None:
    body = json.dumps(data, ensure_ascii=True, separators=(",", ":"))
    path.write_text(
        f"{comment}\nexport const {const} = {body};\nexport const {count_name} = {len(data)};\n",
        encoding="utf-8",
    )


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    csv_path = Path(sys.argv[1]) if len(sys.argv) > 1 else None
    html_path = root / "c27b141aa0bbb112ebe5405b" / "index.html"
    out = root / "lib" / "room"
    out.mkdir(parents=True, exist_ok=True)
    if csv_path:
        emails = load_emails(csv_path)
        write_module(
            out / "emails.js",
            "// Email allowlist. Keys are SHA-256 of the lowercase address. No plaintext emails.",
            "EMAILS",
            emails,
            "EMAIL_COUNT",
        )
        print(f"emails {len(emails)}")
    phones = load_phones(html_path)
    write_module(
        out / "phones.js",
        "// Phone allowlist. Keys are SHA-256 of the E.164 number. No plaintext phones.",
        "PHONES",
        phones,
        "PHONE_COUNT",
    )
    print(f"phones {len(phones)}")


if __name__ == "__main__":
    main()
