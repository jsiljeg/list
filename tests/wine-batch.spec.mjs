/* Many Dodaj vino cards waiting at once (2026-10-21, before Filho's first
   batch of 20+ bottles).

   Caught: every card is cut from main at its own run, and add.py appends the
   wine at the end of library/wines.json and the house at the end of
   data/producers.json. So with two cards on the preview, the second "Objavi"
   conflicted in `git merge --squash` — and failed the same way on every
   retry. One wine at a time never showed it. publish-wine.yml now falls back
   to .github/wine-intake/replay.py, which lays the card on as data.

   Guarded here end to end, in a throwaway clone: three cards from one main —
   two bottles of the same new house, all placed beside the same neighbour,
   each adding a Chinese term at the same line — publish in turn and validate;
   and the same bottle sent twice is refused instead of listed twice. */
import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const PY = process.platform === "win32" ? "python" : "python3";
const FILES = ["library/wines.json", "lists/theatrium.json", "data/producers.json",
               "data/unavailable.json", "js/zh-terms.js", "js/i18n.js"];

test("cards written side by side all publish, and a duplicate is refused", () => {
  test.setTimeout(180_000);
  const dir = join(mkdtempSync(join(tmpdir(), "batch-")), "repo");
  const env = { ...process.env, PYTHONIOENCODING: "utf-8", GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t",
                GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };
  const run = (cmd, args, ok = true) => {
    try { return execFileSync(cmd, args, { cwd: dir, env, encoding: "utf8", stdio: "pipe" }); }
    catch (e) { if (ok) throw new Error(`${cmd} ${args.join(" ")}: ${e.stderr || e}`); return null; }
  };
  const git = (...a) => run("git", a);
  execFileSync("git", ["clone", "-q", "--no-hardlinks", "-c", "core.autocrlf=false", process.cwd(), dir]);
  /* the working tree's replay.py, not the committed one */
  writeFileSync(join(dir, ".github/wine-intake/replay.py"), readFileSync(".github/wine-intake/replay.py"));
  git("add", "-A"); git("commit", "-qm", "base", "--allow-empty");
  const base = git("rev-parse", "HEAD").trim();

  const card = (branch, from, name, producer, term) => {
    git("checkout", "-q", "-B", branch, from);
    const lib = JSON.parse(readFileSync(join(dir, "library/wines.json"), "utf8")).wines;
    const lst = JSON.parse(readFileSync(join(dir, "lists/theatrium.json"), "utf8"));
    const anchor = lst.sections[1].categories[0].groups[0].items[0].ref;
    const P = JSON.parse(readFileSync(join(dir, "data/producers.json"), "utf8")).producers;
    const any = Object.values(P)[0];
    const wine = { ...lib[anchor], name, producer }; delete wine.nameI18n;
    writeFileSync(join(dir, "draft.json"), JSON.stringify({ wine, listings: [{ after: anchor, price: 77 }],
      producer: { name: producer, region: any.region || "", blurb: any.blurb } }));
    const zh = join(dir, "js/zh-terms.js");
    const s = readFileSync(zh, "utf8").replace(/\r\n/g, "\n");
    const line = s.split("\n").find((l) => /^    "[^"]+": "[^"]+",$/.test(l));
    writeFileSync(zh, s.replace(line + "\n", `${line}\n    "${term}": "测试",\n`));
    run(PY, [".claude/skills/add-wine/add.py", "draft.json"]);
    run(PY, ["-c", "import os; os.remove('draft.json')"]);
    git("add", "-A"); git("commit", "-qm", branch);
  };
  card("wA", base, "Testno A 2024", "Probna Kuća", "TermA");
  card("wB", base, "Testno B 2024", "Probna Kuća", "TermB");
  card("wC", base, "Testno C 2024", "Druga Kuća", "TermC");
  card("wD", base, "Testno A 2024", "Probna Kuća", "TermA");   /* A, sent twice */

  /* exactly what publish-wine.yml does */
  const publish = (branch, ref) => {
    if (run("git", ["merge", "--squash", branch], false) === null) {
      git("reset", "-q", "--hard", "HEAD");
      if (run(PY, [".github/wine-intake/replay.py", ref, branch], false) === null) return false;
    }
    git("commit", "-qm", `publish ${branch}`);
    return true;
  };
  git("checkout", "-q", "--detach", base);
  expect(publish("wA", "probna-kuca--testno-a-2024")).toBe(true);
  expect(publish("wB", "probna-kuca--testno-b-2024")).toBe(true);
  expect(publish("wC", "druga-kuca--testno-c-2024")).toBe(true);
  expect(publish("wD", "probna-kuca--testno-a-2024")).toBe(false);
  git("reset", "-q", "--hard", "HEAD");

  const lib = JSON.parse(readFileSync(join(dir, "library/wines.json"), "utf8")).wines;
  for (const r of ["probna-kuca--testno-a-2024", "probna-kuca--testno-b-2024", "druga-kuca--testno-c-2024"])
    expect(lib[r], r).toBeTruthy();
  const listed = JSON.stringify(JSON.parse(readFileSync(join(dir, "lists/theatrium.json"), "utf8")));
  expect(listed.match(/probna-kuca--testno-a-2024/g)).toHaveLength(1);
  const P = JSON.parse(readFileSync(join(dir, "data/producers.json"), "utf8")).producers;
  expect(Object.keys(P)).toEqual(expect.arrayContaining(["Probna Kuća", "Druga Kuća"]));
  const zh = readFileSync(join(dir, "js/zh-terms.js"), "utf8");
  for (const t of ["TermA", "TermB", "TermC"]) expect(zh).toContain(`"${t}"`);
  expect(zh).not.toMatch(/^(<<<<<<<|>>>>>>>)/m);
  run(process.execPath, ["--check", "js/zh-terms.js"]);
  run(process.execPath, ["scripts/validate.mjs"]);
  for (const f of FILES) expect(readFileSync(join(dir, f), "utf8")).not.toContain("\r");
});

test("the publish workflow replays a card whose squash merge conflicts", () => {
  const wf = readFileSync(".github/workflows/publish-wine.yml", "utf8");
  expect(wf).toMatch(/if ! git merge --squash "origin\/wine\/\$ID"; then[\s\S]*replay\.py "\$REF"/);
});
