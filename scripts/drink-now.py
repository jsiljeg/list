# -*- coding: utf-8 -*-
"""Dry run: derive "Za piti sada" from region + classification + age.

Nothing is written. Prints what would change against today's tags.
"""
import io, json, re

import winedata

NOW = 2026

def years(name, region, style, grape):
    """Years after the vintage before the wine is generally ready."""
    n, r = name or "", region or ""
    gc  = bool(re.search(r"Grand Cru|Grand cru", n))
    pc  = bool(re.search(r"1er Cru|Premier Cru", n))
    red = str(style).startswith("red")

    if "Sauternes" in r:                                   return 10
    if "Champagne" in r:                                   return 8 if re.search(r"(19|20)\d\d", n) else 0
    if "Bourgogne" in r or "Chablis" in r:
        if not red:                                        return 5 if (gc or pc) else 3
        return 10 if gc else 5 if pc else 3
    if re.search(r"Médoc|Pauillac|Margaux|Saint-Julien|Saint-Estèphe|Pessac", r): return 10
    if re.search(r"Saint-Émilion|Pomerol|Libournais", r):  return 8
    if re.search(r"Barolo|Barbaresco", r):                 return 10
    if "Montalcino" in r:                                  return 8
    if re.search(r"Bolgheri|Costa Toscana|Maremma", r):    return 8
    if re.search(r"Valpolicella", r):                      return 5
    if "Toscana" in r or "Chianti" in r:                   return 6
    if "Rioja" in r:                                       return 3          # released ready
    if "Ribera del Duero" in r:                            return 6
    if re.search(r"Napa|Sonoma|Santa Cruz|Spring Mountain|Mount Veeder|Alexander", r):
        return 8 if red and "Merlot" not in (grape or "") else 5
    if re.search(r"Oregon|Willamette|Sta\. Rita|Eola|Freestone", r):        return 4
    if re.search(r"Mosel|Rheinhessen|Pfalz", r):
        if style == "sweet":                               return 8
        return 5 if "GG" in n else 3
    if re.search(r"Alsace|Loire|Jura|Sancerre", r):        return 5
    if re.search(r"Friuli|Collio|Gorizia|Kras|Oslavia", r):return 5
    if r.endswith("Piemonte") or "Alto Piemonte" in r:     return 6
    if re.search(r"Dalmacija|Istra|Plešivica|Zagorje|Moslavina|Slavonija|Hrvatsk", r):
        return 4 if red else 2
    if re.search(r"Goriška|Primorska|Štajerska", r):       return 4 if red else 3
    return 6 if red else 3

d = winedata.load_list()   # library + venue list, joined
seen, rows = set(), []
def walk(n):
    if isinstance(n, list):
        for x in n: walk(x)
    elif isinstance(n, dict):
        if "insight" in n and "name" in n:
            k = (n.get("producer"), n["name"])
            if k not in seen:
                seen.add(k)
                i = n["insight"]
                m = re.search(r"(19|20)\d\d", n["name"])
                y = int(m.group(0)) if m else None
                has = "drinking_now" in (n.get("tags") or [])
                if y is None:
                    want = str(i.get("style")) in ("sweet",) or "Champagne" in str(i.get("region"))
                    thr = 0
                else:
                    thr = years(n["name"], i.get("region"), i.get("style"), i.get("grape"))
                    want = (NOW - y) >= thr
                rows.append((n.get("producer",""), n["name"], y, thr, i.get("region",""),
                             str(i.get("style")), has, want))
        for v in n.values(): walk(v)
walk(d)

add  = [r for r in rows if r[7] and not r[6]]
drop = [r for r in rows if r[6] and not r[7]]
keep = [r for r in rows if r[6] and r[7]]
print("today: %d tagged.   model: %d tagged.   (+%d, -%d, %d unchanged)\n"
      % (sum(1 for r in rows if r[6]), sum(1 for r in rows if r[7]), len(add), len(drop), len(keep)))
print("=== WOULD LOSE THE TAG (%d) ===" % len(drop))
for r in sorted(drop, key=lambda r: -(r[2] or 0)):
    print("   %s  %-40s %-34s  treba %2d god, ima %s" % (r[2], r[1][:40], r[4][:34], r[3], (NOW - r[2]) if r[2] else "—"))
print("\n=== WOULD GAIN IT (%d) — first 40 ===" % len(add))
for r in sorted(add, key=lambda r: -(r[2] or 0))[:40]:
    print("   %s  %-40s %-34s  treba %2d god" % (r[2] or "----", r[1][:40], r[4][:34], r[3]))
