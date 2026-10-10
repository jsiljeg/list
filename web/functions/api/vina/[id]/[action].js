/* POST /api/vina/:id/<action>
 *
 *   odgovor   (staff)   answers to Claude's questions, and/or more photos
 *                       (multipart: answer_<i> per question, photo files).
 *                       needs_info → queued, and the queue is pumped.
 *   objavi    (staff)   ready → publishing; starts the publish workflow.
 *   ispravak  (staff)   corrections on a ready preview: prices at once,
 *                       card fields through a short edit run.
 *   ponovi    (staff)   failed → queued, inside the per-wine run limit.
 *   odustani  (staff)   anything not yet published → cancelled.
 *   stanje    (worker)  the run reports: working | needs_info | ready |
 *                       published | failed, with questions / result / branch /
 *                       run_url / ref / usage / error. Only legal moves. */
import { reply, isStaffAsync, isWorker, readRequest, setStatus, savePhotos, pump, startPublish, clip, euros, notifyOwner, person, setPerson } from "../../../_lib/wines.js";

const WORKER_MOVES = {
  working: ["working", "needs_info", "ready", "failed"],
  publishing: ["published", "failed", "ready"],
};

export async function onRequestPost({ request, env, params }) {
  const { id, action } = params;
  const item = await readRequest(env, id);
  if (!item) return reply(request, { error: "not_found" }, 404);

  if (action === "stanje") {
    if (!isWorker(request, env)) return reply(request, { error: "key" }, 401);
    let b;
    try { b = await request.json(); } catch { return reply(request, { error: "body" }, 400); }
    const allowed = WORKER_MOVES[item.status] || [];
    if (!allowed.includes(b.status)) return reply(request, { error: "move", from: item.status, to: b.status }, 409);
    const f = { status: b.status };
    if (b.run_url) f.run_url = clip(b.run_url, 300);
    if (b.branch) f.branch = clip(b.branch, 120);
    if (b.ref) f.ref = clip(b.ref, 200);
    /* A report that is not a failure clears whatever error an earlier step
       left (a dispatch that had to wait, a run that timed out and was retried). */
    if (b.error != null) f.error = clip(b.error, 1000);
    else if (b.status !== "failed") f.error = "";
    if (b.usage) f.usage = JSON.stringify(b.usage).slice(0, 2000);
    if (Array.isArray(b.questions)) f.questions = JSON.stringify(b.questions.slice(0, 5).map((q) => clip(q, 400)));
    if (b.result) {
      const r = JSON.stringify(b.result);
      if (r.length > 300000) return reply(request, { error: "result_too_big" }, 413);
      f.result = r;
    }
    if (b.status === "published") f.published_at = new Date().toISOString();
    await setStatus(env, id, f);
    /* The owner hears about every card the moment it exists — he checks
       them, and the laptop may be off. Not when it goes live: the cloud
       monitor's "new on the list" e-mail says that, for every wine however
       it was added, and one e-mail per new wine is enough (owner, 2026-10-10). */
    const wine = b.result && b.result.draft && b.result.draft.wine;
    const name = wine ? `${wine.producer} — ${wine.name}` : (item.result && item.result.draft && item.result.draft.wine
      ? `${item.result.draft.wine.producer} — ${item.result.draft.wine.name}` : `zahtjev ${id}`);
    const say = {
      ready: ["Dodaj vino: kartica spremna", `${name}. Filho je može pregledati i objaviti.`],
      failed: ["Dodaj vino: nije uspjelo", `${name}: ${f.error || ""}`],
      needs_info: ["Dodaj vino: pitanje za Filha", `${name}: ${(b.questions || []).join(" ")}`],
    }[b.status];
    if (say) await notifyOwner(env, say[0], say[1], b.run_url || item.run_url);
    if (b.status !== "working") await pump(env);   /* the next one in line may start */
    return reply(request, { ok: true });
  }

  if (!(await isStaffAsync(request, env))) return reply(request, { error: "key" }, 401);

  if (action === "odgovor") {
    if (item.status !== "needs_info") return reply(request, { error: "not_waiting" }, 409);
    let form;
    try { form = await request.formData(); } catch { return reply(request, { error: "body" }, 400); }
    const answers = item.answers.slice();
    const at = new Date().toISOString();
    item.questions.forEach((q, i) => {
      const a = clip(form.get(`answer_${i}`), 500);
      if (a) answers.push({ q, a, at });
    });
    const photos = form.getAll("photo").filter((f) => f && typeof f === "object" && f.size);
    if (photos.length > 3) return reply(request, { error: "too_many_photos" }, 400);
    if (!photos.length && answers.length === item.answers.length) return reply(request, { error: "empty" }, 400);
    const saved = await savePhotos(env, id, photos);
    if (saved.error) return reply(request, { error: saved.error }, 400);
    await setStatus(env, id, { status: "queued", answers: JSON.stringify(answers), questions: "[]" });
    const pumped = await pump(env);
    return reply(request, { ok: true, item: await readRequest(env, id), pumped });
  }

  if (action === "objavi") {
    /* who tapped it — the publish commit is authored in that name */
    const b = await request.json().catch(() => ({}));
    await setPerson(env, id, "published_by", person(b.by));
    const d = await startPublish(env, id);
    return d.error ? reply(request, { error: d.error }, 409) : reply(request, { ok: true, item: await readRequest(env, id) });
  }

  /* Filho's corrections on the preview (owner, 2026-10-10: "move a word or
     two; a number or two"). Prices are the venue's, not the card's, so they
     change here and now, without a run, and publish-wine.yml writes them onto
     the listing. Anything on the card itself queues a short edit run on the
     card's branch, so the other seven languages follow the Croatian he typed.
     Only these fields can be edited; the comment is data for the run, like
     every answer. */
  if (action === "ispravak") {
    if (item.status !== "ready") return reply(request, { error: "not_ready" }, 409);
    let b;
    try { b = await request.json(); } catch { return reply(request, { error: "body" }, 400); }
    const FIELDS = ["alcohol", "temp", "grape", "region", "terroir", "note", "blurb", "komentar"];
    const at = new Date().toISOString();
    const priceFields = {};
    for (const k of ["price_bottle", "price_glass"]) if (b[k] !== undefined) {
      const v = euros(b[k]);
      if (Number.isNaN(v)) return reply(request, { error: "price" }, 400);
      priceFields[k] = v;
    }
    const edits = (Array.isArray(b.edits) ? b.edits : []).slice(0, 12)
      .filter((e) => e && FIELDS.includes(e.field))
      .map((e) => ({ kind: "edit", field: e.field, from: clip(e.from, 2000), to: clip(e.to, 2000), at }))
      .filter((e) => e.to !== e.from);
    /* NOVO on or off: immediate, like a price; publish-wine.yml reads the
       latest choice. */
    const novo = typeof b.novo === "boolean" ? [{ kind: "novo", to: b.novo, at }] : [];
    if (!edits.length && !novo.length && !Object.keys(priceFields).length) return reply(request, { error: "empty" }, 400);
    if (Object.keys(priceFields).length) await setStatus(env, id, priceFields);
    if (novo.length) await setStatus(env, id, { answers: JSON.stringify(item.answers.concat(novo)) });
    if (!edits.length) return reply(request, { ok: true, item: await readRequest(env, id) });
    const now = await readRequest(env, id);
    await setStatus(env, id, { status: "queued", answers: JSON.stringify(now.answers.concat(edits)) });
    const pumped = await pump(env);
    return reply(request, { ok: true, item: await readRequest(env, id), pumped });
  }

  /* A failed run goes back in the queue — still inside MAX_RUNS, which pump()
     enforces, so "Pokušaj ponovno" cannot become an unlimited loop. */
  if (action === "ponovi") {
    if (item.status !== "failed") return reply(request, { error: "not_failed" }, 409);
    await setStatus(env, id, { status: "queued", error: "" });
    const pumped = await pump(env);
    return reply(request, { ok: true, item: await readRequest(env, id), pumped });
  }

  if (action === "odustani") {
    if (["published", "publishing", "cancelled"].includes(item.status)) return reply(request, { error: "too_late" }, 409);
    if (item.status === "working") return reply(request, { error: "running" }, 409);
    await setStatus(env, id, { status: "cancelled" });
    return reply(request, { ok: true, item: await readRequest(env, id) });
  }

  return reply(request, { error: "action" }, 404);
}
