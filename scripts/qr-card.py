#!/usr/bin/env python3
"""A contact QR for a printed business card.

Different problem from assets/qr.py, and the difference is the payload. The
wine list is a 32-character URL, so its code is a version 4 and can be printed
at any size a table card allows. A vCard is 150-250 bytes, which pushes the
symbol to a version 9-17 — and a business card gives it about 20mm. That makes
**module size the whole design**, not error correction:

    payload            bytes  EC  ver  modules   mm/module at 18 / 20 / 25mm
    full vCard           256   M   12       73   0.25 / 0.27 / 0.34
    lean vCard           164   M    9       61   0.30 / 0.33 / 0.41
    MECARD                87   M    6       49   0.37 / 0.41 / 0.51

A phone camera wants roughly 0.4mm per module off paper, and below ~0.3mm it
starts failing in the light a restaurant actually has. So the full vCard, with
the postal address and a URL, is out at any size that fits a card: it looks
fine on screen and fails in a pocket.

What is written instead is a **lean vCard** — name, organisation, phone, email
— at error correction M, which lands at 0.41mm per module when printed at
25mm. vCard rather than the smaller MECARD because iOS reads vCard reliably
and MECARD unevenly, and the guest holding this card is as likely to be on an
iPhone as not. The address is on the printed card anyway, where a human can
read it; there is no reason to spend a third of the symbol on it.

Nothing personal is hard-coded here, and the output is written to a directory
that is not committed: the repo is public, and a mobile number handed to a
guest across a table is not the same thing as one indexed on the web.

    python scripts/qr-card.py --name "Ime Prezime" --tel "+385..." \\
        --email someone@example.com --org "Theatrium by Filho"
"""
import argparse
import re
import sys
from pathlib import Path

import segno

ROOT = Path(__file__).resolve().parent.parent
DARK = "#161513"
# What a phone camera needs off paper. Below the first number scanning gets
# unreliable in restaurant light; the second is comfortable.
MIN_MM, GOOD_MM = 0.33, 0.40


def vcard(name: str, org: str, tel: str, email: str) -> str:
    """A deliberately short vCard 3.0 — see the module docstring for why."""
    parts = name.split()
    last, first = (parts[-1], " ".join(parts[:-1])) if len(parts) > 1 else (name, "")
    lines = ["BEGIN:VCARD", "VERSION:3.0", f"N:{last};{first};;;", f"FN:{name}"]
    if org:
        lines.append(f"ORG:{org}")
    if tel:
        lines.append(f"TEL;TYPE=CELL:{tel}")
    if email:
        lines.append(f"EMAIL;TYPE=INTERNET:{email}")
    lines.append("END:VCARD")
    return "\r\n".join(lines) + "\r\n"


