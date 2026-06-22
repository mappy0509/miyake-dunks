"use strict";

/* ---------- 共通 ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

async function loadJSON(path) {
  try {
    const r = await fetch(path + "?t=" + Date.now());
    if (!r.ok) throw new Error(r.status);
    return await r.json();
  } catch (e) {
    console.warn("読み込み失敗:", path, e);
    return null;
  }
}

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 1600);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("コピーしました");
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta); ta.select();
    document.execCommand("copy"); ta.remove();
    toast("コピーしました");
  }
}

const fmtDate = (iso) => {
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return iso;
  const w = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()}（${w}）`;
};

/* ---------- タブ ---------- */
$$(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    $$(".tab").forEach((t) => t.classList.remove("is-active"));
    $$(".panel").forEach((p) => p.classList.remove("is-active"));
    tab.classList.add("is-active");
    $("#" + tab.dataset.tab).classList.add("is-active");
  });
});

/* ---------- 練習メニュー ---------- */
async function renderPractice() {
  const data = await loadJSON("data/practice.json");
  const wrap = $("#practice-list");
  if (!data || !data.menus?.length) { wrap.innerHTML = `<p class="empty-note">メニューがまだありません。<br>data/practice.json に追加してください。</p>`; return; }
  if (data.updated) $("#practice-updated").textContent = "更新 " + data.updated;
  wrap.innerHTML = data.menus.map((m) => `
    <div class="card">
      <div class="row1">
        <span class="badge">${esc(m.category)}</span>
        <span class="name">${esc(m.name)}</span>
        ${m.time ? `<span class="badge time">${esc(m.time)}</span>` : ""}
      </div>
      ${m.detail ? `<div class="detail">${esc(m.detail)}</div>` : ""}
    </div>`).join("");
}

/* ---------- スケジュール ---------- */
let scheduleData = null;
let scheduleFilter = "all";

function renderScheduleList() {
  const wrap = $("#schedule-list");
  const events = (scheduleData?.events || [])
    .filter((e) => scheduleFilter === "all" || e.type === scheduleFilter)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  if (!events.length) { wrap.innerHTML = `<p class="empty-note">予定がまだありません。<br>data/schedule.json に追加してください。</p>`; return; }
  wrap.innerHTML = events.map((e) => {
    const isFile = e.file && !e.file.endsWith("/");
    return `
    <div class="card">
      <div class="row1">
        <span class="badge ${esc(e.type)}">${esc(e.type)}</span>
        <span class="ev-date">${fmtDate(e.date)}</span>
      </div>
      <div class="name" style="margin-top:6px">${esc(e.title)}</div>
      <div class="ev-meta">
        ${e.time ? `<span>⏰ ${esc(e.time)}</span>` : ""}
        ${e.place ? `<span>📍 ${esc(e.place)}</span>` : ""}
      </div>
      ${e.note ? `<div class="detail">${esc(e.note)}</div>` : ""}
      ${isFile ? `<a class="ev-file" href="${encodeURI(e.file)}" target="_blank" rel="noopener">📎 資料を開く</a>` : ""}
    </div>`;
  }).join("");
}

async function renderSchedule() {
  scheduleData = await loadJSON("data/schedule.json");
  if (scheduleData?.updated) $("#schedule-updated").textContent = "更新 " + scheduleData.updated;
  $$("#schedule-filter .chip").forEach((c) => c.addEventListener("click", () => {
    $$("#schedule-filter .chip").forEach((x) => x.classList.remove("is-active"));
    c.classList.add("is-active");
    scheduleFilter = c.dataset.type;
    renderScheduleList();
  }));
  renderScheduleList();
}

/* ---------- SNS 投稿カレンダー ---------- */
let snsData = null;
let calY, calM; // 表示中の年・月(0-11)
let selDate = null;

