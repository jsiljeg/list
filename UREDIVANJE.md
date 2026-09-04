# Kako urediti vinsku kartu (upute za vlasnika)

Svaka spremljena promjena automatski se objavljuje na
**https://theatrium.list.devinos.hr** za otprilike pola minute.

Koliko treba da promjena stigne do tableta u ruci gosta:

| Promjena | Do gosta |
|---|---|
| **Sakriveno / vraćeno vino** | **do minute** — i dok gost čita, bez ijednog dodira |
| **Cijena, novo vino, opis, citat** | **do minute** — isto tako |
| Izgled aplikacije, prijevodi sučelja, pretraga | 3–4 min (tablet se sam osvježi nakon 3 min mirovanja) |

Tablet svakih 30 sekundi provjeri je li se karta promijenila i, ako jest,
sam se osvježi — gost to ne primijeti, ostaje na istom mjestu u popisu.
Samo promjene u samom *programu* (ne u podacima o vinima) čekaju da tablet
odmori 3 minute.

Dvije iznimke, da ne bude iznenađenja: tablet **bez interneta** prikazuje
zadnje što je vidio (namjerno — karta radi i kad padne Wi-Fi), a ako gost
baš u tom trenutku ima **otvorene detalje vina**, promjena čeka da ih
zatvori (ne otimamo mu karticu ispod prsta).

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

### Veličina boce (0,375 l, magnum, klavlin…) → `lists/theatrium.json`
Veličina **nije dio imena vina** nego podatak o boci koju prodajemo, pa se
piše uz cijenu, u litrama, kao broj s **točkom** (ne zarezom) i bez „l":
```json
{ "ref": "clai--tasel", "price": 64, "vol": 0.375 },
```
Aplikacija sama ispiše `0,375 l` gostu koji čita hrvatski i `0.375 l`
onome koji čita engleski.

