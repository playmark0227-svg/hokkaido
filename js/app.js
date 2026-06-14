// ========================================================
// Hokkaido Travel Note — Chat-first AI Planner
// Claude API + Inline Itinerary Cards + Side Map
// ========================================================

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

const REGION_COLORS = {
  doo:    '#E84A38',
  donan:  '#F09040',
  doto:   '#6FAE52',
  dohoku: '#4A8DC0',
};

// Cycle palette for days in the user's plan
const DAY_COLORS = ['#E84A38', '#F09040', '#6FAE52', '#4A8DC0', '#9C6BCC', '#D8A24A'];

const SPOT_BY_ID = Object.fromEntries(SPOTS.map(s => [s.id, s]));

// ─────────────────────────────────────────────
// Geo helpers — distance & rough drive-time estimates
// Hokkaido is rural; ~45km/h average incl. roads/stops.
// ─────────────────────────────────────────────
const AVG_KMH = 45;
function haversineKm(a, b) {
  if (!a || !b) return 0;
  const R = 6371;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function estimateDriveMin(km) {
  // Add ~15% for road winding vs straight line, then time at avg speed
  return Math.round((km * 1.15) / AVG_KMH * 60);
}
function formatKm(km) {
  if (km < 1) return Math.round(km * 1000) + 'm';
  if (km < 10) return km.toFixed(1) + 'km';
  return Math.round(km) + 'km';
}
function formatDuration(min) {
  if (min < 1) return 'すぐ';
  if (min < 60) return `約${min}分`;
  const h = Math.floor(min / 60);
  const m = Math.round(min / 5) * 5 % 60;
  return m ? `約${h}時間${m}分` : `約${h}時間`;
}
// Legs between consecutive spots in a day. Index i = leg from spot i → i+1,
// aligned with the full spotIds order (null when either coord is missing).
function dayLegs(day) {
  const legs = [];
  for (let i = 1; i < day.spotIds.length; i++) {
    const a = SPOT_BY_ID[day.spotIds[i - 1]]?.coords;
    const b = SPOT_BY_ID[day.spotIds[i]]?.coords;
    if (!a || !b) { legs.push(null); continue; }
    const km = haversineKm(a, b);
    legs.push({ km, min: estimateDriveMin(km) });
  }
  return legs;
}
function dayTotals(day) {
  const legs = dayLegs(day);
  return {
    km: legs.reduce((s, l) => s + (l ? l.km : 0), 0),
    min: legs.reduce((s, l) => s + (l ? l.min : 0), 0),
    legs,
  };
}

const PLAN_STORAGE_KEY = 'hokkaido_user_plan_v1';
const TRIP_DATES_STORAGE_KEY = 'hokkaido_trip_dates_v1';
const MAX_TOOL_RECURSION = 5;
const API_TIMEOUT_MS = 90_000;
const MAX_HISTORY = 40; // Cap apiMessages so the request stays small/cheap

// Mapping of nights label → number of days the plan should have
const NIGHTS_TO_DAYS = {
  '日帰り':  1,
  '1泊2日': 2,
  '2泊3日': 3,
  '3泊4日': 4,
  '4泊以上': 5,
};

function getApiUrl() {
  const proxyUrl = (window.ANTHROPIC_PROXY_URL || '').trim();
  if (!proxyUrl) return '';
  return proxyUrl.replace(/\/+$/, '') + '/v1/messages';
}

// ─────────────────────────────────────────────
// State
// ─────────────────────────────────────────────
const state = {
  apiMessages: [],
  isStreaming: false,
  highlightedSpotIds: new Set(),
  plan: { days: [] },
  flow: 'dates',                                       // 'dates' | 'builder'
  tripDates: null,                                     // { nights, season } once set
  builder: { tab: 'destination', activeDayIdx: 0, selectedArea: null },
};

// ─────────────────────────────────────────────
// Storage helpers (used by plan persistence)
// ─────────────────────────────────────────────
function safeStorageGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
function safeStorageSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (_) { return false; } }

// ─────────────────────────────────────────────
// User Plan (curated by clicking "+ 候補に追加")
// ─────────────────────────────────────────────
function newDayId() {
  return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
function defaultPlan() {
  return { days: [
    { id: newDayId(), spotIds: [] },
    { id: newDayId(), spotIds: [] },
    { id: newDayId(), spotIds: [] },
  ]};
}
function loadPlan() {
  const raw = safeStorageGet(PLAN_STORAGE_KEY);
  if (!raw) { state.plan = defaultPlan(); return; }
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.days)) throw new Error('invalid shape');
    state.plan = {
      days: parsed.days.map(d => ({
        id: typeof d.id === 'string' ? d.id : newDayId(),
        spotIds: Array.isArray(d.spotIds) ? d.spotIds.filter(id => SPOT_BY_ID[id]) : [],
      })),
    };
    if (state.plan.days.length === 0) state.plan = defaultPlan();
  } catch (_) {
    state.plan = defaultPlan();
  }
}

function loadTripDates() {
  const raw = safeStorageGet(TRIP_DATES_STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.nights === 'string') {
      state.tripDates = { nights: parsed.nights, season: parsed.season || '' };
    }
  } catch (_) {}
}
function saveTripDates() {
  try { localStorage.setItem(TRIP_DATES_STORAGE_KEY, JSON.stringify(state.tripDates)); } catch (_) {}
}
// Resize the plan to match nights (only when growing — never destroys existing spots).
function ensurePlanDays(targetDays) {
  while (state.plan.days.length < targetDays) {
    state.plan.days.push({ id: newDayId(), spotIds: [] });
  }
}

// Switch top-level screen. Updates body class so CSS can swap layouts.
function switchScreen(name) {
  state.flow = name;
  document.body.classList.toggle('flow-dates',    name === 'dates');
  document.body.classList.toggle('flow-builder',  name === 'builder');
  $$('.screen').forEach(s => { s.hidden = (s.dataset.screen !== name); });
  // Map size changes between screens — re-measure + adjust interactions
  setTimeout(() => {
    map?.invalidateSize();
    if (name === 'builder') {
      // In builder mode the map is a full panel — enable interactions
      setMapInteractions(true);
      // Re-fit Hokkaido after the panel resize
      map?.fitBounds(HOKKAIDO_BOUNDS, { padding: [10, 10], maxZoom: 8 });
    }
  }, 280);
}
function savePlan() {
  try { localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(state.plan)); } catch (_) {}
}
function planTotalCount() {
  return state.plan.days.reduce((n, d) => n + d.spotIds.length, 0);
}
function isInPlan(spotId) {
  return state.plan.days.some(d => d.spotIds.includes(spotId));
}
function findSpotDayIndex(spotId) {
  return state.plan.days.findIndex(d => d.spotIds.includes(spotId));
}
function addToPlan(spotId, dayIndex = 0) {
  if (!SPOT_BY_ID[spotId]) return;
  if (isInPlan(spotId)) return;
  while (state.plan.days.length <= dayIndex) {
    state.plan.days.push({ id: newDayId(), spotIds: [] });
  }
  state.plan.days[dayIndex].spotIds.push(spotId);
  onPlanChanged();
  // On desktop, the panel is already always visible. On mobile, leave the
  // collapsed/expanded state as the user set it — only nudge the count
  // badge so the addition is noticeable.
  pulseCountBadge();
}

function pulseCountBadge() {
  const el = $('#planner-head-count');
  if (!el) return;
  el.classList.remove('is-pulse');
  // force reflow so the animation restarts even on consecutive adds
  void el.offsetWidth;
  el.classList.add('is-pulse');
}
function removeFromPlan(spotId) {
  const idx = findSpotDayIndex(spotId);
  if (idx === -1) return;
  state.plan.days[idx].spotIds = state.plan.days[idx].spotIds.filter(id => id !== spotId);
  onPlanChanged();
}
function addDay() {
  state.plan.days.push({ id: newDayId(), spotIds: [] });
  onPlanChanged();
}
function removeDay(dayIndex) {
  if (state.plan.days.length <= 1) return;
  state.plan.days.splice(dayIndex, 1);
  onPlanChanged();
}
function clearPlan() {
  state.plan = defaultPlan();
  onPlanChanged();
}