function renderCalendar() {
  const cal = $("#calendar");
  $("#cal-label").textContent = `${calY}年 ${calM + 1}月`;
  const first = new Date(calY, calM, 1);
  const startDow = first.getDay();
  const days = new Date(calY, calM + 1, 0).getDate();
  const postDays = new Set((snsData?.posts || [])
    .filter((p) => { const d = new Date(p.date + "T00:00:00"); return d.getFullYear() === calY && d.getMonth() === calM; })
    .map((p) => new Date(p.date + "T00:00:00").getDate()));

  let html = ["日", "月", "火", "水", "木", "金", "土"].map((d) => `<div class="cal-dow">${d}</div>`).join("");
  for (let i = 0; i < startDow; i++) html += `<div class="cal-cell empty"></div>`;
  for (let d = 1; d <= days; d++) {
    const dow = new Date(calY, calM, d).getDay();
    const iso = `${calY}-${String(calM + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const has = postDays.has(d);
    const cls = ["cal-cell", dow === 0 ? "sun" : "", dow === 6 ? "sat" : "", has ? "has-post" : "", iso === selDate ? "is-sel" : ""].join(" ").trim();
    html += `<div class="${cls}" data-date="${iso}">${d}${has ? '<span class="dot"></span>' : ""}</div>`;
  }
  cal.innerHTML = html;
  $$(".cal-cell.has-post", cal).forEach((c) => c.addEventListener("click", () => { selDate = c.dataset.date; renderCalendar(); renderSnsDay(); }));
}

function renderSnsDay() {
  const wrap = $("#sns-day");
  if (!selDate) { wrap.innerHTML = `<p class="empty-note">🟠印の日をタップすると投稿内容を確認できます</p>`; return; }
  const posts = (snsData?.posts || []).filter((p) => p.date === selDate);
  if (!posts.length) { wrap.innerHTML = ""; return; }
  wrap.innerHTML = `<h3 style="font-size:15px">${fmtDate(selDate)} の投稿</h3>` + posts.map((p, i) => `
    <div class="post">
      <div class="top">
        <span class="platform">${esc(p.platform || "投稿")}</span>
        ${p.title ? `<span style="font-size:13px;color:var(--muted)">${esc(p.title)}</span>` : ""}
        <span class="status">${esc(p.status || "予定")}</span>
      </div>
      ${p.caption ? `<pre>${esc(p.caption)}</pre>` : ""}
      ${p.hashtags ? `<div class="tags">${esc(p.hashtags)}</div>` : ""}
      <div style="margin-top:10px">
        ${p.caption ? `<button class="copy-btn" data-copy="cap" data-i="${i}">キャプションをコピー</button>` : ""}
        ${p.hashtags ? `<button class="copy-btn ghost" data-copy="tag" data-i="${i}">タグをコピー</button>` : ""}
      </div>
    </div>`).join("");
  $$("[data-copy]", wrap).forEach((b) => b.addEventListener("click", () => {
    const p = posts[+b.dataset.i];
    copyText(b.dataset.copy === "cap" ? p.caption : p.hashtags);
  }));
}

async function renderSns() {
  snsData = await loadJSON("data/sns.json");
  if (snsData?.updated) $("#sns-updated").textContent = "更新 " + snsData.updated;
  // 投稿がある最初の月、なければ今月を表示
  const now = new Date();
  const future = (snsData?.posts || []).map((p) => p.date).filter(Boolean).sort();
  const base = future.length ? new Date(future[0] + "T00:00:00") : now;
  calY = base.getFullYear(); calM = base.getMonth();
  $("#cal-prev").addEventListener("click", () => { calM--; if (calM < 0) { calM = 11; calY--; } renderCalendar(); });
  $("#cal-next").addEventListener("click", () => { calM++; if (calM > 11) { calM = 0; calY++; } renderCalendar(); });
  renderCalendar();
  renderSnsDay();
}

/* ---------- 起動 ---------- */
renderPractice();
renderSchedule();
renderSns();
