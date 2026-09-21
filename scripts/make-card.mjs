/* A business card carrying the wine list — HTML to look at, PDF to print.

   The QR on it is the **list**, not the person: the card is handed to a guest,
   and what a guest wants from it is the wine list. That also makes the code
   small enough to be comfortable. A vCard is 164 bytes and needs 61 modules,
   which at the ~20mm a card can spare is 0.33mm per module — right at the edge
   of what a phone reads off paper. The list URL is 32 bytes and 41 modules, so
   the same 20mm gives **0.49mm** per module, half again as much. The contact
   details are printed as text beside it, which is where a human reads them
   anyway.

   **Everything vector**, and the reason the first PDF was not is worth writing
   down, because the obvious suspect was innocent. The owner saw a pixelated
   logo while the text beside it stayed crisp. It was not the `<img src=".svg">`
   — Chromium prints a linked SVG as paths perfectly well. It was
   **`filter: invert(1)`**, which the old cream card needed because the logo
   ships white. A CSS filter forces a raster layer in print. Measured:

     logo, plain          0 image objects   vector
     logo, invert(1)      2 image objects   RASTERIZED
     logo, opacity .9     0 image objects   vector

   So the card is dark, which is the identity anyway, and the white logo goes
   on it untouched. The check at the end counts `/Subtype /Image` — not
   `/Image`, which matches the `/ImageB /ImageC /ImageI` in every PDF's ProcSet
   and reports a false raster on a page with nothing but text.

   The card is the app's own identity rather than a light flyer: charcoal,
   gold, Markazi over Raleway. The code sits on a cream tile because scanners
   want dark modules on a light field, and an inverted QR is a coin flip.

     node scripts/make-card.mjs --name "Ime Prezime" --tel "+385911234567" \
       --email someone@theatrium.hr

   Output goes to cards/, which is gitignored: the repo is public, and a phone
   number handed across a table is not one indexed on the web.
*/
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";
import { ROOT } from "./lib/list.mjs";

const arg = (flag, dflt) => {
  const i = process.argv.indexOf(flag);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};

const name = arg("--name");
const tel = arg("--tel");
const email = arg("--email");
const org = arg("--org", "Theatrium by Filho");
const qrMm = Number(arg("--mm", 20));
if (!name || !tel || !email) {
  console.error('need --name "Ime Prezime" --tel "+385911234567" --email someone@theatrium.hr');
  process.exit(1);
}
const slug = arg("--slug", name.toLowerCase().normalize("NFD")
  .replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));

/* Read both marks, drop the XML prolog, and let CSS size them.

   Dropping width/height is only safe if the file has a viewBox to fall back
   on, and segno writes neither one — its QR is `width="492" height="492"` with
   a path scaled 12x inside. Strip the size off that and the browser keeps the
   unscaled coordinate system, so the code renders as one giant corner block.
   (It did, and it was still a "valid" SVG.) So the size is read off the file
   and turned into a viewBox before it goes. */
const inline = (rel, cls) => {
  let svg = readFileSync(path.join(ROOT, rel), "utf8").replace(/<\?xml[^>]*\?>\s*/, "");
  const w = (svg.match(/<svg[^>]*?\swidth="([\d.]+)"/) || [])[1];
  const h = (svg.match(/<svg[^>]*?\sheight="([\d.]+)"/) || [])[1];
  if (w && h && !/viewBox=/.test(svg)) svg = svg.replace(/<svg /, `<svg viewBox="0 0 ${w} ${h}" `);
  return svg
    .replace(/<svg /, `<svg class="${cls}" preserveAspectRatio="xMidYMid meet" `)
    .replace(/(<svg[^>]*?)\swidth="[^"]*"/, "$1")
    .replace(/(<svg[^>]*?)\sheight="[^"]*"/, "$1");
};

const logo = inline("assets/theatrium-logo.svg", "logo");
const qr = inline("assets/qr.svg", "qr");

/* +385916051117 -> +385 91 605 1117, for the side a person reads */
const pretty = /^\+385\d{9}$/.test(tel)
  ? `${tel.slice(0, 4)} ${tel.slice(4, 6)} ${tel.slice(6, 9)} ${tel.slice(9)}` : tel;