// ── Reorder: linear up/down across the whole multi-day sequence ──
function spotPosition(spotId) {
  for (let d = 0; d < state.plan.days.length; d++) {
    const p = state.plan.days[d].spotIds.indexOf(spotId);
    if (p !== -1) return { dayIdx: d, pos: p };
  }
  return null;
}
function moveSpotUp(spotId) {
  const loc = spotPosition(spotId);
  if (!loc) return;
  const { dayIdx, pos } = loc;
  const day = state.plan.days[dayIdx];
  if (pos > 0) {
    // swap within the same day
    [day.spotIds[pos - 1], day.spotIds[pos]] = [day.spotIds[pos], day.spotIds[pos - 1]];
  } else if (dayIdx > 0) {
    // move to the end of the previous day
    day.spotIds.splice(pos, 1);
    state.plan.days[dayIdx - 1].spotIds.push(spotId);
  } else {
    return;
  }
  onPlanChanged();
}
function moveSpotDown(spotId) {
  const loc = spotPosition(spotId);
  if (!loc) return;
  const { dayIdx, pos } = loc;
  const day = state.plan.days[dayIdx];
  if (pos < day.spotIds.length - 1) {
    [day.spotIds[pos + 1], day.spotIds[pos]] = [day.spotIds[pos], day.spotIds[pos + 1]];
  } else if (dayIdx < state.plan.days.length - 1) {
    // move to the start of the next day
    day.spotIds.splice(pos, 1);
    state.plan.days[dayIdx + 1].spotIds.unshift(spotId);
  } else {
    return;
  }
  onPlanChanged();
}
// Day reordering (入れ替え)
function moveDayUp(dayIdx) {
  if (dayIdx <= 0) return;
  const d = state.plan.days;
  [d[dayIdx - 1], d[dayIdx]] = [d[dayIdx], d[dayIdx - 1]];
  onPlanChanged();
}
function moveDayDown(dayIdx) {
  if (dayIdx >= state.plan.days.length - 1) return;
  const d = state.plan.days;
  [d[dayIdx + 1], d[dayIdx]] = [d[dayIdx], d[dayIdx + 1]];
  onPlanChanged();
}
// Free-form move for drag & drop: place spotId at (targetDayIdx, targetPos)
function reorderSpot(spotId, targetDayIdx, targetPos) {
  const loc = spotPosition(spotId);
  if (!loc) return;
  if (targetDayIdx < 0 || targetDayIdx >= state.plan.days.length) return;
  // remove from current
  state.plan.days[loc.dayIdx].spotIds.splice(loc.pos, 1);
  // adjust target pos if same day and removing earlier element
  let pos = targetPos;
  if (loc.dayIdx === targetDayIdx && loc.pos < targetPos) pos -= 1;
  const arr = state.plan.days[targetDayIdx].spotIds;
  pos = Math.max(0, Math.min(pos, arr.length));
  arr.splice(pos, 0, spotId);
  onPlanChanged();
}

// ── Share / save: encode plan into the URL ──
function encodePlan() {
  // day1id,id2;day2id,...  → URL-safe
  return state.plan.days.map(d => d.spotIds.join(',')).join(';');
}
function applyEncodedPlan(str) {
  if (!str) return false;
  try {
    const days = decodeURIComponent(str).split(';').map(seg => ({
      id: newDayId(),
      spotIds: seg.split(',').map(s => s.trim()).filter(id => SPOT_BY_ID[id]),
    }));
    if (!days.length) return false;
    state.plan = { days };
    return true;
  } catch (_) { return false; }
}
function buildShareUrl() {
  const base = location.origin + location.pathname;
  return base + '#plan=' + encodeURIComponent(encodePlan());
}
async function copyShareLink() {
  if (planTotalCount() === 0) { toast('プランが空です。先にスポットを追加してください。'); return; }
  const url = buildShareUrl();
  try {
    await navigator.clipboard.writeText(url);
    toast('共有リンクをコピーしました ✓');
  } catch (_) {
    // Fallback: show a prompt for manual copy
    window.prompt('この共有リンクをコピーしてください:', url);
  }
}

// ── Print / PDF ──
function buildPrintHTML() {
  let html = `<h1>北海道 旅プラン</h1>`;
  html += `<p class="print-meta">ほっかいどう旅手帳 — ${new Date().toLocaleDateString('ja-JP')}</p>`;
  state.plan.days.forEach((day, i) => {
    if (!day.spotIds.length) return;
    const totals = dayTotals(day);
    html += `<section class="print-day"><h2>DAY ${i + 1}` +
      (totals.km > 0 ? ` <span class="print-day-stat">移動 ${formatKm(totals.km)} / ${formatDuration(totals.min)}</span>` : '') +
      `</h2><ol>`;
    day.spotIds.forEach(id => {
      const s = SPOT_BY_ID[id];
      if (!s) return;
      html += `<li><strong>${escapeHtml(s.name)}</strong> <span class="print-area-tag">📍${escapeHtml(s.area)}</span><br>` +
        `<span class="print-desc">${escapeHtml(s.description)}</span></li>`;
    });
    html += `</ol></section>`;
  });
  return html;
}
function printPlan() {
  if (planTotalCount() === 0) { toast('プランが空です。'); return; }
  const area = $('#print-area');
  if (area) area.innerHTML = buildPrintHTML();
  window.print();
}

// ── Toast (lightweight, transient) ──
let toastTimer = null;
function toast(msg) {
  let el = $('#toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2600);
}

function onPlanChanged() {
  savePlan();
  renderPlannerDrawer();
  renderPlanOnMap();
  refreshPlanAddButtons();
  updatePlanCount();
  // Builder UI (only rendered if we're on the builder screen)
  if (state.flow === 'builder') {
    renderBuilderHeader();
    renderDayPicker();
  }
}
function updatePlanCount() {
  const n = planTotalCount();
  // Nav badge (mobile drawer toggle button — currently hidden)
  const el = $('#plan-count');
  if (el) {
    el.textContent = n;
    el.classList.toggle('is-empty', n === 0);
  }
  // Header inline count (shown next to "あなたのプラン")
  const headCount = $('#planner-head-count');
  if (headCount) {
    headCount.textContent = n;
    headCount.hidden = n === 0;
  }
}

// ── Mobile pull-down: collapse / expand the planner ──
function isMobileLayout() {
  return window.matchMedia('(max-width: 960px)').matches;
}
function setPlannerCollapsed(collapsed) {
  const d = $('#planner-drawer');
  if (!d) return;
  d.classList.toggle('is-collapsed', collapsed);
}
function togglePlannerCollapsed() {
  const d = $('#planner-drawer');
  if (!d) return;
  d.classList.toggle('is-collapsed');
}

// ─────────────────────────────────────────────
// Map (Leaflet)
// ─────────────────────────────────────────────
let map, markerLayer, planLayer;
const markerById = {};

// Approximate bounds of mainland Hokkaido (incl. Hakodate & Wakkanai)
const HOKKAIDO_BOUNDS = [[41.35, 139.6], [45.6, 146.0]];

function initMap() {
  if (typeof L === 'undefined') { setTimeout(initMap, 100); return; }
  map = L.map('map', {
    center: [43.4, 142.7],
    zoom: 6,
    scrollWheelZoom: true,
    zoomControl: true,
  });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '© OpenStreetMap'
  }).addTo(map);
  markerLayer = L.layerGroup().addTo(map);
  planLayer = L.layerGroup().addTo(map);
  SPOTS.forEach(addMarker);
  renderPlanOnMap();
  // Fit Hokkaido into whatever container size we have (esp. mobile thumbnail)
  setTimeout(() => {
    map.invalidateSize();
    map.fitBounds(HOKKAIDO_BOUNDS, { padding: [6, 6], maxZoom: 8 });
  }, 250);
}

