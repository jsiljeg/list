/* POST /api/vina/:id/<action>
 *
 *   odgovor   (staff)   answers to Claude's questions, and/or more photos
 *                       (multipart: answer_<i> per question, photo files).
 *                       needs_info → queued, and the queue is pumped.
 *   objavi    (staff)   ready → publishing; starts the publish workflow.
 *   ponovi    (staff)   failed → queued, inside the per-wine run limit.
 *   odustani  (staff)   anything not yet published → cancelled.
 *   stanje    (worker)  the run reports: working | needs_info | ready |
 *                       published | failed, with questions / result / branch /
 *                       run_url / ref / usage / error. Only legal moves. */
import { reply, isStaff, isWorker, readRequest, setStatus, savePhotos, pump, startPublish, clip } from "../../../_lib/wines.js";

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
    if (b.status !== "working") await pump(env);   /* the next one in line may start */
    return reply(request, { ok: true });
  }

  if (!isStaff(request, env)) return reply(request, { error: "key" }, 401);

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
    const d = await startPublish(env, id);
    return d.error ? reply(request, { error: d.error }, 409) : reply(request, { ok: true, item: await readRequest(env, id) });
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
