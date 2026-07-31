# Kako urediti vinsku kartu (upute za vlasnika)

Karta se uređuje u **jednoj datoteci**: `data/wines.json`. Svaka spremljena
promjena automatski se objavljuje na **https://theatrium.list.devinos.hr**
za otprilike jednu minutu. Tableti sami povuku novu verziju čim budu
3 minute bez korištenja.

## Kako doći do datoteke

1. Otvorite **github.com/jsiljeg/list** i prijavite se (potreban je GitHub
   račun s pravom uređivanja — Jure vas dodaje kao suradnika).
2. Kliknite `data` → `wines.json` → ikonu **olovke** (Edit) gore desno.
3. Napravite promjenu, kliknite **Commit changes** (zeleni gumb), gotovo.

**Sigurnosna mreža:** prije objave sustav automatski provjerava datoteku.
Ako se negdje potkrade greška (npr. obrisan zarez), stara karta ostaje
online, a nova se ne objavljuje — ništa se ne može "srušiti". Grešku
vidite pod karticom **Actions** (crveni X, s opisom što je krivo).

## Najčešći zadaci

### Promijeniti cijenu
Nađite vino (Ctrl+F / ⌘+F) i promijenite broj — **bez navodnika i bez €**:
```json
"price": 49,
```

### Označiti / maknuti "Filho preporučuje" ★
Dodajte ili obrišite ovaj redak unutar vina:
```json
"recommended": true,
```

### Istaknuti novo vino u ponudi ("NOVO")
Dodajte redak:
```json
"new": true,
```
Vino dobiva zlatnu oznaku **NOVO** u popisu i u detaljima te se, uz
označena ★ vina, pojavljuje u pregledu **„Filhov izbor"** (gumb u
zaglavlju). Kad vino više nije novost, samo obrišite taj redak.

### Filhova rečenica o vinu (citat u detaljima vina)
Vino može imati Filhov citat koji se prikazuje u detaljima, na svih
5 jezika. Zvjezdicom označena vina već ga imaju — slobodno prepravite
tekst svojim riječima:
```json
"note": {
 "hr": "Pošip iz kamena Pelješca — živac i mineralnost, bez šminke.",
 "en": "Pošip from the stone of Pelješac — nerve and minerality, nothing cosmetic.",
 "it": "…", "fr": "…", "de": "…"
},
```

### Dodati oznaku vintagea / rijetkosti (bedž)
Dodajte polje `tags` s jednom ili više vrijednosti:
```json
"tags": ["legendary_vintage", "rare"],
```
Dopušteno: `legendary_vintage` (legendarna berba), `excellent_vintage`
(izvrsna berba), `rare` (rijetka boca), `drinking_now` (za piti sada).
Prikazuju se kao zlatni/ljubičasti bedževi u detaljima vina.

### Tekst o vinaru (prikazuje se u detaljima svih njegovih vina)
Uređuje se u zasebnoj datoteci `data/producers.json`, po vinaru (ne po
vinu). Nađite vinara po imenu ili dodajte novog:
```json
"Miloš": {
 "region": "Pelješac, Dalmacija",
 "blurb": { "hr": "…", "en": "…", "it": "…", "fr": "…", "de": "…", "zh": "…" }
}
```
Ime vinara mora se podudarati s onim u `wines.json` (dovoljno je da je
sadržano — npr. ključ `"Clai"` pokriva i `"Giorgio Clai"`).

### Preporuka jela uz vino
Ovo se **ne uređuje ručno** — aplikacija sama predlaže 1–2 jela iz
menija (`data/menu.json`) prema profilu vina. Ako se promijeni jelovnik,
uredite `data/menu.json` (ista pravila kao za vina: `pairings` i
`styles` su ključne riječi iz `js/i18n.js`).

### Dodati ocjenu kritičara
```json
"ratings": [
 { "critic": "James Suckling", "score": "97" },
 { "critic": "Wine Advocate", "score": "96" }
],
```