function renderPlanOnMap() {
  if (!planLayer || !map) return;
  planLayer.clearLayers();
  state.plan.days.forEach((day, dayIdx) => {
    const color = DAY_COLORS[dayIdx % DAY_COLORS.length];
    const coords = [];
    day.spotIds.forEach((sid, orderIdx) => {
      const spot = SPOT_BY_ID[sid];
      if (!spot?.coords) return;
      coords.push(spot.coords);
      const icon = L.divIcon({
        className: 'plan-pin',
        html: `<span style="background:${color}">${orderIdx + 1}</span>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      const marker = L.marker(spot.coords, { icon, zIndexOffset: 500 + dayIdx * 10 });
      marker.bindPopup(`
        <div class="map-popup">
          <strong>DAY ${dayIdx + 1}-${orderIdx + 1} ${escapeHtml(spot.name)}</strong>
          <p>${escapeHtml(spot.description)}</p>
          <small>📍 ${escapeHtml(spot.area)}</small>
        </div>
      `);
      planLayer.addLayer(marker);
    });
    if (coords.length >= 2) {
      const line = L.polyline(coords, {
        color,
        weight: 3.5,
        opacity: 0.85,
        dashArray: '8, 6',
        lineCap: 'round',
      });
      const t = dayTotals(day);
      line.bindTooltip(
        `DAY ${dayIdx + 1}・移動 ${formatKm(t.km)} / ${formatDuration(t.min)}`,
        { sticky: true, className: 'route-tooltip' }
      );
      planLayer.addLayer(line);
    }
  });
}

function addMarker(spot) {
  if (!spot.coords) return;
  const color = REGION_COLORS[spot.region] || '#3D2817';
  const icon = L.divIcon({
    className: 'spot-pin',
    html: `<span style="background:${color}"></span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
  const m = L.marker(spot.coords, { icon }).addTo(markerLayer);
  m.bindPopup(`
    <div class="map-popup">
      <strong>${escapeHtml(spot.name)}</strong>
      <span class="map-popup-en">${escapeHtml(spot.nameEn)}</span>
      <p>${escapeHtml(spot.description)}</p>
      <small>📍 ${escapeHtml(spot.area)} · ${escapeHtml(spot.bestSeason)}</small>
    </div>
  `);
  markerById[spot.id] = m;
}

function refreshHighlights() {
  Object.entries(markerById).forEach(([id, marker]) => {
    const spot = SPOT_BY_ID[id];
    if (!spot) return;
    const isHL = state.highlightedSpotIds.has(id);
    const color = isHL ? '#E84A38' : (REGION_COLORS[spot.region] || '#3D2817');
    const icon = L.divIcon({
      className: 'spot-pin' + (isHL ? ' is-fav' : ''),
      html: `<span style="background:${color}"></span>`,
      iconSize: isHL ? [28, 28] : [22, 22],
      iconAnchor: isHL ? [14, 14] : [11, 11],
    });
    marker.setIcon(icon);
  });
}

function flyToSpots(ids) {
  if (!map) return;
  const coords = ids.map(id => SPOT_BY_ID[id]?.coords).filter(Boolean);
  if (!coords.length) return;
  if (coords.length === 1) {
    map.flyTo(coords[0], 10, { duration: 0.8 });
  } else {
    const bounds = L.latLngBounds(coords);
    if (bounds.isValid()) map.flyToBounds(bounds, { padding: [40, 40], duration: 0.8 });
  }
}

// ─────────────────────────────────────────────
// Claude API: System prompt + Tool
// ─────────────────────────────────────────────
const SPOTS_FOR_AI = SPOTS.map(s => ({
  id: s.id,
  name: s.name,
  region: s.region,
  area: s.area,
  categories: s.categories,
  bestSeason: s.bestSeason,
  description: s.description,
  accessTime: s.accessTime,
  hasVideo: !!s.videoUrl,
}));

const SYSTEM_INSTRUCTIONS = `あなたは北海道専門の旅行プランナーです。ユーザーの要望に対して、すぐにおすすめスポットを提案します。

【最重要: まず提案する】
- ユーザーの最初の発言だけでも、必ず propose_spots ツールを呼んでスポットを提案する
- 「期間は?」「人数は?」など事前ヒアリングはしない。情報が少なくても推測で提案する
- たとえば「札幌行きたい」だけでも → 札幌エリアの定番8スポットを即提案
- 「北海道」だけでも → 全道の有名スポットを混ぜて提案
- 「温泉に入りたい」だけでも → 道内の温泉スポットを提案
- 何も指定がなくても → 北海道の代表的なスポットを提案
- 提案後に「日程や人数を教えてもらえれば絞り込めます」と一言添えるのは OK
- 「もう少し違う案」「○○を入れて」「○○エリアで」と言われたら、再度ツールを呼んで違うスポットを提案

【話し方】
- 親しみやすいが落ち着いたトーン。絵文字や「♪」は避ける
- 1〜2文で簡潔に。長い前置きはしない
- 道外の人にも分かりやすい言葉で。地元用語の「道央/道南/道東/道北」は使わず、
  代わりに「札幌・小樽エリア」「函館エリア」「知床・釧路エリア」「旭川・稚内エリア」のように
  具体的な地名で表現する

【ツール使用】
- propose_spots ツールでフラットなおすすめリストを返す (日割りはしない)
- 1回の提案で 6〜12 スポット
- 各スポットに「なぜおすすめか」「楽しみ方」を1〜2文の comment で添える
- スポットIDは渡されたデータの id を必ず使う
- ユーザーは提案された中から自分で選んで、右の「あなたのプラン」に組み立てる仕組み

【スポット選定の指針】
- ユーザーの条件に合致するものを優先 (キーワード・エリア・季節など)
- 条件が曖昧なら、有名どころ・行きやすい場所を優先
- エリア・テーマのバランスを考慮
- 「hasVideo: true」のスポットも、適合度が高いなら積極的に含めてよい
- 同じスポットは1つの提案内で重複させない

【参考: スポットデータのregion値 (内部用)】
- doo    = 札幌・小樽・富良野・美瑛・ニセコ・登別 (北海道中央エリア)
- donan  = 函館・松前・大沼 (北海道南エリア)
- doto   = 知床・釧路・網走・阿寒・帯広 (北海道東エリア)
- dohoku = 旭川・稚内・利尻礼文・サロベツ (北海道北エリア)

【プランの講評・相談への対応】
- ユーザーが「今のプランどう?」「講評して」と聞いてきたら、提示される現在のプラン内容をもとに:
  - 全体の印象を一言
  - 季節・天候の注意点 (例: 冬は流氷、夏はラベンダー、雪道の運転など)
  - 移動の効率 (離れたエリアが混在していないか。1日の移動が長すぎないか)
  - 足りないジャンル (グルメ/温泉/自然などの偏り) があれば指摘
  - 必要なら propose_spots で追加候補を提案
- 移動距離の目安が提示された場合はそれを踏まえてコメントする

【ツール呼び出し後】
- 短く一言「いかがでしょうか?」「気になるところはありますか?」程度で済ませる
- スポットの説明をテキストで繰り返さない (UIに表示されるので不要)
`;

// Compact text description of the user's current plan, for AI awareness.
function planSummaryText() {
  if (planTotalCount() === 0) return '（ユーザーのプランはまだ空です）';
  return state.plan.days.map((day, i) => {
    if (!day.spotIds.length) return `DAY ${i + 1}: (空)`;
    const names = day.spotIds.map(id => SPOT_BY_ID[id]?.name).filter(Boolean).join(' → ');
    const t = dayTotals(day);
    const move = t.km > 0 ? ` [移動目安 ${formatKm(t.km)}/${formatDuration(t.min)}]` : '';
    return `DAY ${i + 1}: ${names}${move}`;
  }).join('\n');
}

function buildSystem() {
  return [
    { type: 'text', text: SYSTEM_INSTRUCTIONS },
    {
      type: 'text',
      text: `# 利用可能な北海道観光スポット (64件)\n${JSON.stringify(SPOTS_FOR_AI)}`,
      cache_control: { type: 'ephemeral' },
    },
    // Dynamic (not cached) — placed after the cache breakpoint so it never
    // invalidates the big spots-data cache above.
    {
      type: 'text',
      text: `# ユーザーが現在組んでいるプラン (リアルタイム)\n${planSummaryText()}`,
    },
  ];
}

const TOOLS = [{
  name: 'propose_spots',
  description: '対話で集めた条件に基づき、北海道のおすすめ観光スポットをフラットに提案する。「こんなところどうですか?」というニュアンスで、ユーザーが自分で選んで自分のプランに組み立てられるようにする。日割りはしない。再提案する場合も同じツールを呼ぶ。',
  input_schema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: '提案のタイトル。例: 「札幌・小樽でおすすめの温泉とグルメスポット」'
      },
      intro: {
        type: 'string',
        description: '提案の前置きを1〜2文で。例: 「以下のスポットがあなたの条件に合いそうです」'
      },
      spots: {
        type: 'array',
        description: '提案するスポットを並べる。6〜12個程度。',
        items: {
          type: 'object',
          properties: {
            spot_id: { type: 'string', description: '提供データの id を必ず使う' },
            comment: { type: 'string', description: 'なぜおすすめか・楽しみ方を1〜2文で。' },
          },
          required: ['spot_id', 'comment']
        }
      }
    },
    required: ['title', 'spots']
  }
}];

// ─────────────────────────────────────────────
// Direct fetch to Anthropic API with SSE parse
// ─────────────────────────────────────────────
async function callClaudeStream({ system, tools, messages, onTextDelta }) {
  const apiUrl = getApiUrl();
  if (!apiUrl) {
    const e = new Error('プロキシURLが設定されていません (js/config.js の ANTHROPIC_PROXY_URL)');
    e.status = 0;
    throw e;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-8',
        max_tokens: 3000,
        system,
        tools,
        messages,
        stream: true,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      const e = new Error(`タイムアウト (${API_TIMEOUT_MS / 1000}秒以内に応答なし)`);
      e.status = 0;
      throw e;
    }
    throw err;
  }
  clearTimeout(timeoutId);

  if (!response.ok) {
    let errMsg = `HTTP ${response.status}`;
    let errType = null;
    try {
      const errData = await response.json();
      if (errData?.error?.message) errMsg = errData.error.message;
      if (errData?.error?.type) errType = errData.error.type;
    } catch (_) {}
    const e = new Error(errMsg);
    e.status = response.status;
    if (errType) e.type = errType;
    throw e;
  }
  if (!response.body) throw new Error('レスポンスにストリームがありません');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const contentBlocks = [];
  const toolInputBuffers = {};
  let stopReason = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nlnl;
    while ((nlnl = buffer.indexOf('\n\n')) !== -1) {
      const chunk = buffer.slice(0, nlnl);
      buffer = buffer.slice(nlnl + 2);
      for (const line of chunk.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        let event;
        try { event = JSON.parse(data); } catch { continue; }
        if (event.type === 'content_block_start') {
          const idx = event.index;
          const block = { ...event.content_block };
          contentBlocks[idx] = block;
          if (block.type === 'tool_use') toolInputBuffers[idx] = '';
        } else if (event.type === 'content_block_delta') {
          const idx = event.index;
          const block = contentBlocks[idx];
          if (event.delta.type === 'text_delta') {
            block.text = (block.text || '') + event.delta.text;
            if (onTextDelta) onTextDelta(event.delta.text);
          } else if (event.delta.type === 'input_json_delta') {
            toolInputBuffers[idx] += event.delta.partial_json;
          }
        } else if (event.type === 'content_block_stop') {
          const idx = event.index;
          const block = contentBlocks[idx];
          if (block && block.type === 'tool_use' && toolInputBuffers[idx]) {
            try { block.input = JSON.parse(toolInputBuffers[idx]); }
            catch { block.input = {}; }
          }
        } else if (event.type === 'message_delta') {
          if (event.delta?.stop_reason) stopReason = event.delta.stop_reason;
        } else if (event.type === 'error') {
          const err = new Error(event.error?.message || 'Stream error');
          err.type = event.error?.type;
          throw err;
        }
      }
    }
  }
  return { content: contentBlocks.filter(Boolean), stop_reason: stopReason };
}

// ─────────────────────────────────────────────
// Builder topic chips (used by グルメ / 体験 tabs)
// ─────────────────────────────────────────────
const TOPIC_FOODS = [
  { v: '海鮮丼',          l: '🐟 海鮮丼' },
  { v: '寿司',            l: '🍣 寿司' },
  { v: 'ラーメン',        l: '🍜 ラーメン' },
  { v: 'ジンギスカン',    l: '🥩 ジンギスカン' },
  { v: 'スープカレー',    l: '🍛 スープカレー' },
  { v: '蟹・甲殻類',      l: '🦀 蟹' },
  { v: 'ジェラート・チーズ', l: '🧀 乳製品・チーズ' },
  { v: 'メロン・果物',    l: '🍈 メロン・果物' },
  { v: 'サッポロビール',  l: '🍺 ビール' },
  { v: '富良野ワイン',    l: '🍷 ワイン' },
  { v: 'ニッカウヰスキー', l: '🥃 ウイスキー' },
  { v: 'スイーツ・お菓子', l: '🍰 スイーツ' },
];
const TOPIC_EXPERIENCES = [
  { v: '温泉',            l: '♨ 温泉巡り' },
  { v: 'スキー・スノボ',  l: '⛷ スキー・スノボ' },
  { v: 'ラベンダー畑',    l: '🌸 ラベンダー' },
  { v: '流氷クルーズ',    l: '🧊 流氷' },
  { v: '動物園・水族館',  l: '🐧 動物・水族館' },
  { v: '夜景観賞',        l: '🌃 夜景' },
  { v: '雪まつり',        l: '⛄ 雪まつり' },
  { v: '自然・絶景巡り',  l: '🏞 自然・絶景' },
  { v: '工場見学・体験',  l: '🏭 工場見学' },
  { v: '街歩き・ショッピング', l: '🚶 街歩き' },
  { v: 'アイヌ文化',      l: '🪶 アイヌ文化' },
  { v: '釣り・カヌー',    l: '🎣 釣り・カヌー' },
];

// Pre-compute area → spots map (data-driven 目的地 tab)
const SPOTS_BY_AREA = SPOTS.reduce((acc, s) => {
  if (!s.area) return acc;
  (acc[s.area] = acc[s.area] || []).push(s);
  return acc;
}, {});
const AREAS_SORTED = Object.entries(SPOTS_BY_AREA)
  .map(([area, ss]) => ({ area, region: ss[0].region, count: ss.length }))
  .sort((a, b) => b.count - a.count);

// ─────────────────────────────────────────────
// Dates screen (Screen 1)
// ─────────────────────────────────────────────
function wireDatesScreen() {
  const root = $('#screen-dates');
  if (!root) return;
  root.querySelectorAll('.picker-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const group = chip.closest('.picker-chips');
      if (group?.dataset.single === 'true') {
        group.querySelectorAll('.picker-chip').forEach(c => c.classList.remove('is-selected'));
      }
      chip.classList.add('is-selected');
      updateDatesNextState();
    });
  });
  $('#dates-next-btn')?.addEventListener('click', () => {
    const nightsChip = root.querySelector('[data-group="nights"] .picker-chip.is-selected');
    const seasonChip = root.querySelector('[data-group="season"] .picker-chip.is-selected');
    if (!nightsChip) return;
    state.tripDates = {
      nights: nightsChip.dataset.value,
      season: seasonChip ? seasonChip.dataset.value : '',
    };
    saveTripDates();
    ensurePlanDays(NIGHTS_TO_DAYS[state.tripDates.nights] || 3);
    onPlanChanged();
    goToBuilder();
  });

  // If tripDates was loaded from storage, pre-select the chips
  if (state.tripDates) {
    root.querySelector(`[data-group="nights"] [data-value="${state.tripDates.nights}"]`)?.classList.add('is-selected');
    const sSel = `[data-group="season"] [data-value="${state.tripDates.season ?? ''}"]`;
    root.querySelector(sSel)?.classList.add('is-selected');
    updateDatesNextState();
  }
}
function updateDatesNextState() {
  const root = $('#screen-dates');
  if (!root) return;
  const nightsOk = !!root.querySelector('[data-group="nights"] .picker-chip.is-selected');
  const seasonOk = !!root.querySelector('[data-group="season"] .picker-chip.is-selected');
  const btn = $('#dates-next-btn');
  if (btn) btn.disabled = !(nightsOk && seasonOk);
}

