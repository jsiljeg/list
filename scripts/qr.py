#!/usr/bin/env python3
"""Regenerate the QR codes that point a guest's phone at the list.

Three files, one code:

  assets/qr.svg        vector, charcoal on transparent — what qr.html shows,
                       and the file to hand a printer for anything large.
  assets/qr.png        1.3k px, charcoal on white — for a screen or a slide.
  assets/qr-print.png  ~5k px, charcoal on white — a table card, a poster, a
                       window sticker. At 300 dpi that is a 42 cm square, so
                       nothing a restaurant prints will out-resolve it.

Error correction is H (30%): the code lives on a table, and a thumbprint, a
wine ring or a crease across it must not cost the guest the page. H is what
makes that affordable — the URL is short enough that the symbol stays a
version 4 (33x33 modules), the same size the old M-level code already was,
so the modules are no smaller and the scan is no harder.

The quiet zone is the spec's 4 modules. The old code shipped with 2, which
scanners mostly forgive and sometimes do not — and on a printed card there is
no way to tell which kind of phone is holding it.

    python scripts/qr.py            # write the three files
    python scripts/qr.py --check    # verify they decode back to the URL
"""
import sys
import segno

URL = "https://theatrium.list.devinos.hr"
DARK = "#161513"          # the app's charcoal
OUT = {
    "assets/qr.svg": dict(scale=12, light=None),
    "assets/qr.png": dict(scale=32, light="#ffffff"),
    "assets/qr-print.png": dict(scale=120, light="#ffffff"),
}


def build():
    qr = segno.make(URL, error="h", micro=False)
    for path, opts in OUT.items():
        qr.save(path, border=4, dark=DARK, **opts)
        print(f"{path}: version {qr.version}, {qr.symbol_size(scale=1, border=4)[0]} modules")
    return qr


def check():
    """Decode the PNGs back and compare. Needs pyzbar; skipped if absent."""
    try:
        from pyzbar.pyzbar import decode
        from PIL import Image
    except Exception as exc:                      # noqa: BLE001
        print(f"decode check skipped ({exc})")
        return 0
    bad = 0
    for path in ("assets/qr.png", "assets/qr-print.png"):
        found = [d.data.decode() for d in decode(Image.open(path))]
        ok = found == [URL]
        print(f"{'OK ' if ok else 'FAIL'} {path} -> {found}")
        bad += not ok
    return bad


if __name__ == "__main__":
    if "--check" not in sys.argv:
        build()
    raise SystemExit(check())
