# Kako urediti vinsku kartu (upute za vlasnika)

Svaka spremljena promjena automatski se objavljuje na
**https://theatrium.list.devinos.hr** za otprilike jednu minutu. Tableti
sami povuku novu verziju čim budu 3 minute bez korištenja.

## Tri datoteke i što je u kojoj

| Datoteka | Što je unutra | Kad je dirate |
|---|---|---|
| `lists/theatrium.json` | **Karta**: koje je vino gdje, cijena, ★, NOVO, redoslijed | Najčešće — cijene i ponuda |
| `library/wines.json` | **Vina**: sorta, položaj, alkohol, arome, ocjene, Filhov citat | Kad ispravljate podatak o vinu |
| `data/unavailable.json` | **Čega trenutno nema** | Kad vino nestane / se vrati |

Zašto podijeljeno: ono *što vino jest* isto je u svakom restoranu, a
*cijena i mjesto na karti* nisu. Tako se za drugu kartu vina ne prepisuju
ponovno, nego se samo posloži nova `lists/…` datoteka. Usput je nestala i
jedna tiha greška: vino koje se toči i na čašu i na bocu bilo je upisano
**dvaput**, pa su se dva zapisa znala razići (jedan je pisao „Meneghetti
White", drugi „Meneghetti white"). Sada je vino jedno, s dvije cijene.

## Kako doći do datoteke

1. Otvorite **github.com/jsiljeg/list** i prijavite se (potreban je GitHub
   račun s pravom uređivanja — Jure vas dodaje kao suradnika).
2. Kliknite mapu iz tablice gore → datoteku → ikonu **olovke** (Edit)
   gore desno.
3. Napravite promjenu, kliknite **Commit changes** (zeleni gumb), gotovo.

Vino u karti (`lists/theatrium.json`) izgleda ovako — `ref` je „šifra"
vina u knjižnici, ostalo je vaše:
```json
{ "ref": "meneghetti--blanc-de-blancs", "price": 9, "recommended": true },
```
`ref` ne mijenjajte. Ako se upiše `ref` kojeg nema u knjižnici, provjera
prije objave to odbija — jer bi vino inače nestalo s karte, a da nitko ne
primijeti.

**Sigurnosna mreža:** prije objave sustav automatski provjerava datoteku.
Ako se negdje potkrade greška (npr. obrisan zarez), stara karta ostaje
online, a nova se ne objavljuje — ništa se ne može "srušiti". Grešku
vidite pod karticom **Actions** (crveni X, s opisom što je krivo).

## Najčešći zadaci

> **Gdje?** Cijena, ★ i NOVO su u `lists/theatrium.json`. Sve ostalo
> (sorta, arome, citat, ocjene, oznake) je u `library/wines.json`.

### Promijeniti cijenu → `lists/theatrium.json`
Nađite vino (Ctrl+F / ⌘+F) i promijenite broj — **bez navodnika i bez €**:
```json
{ "ref": "kunjas--posip-2024", "price": 49 },
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

### Dodati novo vino → **dvije datoteke**
Novo vino se prvo opiše u knjižnici, pa se stavi na kartu.

**1) `library/wines.json`** — dodajte zapis. „Šifra" (`ref`) je
`vinar--ime-vina`, malim slovima, bez kvačica, razmaci u crticu:
```json
"kunjas--posip-2024": {
 "name": "Pošip 2024",
 "producer": "Kunjas",
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

**2) `lists/theatrium.json`** — stavite ga na kartu, u željenu kategoriju
i na željeno mjesto u redoslijedu:
```json
{ "ref": "kunjas--posip-2024", "price": 52, "new": true },
```

Pazite na **zarez** iza `},` — svaki zapis osim zadnjeg u popisu ima
zarez. Ako se `ref` u dvije datoteke ne poklapa, provjera prije objave
javlja grešku i stara karta ostaje online.

**Vino koje se toči i na čašu i na bocu** upisuje se u knjižnicu **jednom**,
a u kartu dvaput — u „Vina na čašu" i u odgovarajuću kategoriju boca, s
različitim cijenama i istim `ref`-om. Tako se opis ne može razići.

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

### Obrisati vino s karte
Obrišite mu redak (`{ "ref": …, "price": … },`) iz `lists/theatrium.json`.
Ako je bio zadnji u popisu, prethodnom obrišite zarez iza `}`.

**Zapis u knjižnici namjerno ostaje** — sav trud oko opisa, aroma i ocjena
čeka spreman ako vino jednom vratite ili ga stavite na neku drugu kartu.
Ne zauzima ništa i gost ga ne vidi.

Ako vino samo trenutno nemate, ne brišite ga — koristite postupak iznad.

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