function goToBuilder() {
  switchScreen('builder');
  renderBuilderHeader();
  renderDayPicker();
  setActiveTab(state.builder.tab || 'destination');
}

// ─────────────────────────────────────────────
// Builder screen (Screen 2) — summary + day picker + tabs
// ─────────────────────────────────────────────
function renderBuilderHeader() {
  const el = $('#builder-summary');
  if (!el) return;
  const t = state.tripDates;
  let summary = t ? `${t.season ? t.season + 'の' : ''}${t.nights}` : '日程: -';
  // Total travel across all days
  let totalKm = 0, totalMin = 0;
  state.plan.days.forEach(d => {
    const tt = dayTotals(d);
    totalKm += tt.km; totalMin += tt.min;
  });
  if (totalKm > 0) summary += `・移動 ${formatKm(totalKm)} / ${formatDuration(totalMin)}`;
  el.textContent = summary;
}

function renderDayPicker() {
  const el = $('#builder-day-picker');
  if (!el) return;
  let html = '';
  state.plan.days.forEach((day, i) => {
    const color = DAY_COLORS[i % DAY_COLORS.length];
    const count = day.spotIds.length;
    const isActive = i === state.builder.activeDayIdx;
    html += `<button type="button" class="day-chip${isActive ? ' is-active' : ''}" data-day="${i}" style="${isActive ? `background:${color};color:#fff;border-color:${color};` : ''}">`;
    html += `DAY ${i + 1}`;
    if (count > 0) html += ` <span class="day-chip-count">${count}</span>`;
    html += `</button>`;
  });
  html += `<button type="button" class="day-chip day-chip-add" id="day-chip-add" title="日を追加">＋</button>`;
  el.innerHTML = html;
  el.querySelectorAll('[data-day]').forEach(b => {
    b.addEventListener('click', () => {
      state.builder.activeDayIdx = Number(b.dataset.day);
      renderDayPicker();
    });
  });
  $('#day-chip-add')?.addEventListener('click', () => {
    addDay();
    state.builder.activeDayIdx = state.plan.days.length - 1;
    renderDayPicker();
  });
}

