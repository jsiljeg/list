# -*- coding: utf-8 -*-
"""Screenshot the app in a real browser, so visual work stops being guesswork.

jsdom tells us the structure rendered; it never paints, so opacity, contrast,
crop and overlap are invisible to it. This boots a throwaway static server and a
headless Chromium, walks the app into each state worth looking at, and writes
PNGs to a directory.

    python scripts/shot.py                       # every state, every viewport
    python scripts/shot.py story                 # one state
    python scripts/shot.py story --vp tablet     # one state, one viewport
    python scripts/shot.py --out shots/before    # somewhere to diff against

States: start, story, list, detail, ikone, search.
Viewports: tablet 1024x768, laptop 1440x900, phone 390x844.

Needs `pip install playwright` and `playwright install chromium`.
"""
import argparse
import functools
import http.server
import os
import socketserver
import sys
import threading

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VIEWPORTS = {
    "tablet": dict(width=1024, height=768, is_mobile=False),
    "laptop": dict(width=1440, height=900, is_mobile=False),
    "phone": dict(width=390, height=844, is_mobile=True),
}


def serve():
    """A quiet static server on a free port, daemonised."""
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a, **k):
            pass

    handler = functools.partial(Quiet, directory=ROOT)
    srv = socketserver.TCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return "http://127.0.0.1:%d" % srv.server_address[1]


def enter(page, base, lang="hr"):
    """Language screen → story splash. Returns with the splash on screen."""
    page.goto(base + "/index.html", wait_until="networkidle")
    page.evaluate("localStorage.clear()")
    page.goto(base + "/index.html", wait_until="networkidle")
    page.click('#lang-buttons button[data-lang="%s"]' % lang)
    page.wait_for_selector("#story-screen:not(.hidden)")
    page.wait_for_timeout(400)


def to_list(page):
    page.click("#story-enter")
    page.wait_for_selector("#app:not(.hidden)")
    page.wait_for_timeout(400)


STATES = {}


def state(fn):
    STATES[fn.__name__] = fn
    return fn


@state
def start(page, base):
    page.goto(base + "/index.html", wait_until="networkidle")
    page.evaluate("localStorage.clear()")
    page.goto(base + "/index.html", wait_until="networkidle")
    page.wait_for_selector("#start:not(.hidden)")
    page.wait_for_timeout(600)          # let the logo breathe animation settle


@state
def story(page, base):
    enter(page, base)


@state
def list(page, base):
    enter(page, base)
    to_list(page)


@state
def detail(page, base):
    enter(page, base)
    to_list(page)
    page.click(".item")
    page.wait_for_selector("#modal:not(.hidden)")
    page.wait_for_timeout(500)


@state
def ikone(page, base):
    enter(page, base)
    to_list(page)
    page.click("#pride-toggle")
    page.wait_for_timeout(500)


@state
def spirit(page, base):
    """A spirit card — a different set of fields and a different glass from a
    wine, so it needs looking at on its own."""
    enter(page, base)
    to_list(page)
    page.click("#search-toggle")
    page.fill("#search", "hampden")
    page.wait_for_timeout(400)
    page.click(".item.clickable")
    page.wait_for_selector("#modal:not(.hidden)")
    page.wait_for_timeout(500)


@state
def search(page, base):
    enter(page, base)
    to_list(page)
    page.click("#search-toggle")
    page.fill("#search", "barolo")
    page.wait_for_timeout(500)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("states", nargs="*", default=None,
                    help="states to shoot (default: all of %s)" % ", ".join(STATES))
    ap.add_argument("--vp", action="append", choices=sorted(VIEWPORTS),
                    help="viewport(s) to use (default: all)")
    ap.add_argument("--out", default="shots", help="output directory")
    ap.add_argument("--full", action="store_true", help="full-page instead of viewport-only")
    args = ap.parse_args()

    want = args.states or sorted(STATES)
    bad = [s for s in want if s not in STATES]
    if bad:
        sys.exit("unknown state(s): %s — pick from %s" % (", ".join(bad), ", ".join(sorted(STATES))))
    vps = args.vp or sorted(VIEWPORTS)

    os.makedirs(args.out, exist_ok=True)
    base = serve()
    written = []
    with sync_playwright() as p:
        # PW_CHROMIUM lets a machine whose Chromium build doesn't match the
        # installed playwright package point at the browser it does have,
        # instead of downloading a second ~120 MB copy.
        exe = os.environ.get("PW_CHROMIUM")
        browser = p.chromium.launch(executable_path=exe) if exe else p.chromium.launch()
        for vp in vps:
            cfg = dict(VIEWPORTS[vp])
            mobile = cfg.pop("is_mobile")
            ctx = browser.new_context(viewport=cfg, is_mobile=mobile,
                                      has_touch=mobile, device_scale_factor=2,
                                      reduced_motion="reduce")
            page = ctx.new_page()
            errs = []
            page.on("pageerror", lambda e: errs.append(str(e)))
            page.on("console", lambda m: errs.append("console.%s: %s" % (m.type, m.text))
                    if m.type == "error" else None)
            for name in want:
                STATES[name](page, base)
                path = os.path.join(args.out, "%s-%s.png" % (name, vp))
                page.screenshot(path=path, full_page=args.full)
                written.append((path, os.path.getsize(path)))
            ctx.close()
            for e in dict.fromkeys(errs):          # de-duplicated, order kept
                print("  ! %s [%s]" % (e, vp))
        browser.close()

    for path, size in written:
        print("%s  %.0f kB" % (path, size / 1024))


if __name__ == "__main__":
    main()