const html = `<!DOCTYPE html>
<html lang="hr">
<head>
<meta charset="utf-8">
<title>${name} — posjetnica</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Markazi+Text:wght@400;500;600&family=Raleway:wght@300;400;500&display=swap" rel="stylesheet">
<style>
  /* the app's own tokens — a card that does not look like the list is a card
     the guest does not connect to the list */
  :root {
    --bg: #161513; --gold: #c9a961; --text: #efe9dd; --text-dim: #a89f8f;
    --serif: "Markazi Text", Georgia, serif;
    --sans: "Raleway", system-ui, sans-serif;
  }
  @page { size: 85mm 55mm; margin: 0; }
  body { margin: 0; background: #6b6558; display: flex; align-items: center;
         justify-content: center; min-height: 100vh; }
  /* Two columns as flex, not grid. The first attempt was a grid with the tile
     spanning both rows, and the tile's height then drove the row sizing and
     pushed the email 5.3mm off the bottom of the card — measured, not guessed.
     Flex keeps the two columns independent, which is what they are. */
  .card {
    width: 85mm; height: 55mm; box-sizing: border-box; padding: 5.5mm 6mm;
    background: var(--bg); color: var(--text); font-family: var(--sans);
    display: flex; gap: 5mm; align-items: stretch; overflow: hidden;
  }
  .left { flex: 1; min-width: 0; display: flex; flex-direction: column;
          justify-content: space-between; }
  .logo { width: 30mm; height: auto; }                   /* ships white already */
  .name { font-family: var(--serif); font-weight: 500; font-size: 7mm;
          line-height: 1; letter-spacing: .01em; margin: 0 0 1mm; }
  .role { font-size: 2.3mm; letter-spacing: .24em; text-transform: uppercase;
          color: var(--gold); margin: 0; }
  .contact { font-size: 2.8mm; font-weight: 300; line-height: 1.5;
             color: var(--text-dim); margin-top: 2.6mm; }
  .contact a { color: inherit; text-decoration: none; }
  /* A cream tile: scanners want dark modules on a light field, and an inverted
     code is a coin flip on half the phones in the room. */
  .tile { align-self: center; background: var(--text); border-radius: 1.6mm;
          padding: 1.6mm; display: flex; flex-direction: column; align-items: center; }
  .qr { width: ${qrMm}mm; height: ${qrMm}mm; display: block; }
  .tile .cap { font-size: 1.9mm; letter-spacing: .16em; text-transform: uppercase;
               color: #5a5346; margin-top: 1.2mm; text-align: center; line-height: 1.35; }
  @media screen { .card { box-shadow: 0 2mm 8mm rgba(0,0,0,.4); } }
</style>
</head>
<body>
  <div class="card">
    <div class="left">
      ${logo}
      <div class="who">
        <p class="name">${name}</p>
        <p class="role">${org}</p>
        <div class="contact">
          <a href="tel:${tel}">${pretty}</a><br>
          <a href="mailto:${email}">${email}</a>
        </div>
      </div>
    </div>
    <div class="tile">
      ${qr}
      <div class="cap">Vinska karta<br>Wine list</div>
    </div>
  </div>
</body>
</html>
`;

const out = path.join(ROOT, "cards");
mkdirSync(out, { recursive: true });
const htmlPath = path.join(out, `${slug}-card.html`);
const pdfPath = path.join(out, `${slug}-card.pdf`);
writeFileSync(htmlPath, html);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("file://" + htmlPath.replace(/\\/g, "/"), { waitUntil: "networkidle" });
await page.waitForTimeout(600);                       /* let the webfonts land */
await page.pdf({ path: pdfPath, width: "85mm", height: "55mm", printBackground: true,
                 margin: { top: 0, right: 0, bottom: 0, left: 0 } });
await browser.close();

/* A vector card has no image objects at all. Match /Subtype /Image rather than
   /Image: every Chromium PDF lists /ImageB /ImageC /ImageI in its ProcSet, so
   the loose pattern reports three rasters on a page of plain text — which it
   did, and sent me looking for a bug that was not there. */
const pdf = readFileSync(pdfPath);
const rasters = (pdf.toString("latin1").match(/\/Subtype\s*\/Image/g) || []).length;
const modules = 41;                                   /* the list code: v4 + quiet zone */
console.log(`${slug}-card.pdf — 85x55mm, QR ${qrMm}mm (${(qrMm / modules).toFixed(2)}mm per module)`);
console.log(rasters ? `RASTERIZED: ${rasters} image objects — something is still an <img>`
                    : "vector: no raster image objects in the PDF");
process.exit(rasters ? 1 : 0);