function setActiveTab(tab) {
  state.builder.tab = tab;
  $$('.builder-tab').forEach(t => t.classList.toggle('is-active', t.dataset.tab === tab));
  $$('.builder-tab-content').forEach(c => { c.hidden = (c.dataset.tabContent !== tab); });
  // Render tab content lazily
  if (tab === 'destination') renderTabDestination();
  else if (tab === 'food') renderTabTopics('food');
  else if (tab === 'experience') renderTabTopics('experience');
  // AI tab body is just the chat thread which is always in DOM
  // Toggle chat-form visibility
  const form = $('#chat-form');
  if (form) form.hidden = (tab !== 'ai');
  // Scroll tab body to top
  const body = $('#builder-tab-body');
  if (body) body.scrollTop = 0;
}

function renderTabDestination() {
  const root = $('[data-tab-content="destination"]');
  if (!root) return;
  if (state.builder.selectedArea) {
    renderAreaSpots(root, state.builder.selectedArea);
    return;
  }
  let html = `<p class="tab-hint">行きたい地域を選んでください。</p>`;
  html += `<div class="area-grid">`;
  AREAS_SORTED.forEach(({ area, region, count }) => {
    const color = REGION_COLORS[region] || '#3D2817';
    html += `<button type="button" class="area-tile" data-area="${escapeHtml(area)}">`;
    html += `<span class="area-dot" style="background:${color}"></span>`;
    html += `<span class="area-name">${escapeHtml(area)}</span>`;
    html += `<span class="area-count">${count}件</span>`;
    html += `</button>`;
  });
  html += `</div>`;
  root.innerHTML = html;
  root.querySelectorAll('[data-area]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.builder.selectedArea = btn.dataset.area;
      renderTabDestination();
      // Zoom map to the area
      const spots = SPOTS_BY_AREA[btn.dataset.area] || [];
      flyToSpots(spots.map(s => s.id));
    });
  });
}

function renderAreaSpots(root, area) {
  const spots = SPOTS_BY_AREA[area] || [];
  let html = `<button type="button" class="area-back-btn" id="area-back-btn">← エリア一覧</button>`;
  html += `<h3 class="area-title">${escapeHtml(area)} のスポット</h3>`;
  html += `<div class="area-spots">`;
  spots.forEach(spot => {
    const inPlan = isInPlan(spot.id);
    html += `<article class="spot-listing ${spot.videoUrl ? 'has-video' : 'no-video'}">`;
    if (spot.videoUrl) {
      html += `<div class="spot-media spot-media-video"><video autoplay loop muted playsinline preload="metadata" poster="assets/cover-poster.jpg"><source src="${spot.videoUrl}" type="video/mp4"></video><span class="spot-media-badge">掲載パートナー</span></div>`;
    } else {
      html += `<div class="spot-media spot-media-icon" style="background:${spot.color}">${getIcon(spot.icon)}</div>`;
    }
    html += `<div class="spot-listing-body">`;
    html += `<div class="spot-listing-head"><h3 class="spot-listing-name">${escapeHtml(spot.name)}</h3></div>`;
    html += `<div class="spot-listing-meta"><span>📍 ${escapeHtml(spot.area)}</span>`;
    if (spot.bestSeason && spot.bestSeason !== '通年') html += `<span class="spot-season-note">ベスト: ${escapeHtml(spot.bestSeason)}</span>`;
    html += `</div>`;
    html += `<p class="spot-listing-comment">${escapeHtml(spot.description)}</p>`;
    html += `<div class="spot-listing-foot">`;
    html += `<button type="button" class="spot-pan-btn" data-spot-pan="${spot.id}">📍 マップ</button>`;
    if (inPlan) html += `<button type="button" class="plan-add-btn in-plan" disabled>✓ 追加済</button>`;
    else html += `<button type="button" class="plan-add-btn" data-plan-add="${spot.id}">＋ 追加</button>`;
    html += `</div></div></article>`;
  });
  html += `</div>`;
  root.innerHTML = html;
  $('#area-back-btn')?.addEventListener('click', () => {
    state.builder.selectedArea = null;
    renderTabDestination();
  });
  root.querySelectorAll('[data-spot-pan]').forEach(b => {
    b.addEventListener('click', () => {
      const id = b.dataset.spotPan;
      const sp = SPOT_BY_ID[id];
      if (sp?.coords) { map?.flyTo(sp.coords, 12, { duration: 0.6 }); markerById[id]?.openPopup(); }
    });
  });
  root.querySelectorAll('[data-plan-add]').forEach(b => {
    b.addEventListener('click', () => {
      const id = b.dataset.planAdd;
      if (isInPlan(id)) return;
      addToPlan(id, state.builder.activeDayIdx);
      toast(`DAY ${state.builder.activeDayIdx + 1} に追加しました`);
      const sp = SPOT_BY_ID[id];
      if (sp?.coords) map?.flyTo(sp.coords, 11, { duration: 0.6 });
    });
  });
}

function renderTabTopics(kind) {
  const root = $(`[data-tab-content="${kind}"]`);
  if (!root) return;
  const topics = kind === 'food' ? TOPIC_FOODS : TOPIC_EXPERIENCES;
  const cta = kind === 'food'
    ? { hint: '気になる食べ物を選んでください (複数可)', label: '🧠 このグルメでAIに提案してもらう' }
    : { hint: '気になる体験を選んでください (複数可)',   label: '🧠 この体験でAIに提案してもらう' };
  let html = `<p class="tab-hint">${cta.hint}</p>`;
  html += `<div class="picker-chips" data-group="${kind}">`;
  topics.forEach(opt => {
    html += `<button type="button" class="picker-chip" data-value="${escapeHtml(opt.v)}"><span class="picker-chip-label">${escapeHtml(opt.l)}</span></button>`;
  });
  html += `</div>`;
  html += `<button type="button" class="picker-submit" data-topic-submit="${kind}" disabled>${cta.label}</button>`;
  root.innerHTML = html;
  root.querySelectorAll('.picker-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      chip.classList.toggle('is-selected');
      const any = root.querySelector('.picker-chip.is-selected');
      const submit = root.querySelector('.picker-submit');
      if (submit) submit.disabled = !any;
    });
  });
  root.querySelector('[data-topic-submit]')?.addEventListener('click', () => {
    const selected = Array.from(root.querySelectorAll('.picker-chip.is-selected')).map(c => c.dataset.value);
    if (!selected.length) return;
    const prompt = kind === 'food'
      ? `${selected.join('・')} を楽しめる北海道のスポットを提案してください。`
      : `${selected.join('・')} を体験できる北海道のスポットを提案してください。`;
    setActiveTab('ai');
    sendUserMessage(prompt);
  });
}

// ─────────────────────────────────────────────
// Chat UI
// ─────────────────────────────────────────────
function ensureChatThread() {
  // When a chat message is being added, hide the intro placeholder
  $('#ai-tab-intro')?.remove();
}

// Only auto-scroll the chat thread if the user is already near the bottom.
// (Don't yank them away from older messages they were reading.)
function scrollChatIfNear(threshold = 120) {
  const t = $('#chat-thread');
  if (!t) return;
  const distance = t.scrollHeight - t.scrollTop - t.clientHeight;
  if (distance < threshold) t.scrollTop = t.scrollHeight;
}

function addUserMessage(text) {
  ensureChatThread();
  const thread = $('#chat-thread');
  const el = document.createElement('div');
  el.className = 'chat-msg chat-msg-user';
  el.innerHTML = `<div class="chat-bubble">${escapeHtml(text).replace(/\n/g, '<br>')}</div>`;
  thread.appendChild(el);
  thread.scrollTop = thread.scrollHeight;
}

function addBotMessage(initialText = '') {
  ensureChatThread();
  const thread = $('#chat-thread');
  const el = document.createElement('div');
  el.className = 'chat-msg chat-msg-bot';
  el.innerHTML = `
    <span class="chat-avatar">AI</span>
    <div class="chat-bubble"></div>
  `;
  if (initialText) el.querySelector('.chat-bubble').innerHTML = escapeHtml(initialText).replace(/\n/g, '<br>');
  thread.appendChild(el);
  thread.scrollTop = thread.scrollHeight;
  return el;
}

