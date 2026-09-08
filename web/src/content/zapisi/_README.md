# Zapisi — kako objaviti novi tekst

1. Kopiraj `_template.md` u novu datoteku, npr. `new-york-le-bernardin.md`.
   Naziv datoteke postaje adresa: `/zapisi/new-york-le-bernardin/`.
2. Ispuni `title`, `date` (YYYY-MM-DD), `summary`, po želji `place`.
3. Makni `draft: true` kad je tekst spreman. Dok stoji, tekst se ne objavljuje.
4. Tekst ide ispod druge crte `---`, u Markdownu.
5. Commit i push — objavljuje se samo.

Datoteke koje počinju s `_` Astro ignorira, pa `_template.md` nikad ne postane
stranica.

**Objavljujemo prvo ovdje.** Ako tekst poslije preuzme neki portal, neka
postave `rel="canonical"` na našu adresu — tako tražilice ovu stranicu
tretiraju kao izvornik, a portal donosi doseg bez da ga odnese.
