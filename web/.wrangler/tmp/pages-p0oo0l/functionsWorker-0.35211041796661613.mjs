var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../.wrangler/tmp/bundle-wjGJxy/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// ../src/lib/booking.mjs
var TZ = "Europe/Zagreb";
var SERVICE = {
  0: [],
  1: [{ from: "12:00", to: "23:00" }],
  2: [{ from: "12:00", to: "23:00" }],
  3: [{ from: "12:00", to: "23:00" }],
  4: [{ from: "12:00", to: "23:00" }],
  5: [{ from: "12:00", to: "23:00" }],
  6: [{ from: "12:00", to: "23:00" }]
};
var CONFIG = {
  slotMinutes: 15,
  /* How long a table is held. Bigger parties eat longer — this is the single
     number most worth tuning once there is real data. */
  turnMinutes: (covers) => covers <= 2 ? 90 : covers <= 4 ? 105 : 135,
  /* Seats in the room available to online booking. Keep this BELOW the true
     capacity so walk-ins and the phone still have somewhere to go. */
  capacity: 34,
  /* Covers allowed to start within one slot, so arrivals do not bunch. */
  pacing: 8,
  minParty: 1,
  maxParty: 8,
  /* Above maxParty we ask them to call — a private-event conversation, not a
     form. */
  leadMinutes: 120,
  horizonDays: 60
};
var hhmm = /* @__PURE__ */ __name((min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`, "hhmm");
var toMin = /* @__PURE__ */ __name((s) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s).trim());
  if (!m)
    return null;
  const h = +m[1], mi = +m[2];
  if (h > 23 || mi > 59)
    return null;
  return h * 60 + mi;
}, "toMin");
function weekday(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
__name(weekday, "weekday");
function isValidDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr))
    return false;
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
__name(isValidDate, "isValidDate");
function nowInZagreb(at = /* @__PURE__ */ new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(at).reduce((o, p) => (o[p.type] = p.value, o), {});
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: +parts.hour * 60 + +parts.minute
  };
}
__name(nowInZagreb, "nowInZagreb");
function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}
__name(addDays, "addDays");
function candidateSlots(dateStr, covers) {
  const turn = CONFIG.turnMinutes(covers);
  const out = [];
  for (const period of SERVICE[weekday(dateStr)] || []) {
    const from = toMin(period.from), to = toMin(period.to);
    for (let t = from; t + turn <= to; t += CONFIG.slotMinutes)
      out.push(t);
  }
  return out;
}
__name(candidateSlots, "candidateSlots");
function availableSlots({ date, covers, booked = [], blackouts = [], now = nowInZagreb() }) {
  if (!isValidDate(date))
    return [];
  if (covers < CONFIG.minParty || covers > CONFIG.maxParty)
    return [];
  if (date < now.date || date > addDays(now.date, CONFIG.horizonDays))
    return [];
  const turn = CONFIG.turnMinutes(covers);
  const earliest = date === now.date ? now.minutes + CONFIG.leadMinutes : -Infinity;
  return candidateSlots(date, covers).filter((start) => {
    if (start < earliest)
      return false;
    const end = start + turn;
    if (blackouts.some((b) => start < (b.end ?? 1440) && end > (b.start ?? 0)))
      return false;
    let concurrent = covers, starting = covers;
    for (const r of booked) {
      if (r.start < end && r.start + r.turn > start)
        concurrent += r.covers;
      if (r.start === start)
        starting += r.covers;
    }
    return concurrent <= CONFIG.capacity && starting <= CONFIG.pacing;
  }).map((start) => ({ start, time: hhmm(start), turn }));
}
__name(availableSlots, "availableSlots");
function validate({ date, time, covers, name, email, consentPrivacy }) {
  const errors = [];
  if (!isValidDate(date))
    errors.push("date");
  if (toMin(time) === null)
    errors.push("time");
  if (!Number.isInteger(covers) || covers < CONFIG.minParty || covers > CONFIG.maxParty)
    errors.push("covers");
  if (!name || String(name).trim().length < 2)
    errors.push("name");
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email).trim()))
    errors.push("email");
  if (!consentPrivacy)
    errors.push("consent");
  return errors;
}
__name(validate, "validate");

// api/availability.js
var json = /* @__PURE__ */ __name((body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    /* Short cache: a slot list is worth a few seconds of edge cache on a busy
       evening, but not more — it goes stale as people book. */
    "cache-control": "public, max-age=15"
  }
}), "json");
async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date") || "";
  const covers = Number(url.searchParams.get("covers") || 2);
  if (!isValidDate(date))
    return json({ error: "date" }, 400);
  if (!Number.isInteger(covers) || covers < CONFIG.minParty || covers > CONFIG.maxParty)
    return json({ error: "covers", maxParty: CONFIG.maxParty }, 400);
  const now = nowInZagreb();
  if (date < now.date || date > addDays(now.date, CONFIG.horizonDays))
    return json({ date, covers, slots: [] });
  if (!env.DB) {
    return json({ date, covers, slots: availableSlots({ date, covers, now }), unbound: true });
  }
  const [booked, blackouts] = await Promise.all([
    env.DB.prepare(
      "SELECT start_min AS start, turn_min AS turn, covers FROM reservations WHERE date = ? AND status = 'confirmed'"
    ).bind(date).all(),
    env.DB.prepare(
      "SELECT start_min AS start, end_min AS end FROM blackouts WHERE date = ?"
    ).bind(date).all()
  ]);
  const slots = availableSlots({
    date,
    covers,
    booked: booked.results ?? [],
    blackouts: blackouts.results ?? [],
    now
  });
  return json({ date, covers, slots });
}
__name(onRequestGet, "onRequestGet");

// _lib/mail.js
var API = "https://api.resend.com/emails";
var esc = /* @__PURE__ */ __name((s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]), "esc");
var hhmm2 = /* @__PURE__ */ __name((min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`, "hhmm");
async function send(env, { to, subject, html, replyTo }) {
  if (!env.RESEND_API_KEY) {
    console.log("[mail skipped \u2014 no RESEND_API_KEY]", subject, "->", to);
    return { skipped: true };
  }
  const r = await fetch(API, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      from: env.MAIL_FROM || "Theatrium <rezervacije@theatrium.hr>",
      to: [to],
      subject,
      html,
      ...replyTo ? { reply_to: replyTo } : {}
    })
  });
  if (!r.ok)
    throw new Error(`resend ${r.status}: ${await r.text()}`);
  return r.json();
}
__name(send, "send");
var wrap = /* @__PURE__ */ __name((inner) => `
<div style="font-family:Georgia,'Times New Roman',serif;background:#161513;color:#efe9dd;padding:32px 24px">
  <div style="max-width:520px;margin:0 auto">
    <p style="letter-spacing:.28em;text-transform:uppercase;font-size:12px;color:#c9a961;margin:0 0 24px">
      Theatrium by Filho
    </p>
    ${inner}
    <p style="margin-top:36px;font-size:12px;color:#7c7466;line-height:1.6">
      Teslina 7, Zagreb &middot; +385 99 5844 652<br>
      Podatke iz rezervacije koristimo isklju&#269;ivo za njezinu obradu.
    </p>
  </div>
</div>`, "wrap");
function sendGuestConfirmation(env, { name, email, date, start, covers, note, id, cancelToken, origin }) {
  const html = wrap(`
    <h1 style="font-size:26px;font-weight:normal;margin:0 0 16px">Rezervacija je potvr&#273;ena</h1>
    <p style="margin:0 0 20px;color:#a89f8f;line-height:1.7">
      Hvala, ${esc(name)}. O&#269;ekujemo vas.
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:16px">
      <tr><td style="padding:8px 0;color:#a89f8f">Datum</td><td style="padding:8px 0;text-align:right">${esc(date)}</td></tr>
      <tr><td style="padding:8px 0;color:#a89f8f">Vrijeme</td><td style="padding:8px 0;text-align:right">${hhmm2(start)}</td></tr>
      <tr><td style="padding:8px 0;color:#a89f8f">Gostiju</td><td style="padding:8px 0;text-align:right">${esc(covers)}</td></tr>
      ${note ? `<tr><td style="padding:8px 0;color:#a89f8f">Napomena</td><td style="padding:8px 0;text-align:right">${esc(note)}</td></tr>` : ""}
    </table>
    <p style="margin:28px 0 0;font-size:14px;color:#a89f8f;line-height:1.7">
      Ako ne mo&#382;ete do&#263;i, javite nam
      <a href="${origin}/otkazivanje/?t=${cancelToken}" style="color:#c9a961">jednim klikom</a>
      &mdash; stol tada mo&#382;e dobiti netko drugi.
    </p>
    <p style="margin:16px 0 0;font-size:12px;color:#7c7466">Broj rezervacije: ${esc(id).slice(0, 8)}</p>
  `);
  return send(env, {
    to: email,
    subject: `Rezervacija ${date} u ${hhmm2(start)} \u2014 Theatrium`,
    html,
    replyTo: env.MAIL_HOUSE || "joy@theatrium.hr"
  });
}
__name(sendGuestConfirmation, "sendGuestConfirmation");
function sendHouseNotice(env, { name, email, phone, date, start, covers, note, id }) {
  const to = env.MAIL_HOUSE || "joy@theatrium.hr";
  const html = wrap(`
    <h1 style="font-size:22px;font-weight:normal;margin:0 0 16px">Nova rezervacija</h1>
    <table style="width:100%;border-collapse:collapse;font-size:15px">
      <tr><td style="padding:6px 0;color:#a89f8f">Kada</td><td style="padding:6px 0;text-align:right">${esc(date)} &middot; ${hhmm2(start)}</td></tr>
      <tr><td style="padding:6px 0;color:#a89f8f">Gostiju</td><td style="padding:6px 0;text-align:right">${esc(covers)}</td></tr>
      <tr><td style="padding:6px 0;color:#a89f8f">Ime</td><td style="padding:6px 0;text-align:right">${esc(name)}</td></tr>
      <tr><td style="padding:6px 0;color:#a89f8f">E-mail</td><td style="padding:6px 0;text-align:right">${esc(email)}</td></tr>
      ${phone ? `<tr><td style="padding:6px 0;color:#a89f8f">Telefon</td><td style="padding:6px 0;text-align:right">${esc(phone)}</td></tr>` : ""}
      ${note ? `<tr><td style="padding:6px 0;color:#a89f8f">Napomena</td><td style="padding:6px 0;text-align:right">${esc(note)}</td></tr>` : ""}
    </table>
    <p style="margin:20px 0 0;font-size:12px;color:#7c7466">${esc(id)}</p>
  `);
  return send(env, { to, subject: `Rezervacija ${date} ${hhmm2(start)} \xB7 ${covers} os. \xB7 ${name}`, html, replyTo: email });
}
__name(sendHouseNotice, "sendHouseNotice");

