# Regression suite

Every test here exists because something broke once. The header comment of each
spec names the commit it guards, so when a test fails you can read what it was
protecting before deciding it is wrong.

## Running it

```bash
npm ci                              # once
npx playwright install chromium     # once, ~120 MB

npm test                            # all three viewports
npm run test:tablet                 # just the tablet — fastest useful loop
npx playwright test -g "swipe"      # by name
npm run test:headed                 # watch it happen
npm run report                      # open the last HTML report
```

`npm run check` is everything in one command: syntax, data validation, tests.

**The suite does not run on every push, by design.** A data edit should reach the
restaurant in a minute rather than after a browser run. Use it as a regression
check when something looks wrong, or before a change you are unsure of:

```bash
npm test                                  # this working tree
gh workflow run test.yml --ref main       # on GitHub, on demand
git checkout <sha> && npm ci && npm test  # against a past commit
git checkout -                            # and back
```

The deploy still runs the cheap checks — `node --check` on every script and
`scripts/validate.mjs` — so a broken edit cannot reach the tablet.

The static server (`tests/serve.mjs`) starts and stops itself; nothing needs to
be running first. It is dependency-free on purpose — the site has no
dependencies either.

## What is covered, and why

| Spec | Guards against |
|---|---|
| `smoke.spec.mjs` | the walk a guest takes: language screen → story → list → card, every language, every section, every mode button. Fails on any console error, because a JS error mid-render leaves a half-drawn list that looks like a data problem. |
| `gestures.spec.mjs` | swipe dead zones (screen edges, the footer, the backdrop), the chip strip and mode buttons keeping their own gestures, the tab ring wrapping, the page never panning sideways, a new section starting at the top, and the card never being left displaced. |
| `detail-sheet.spec.mjs` | the glass icon under the ✕ and anything overlapping the glass — that one came back three times, each on a viewport nobody checked. Also the card opening at the top, the frame not resizing between wines, and stepping staying inside a search result. |
| `glasses.spec.mjs` | the whole dataset through `glassFor()`: Riedel's Pinot/Nebbiolo vs Cabernet/Merlot split, sweet wines keeping the dessert glass whatever else is tagged, the named owner exceptions, and the seven drawings staying seven distinct drawings inside their viewBoxes. |
| `search.spec.mjs` | every spelling of a region returning the same wines, "burgun" not matching *spät*burgunder mid-word, "brunello" meaning Montalcino rather than all Sangiovese, "riesling" never returning Graševina, diacritics being optional, Chinese queries still working, a wine's **style** being searchable in every language ("orange", "macerirano", "trocken" — the wine vocabulary was missing from the haystack while the spirit vocabulary was in it), wines ranking ahead of spirits in the results, and Croatian showing Friuli while "Furlanija" still finds it. |
| `layout.spec.mjs` | the footer at the foot of the screen on a short category, no sideways scroll, the sticky header, the flag actually decoding (it once failed silently and rendered 0×0), the face preloaded rather than fetched at the language tap, the language title not resizing when the webfont swaps in (Georgia set it 34% wider than Markazi, so it landed too big and snapped smaller), and nothing 404ing. |
| `i18n.spec.mjs` | the style line in sentence case with the dosage keeping its capital, the subtitle staying Filho's English line, the Chinese view glossing every region token, exonyms following the language, the country appended once, and no raw i18n key reaching the screen. |
| `availability.spec.mjs` | the temporarily-out-of-stock list: a hidden wine leaving the DOM *and* `DATA` (so the si/ci/gi/ii detail path can't drift onto the wrong wine), `where` scoping glass vs bottle, an emptied category leaving the nav, and neither a 404 nor an over-eager hide-everything taking the list down. Then the 30-second poll: a wine vanishing and returning mid-session with no reload, a corrected tasting note arriving the same way, an open detail sheet never rebuilt underneath the guest, every data fetch revalidating rather than trusting Pages' 10-minute cache, the search query and scroll surviving the re-render, and a dropped network changing nothing. |
| `admin.spec.mjs` | the staff 86 board: the PIN gate, a switch per wine, the glass/bottle buttons on wines sold both ways, three flips in a row all landing and batching into fewer commits, an un-hide not made to sit through the 30-second countdown, and the receipt refusing to call something published until it has re-read the deployed file. GitHub is intercepted, so it needs no token and never touches the repo. |
| `data.spec.mjs` | the conventions in CLAUDE.md, checked instead of trusted: no country inside `insight.region`, blends name-first and descending, large-format twins identical, critic names from the agreed list, every data file in canonical form, the Saints Hills blurb carrying the Michel Rolland story in all eight languages, no nail ornament radiating from a single shared point (which is what made the citrus read as a starburst), and — since the library split — every listing's `ref` resolving to a library wine with nothing stranded. Runs without a browser, in about a second. |
| `data.spec.mjs` (spirits) | the spirits vocabulary, which lives in `js/spirits.js` and so is invisible to every check above: all eight languages carrying the same keys (a key added to `en` and forgotten in `sl` renders `ex_bourbon` at a Slovenian guest and nobody else), every class/base/still/cask/serve resolving, every class having a glass, no wine-only field left on a spirit, no two bottles sharing one note (six house stories were pasted onto every bottle their house makes), no Cyrillic hiding inside a Latin word, and "Clairin" not inheriting Giorgio Clai's winery blurb. |

## Writing a new one

Add it when you fix a bug, not later. Two rules learned the hard way:

**Test the edges, not the middle.** The first version of the swipe tests ran down
the centre of a phone and passed while the tablet gutters were completely dead.
Start gestures at `width - 8`, not `width / 2`.

**Use real input for gestures.** `swipe()` in `helpers.mjs` dispatches through
CDP, which goes through the browser's own touch pipeline. Synthetic `TouchEvent`s
bypass `touch-action` and scroll handling and will happily pass on a broken app.

For layout assertions, measure the **ink** rather than the element box —
`.detail-name` is a full-width block whose text stops well short of the glass
icon, so comparing bounding boxes reports overlaps nobody can see. There is a
`Range`-based helper pattern in `detail-sheet.spec.mjs`.

## Viewports

Three, because nearly every layout bug here has been one-viewport-only:

- **tablet** 1024×768, touch — the device in the restaurant
- **phone** 390×844, touch, 2× — the QR-code guest
- **laptop** 1440×900, no touch — where the rating chips grew into the glass

Touch-only tests skip themselves on laptop; the narrow-screen badge test skips
above 420px.
