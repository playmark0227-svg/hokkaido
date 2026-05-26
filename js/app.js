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

const SPOT_BY_ID = Object.fromEntries(SPOTS.map(s => [s.id, s]));

const STORAGE_KEY = 'anthropic_api_key';
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
// Map (Leaflet)
// ─────────────────────────────────────────────
let map, markerLayer;
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
  SPOTS.forEach(addMarker);
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

const SYSTEM_INSTRUCTIONS = `あなたは北海道専門の旅行プランナーです。ユーザーと対話して旅程を組み立てます。

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

【ツール使用】
- 必要な情報が揃ったら propose_itinerary ツールを呼んで旅程を提案する
- 各スポットには日付・時間帯・コメントを添える
- 日帰り: 3-5スポット / 1泊: 5-8 / 2泊: 8-12 / 3泊+: 10-16
- ユーザーが「もう少し違う案」「○○を入れて」と言えば、再度ツールを呼んで修正版を提案
- スポットIDは渡されたデータの id を必ず使う

【スポット選定の指針】
- ユーザーの条件に合致するものを優先
- エリア・テーマのバランス、移動の現実性を考慮
- 「hasVideo: true」のスポットも、適合度が高いなら積極的に含めてよい (条件には合わせる)
- 同じスポットは1つの旅程内で重複させない

【参考: スポットデータのregion値の対応 (内部用)】
- doo    = 札幌・小樽・富良野・美瑛・ニセコ・登別 (北海道中央エリア)
- donan  = 函館・松前・大沼 (北海道南エリア)
- doto   = 知床・釧路・網走・阿寒・帯広 (北海道東エリア)
- dohoku = 旭川・稚内・利尻礼文・サロベツ (北海道北エリア)

【ツール呼び出し後】
- ツール呼び出し後は短く一言「いかがでしょうか?」「気になる箇所はありますか?」程度で済ませる
- 旅程の説明をテキストで繰り返さない (UIに表示されるので不要)
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
  name: 'propose_itinerary',
  description: '対話で集めた条件に基づき、北海道の旅程を提案する。日付ごとにスポットを並べてユーザーに表示する。再提案する場合も同じツールを呼ぶ。',
  input_schema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: '旅程のタイトル。例: 「札幌・小樽 2泊3日 温泉とグルメ」'
      },
      summary: {
        type: 'string',
        description: '旅程全体のテーマや見どころを1〜2文で。'
      },
      days: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            day: { type: 'number', description: '日数 (1始まり)' },
            theme: { type: 'string', description: 'その日のテーマ (例: 札幌街歩き)' },
            spots: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  spot_id: { type: 'string', description: '提供データの id を必ず使う' },
                  time: { type: 'string', description: '午前 / 昼 / 午後 / 夕方 / 夜 など' },
                  comment: { type: 'string', description: 'そのスポットの楽しみ方や見どころを1〜2文で。AIプランナーらしい所感。' },
                },
                required: ['spot_id', 'comment']
              }
            }
          },
          required: ['day', 'spots']
        }
      }
    },
    required: ['title', 'days']
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
// Demo itineraries (no API key needed for the 6 example prompts)
// ─────────────────────────────────────────────
const DEMO_ITINERARIES = {
  "札幌に2泊3日で温泉とグルメを楽しみたい": {
    title: "札幌2泊3日 — 温泉とグルメ満喫プラン",
    summary: "札幌の街を満喫しつつ、定山渓温泉で湯ったり、サッポロビール園でジンギスカンも楽しめる王道プラン。",
    days: [
      { day: 1, theme: "札幌街歩きとビール園", spots: [
        { spot_id: "sapporo-clock-tower", time: "午前", comment: "札幌のシンボル。明治の建造物で写真映えも◎" },
        { spot_id: "odori-park", time: "昼", comment: "公園のスタンドでお昼ご飯。テレビ塔と一緒に撮影。" },
        { spot_id: "sapporo-tv-tower", time: "午後", comment: "展望台から札幌の街を一望。" },
        { spot_id: "sapporo-beer", time: "夜", comment: "サッポロビール園で名物ジンギスカンと出来立てビール。" }
      ]},
      { day: 2, theme: "定山渓温泉で湯ったり", spots: [
        { spot_id: "jozankei-onsen", time: "終日", comment: "札幌からバスで70分。渓谷美と温泉で癒される一日。" }
      ]},
      { day: 3, theme: "札幌郊外の名所", spots: [
        { spot_id: "hokkaido-shrine", time: "午前", comment: "札幌の総鎮守。緑豊かな円山公園内に。" },
        { spot_id: "maruyama-zoo", time: "昼", comment: "ホッキョクグマやレッサーパンダに出会える。" },
        { spot_id: "shiroi-koibito-park", time: "午後", comment: "白い恋人の工場見学+お菓子作り体験で旅の締めくくり。" }
      ]}
    ]
  },
  "知床と網走で大自然を満喫する3泊プランを組みたい": {
    title: "知床・網走3泊4日 — 大自然満喫プラン",
    summary: "世界自然遺産・知床から流氷の街・網走、神秘の湖・摩周湖まで道東の絶景を巡ります。",
    days: [
      { day: 1, theme: "知床到着&五湖散策", spots: [
        { spot_id: "shiretoko", time: "終日", comment: "世界自然遺産。ウトロ温泉に宿泊。" },
        { spot_id: "shiretoko-goko", time: "午後", comment: "原生林の中に点在する五つの湖。高架木道から知床連山を望む。" }
      ]},
      { day: 2, theme: "知床の絶景", spots: [
        { spot_id: "oshinkoshin-falls", time: "午前", comment: "日本の滝百選。二筋に分かれて流れる姿が美しい。" },
        { spot_id: "shiretoko", time: "午後", comment: "知床クルーズで野生動物観察 (ヒグマやイルカに出会えることも)。" }
      ]},
      { day: 3, theme: "網走移動&流氷", spots: [
        { spot_id: "abashiri-drift-ice", time: "午前", comment: "冬の風物詩。流氷砕氷船「おーろら」で大自然の神秘を体験。" },
        { spot_id: "abashiri-prison", time: "午後", comment: "明治時代の監獄を移築復元した野外博物館。" }
      ]},
      { day: 4, theme: "神秘の湖を巡る", spots: [
        { spot_id: "lake-mashu", time: "午前", comment: "世界屈指の透明度を誇る神秘の湖。「霧の摩周湖」の幻想的な景色。" },
        { spot_id: "lake-akan", time: "午後", comment: "マリモの生息地。アイヌコタンの文化体験も。" }
      ]}
    ]
  },
  "家族で行ける札幌・小樽周辺のおすすめスポットを教えて": {
    title: "家族で札幌・小樽 1泊2日",
    summary: "子連れでも楽しめる動物園や工場見学、レトロな街並み散策プラン。",
    days: [
      { day: 1, theme: "札幌で動物と工場見学", spots: [
        { spot_id: "maruyama-zoo", time: "午前", comment: "子供に大人気の動物園。ホッキョクグマの泳ぐ姿は必見。" },
        { spot_id: "shiroi-koibito-park", time: "午後", comment: "お菓子作り体験ができるテーマパーク。お土産購入も。" }
      ]},
      { day: 2, theme: "小樽でレトロ散策", spots: [
        { spot_id: "otaru-canal", time: "午前", comment: "レトロな倉庫群とガス灯が美しい運河。クルーズも楽しめる。" },
        { spot_id: "otaru-music-box", time: "昼", comment: "世界中のオルゴールが並ぶ夢の空間。蒸気時計も必見。" },
        { spot_id: "yoichi-distillery", time: "午後", comment: "ニッカウヰスキー余市蒸溜所見学。" }
      ]}
    ]
  },
  "冬の北海道で雪まつりとスキーリゾートを巡りたい": {
    title: "冬の北海道3泊4日 — 雪まつり&スキー",
    summary: "札幌雪まつりから世界トップクラスのパウダースノー・ニセコ、温泉天国・登別まで。",
    days: [
      { day: 1, theme: "札幌雪まつり満喫", spots: [
        { spot_id: "sapporo-snow-festival", time: "午後〜夜", comment: "2月の世界的祭典。巨大雪像のライトアップは圧巻。" },
        { spot_id: "odori-park", time: "夜", comment: "メイン会場。屋台グルメも豊富。" }
      ]},
      { day: 2, theme: "ニセコへ移動&スキー", spots: [
        { spot_id: "niseko", time: "終日", comment: "世界有数のパウダースノー。アクティビティ豊富で滞在を楽しめる。" }
      ]},
      { day: 3, theme: "登別温泉で湯治", spots: [
        { spot_id: "noboribetsu-onsen", time: "終日", comment: "9種類もの泉質を誇る日本屈指の温泉郷。" },
        { spot_id: "jigokudani", time: "午後", comment: "登別の象徴。雪景色と湯けむりが幻想的。" }
      ]},
      { day: 4, theme: "札幌へ戻る", spots: [
        { spot_id: "sapporo-clock-tower", time: "午前", comment: "札幌のシンボルを訪れて旅の締めくくり。" }
      ]}
    ]
  },
  "美瑛と富良野の花と景色を満喫する1泊2日": {
    title: "美瑛・富良野1泊2日 — 花と景色の旅",
    summary: "ラベンダーの紫の絨毯から青い池の神秘的な絶景まで、美瑛富良野の名所を巡ります。",
    days: [
      { day: 1, theme: "富良野の花畑", spots: [
        { spot_id: "furano-lavender", time: "午前", comment: "ラベンダー畑の代表格。7月が見頃。" },
        { spot_id: "furano", time: "昼", comment: "ドラマ「北の国から」の舞台。チーズ工房やワインも。" }
      ]},
      { day: 2, theme: "美瑛の絶景", spots: [
        { spot_id: "biei-blue-pond", time: "午前", comment: "コバルトブルーに輝く幻想的な池。Apple Mac壁紙の名所。" },
        { spot_id: "biei-patchwork", time: "昼", comment: "色とりどりの畑が織りなす丘陵。CMの木々も。" },
        { spot_id: "shirahige-falls", time: "午後", comment: "岩の隙間から湧き出るブルーの水。青い池の上流。" }
      ]}
    ]
  },
  "函館の夜景と歴史散策の1泊2日プラン": {
    title: "函館1泊2日 — 夜景と歴史散策",
    summary: "世界三大夜景の函館山、星形要塞の五稜郭、レトロな元町エリアを巡る王道プラン。",
    days: [
      { day: 1, theme: "歴史散策&夜景", spots: [
        { spot_id: "goryokaku", time: "午前", comment: "星形の城郭が美しい特別史跡。タワーから全景を。" },
        { spot_id: "motomachi", time: "午後", comment: "異国情緒あふれる坂の街。教会やレトロな洋館を巡る。" },
        { spot_id: "kanemori-warehouse", time: "夕方", comment: "ベイエリアの赤レンガ倉庫群。ショッピングとカフェ。" },
        { spot_id: "mt-hakodate", time: "夜", comment: "世界三大夜景。扇形の夜景は息をのむ美しさ。" }
      ]},
      { day: 2, theme: "朝市&大沼", spots: [
        { spot_id: "hakodate-morning-market", time: "午前", comment: "新鮮な海鮮丼の朝食。イカ釣り体験も。" },
        { spot_id: "onuma-park", time: "午後", comment: "駒ヶ岳を背景にした美しい湖沼群。" }
      ]}
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

  addBotMessage('ご希望に合わせて旅程をご提案します。');
  await sleep(400);
  renderItinerary(demo);
  await sleep(500);

  const closing = addBotMessage('');
  closing.querySelector('.chat-bubble').innerHTML = `
    上記がおすすめプランです。気になる点があれば、下のチャット欄からお知らせください。<br>
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
    const demo = DEMO_ITINERARIES[prompt];
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
function renderItinerary(input) {
  const { title, summary, days } = input;
  const validDays = (days || []).filter(d => d.spots?.length);
  if (!validDays.length) return null;

  // Collect all spot ids for map highlighting
  const allIds = [];
  validDays.forEach(d => d.spots.forEach(s => { if (s.spot_id) allIds.push(s.spot_id); }));

  state.highlightedSpotIds = new Set(allIds);
  refreshHighlights();
  flyToSpots(allIds);

  const thread = $('#chat-thread');
  const wrapper = document.createElement('div');
  wrapper.className = 'itinerary-card';

  let html = '';
  if (title) html += `<h2 class="itinerary-title">${escapeHtml(title)}</h2>`;
  if (summary) html += `<p class="itinerary-summary">${escapeHtml(summary)}</p>`;

  validDays.forEach(day => {
    html += `<div class="itinerary-day">`;
    html += `<div class="itinerary-day-head">`;
    html += `<span class="itinerary-day-num">DAY ${day.day || '?'}</span>`;
    if (day.theme) html += `<span class="itinerary-day-theme">${escapeHtml(day.theme)}</span>`;
    html += `</div>`;
    html += `<div class="itinerary-spots">`;
    day.spots.forEach(s => {
      const spot = SPOT_BY_ID[s.spot_id];
      if (!spot) return;
      html += renderSpotCard(spot, s);
    });
    html += `</div></div>`;
  });

  wrapper.innerHTML = html;
  thread.appendChild(wrapper);
  thread.scrollTop = thread.scrollHeight;

  // Wire up "show on map" buttons in the itinerary
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
        <p class="spot-listing-desc">${escapeHtml(spot.description)}</p>
        <div class="spot-listing-foot">
          <small>🚆 ${escapeHtml(spot.accessTime || '')}</small>
          <button type="button" class="spot-pan-btn" data-spot-pan="${spot.id}">
            マップで見る →
          </button>
        </div>
      </div>
    </article>
  `;
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
    if (toolUse && toolUse.name === 'propose_itinerary') {
      const rendered = renderItinerary(toolUse.input || {});
      const okText = rendered
        ? `旅程(${(toolUse.input?.days || []).reduce((n, d) => n + (d.spots?.length || 0), 0)}スポット)を表示しました。ユーザーの反応を待ってください。`
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
// Boot
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initMap();

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

  // Trigger map resize after layout settles
  setTimeout(() => map?.invalidateSize(), 600);
});