function addTypingIndicator() {
  ensureChatThread();
  const thread = $('#chat-thread');
  const el = document.createElement('div');
  el.className = 'chat-msg chat-msg-bot chat-typing';
  el.innerHTML = `<span class="chat-avatar">AI</span><div class="chat-bubble"><span></span><span></span><span></span></div>`;
  thread.appendChild(el);
  thread.scrollTop = thread.scrollHeight;
  return el;
}

function addErrorMessage(message, advice = '') {
  ensureChatThread();
  const thread = $('#chat-thread');
  const el = document.createElement('div');
  el.className = 'chat-msg chat-msg-error';
  el.innerHTML = `
    <div class="chat-bubble">
      <strong>⚠️ エラーが発生しました</strong>
      <p><code>${escapeHtml(message)}</code></p>
      ${advice ? `<p>${escapeHtml(advice)}</p>` : ''}
    </div>
  `;
  thread.appendChild(el);
  thread.scrollTop = thread.scrollHeight;
}

// ─────────────────────────────────────────────
// Render an itinerary inline in the chat
// ─────────────────────────────────────────────
function renderProposal(input) {
  const { title, intro, spots } = input;
  const validSpots = (spots || []).filter(s => SPOT_BY_ID[s.spot_id]);
  if (!validSpots.length) return null;

  const allIds = validSpots.map(s => s.spot_id);
  state.highlightedSpotIds = new Set(allIds);
  refreshHighlights();
  flyToSpots(allIds);

  const thread = $('#chat-thread');
  const wrapper = document.createElement('div');
  wrapper.className = 'proposal-card';

  let html = '';
  if (title) html += `<h2 class="proposal-title">${escapeHtml(title)}</h2>`;
  if (intro) html += `<p class="proposal-intro">${escapeHtml(intro)}</p>`;

  html += `<div class="proposal-actions">`;
  html += `<button type="button" class="proposal-bulk-btn" data-add-all>＋ 全部プランに追加</button>`;
  html += `</div>`;

  html += `<div class="proposal-spots">`;
  validSpots.forEach(s => {
    const spot = SPOT_BY_ID[s.spot_id];
    html += renderSpotCard(spot, s);
  });
  html += `</div>`;

  wrapper.innerHTML = html;
  thread.appendChild(wrapper);
  thread.scrollTop = thread.scrollHeight;

  wrapper.querySelectorAll('[data-spot-pan]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.spotPan;
      const spot = SPOT_BY_ID[id];
      if (spot && spot.coords && map) {
        map.flyTo(spot.coords, 12, { duration: 0.6 });
        markerById[id]?.openPopup();
      }
    });
  });

  wrapper.querySelectorAll('[data-plan-add]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.planAdd;
      if (isInPlan(id)) return;
      addToPlan(id, 0);
    });
  });

  const bulkBtn = wrapper.querySelector('[data-add-all]');
  if (bulkBtn) {
    bulkBtn.addEventListener('click', () => {
      validSpots.forEach(s => {
        if (!isInPlan(s.spot_id)) addToPlan(s.spot_id, 0);
      });
      bulkBtn.classList.add('is-done');
      bulkBtn.textContent = '✓ 全部追加しました';
      bulkBtn.disabled = true;
    });
  }

  return wrapper;
}

function renderSpotCard(spot, suggestion = {}) {
  const hasVideo = !!spot.videoUrl;
  const timeBadge = suggestion.time
    ? `<span class="spot-time">${escapeHtml(suggestion.time)}</span>`
    : '';
  const seasonNote = spot.bestSeason && spot.bestSeason !== '通年'
    ? `<span class="spot-season-note">ベストシーズン: ${escapeHtml(spot.bestSeason)}</span>`
    : '';

  const mediaHTML = hasVideo
    ? `<div class="spot-media spot-media-video">
         <video autoplay loop muted playsinline preload="metadata"
                poster="assets/cover-poster.jpg"
                aria-label="${escapeHtml(spot.name)} の紹介映像">
           <source src="${spot.videoUrl}" type="video/mp4">
         </video>
         <span class="spot-media-badge">掲載パートナー</span>
       </div>`
    : `<div class="spot-media spot-media-icon" style="background:${spot.color}">
         ${getIcon(spot.icon)}
       </div>`;

  const inPlan = isInPlan(spot.id);
  const addBtn = inPlan
    ? `<button type="button" class="plan-add-btn in-plan" disabled>✓ 追加済</button>`
    : `<button type="button" class="plan-add-btn" data-plan-add="${spot.id}">＋ プランへ</button>`;

  return `
    <article class="spot-listing ${hasVideo ? 'has-video' : 'no-video'}" data-spot="${spot.id}">
      ${mediaHTML}
      <div class="spot-listing-body">
        <div class="spot-listing-head">
          <h3 class="spot-listing-name">${escapeHtml(spot.name)}</h3>
          ${timeBadge}
        </div>
        <div class="spot-listing-meta">
          <span>📍 ${escapeHtml(spot.area)}</span>
          ${seasonNote}
        </div>
        ${suggestion.comment
          ? `<p class="spot-listing-comment">💡 ${escapeHtml(suggestion.comment)}</p>`
          : ''}
        <div class="spot-listing-foot">
          <button type="button" class="spot-pan-btn" data-spot-pan="${spot.id}">📍 マップ</button>
          ${addBtn}
        </div>
      </div>
    </article>
  `;
}

function refreshPlanAddButtons() {
  $$('[data-plan-add]').forEach(btn => {
    const id = btn.dataset.planAdd;
    if (isInPlan(id)) {
      btn.classList.add('in-plan');
      btn.disabled = true;
      btn.textContent = '✓ 追加済';
      btn.removeAttribute('data-plan-add');
    }
  });
}

// ─────────────────────────────────────────────
// Conversation loop
// ─────────────────────────────────────────────
// Keep the API conversation small + valid. Strips the oldest messages but
// repairs the head so we never start with an orphaned tool_result.
function trimHistory() {
  const msgs = state.apiMessages;
  if (msgs.length <= MAX_HISTORY) return;
  state.apiMessages = msgs.slice(-MAX_HISTORY);
  while (state.apiMessages.length) {
    const first = state.apiMessages[0];
    const hasToolResult = first?.role === 'user'
      && Array.isArray(first.content)
      && first.content.some(b => b?.type === 'tool_result');
    if (first.role !== 'user' || hasToolResult) {
      state.apiMessages.shift();
      continue;
    }
    break;
  }
}

async function sendUserMessage(text) {
  if (state.isStreaming) return;
  state.isStreaming = true;
  setInputDisabled(true);

  addUserMessage(text);
  state.apiMessages.push({ role: 'user', content: text });
  trimHistory();

  await runAssistantTurn(0);

  state.isStreaming = false;
  setInputDisabled(false);
  $('#chat-input')?.focus();
}

// Ask the AI to review the user's current plan
function reviewPlan() {
  if (state.isStreaming) return;
  if (planTotalCount() === 0) { toast('プランが空です。先にスポットを追加してください。'); return; }
  if (!getApiUrl()) { toast('AI機能が未設定です (プロキシURL)。'); return; }
  closePlannerDrawer();
  // Make sure the user lands on the AI tab to see the response
  if (state.flow !== 'builder') goToBuilder();
  setActiveTab('ai');
  sendUserMessage('今組んでいるプランを講評してください。全体の印象、季節・天候の注意点、移動の効率、足りないジャンルがあれば教えてください。');
}