def card_html(name: str, org: str, tel_display: str, email: str, qr: str, mm: float) -> str:
    """A print-ready 85x55mm card, so the QR can be seen in place rather than
    judged as a square on its own. One side; the printer takes the SVG."""
    return f"""<!DOCTYPE html>
<html lang="hr">
<head>
<meta charset="utf-8">
<title>{name} — posjetnica</title>
<link href="https://fonts.googleapis.com/css2?family=Markazi+Text:wght@500;600&family=Raleway:wght@300;400;500&display=swap" rel="stylesheet">
<style>
  @page {{ size: 85mm 55mm; margin: 0; }}
  body {{ margin: 0; background: #6b6558; display: flex; align-items: center;
          justify-content: center; min-height: 100vh; font-family: "Raleway", sans-serif; }}
  .card {{
    width: 85mm; height: 55mm; box-sizing: border-box; padding: 6mm 6.5mm;
    background: #efe9dd; color: #161513;
    display: grid; grid-template-columns: 1fr auto; grid-template-rows: auto 1fr auto;
    column-gap: 5mm;
  }}
  .logo {{ width: 34mm; grid-column: 1; filter: invert(1); }}
  .who {{ grid-column: 1; align-self: center; }}
  .name {{ font-family: "Markazi Text", serif; font-size: 7.4mm; line-height: 1;
           letter-spacing: .02em; margin: 0 0 1mm; }}
  .role {{ font-size: 2.5mm; letter-spacing: .22em; text-transform: uppercase;
           color: #8a8270; margin: 0; }}
  .contact {{ grid-column: 1; font-size: 2.9mm; line-height: 1.55; color: #3c382f; }}
  .contact a {{ color: inherit; text-decoration: none; }}
  /* The code sits in its own column at the size it was measured for — shrink
     this and it stops scanning, which is the one thing a card cannot do. */
  .qr {{ grid-row: 1 / -1; grid-column: 2; align-self: center;
         width: {mm}mm; height: {mm}mm; }}
  .hint {{ grid-column: 2; font-size: 2mm; letter-spacing: .12em; text-align: center;
           text-transform: uppercase; color: #8a8270; margin: 1.5mm 0 0; }}
  @media screen {{ .card {{ box-shadow: 0 2mm 8mm rgba(0,0,0,.35); }} }}
</style>
</head>
<body>
  <div class="card">
    <img class="logo" src="../assets/theatrium-logo.svg" alt="{org}">
    <div class="who">
      <p class="name">{name}</p>
      <p class="role">{org}</p>
    </div>
    <div class="contact">
      <a href="tel:{tel_display.replace(' ', '')}">{tel_display}</a><br>
      <a href="mailto:{email}">{email}</a>
    </div>
    <img class="qr" src="{qr}" alt="QR — {name}">
  </div>
</body>
</html>
"""


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--name", required=True)
    ap.add_argument("--tel", required=True, help="E.164, e.g. +385911234567")
    ap.add_argument("--email", required=True)
    ap.add_argument("--org", default="")
    ap.add_argument("--slug", default="", help="file name stem; defaults from --name")
    ap.add_argument("--mm", type=float, default=25.0, help="printed size of the code")
    ap.add_argument("--out", default="cards", help="output dir (not committed)")
    a = ap.parse_args()

    if not re.fullmatch(r"\+\d{8,15}", a.tel):
        print(f"--tel should be E.164 with no spaces, e.g. +385911234567 (got {a.tel!r})",
              file=sys.stderr)
        return 1
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[A-Za-z]{2,}", a.email):
        print(f"--email has no domain: {a.email!r}", file=sys.stderr)
        return 1

    slug = a.slug or re.sub(r"[^a-z0-9]+", "-", a.name.lower()).strip("-")
    out = ROOT / a.out
    out.mkdir(parents=True, exist_ok=True)

    data = vcard(a.name, a.org, a.tel, a.email)
    qr = segno.make(data, error="m")
    modules = qr.symbol_size(scale=1, border=4)[0]
    per = a.mm / modules

    qr.save(out / f"{slug}.svg", scale=12, border=4, dark=DARK, light=None)
    qr.save(out / f"{slug}.png", scale=40, border=4, dark=DARK, light="#ffffff")

    # a readable phone number for the printed side, from the E.164 one
    d = a.tel
    pretty = f"{d[:4]} {d[4:6]} {d[6:9]} {d[9:]}" if d.startswith("+385") and len(d) == 13 else d
    (out / f"{slug}-card.html").write_text(
        card_html(a.name, a.org, pretty, a.email, f"{slug}.svg", a.mm), encoding="utf-8")

    print(f"vCard {len(data)} bytes -> version {qr.version}, {modules} modules")
    print(f"printed at {a.mm:g}mm that is {per:.2f}mm per module", end=" ")
    print("— comfortable" if per >= GOOD_MM else
          ("— readable, but do not go smaller" if per >= MIN_MM else
           "— TOO SMALL, print it bigger"))
    smallest = modules * MIN_MM
    print(f"never print this code below {smallest:.0f}mm")
    print(f"wrote {out.relative_to(ROOT)}/: {slug}.svg, {slug}.png, {slug}-card.html")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