### Dodati novo vino
Kopirajte postojeće vino iz iste kategorije (od `{` do `},`) i promijenite
podatke. Primjer:
```json
{
 "name": "Pošip 2024",
 "producer": "Kunjas",
 "price": 52,
 "insight": {
  "grape": "Pošip",
  "region": "Dalmacija",
  "country": "HR",
  "style": "white_fresh",
  "body": "medium",
  "aromas": ["citrus", "peach", "saline"],
  "pairings": ["seafood", "grilled_fish", "risotto"],
  "temp": "10–12"
 }
},
```
Pazite na **zarez** iza `},` — svako vino osim zadnjeg u popisu ima zarez.

### Privremeno sakriti vino (nema ga danas, ima ga sutra)
**Ne dirajte `wines.json`.** Sve se radi u maloj datoteci
`data/unavailable.json`, koja je popis onoga što gosti trenutno **ne**
vide. Vino ostaje zapisano sa svime što smo o njemu napisali — samo se ne
prikazuje.

Otvorite `data` → `unavailable.json` → olovka, i unutar `"hidden": [ ]`
dodajte redak po vinu:
```json
{
 "hidden": [
  { "producer": "Meneghetti", "name": "Blanc de Blancs", "since": "2026-08-01", "reason": "rasprodano" }
 ]
}
```
- `name` — **točno** kako piše u karti, s godištem (`"Red 2020"`).
- `producer` — vinar; može se izostaviti ako samo jedan ima vino tog imena.
- `since` i `reason` — samo za vas i vašu evidenciju; gost ih ne vidi.
- `where` — dodajte `"where": "glass"` ako vino nestaje samo iz ponude na
  čaše, a i dalje se prodaje na boce (ili `"bottle"` za obrnuto). Bez tog
  retka vino nestaje odasvud.

**Vraćanje vina u kartu:** obrišite njegov redak. Ništa više.

Ako se potkrade tipfeler u imenu, provjera prije objave to **odbija** i
javlja koje ime ne postoji — da se ne dogodi da mislite kako je vino
skriveno, a gost ga i dalje vidi na karti.

Kategorija koja ostane prazna (npr. sakrijete jedini rosé) sama nestaje
iz izbornika i vraća se kad vino vratite.

**Evidencija:** trenutno stanje uvijek vidite na jednom mjestu — u toj
datoteci. Povijest tko je što i kada sakrio i vratio stoji pod **History**
te datoteke na GitHubu.

### Obrisati vino
Za trajno brisanje (vino više nikad ne uzimamo) obrišite cijeli blok od
`{` do `},` (uključivo) u `wines.json`. Ako je bilo zadnje u popisu,
prethodnom vinu obrišite zarez iza `}`. Ako vino samo trenutno nemate,
koristite postupak iznad.

### Urediti opis vina (sorta, arome, sljubljivanje…)
- `grape`, `region`, `temp` — slobodan tekst, upišite što želite.
- `style`, `body`, `aromas`, `pairings` — **ključne riječi** koje se same
  prevode na svih 5 jezika. Dopuštene vrijednosti su popisane u
  `js/i18n.js` (sekcije `styles`, `bodies`, `aromas`, `pairings`).
  Npr. arome: `citrus`, `cherry`, `honey`, `mineral`…; jela: `steak`,
  `seafood`, `pasta`, `cheese_hard`… Ako upišete nepostojeću ključnu
  riječ, provjera će vas upozoriti i ništa se neće objaviti.

## Ostalo što se može urediti

- **Priča na naslovnici i svi prijevodi**: `js/i18n.js` (sekcija `story`
  za svaki jezik).
- **Oznaka "Filho preporučuje" u drugi tekst** (npr. "Filip preporučuje"):
  u `js/i18n.js` promijenite `recommended:` u svakom od 5 jezika.

## Ako nešto pođe po zlu

Svaka promjena je zapamćena. Na github.com/jsiljeg/list → **History**
(povijest datoteke) možete vidjeti svaku verziju i vratiti staru — ili
javite Juri i vraća se jednom naredbom.