// api/reservations.js
var json2 = /* @__PURE__ */ __name((body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
}), "json");
async function onRequestPost({ request, env }) {
  let body;
  try {
    body = request.headers.get("content-type")?.includes("application/json") ? await request.json() : Object.fromEntries(await request.formData());
  } catch {
    return json2({ error: "body" }, 400);
  }
  const covers = Number(body.covers);
  const input = {
    date: String(body.date || ""),
    time: String(body.time || ""),
    covers,
    name: String(body.name || "").trim().slice(0, 120),
    email: String(body.email || "").trim().slice(0, 200),
    phone: String(body.phone || "").trim().slice(0, 40),
    note: String(body.note || "").trim().slice(0, 1e3),
    consentPrivacy: body.consentPrivacy === true || body.consentPrivacy === "yes" || body.privacy === "yes",
    marketing: body.newsletter === "yes" || body.newsletter === true,
    locale: /^[a-z]{2}$/.test(String(body.locale || "")) ? String(body.locale) : "hr"
  };
  const errors = validate(input);
  if (errors.length)
    return json2({ error: "invalid", fields: errors }, 400);
  const now = nowInZagreb();
  if (input.date < now.date || input.date > addDays(now.date, CONFIG.horizonDays))
    return json2({ error: "outside-horizon" }, 400);
  const start = toMin(input.time);
  const turn = CONFIG.turnMinutes(covers);
  const end = start + turn;
  if (input.date === now.date && start < now.minutes + CONFIG.leadMinutes)
    return json2({ error: "too-soon", leadMinutes: CONFIG.leadMinutes }, 409);
  if (!env.DB)
    return json2({ error: "no-database" }, 503);
  const black = await env.DB.prepare(
    `SELECT 1 FROM blackouts WHERE date = ?
       AND COALESCE(start_min, 0) < ? AND COALESCE(end_min, 1440) > ? LIMIT 1`
  ).bind(input.date, end, start).first();
  if (black)
    return json2({ error: "closed" }, 409);
  const id = crypto.randomUUID();
  const cancelToken = crypto.randomUUID().replace(/-/g, "");
  const createdAt = (/* @__PURE__ */ new Date()).toISOString();
  const res = await env.DB.prepare(
    `INSERT INTO reservations
       (id, created_at, date, start_min, turn_min, covers, name, email, phone, note,
        status, cancel_token, consent_privacy_at, consent_marketing_at, locale, source)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10,
            'confirmed', ?11, ?2, ?12, ?13, 'web'
     WHERE (
       SELECT COALESCE(SUM(covers), 0) FROM reservations
        WHERE date = ?3 AND status = 'confirmed'
          AND start_min < ?14 AND start_min + turn_min > ?4
     ) + ?6 <= ?15
       AND (
       SELECT COALESCE(SUM(covers), 0) FROM reservations
        WHERE date = ?3 AND status = 'confirmed' AND start_min = ?4
     ) + ?6 <= ?16`
  ).bind(
    id,
    createdAt,
    input.date,
    start,
    turn,
    covers,
    input.name,
    input.email,
    input.phone || null,
    input.note || null,
    cancelToken,
    input.marketing ? createdAt : null,
    input.locale,
    end,
    CONFIG.capacity,
    CONFIG.pacing
  ).run();
  if (!res.meta || res.meta.changes !== 1) {
    return json2({ error: "slot-taken" }, 409);
  }
  const origin = new URL(request.url).origin;
  try {
    await Promise.all([
      sendGuestConfirmation(env, { ...input, id, start, cancelToken, origin }),
      sendHouseNotice(env, { ...input, id, start })
    ]);
  } catch (err) {
    console.error("reservation mail failed", id, err?.message);
  }
  return json2({
    ok: true,
    id,
    date: input.date,
    time: input.time,
    covers,
    cancelUrl: `${origin}/otkazivanje/?t=${cancelToken}`
  }, 201);
}
__name(onRequestPost, "onRequestPost");

// ../.wrangler/tmp/pages-p0oo0l/functionsRoutes-0.4691683659619579.mjs
var routes = [
  {
    routePath: "/api/availability",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/reservations",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  }
];

// ../node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult) {
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: mountMatchResult.path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: () => {
            isFailOpen = true;
          }
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");

// ../node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// ../.wrangler/tmp/bundle-wjGJxy/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = pages_template_worker_default;

// ../node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// ../.wrangler/tmp/bundle-wjGJxy/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=functionsWorker-0.35211041796661613.mjs.map