async function runAssistantTurn(depth) {
  if (depth >= MAX_TOOL_RECURSION) {
    addBotMessage(`ツール呼び出しが ${MAX_TOOL_RECURSION} 回連続したため一旦停止しました。再度お声がけください。`);
    return;
  }

  let typing = addTypingIndicator();
  let textEl = null;
  let accumulated = '';

  const onDelta = (delta) => {
    if (typing) { typing.remove(); typing = null; }
    if (!textEl) textEl = addBotMessage('');
    accumulated += delta;
    textEl.querySelector('.chat-bubble').innerHTML = escapeHtml(accumulated).replace(/\n/g, '<br>');
    // Only follow the stream if the user hasn't scrolled away
    scrollChatIfNear();
  };

  try {
    const finalMessage = await callClaudeStream({
      system: buildSystem(),
      tools: TOOLS,
      messages: state.apiMessages,
      onTextDelta: onDelta,
    });

    if (typing) { typing.remove(); typing = null; }
    state.apiMessages.push({ role: 'assistant', content: finalMessage.content });

    // Render any tool calls
    const toolUse = finalMessage.content.find(b => b.type === 'tool_use');
    if (toolUse && toolUse.name === 'propose_spots') {
      const rendered = renderProposal(toolUse.input || {});
      const okText = rendered
        ? `${(toolUse.input?.spots || []).length} 個のスポットを提案表示しました。ユーザーが自分のプランに追加するのを待ってください。`
        : 'スポットIDが認識できなかったため、表示できませんでした。再提案してください。';
      state.apiMessages.push({
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: okText
        }]
      });
      await runAssistantTurn(depth + 1);
      return;
    }
  } catch (err) {
    if (typing) typing.remove();
    console.error('Claude API error:', err);
    // Roll back trailing user text message
    const last = state.apiMessages[state.apiMessages.length - 1];
    if (last && last.role === 'user' && typeof last.content === 'string') {
      state.apiMessages.pop();
    }
    handleApiError(err);
  }
}

function handleApiError(err) {
  const msg = err?.message || String(err);
  let advice = '';
  if (err?.status === 401) advice = 'サイト側のAPIキーが無効化されている可能性があります。サイト管理者にお知らせください。';
  else if (err?.status === 0) advice = 'プロキシ未設定です。worker/README.md を参照してデプロイしてください。';
  else if (err?.status === 403) advice = 'このキーには利用権限がありません。Anthropic Consoleでキーを確認してください。';
  else if (err?.status === 429) advice = 'レート制限/予算上限に達しました。少し時間を空けて再試行してください。';
  else if (err?.status === 400) advice = 'リクエストパラメータが不正です。開発者ツールのコンソールをご確認ください。';
  else if (err?.status >= 500) advice = 'Anthropic側で一時的なエラーが発生しています。しばらくして再試行してください。';
  else if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch')) advice = 'ネットワーク接続を確認してください。';
  addErrorMessage(msg, advice);
}

// ─────────────────────────────────────────────
// Input handling
// ─────────────────────────────────────────────
function setInputDisabled(disabled) {
  const input = $('#chat-input');
  const btn = $('#chat-send');
  if (input) input.disabled = disabled;
  if (btn) btn.disabled = disabled;
}

function autosizeTextarea() {
  const ta = $('#chat-input');
  if (!ta) return;
  ta.style.height = 'auto';
  ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
}

function handleSubmit(e) {
  e?.preventDefault?.();
  const ta = $('#chat-input');
  const text = (ta?.value || '').trim();
  if (!text || state.isStreaming) return;
  ta.value = '';
  autosizeTextarea();
  sendUserMessage(text);
}

// ─────────────────────────────────────────────
// Map toggle (small screens / user preference)
// ─────────────────────────────────────────────
function toggleMap() {
  document.body.classList.toggle('map-hidden');
  setTimeout(() => map?.invalidateSize(), 300);
}

// Mobile: map is a small floating thumbnail by default. Tap to expand to
// a near-fullscreen modal; tap close (× / backdrop) to shrink back.
function setMapInteractions(enabled) {
  if (!map) return;
  const m = enabled ? 'enable' : 'disable';
  ['dragging','touchZoom','doubleClickZoom','scrollWheelZoom','boxZoom','keyboard']
    .forEach(k => { try { map[k]?.[m](); } catch (_) {} });
  if (map.tap) { try { map.tap[m](); } catch (_) {} }
}
function setMapExpanded(expanded) {
  const panel = $('#map-panel');
  if (!panel) return;
  panel.classList.toggle('is-expanded', expanded);
  document.body.classList.toggle('map-expanded', expanded);
  setMapInteractions(expanded || !isMobileLayout());
  setTimeout(() => {
    map?.invalidateSize();
    // When shrinking back to a thumbnail, re-fit Hokkaido so it stays useful
    if (!expanded && isMobileLayout()) {
      map?.fitBounds(HOKKAIDO_BOUNDS, { padding: [6, 6], maxZoom: 8 });
    }
  }, 280);
}
function toggleMapExpanded() { setMapExpanded(!$('#map-panel')?.classList.contains('is-expanded')); }

// ─────────────────────────────────────────────
// Planner Drawer
// ─────────────────────────────────────────────
function openPlannerDrawer() {
  document.body.classList.add('drawer-open');
  $('#planner-drawer')?.setAttribute('aria-hidden', 'false');
  $('#planner-overlay')?.setAttribute('aria-hidden', 'false');
}
function closePlannerDrawer() {
  document.body.classList.remove('drawer-open');
  $('#planner-drawer')?.setAttribute('aria-hidden', 'true');
  $('#planner-overlay')?.setAttribute('aria-hidden', 'true');
}
function togglePlannerDrawer() {
  if (document.body.classList.contains('drawer-open')) closePlannerDrawer();
  else openPlannerDrawer();
}

function renderPlannerDrawer() {
  const body = $('#planner-body');
  if (!body) return;
  const total = planTotalCount();
  const drawer = $('#planner-drawer');
  if (drawer) drawer.classList.toggle('plan-is-empty', total === 0);
  if (total === 0) {
    // Compact empty state — one-liner that fits in a thin band
    body.innerHTML = `
      <div class="planner-empty">
        <span class="planner-empty-emoji" aria-hidden="true">🧭</span>
        <span class="planner-empty-text">
          <strong>まだ空っぽです</strong>
          AIの提案や＋ボタンで気になる場所を集めましょう
        </span>
      </div>
    `;
  } else {
    let html = '';
    state.plan.days.forEach((day, dayIdx) => {
      html += renderPlannerDay(day, dayIdx);
    });
    body.innerHTML = html;
  }
  wirePlannerEvents();
}

function renderPlannerDay(day, dayIdx) {
  const color = DAY_COLORS[dayIdx % DAY_COLORS.length];
  const totals = dayTotals(day);
  const daysCount = state.plan.days.length;

  let html = `<div class="planner-day" data-day-idx="${dayIdx}">`;
  html += `<div class="planner-day-head">`;
  html += `<span class="planner-day-num" style="background:${color}">DAY ${dayIdx + 1}</span>`;
  if (totals.km > 0) {
    html += `<span class="planner-day-stat" title="この日の移動目安">🚗 ${formatKm(totals.km)} / ${formatDuration(totals.min)}</span>`;
  }
  html += `<div class="planner-day-actions">`;
  html += `<button type="button" class="planner-icon-btn" data-day-up="${dayIdx}" ${dayIdx === 0 ? 'disabled' : ''} title="日を上へ" aria-label="日を上へ">▲</button>`;
  html += `<button type="button" class="planner-icon-btn" data-day-down="${dayIdx}" ${dayIdx === daysCount - 1 ? 'disabled' : ''} title="日を下へ" aria-label="日を下へ">▼</button>`;
  if (daysCount > 1) {
    html += `<button type="button" class="planner-icon-btn danger" data-remove-day="${dayIdx}" title="この日を削除" aria-label="この日を削除">×</button>`;
  }
  html += `</div></div>`;

  html += `<div class="planner-spots" data-day-idx="${dayIdx}">`;
  if (day.spotIds.length === 0) {
    html += `<div class="planner-spot-empty">ここにドラッグ、または「＋ プランへ」で追加</div>`;
  } else {
    day.spotIds.forEach((sid, orderIdx) => {
      const spot = SPOT_BY_ID[sid];
      if (!spot) return;
      html += renderPlannerSpot(spot, orderIdx, dayIdx);
      // travel leg to the next spot
      if (orderIdx < day.spotIds.length - 1 && totals.legs[orderIdx]) {
        const leg = totals.legs[orderIdx];
        html += `<div class="planner-leg"><span>🚗 ${formatKm(leg.km)}・${formatDuration(leg.min)}</span></div>`;
      }
    });
  }
  html += `</div>`;

  html += `</div>`;
  return html;
}