Zato **isto vino u dvije veličine ima jedan zapis u knjižnici i dva retka
u karti** — magnum i obična boca, s različitom cijenom i različitim `vol`:
```json
{ "ref": "chiara-condello--predappio-sangiovese-2023", "price": 145 },
{ "ref": "chiara-condello--predappio-sangiovese-2023", "price": 290, "vol": 1.5 },
```
Ako `vol` nema, aplikacija ne piše ništa — to je obična boca od 0,75 l.

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
 { "critic": "Robert Parker", "score": "96" }
],
```
Ime kritičara pišite točno ovako: **Robert Parker** (ne „Wine Advocate"),
James Suckling, Wine Spectator, Wine Enthusiast, Vinous, Decanter,
Falstaff, Jancis Robinson (uvijek `NN/20`). Provjera prije objave odbija
ime izvan tog popisa.

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

### Privremeno sakriti vino — **najlakši način: /admin**

Otvorite **https://theatrium.list.devinos.hr/admin.html** na tabletu iza
šanka. Upišete PIN, i dobijete popis svih vina s prekidačem uz svako.
Kliknete prekidač — vino nestaje s karte. Kliknete opet — vraća se.
Nema tipkanja, nema JSON-a.

**Trakica na dnu vam govori dokle je stiglo**, jer prekidač kojem ne
vjerujete gori je od tipkanja:

1. **spremljeno** — zapisano na GitHub (par sekundi)
2. **objavljeno** — stranica je ponovno objavljena (~30 s). Ovo se
   **provjerava**, ne pretpostavlja: stranica sama pročita objavljenu
   datoteku dok ne vidi vašu promjenu.
3. **na tabletima** — odbrojava 30 s, koliko najviše treba da i zadnji
   tablet povuče promjenu.

Gore piše i koliko je vina trenutno skriveno, a gumb **Samo skriveno**
pokaže samo njih — to je vaša evidencija na jednom ekranu.

Vino koje ide **i na čašu i na bocu** ima još dva mala gumba: *nema na
čašu* i *nema na bocu*. Prekidač skriva vino svugdje; gumbi skrivaju samo
jednu ponudu (otvorena boca je gotova, a zatvorenih još ima).

Možete mirno kliknuti tri vina zaredom — ne treba čekati da prvo završi.

#### Ključ (jednom, na jednom tabletu)
Prvi put stranica traži GitHub token. Napravite ga ovako:

1. github.com → **Settings** → Developer settings → **Personal access
   tokens** → **Fine-grained tokens** → *Generate new token*
2. **Repository access:** Only select repositories → **jsiljeg/list**
3. **Permissions** → Repository permissions → **Contents: Read and write**
   (ništa drugo)
4. Kopirajte token i zalijepite ga u stranicu. Ostaje spremljen na tom
   tabletu.

**Što ako tablet nestane?** Taj ključ ne može ništa osim skrivati i
vraćati vina na *našoj* karti. Javite Juri, ili sami obrišite token na
github.com/settings/tokens — vrijedi odmah. Gumb **Odjava** briše ključ s
tableta.

**PIN nije zaštita**, nego brava na ekranu da gost slučajno ne otvori
stranicu. Prava zaštita je token. PIN se mijenja u `js/admin.js`
(`const PIN`).

### Privremeno sakriti vino — ručno (bez tableta sa ključem)
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
- `vol` — dodajte `"vol": 1.5` ako je nestala samo ta veličina, a obična
  boca se i dalje toči. Bez tog retka nestaju sve veličine (a to je i ono
  što napravi prekidač na `/admin`).

**Vraćanje vina u kartu:** obrišite njegov redak. Ništa više.

Ako se potkrade tipfeler u imenu, provjera prije objave to **odbija** i
javlja koje ime ne postoji — da se ne dogodi da mislite kako je vino
skriveno, a gost ga i dalje vidi na karti.

Kategorija koja ostane prazna (npr. sakrijete jedini rosé) sama nestaje
iz izbornika i vraća se kad vino vratite.

**Evidencija:** trenutno stanje uvijek vidite na jednom mjestu — u toj
datoteci. Povijest tko je što i kada sakrio i vratio stoji pod **History**
te datoteke na GitHubu.

### Jelo koje je sezonski otišlo s karte → `data/menu.json`
**Nemojte ga brisati.** Jela se vraćaju sljedeće sezone, a uz svako stoji
ime na 8 jezika i ručno provjeren popis sljubljivanja — to bi se svaki put
iznova radilo. Umjesto brisanja dodajte jelu jedan redak:
```json
"off": true
```
Jelo odmah nestaje iz sommeliera („Pomozi mi odabrati") i s kartica vina,
ali sve o njemu ostaje zapisano.

**Kad se jelo vrati:** obrišite taj redak. Ništa više — sljubljivanja su
ondje gdje ste ih ostavili.

Trenutno je tako sklonjeno 15 jela (foie gras, pašticada, janjetina, fritto
misto i ostala s proljetne karte). Provjera prije objave i dalje ih
kontrolira kao i aktivna, pa ne mogu tiho zastarjeti dok čekaju.

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

### Kartica za žestoko piće (rum, viski, gin, rakija…)

Žestoka pića imaju svoju karticu, kao i vina, samo s drugim poljima — sirovina,
destilacija, odležavanje, starost, kako se pije. Zapis u `library/wines.json`
izgleda ovako:

```json
"hampden-estate--hlcf-classic-4y": {
 "name": "HLCF Classic 4Y",
 "producer": "Hampden Estate",
 "insight": {
  "kind": "spirit",          <-- OBAVEZNO, inače se prikazuje kao vino
  "class": "rum_jamaican",   <-- redak stila ispod cijene
  "region": "Trelawny",
  "country": "JM",
  "base": ["molasses"],      <-- sirovina
  "still": ["double_retort_pot"],
  "cask": ["ex_bourbon"],    <-- odležavanje
  "age": "4",
  "alcohol": "60",
  "bottler": "Velier",       <-- neobavezno, za nezavisna punjenja
  "aromas": ["overripe_banana", "varnish"],
  "serve": ["neat", "drop_of_water"],
  "pairings": ["cigars", "spicy"]
 },
 "note": { "hr": "…", "en": "…" },
 "notePlain": true
}
```

**Sve vrijednosti u `class`, `base`, `still`, `cask` i `serve` moraju postojati
u `js/spirits.js`, i to na svih osam jezika.** Ondje su i posebne arome koje
vino nema (treset, koji, kubeba papar). Ako dodajete novu vrijednost, dodajte
je u svih osam jezičnih blokova — `node scripts/validate.mjs` neće pustiti
objavu ako nedostaje ijedan.

Čašu bira `class` sam (VESSEL_BY_CLASS u `js/spirits.js`); ako neko piće treba
drugu čašu, dodajte mu `"vessel": "tumbler"` u `insight`.

Priču o destileriji **ne pišite u svako piće** — ide u `data/producers.json`,
isto kao tekst o vinaru, i prikazuje se ispod svih pića te kuće. `note` je za
ono što razlikuje baš tu bocu.

## Ostalo što se može urediti

- **Priča na naslovnici i svi prijevodi**: `js/i18n.js` (sekcija `story`
  za svaki jezik).
- **Oznaka "Filho preporučuje" u drugi tekst** (npr. "Filip preporučuje"):
  u `js/i18n.js` promijenite `recommended:` u svakom od 5 jezika.

## Ako nešto pođe po zlu

Svaka promjena je zapamćena. Na github.com/jsiljeg/list → **History**
(povijest datoteke) možete vidjeti svaku verziju i vratiti staru — ili
javite Juri i vraća se jednom naredbom.
