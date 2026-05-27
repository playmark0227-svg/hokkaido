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

const STORAGE_KEY = 'anthropic_api_key';
const PLAN_STORAGE_KEY = 'hokkaido_user_plan_v1';
const API_URL = 'https://api.anthropic.com/v1/messages';
const MAX_TOOL_RECURSION = 5;
const API_TIMEOUT_MS = 90_000;

// ─────────────────────────────────────────────
// State
// ─────────────────────────────────────────────
const state = {
  apiMessages: [],
  isStreaming: false,
  highlightedSpotIds: new Set(),
  plan: { days: [] },
};

// ─────────────────────────────────────────────
// API key (config.js > localStorage > memory)
// ─────────────────────────────────────────────
let memoryKey = '';
function safeStorageGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
function safeStorageSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (_) { return false; } }
function safeStorageRemove(k) { try { localStorage.removeItem(k); } catch (_) {} }
function getApiKey() {
  if (typeof window.ANTHROPIC_API_KEY === 'string' && window.ANTHROPIC_API_KEY.trim()) {
    return window.ANTHROPIC_API_KEY.trim();
  }
  return safeStorageGet(STORAGE_KEY) || memoryKey || '';
}
function setApiKey(k) { memoryKey = k; return safeStorageSet(STORAGE_KEY, k); }
function clearApiKey() { memoryKey = ''; safeStorageRemove(STORAGE_KEY); }

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
  openPlannerDrawer();
}
function removeFromPlan(spotId) {
  const idx = findSpotDayIndex(spotId);
  if (idx === -1) return;
  state.plan.days[idx].spotIds = state.plan.days[idx].spotIds.filter(id => id !== spotId);
  onPlanChanged();
}
function moveToDay(spotId, toDayIndex) {
  const fromIdx = findSpotDayIndex(spotId);
  if (fromIdx === -1 || fromIdx === toDayIndex) return;
  while (state.plan.days.length <= toDayIndex) {
    state.plan.days.push({ id: newDayId(), spotIds: [] });
  }
  state.plan.days[fromIdx].spotIds = state.plan.days[fromIdx].spotIds.filter(id => id !== spotId);
  if (!state.plan.days[toDayIndex].spotIds.includes(spotId)) {
    state.plan.days[toDayIndex].spotIds.push(spotId);
  }
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
function onPlanChanged() {
  savePlan();
  renderPlannerDrawer();
  renderPlanOnMap();
  refreshPlanAddButtons();
  updatePlanCount();
}
function updatePlanCount() {
  const el = $('#plan-count');
  if (!el) return;
  const n = planTotalCount();
  el.textContent = n;
  el.classList.toggle('is-empty', n === 0);
}

// ─────────────────────────────────────────────
// Map (Leaflet)
// ─────────────────────────────────────────────
let map, markerLayer, planLayer;
const markerById = {};

function initMap() {
  if (typeof L === 'undefined') { setTimeout(initMap, 100); return; }
  map = L.map('map', {
    center: [43.4, 142.7],
    zoom: 5,
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

const SYSTEM_INSTRUCTIONS = `あなたは北海道専門の旅行プランナーです。ユーザーと対話して、おすすめの観光スポットを提案します。

【話し方】
- 親しみやすいが落ち着いたトーン。絵文字や「♪」は避ける
- 1〜2文で簡潔に。長い前置きはしない
- 質問は一度に1〜2個まで
- 道外の人にも分かりやすい言葉で。地元用語の「道央/道南/道東/道北」は使わず、
  代わりに「札幌・小樽エリア」「函館エリア」「知床・釧路エリア」「旭川・稚内エリア」のように
  具体的な地名で表現する

【ヒアリング項目 (柔軟に)】
- 期間・日程
- 興味のあるテーマ(自然/温泉/グルメ/街/文化/季節)
- マストで行きたい場所
- 同行者・出発地・予算 (任意)

【ツール使用 - 重要】
- 必要な情報が揃ったら propose_spots ツールを呼んで「こんなところどうですか?」と
  おすすめスポットを提案する
- 旅程の日割り (Day 1, Day 2 など) は組まなくてよい。フラットなおすすめリストを返す
- ユーザーは提案された中から自分で選んで、自分のプランに組み立てる仕組み
- 1回の提案で 6〜12 スポット程度
- 各スポットに「なぜおすすめか」「楽しみ方」を1〜2文の comment で添える
- ユーザーが「もう少し違う案」「○○を入れて」と言えば、再度ツールを呼んで違うスポットを提案
- スポットIDは渡されたデータの id を必ず使う

【スポット選定の指針】
- ユーザーの条件に合致するものを優先
- エリア・テーマのバランス、移動の現実性を考慮
- 「hasVideo: true」のスポットも、適合度が高いなら積極的に含めてよい (条件には合わせる)
- 同じスポットは1つの提案内で重複させない

【参考: スポットデータのregion値の対応 (内部用)】
- doo    = 札幌・小樽・富良野・美瑛・ニセコ・登別 (北海道中央エリア)
- donan  = 函館・松前・大沼 (北海道南エリア)
- doto   = 知床・釧路・網走・阿寒・帯広 (北海道東エリア)
- dohoku = 旭川・稚内・利尻礼文・サロベツ (北海道北エリア)

【ツール呼び出し後】
- ツール呼び出し後は短く一言「いかがでしょうか?」「気になるところはありますか?」程度で済ませる
- スポットの説明をテキストで繰り返さない (UIに表示されるので不要)
- ユーザーが各スポットをクリックして自分のプランに追加することを伝える
`;

function buildSystem() {
  return [
    { type: 'text', text: SYSTEM_INSTRUCTIONS },
    {
      type: 'text',
      text: `# 利用可能な北海道観光スポット (64件)\n${JSON.stringify(SPOTS_FOR_AI)}`,
      cache_control: { type: 'ephemeral' },
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
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('API キーが設定されていません');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-7',
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
// Demo proposals (no API key needed for the 6 example prompts)
// 「こんなところどうですか?」というフラットなおすすめスポット
// ─────────────────────────────────────────────
const DEMO_PROPOSALS = {
  "札幌に2泊3日で温泉とグルメを楽しみたい": {
    title: "札幌でおすすめの温泉・グルメスポット",
    intro: "札幌の街遊びから定山渓の温泉、ジンギスカンまで楽しめるラインナップです。気になるものをプランに追加してみてください。",
    spots: [
      { spot_id: "sapporo-clock-tower", comment: "札幌のシンボル。明治の建造物で写真映えも◎" },
      { spot_id: "odori-park",          comment: "テレビ塔から眺める噴水と緑。市内中心の休憩スポット。" },
      { spot_id: "sapporo-tv-tower",    comment: "展望台から札幌の街を一望。夜景もきれい。" },
      { spot_id: "sapporo-beer",        comment: "サッポロビール園で名物ジンギスカンと出来立てビール。" },
      { spot_id: "jozankei-onsen",      comment: "札幌からバスで70分。渓谷美と温泉で癒される名湯。" },
      { spot_id: "hokkaido-shrine",     comment: "札幌の総鎮守。緑豊かな円山公園内に。" },
      { spot_id: "maruyama-zoo",        comment: "ホッキョクグマやレッサーパンダに出会える人気動物園。" },
      { spot_id: "shiroi-koibito-park", comment: "白い恋人の工場見学とお菓子作り体験ができるテーマパーク。" }
    ]
  },
  "知床と網走で大自然を満喫する3泊プランを組みたい": {
    title: "道東 大自然と神秘の絶景スポット",
    intro: "世界自然遺産の知床から流氷の網走、神秘の湖まで。道東の自然をたっぷり楽しめる候補です。",
    spots: [
      { spot_id: "shiretoko",         comment: "世界自然遺産。クルーズで野生動物に出会えることも。" },
      { spot_id: "shiretoko-goko",    comment: "原生林の中に点在する五つの湖。高架木道から知床連山を望む。" },
      { spot_id: "oshinkoshin-falls", comment: "日本の滝百選。二筋に分かれて流れる姿が美しい。" },
      { spot_id: "abashiri-drift-ice", comment: "冬の風物詩。流氷砕氷船「おーろら」で大自然の神秘を体験。" },
      { spot_id: "abashiri-prison",   comment: "明治時代の監獄を移築復元した野外博物館。" },
      { spot_id: "lake-mashu",        comment: "世界屈指の透明度を誇る神秘の湖。「霧の摩周湖」の幻想的な景色。" },
      { spot_id: "lake-akan",         comment: "マリモの生息地。アイヌコタンの文化体験も。" }
    ]
  },
  "家族で行ける札幌・小樽周辺のおすすめスポットを教えて": {
    title: "家族で楽しめる札幌・小樽スポット",
    intro: "子連れでも楽しめる動物園や工場見学、レトロな街並み散策の候補です。",
    spots: [
      { spot_id: "maruyama-zoo",        comment: "子供に大人気の動物園。ホッキョクグマの泳ぐ姿は必見。" },
      { spot_id: "shiroi-koibito-park", comment: "お菓子作り体験ができるテーマパーク。お土産購入も。" },
      { spot_id: "otaru-canal",         comment: "レトロな倉庫群とガス灯が美しい運河。クルーズも楽しめる。" },
      { spot_id: "otaru-music-box",     comment: "世界中のオルゴールが並ぶ夢の空間。蒸気時計も必見。" },
      { spot_id: "yoichi-distillery",   comment: "ニッカウヰスキー余市蒸溜所見学。大人向けに。" },
      { spot_id: "sapporo-tv-tower",    comment: "展望台から札幌を一望。子供も大喜び。" }
    ]
  },
  "冬の北海道で雪まつりとスキーリゾートを巡りたい": {
    title: "冬の北海道 雪まつり&スキースポット",
    intro: "札幌雪まつりからニセコのパウダースノー、温泉天国・登別まで。冬ならではの候補です。",
    spots: [
      { spot_id: "sapporo-snow-festival", comment: "2月の世界的祭典。巨大雪像のライトアップは圧巻。" },
      { spot_id: "odori-park",            comment: "雪まつりメイン会場。屋台グルメも豊富。" },
      { spot_id: "niseko",                comment: "世界有数のパウダースノー。アクティビティ豊富で滞在を楽しめる。" },
      { spot_id: "noboribetsu-onsen",     comment: "9種類もの泉質を誇る日本屈指の温泉郷。" },
      { spot_id: "jigokudani",            comment: "登別の象徴。雪景色と湯けむりが幻想的。" },
      { spot_id: "sapporo-clock-tower",   comment: "札幌のシンボル。冬の雪化粧も絵になる。" }
    ]
  },
  "美瑛と富良野の花と景色を満喫する1泊2日": {
    title: "美瑛・富良野 花と絶景スポット",
    intro: "ラベンダーから青い池まで、美瑛富良野の名所を集めました。",
    spots: [
      { spot_id: "furano-lavender",  comment: "ラベンダー畑の代表格。7月が見頃。" },
      { spot_id: "furano",           comment: "ドラマ「北の国から」の舞台。チーズ工房やワインも。" },
      { spot_id: "biei-blue-pond",   comment: "コバルトブルーに輝く幻想的な池。Apple Mac壁紙の名所。" },
      { spot_id: "biei-patchwork",   comment: "色とりどりの畑が織りなす丘陵。CMの木々も。" },
      { spot_id: "shirahige-falls",  comment: "岩の隙間から湧き出るブルーの水。青い池の上流。" }
    ]
  },
  "函館の夜景と歴史散策の1泊2日プラン": {
    title: "函館 夜景&歴史散策スポット",
    intro: "世界三大夜景、星形要塞、レトロな元町エリアなど函館の王道候補です。",
    spots: [
      { spot_id: "goryokaku",                comment: "星形の城郭が美しい特別史跡。タワーから全景を。" },
      { spot_id: "motomachi",                comment: "異国情緒あふれる坂の街。教会やレトロな洋館を巡る。" },
      { spot_id: "kanemori-warehouse",       comment: "ベイエリアの赤レンガ倉庫群。ショッピングとカフェ。" },
      { spot_id: "mt-hakodate",              comment: "世界三大夜景。扇形の夜景は息をのむ美しさ。" },
      { spot_id: "hakodate-morning-market",  comment: "新鮮な海鮮丼の朝食。イカ釣り体験も。" },
      { spot_id: "onuma-park",               comment: "駒ヶ岳を背景にした美しい湖沼群。" }
    ]
  }
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runDemoFlow(prompt, demo) {
  if (state.isStreaming) return;
  state.isStreaming = true;
  setInputDisabled(true);

  addUserMessage(prompt);
  const typing = addTypingIndicator();
  await sleep(700);
  typing.remove();

  addBotMessage('こんなところはいかがでしょうか?');
  await sleep(400);
  renderProposal(demo);
  await sleep(500);

  const closing = addBotMessage('');
  closing.querySelector('.chat-bubble').innerHTML = `
    気になるスポットがあれば「＋ プランへ」ボタンで右の「あなたのプラン」に追加できます。<br>
    日程は自分で自由に組み立て可能です。<br>
    <div class="bot-actions">
      <button type="button" class="chip" data-action="back-to-examples">← 別の例を見る</button>
    </div>
  `;
  closing.querySelector('[data-action="back-to-examples"]')?.addEventListener('click', resetToWelcome);

  state.isStreaming = false;
  setInputDisabled(false);
}

// Capture welcome HTML once so we can restore it
let welcomeHTML = '';
function captureWelcomeHTML() {
  const w = $('#chat-welcome');
  if (w && !welcomeHTML) welcomeHTML = w.outerHTML;
}
function resetToWelcome() {
  state.apiMessages = [];
  state.highlightedSpotIds = new Set();
  refreshHighlights();
  const thread = $('#chat-thread');
  thread.innerHTML = welcomeHTML || '';
  $$('.welcome-example').forEach(wireExampleButton);
}
function wireExampleButton(btn) {
  btn.addEventListener('click', () => {
    const prompt = btn.dataset.prompt;
    if (!prompt) return;
    const demo = DEMO_PROPOSALS[prompt];
    if (demo) runDemoFlow(prompt, demo);
    else sendUserMessage(prompt);
  });
}

// ─────────────────────────────────────────────
// Chat UI
// ─────────────────────────────────────────────
function ensureChatThread() {
  $('#chat-welcome')?.remove();
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
async function sendUserMessage(text) {
  if (state.isStreaming) return;
  state.isStreaming = true;
  setInputDisabled(true);

  addUserMessage(text);
  state.apiMessages.push({ role: 'user', content: text });

  await runAssistantTurn(0);

  state.isStreaming = false;
  setInputDisabled(false);
  $('#chat-input')?.focus();
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
    $('#chat-thread').scrollTop = $('#chat-thread').scrollHeight;
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
  if (total === 0) {
    body.innerHTML = `
      <div class="planner-empty">
        <strong>まだ何も追加されていません</strong>
        AIの提案カードや「＋ プランへ」ボタンで<br>気になるスポットを追加してください。
      </div>
    `;
    // Even when empty, still allow add-day/clear etc.
    // Render empty days too so user can plan from scratch
    let dayHtml = '';
    state.plan.days.forEach((day, dayIdx) => {
      dayHtml += renderPlannerDay(day, dayIdx);
    });
    body.innerHTML += dayHtml;
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
  let html = `<div class="planner-day" data-day-idx="${dayIdx}">`;
  html += `<div class="planner-day-head">`;
  html += `<span class="planner-day-num" style="background:${color}">DAY ${dayIdx + 1}</span>`;
  html += `<div class="planner-day-actions">`;
  if (state.plan.days.length > 1) {
    html += `<button type="button" class="planner-icon-btn danger" data-remove-day="${dayIdx}" title="この日を削除" aria-label="この日を削除">×</button>`;
  }
  html += `</div></div>`;

  if (day.spotIds.length === 0) {
    html += `<div class="planner-spot-empty">スポットを追加してください</div>`;
  } else {
    html += `<div class="planner-spots">`;
    day.spotIds.forEach((sid, orderIdx) => {
      const spot = SPOT_BY_ID[sid];
      if (!spot) return;
      html += renderPlannerSpot(spot, orderIdx, dayIdx);
    });
    html += `</div>`;
  }

  html += `</div>`;
  return html;
}

function renderPlannerSpot(spot, orderIdx, dayIdx) {
  const daysCount = state.plan.days.length;
  const canMovePrev = dayIdx > 0;
  const canMoveNext = dayIdx < daysCount - 1;
  return `
    <div class="planner-spot" data-spot="${spot.id}">
      <span class="planner-spot-order">${orderIdx + 1}</span>
      <div class="planner-spot-info">
        <div class="planner-spot-name">${escapeHtml(spot.name)}</div>
        <div class="planner-spot-area">📍 ${escapeHtml(spot.area)}</div>
      </div>
      <div class="planner-spot-actions">
        <button type="button" class="planner-slide-btn" data-slide-spot="${spot.id}" data-direction="prev" ${canMovePrev ? '' : 'disabled'} title="前の日へ" aria-label="前の日へ">◀</button>
        <button type="button" class="planner-slide-btn" data-slide-spot="${spot.id}" data-direction="next" data-add-day-if-needed="true" title="次の日へ" aria-label="次の日へ">▶</button>
        <button type="button" class="planner-icon-btn" data-locate-spot="${spot.id}" title="マップで見る" aria-label="マップで見る">📍</button>
        <button type="button" class="planner-icon-btn danger" data-remove-spot="${spot.id}" title="削除" aria-label="削除">×</button>
      </div>
    </div>
  `;
}

function wirePlannerEvents() {
  $$('#planner-body [data-remove-day]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.removeDay);
      removeDay(idx);
    });
  });
  $$('#planner-body [data-remove-spot]').forEach(btn => {
    btn.addEventListener('click', () => removeFromPlan(btn.dataset.removeSpot));
  });
  $$('#planner-body [data-slide-spot]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.slideSpot;
      const dir = btn.dataset.direction; // 'prev' | 'next'
      const fromIdx = findSpotDayIndex(id);
      if (fromIdx === -1) return;
      let toIdx = dir === 'prev' ? fromIdx - 1 : fromIdx + 1;
      if (toIdx < 0) return;
      // Auto-add a new day if moving past the last day
      if (toIdx >= state.plan.days.length) {
        state.plan.days.push({ id: newDayId(), spotIds: [] });
      }
      moveToDay(id, toIdx);
    });
  });
  $$('#planner-body [data-locate-spot]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.locateSpot;
      const spot = SPOT_BY_ID[id];
      if (spot?.coords && map) {
        map.flyTo(spot.coords, 12, { duration: 0.6 });
      }
    });
  });
}

// ─────────────────────────────────────────────
// Boot
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadPlan();
  initMap();
  renderPlannerDrawer();
  updatePlanCount();

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

  // Capture welcome HTML for later restore via "別の例を見る"
  captureWelcomeHTML();

  // Welcome example chips — pre-baked demo flow (no API key required)
  $$('.welcome-example').forEach(wireExampleButton);

  // Map toggle
  $('#toggle-map')?.addEventListener('click', toggleMap);

  // Planner drawer wiring
  $('#plan-toggle')?.addEventListener('click', togglePlannerDrawer);
  $('#planner-close')?.addEventListener('click', closePlannerDrawer);
  $('#planner-overlay')?.addEventListener('click', closePlannerDrawer);
  $('#planner-add-day')?.addEventListener('click', addDay);
  $('#planner-clear')?.addEventListener('click', () => {
    if (planTotalCount() === 0 || confirm('プランを全部消してよろしいですか?')) clearPlan();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.body.classList.contains('drawer-open')) {
      closePlannerDrawer();
    }
  });

  // Trigger map resize after layout settles
  setTimeout(() => map?.invalidateSize(), 600);
});