function renderPlannerSpot(spot, orderIdx, dayIdx) {
  return `
    <div class="planner-spot" data-spot="${spot.id}" data-pos="${orderIdx}" draggable="true">
      <span class="planner-drag" aria-hidden="true" title="ドラッグで並べ替え">⠿</span>
      <span class="planner-spot-order" style="background:${DAY_COLORS[dayIdx % DAY_COLORS.length]}">${orderIdx + 1}</span>
      <div class="planner-spot-info" data-locate-spot="${spot.id}" title="マップで見る">
        <div class="planner-spot-name">${escapeHtml(spot.name)}</div>
        <div class="planner-spot-area">📍 ${escapeHtml(spot.area)}</div>
      </div>
      <div class="planner-spot-actions">
        <button type="button" class="planner-icon-btn" data-move-up="${spot.id}" title="ひとつ前へ" aria-label="ひとつ前へ">▲</button>
        <button type="button" class="planner-icon-btn" data-move-down="${spot.id}" title="ひとつ後へ" aria-label="ひとつ後へ">▼</button>
        <button type="button" class="planner-icon-btn danger" data-remove-spot="${spot.id}" title="削除" aria-label="削除">×</button>
      </div>
    </div>
  `;
}

function wirePlannerEvents() {
  $$('#planner-body [data-remove-day]').forEach(btn => {
    btn.addEventListener('click', () => removeDay(Number(btn.dataset.removeDay)));
  });
  $$('#planner-body [data-day-up]').forEach(btn => {
    btn.addEventListener('click', () => moveDayUp(Number(btn.dataset.dayUp)));
  });
  $$('#planner-body [data-day-down]').forEach(btn => {
    btn.addEventListener('click', () => moveDayDown(Number(btn.dataset.dayDown)));
  });
  $$('#planner-body [data-remove-spot]').forEach(btn => {
    btn.addEventListener('click', () => removeFromPlan(btn.dataset.removeSpot));
  });
  $$('#planner-body [data-move-up]').forEach(btn => {
    btn.addEventListener('click', () => moveSpotUp(btn.dataset.moveUp));
  });
  $$('#planner-body [data-move-down]').forEach(btn => {
    btn.addEventListener('click', () => moveSpotDown(btn.dataset.moveDown));
  });
  $$('#planner-body [data-locate-spot]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.locateSpot;
      const spot = SPOT_BY_ID[id];
      if (spot?.coords && map) {
        map.flyTo(spot.coords, 12, { duration: 0.6 });
        markerById[id]?.openPopup();
      }
    });
  });
  wirePlannerDnD();
}

// ── Drag & drop reordering (desktop / pointer) ──
let dragSpotId = null;
function wirePlannerDnD() {
  $$('#planner-body .planner-spot').forEach(row => {
    row.addEventListener('dragstart', e => {
      dragSpotId = row.dataset.spot;
      row.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', dragSpotId); } catch (_) {}
    });
    row.addEventListener('dragend', () => {
      dragSpotId = null;
      $$('#planner-body .planner-spot').forEach(r => r.classList.remove('is-dragging', 'drop-before', 'drop-after'));
    });
    row.addEventListener('dragover', e => {
      if (!dragSpotId) return;
      e.preventDefault();
      const rect = row.getBoundingClientRect();
      const after = (e.clientY - rect.top) > rect.height / 2;
      row.classList.toggle('drop-after', after);
      row.classList.toggle('drop-before', !after);
    });
    row.addEventListener('dragleave', () => {
      row.classList.remove('drop-before', 'drop-after');
    });
    row.addEventListener('drop', e => {
      if (!dragSpotId) return;
      e.preventDefault();
      e.stopPropagation();
      const targetDayIdx = Number(row.closest('.planner-spots').dataset.dayIdx);
      const targetPos = Number(row.dataset.pos) + (row.classList.contains('drop-after') ? 1 : 0);
      reorderSpot(dragSpotId, targetDayIdx, targetPos);
    });
  });
  // Allow dropping onto an empty day or the container tail
  $$('#planner-body .planner-spots').forEach(container => {
    container.addEventListener('dragover', e => {
      if (!dragSpotId) return;
      e.preventDefault();
    });
    container.addEventListener('drop', e => {
      if (!dragSpotId) return;
      // Only handle if the drop wasn't already handled by a spot row
      if (e.target.closest('.planner-spot')) return;
      e.preventDefault();
      const targetDayIdx = Number(container.dataset.dayIdx);
      reorderSpot(dragSpotId, targetDayIdx, state.plan.days[targetDayIdx].spotIds.length);
    });
  });
}

// ─────────────────────────────────────────────
// Boot
// ─────────────────────────────────────────────
function loadPlanFromHash() {
  const m = (location.hash || '').match(/plan=([^&]+)/);
  if (!m) return false;
  const ok = applyEncodedPlan(m[1]);
  if (ok) {
    savePlan();
    // Clear the hash so a reload doesn't keep re-importing
    history.replaceState(null, '', location.pathname + location.search);
    setTimeout(() => toast('共有されたプランを読み込みました ✓'), 400);
  }
  return ok;
}

document.addEventListener('DOMContentLoaded', () => {
  loadPlan();
  loadPlanFromHash(); // shared plan in URL overrides the saved one
  loadTripDates();
  initMap();
  renderPlannerDrawer();
  updatePlanCount();

  // On mobile, always start collapsed — the user opens it on demand.
  // Desktop ignores the class via CSS.
  if (isMobileLayout()) setPlannerCollapsed(true);

  // Chat form
  $('#chat-form')?.addEventListener('submit', handleSubmit);
  $('#chat-input')?.addEventListener('input', autosizeTextarea);
  $('#chat-input')?.addEventListener('keydown', e => {
    // Enter to send; Shift+Enter for newline
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      handleSubmit(e);
    }
  });

  // Screen 1 (dates) — chip selection + 次へ
  wireDatesScreen();

  // Screen 2 (builder) — tabs + back button
  $$('.builder-tab').forEach(t => {
    t.addEventListener('click', () => setActiveTab(t.dataset.tab));
  });
  $('#builder-back-btn')?.addEventListener('click', () => switchScreen('dates'));

  // Decide which screen to start on. If a previous trip is set in storage,
  // jump straight to the builder; otherwise the user starts on dates.
  if (state.tripDates) goToBuilder();
  else switchScreen('dates');

  // Map toggle (header eye icon)
  $('#toggle-map')?.addEventListener('click', toggleMap);

  // Mobile: tap the small map to expand; tap the close pill / backdrop to shrink
  $('#map-panel')?.addEventListener('click', (e) => {
    if (!isMobileLayout()) return;
    const panel = $('#map-panel');
    // If clicking the close pill, collapse
    if (e.target.closest('[data-map-close]')) { setMapExpanded(false); return; }
    // Only auto-expand from the thumbnail state (when collapsed)
    if (!panel.classList.contains('is-expanded')) {
      e.stopPropagation();
      setMapExpanded(true);
    }
  });
  $('#map-backdrop')?.addEventListener('click', () => setMapExpanded(false));
  // Default: thumbnail (no map interactions) on mobile
  setTimeout(() => {
    if (isMobileLayout()) setMapInteractions(false);
  }, 700);

  // When crossing the breakpoint, reset map interactions / expanded state
  window.addEventListener('resize', () => {
    if (isMobileLayout()) {
      const expanded = $('#map-panel')?.classList.contains('is-expanded');
      setMapInteractions(!!expanded);
    } else {
      setMapExpanded(false);
      setMapInteractions(true);
    }
  });

  // Planner drawer wiring
  $('#plan-toggle')?.addEventListener('click', togglePlannerDrawer);
  $('#planner-close')?.addEventListener('click', closePlannerDrawer);
  $('#planner-overlay')?.addEventListener('click', closePlannerDrawer);
  $('#planner-add-day')?.addEventListener('click', addDay);
  $('#planner-clear')?.addEventListener('click', () => {
    if (planTotalCount() === 0 || confirm('プランを全部消してよろしいですか?')) clearPlan();
  });
  $('#planner-share')?.addEventListener('click', copyShareLink);
  $('#planner-print')?.addEventListener('click', printPlan);
  $('#planner-review')?.addEventListener('click', reviewPlan);

  // Mobile pull-down: tap the header to toggle collapse
  $('#planner-head')?.addEventListener('click', (e) => {
    // Don't collapse when clicking the close button
    if (e.target.closest('#planner-close')) return;
    if (!isMobileLayout()) return;
    togglePlannerCollapsed();
  });
  // Re-evaluate default when the user rotates / resizes across the breakpoint
  let wasMobile = isMobileLayout();
  window.addEventListener('resize', () => {
    const nowMobile = isMobileLayout();
    if (nowMobile !== wasMobile) {
      // Crossing the breakpoint: collapse on mobile, expand on desktop
      setPlannerCollapsed(nowMobile);
      wasMobile = nowMobile;
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.body.classList.contains('drawer-open')) {
      closePlannerDrawer();
    }
  });

  // Trigger map resize after layout settles
  setTimeout(() => map?.invalidateSize(), 600);
});
