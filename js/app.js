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
  if (err?.status === 401) advice = 'APIキーが正しくないか、無効化されている可能性があります。右上の歯車から再入力してください。';
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
  if (!getApiKey()) {
    addErrorMessage('Claude APIキーが設定されていません', '右上の歯車アイコンからキーを設定してください。');
    openSettingsModal();
    return;
  }
  ta.value = '';
  autosizeTextarea();
  sendUserMessage(text);
}

// ─────────────────────────────────────────────
// Settings modal
// ─────────────────────────────────────────────
function openSettingsModal() {
  const ov = $('#settings-overlay');
  if (!ov) return;
  ov.hidden = false;
  const input = $('#api-key-input');
  input.value = getApiKey();
  $('#settings-status').className = 'settings-status';
  $('#settings-status').textContent = '';
  setTimeout(() => input.focus(), 50);
}
function closeSettingsModal() {
  const ov = $('#settings-overlay');
  if (ov) ov.hidden = true;
}
function handleSaveApiKey() {
  const input = $('#api-key-input');
  const status = $('#settings-status');
  const key = input.value.trim();
  if (!key) {
    status.className = 'settings-status is-error';
    status.textContent = 'APIキーを入力してください';
    return;
  }
  if (!key.startsWith('sk-ant-')) {
    status.className = 'settings-status is-error';
    status.textContent = 'キーの形式が正しくないようです (sk-ant- で始まる文字列のはず)';
    return;
  }
  const saved = setApiKey(key);
  status.className = 'settings-status is-success';
  status.textContent = saved
    ? '保存しました。チャットが使えます ✓'
    : 'ストレージが無効ですが、このタブのみ動作します';
  setTimeout(() => {
    closeSettingsModal();
    $('#chat-input')?.focus();
  }, 600);
}
function handleClearApiKey() {
  clearApiKey();
  $('#api-key-input').value = '';
  const status = $('#settings-status');
  status.className = 'settings-status is-success';
  status.textContent = 'キーを削除しました';
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

  // Welcome example chips
  $$('.welcome-example').forEach(btn => {
    btn.addEventListener('click', () => {
      const prompt = btn.dataset.prompt;
      if (prompt) {
        if (!getApiKey()) {
          openSettingsModal();
          return;
        }
        sendUserMessage(prompt);
      }
    });
  });

  // Map toggle
  $('#toggle-map')?.addEventListener('click', toggleMap);

  // Settings
  $('#open-settings')?.addEventListener('click', openSettingsModal);
  $('#settings-close')?.addEventListener('click', closeSettingsModal);
  $('#settings-overlay')?.addEventListener('click', e => {
    if (e.target.id === 'settings-overlay') closeSettingsModal();
  });
  $('#save-api-key')?.addEventListener('click', handleSaveApiKey);
  $('#clear-api-key')?.addEventListener('click', handleClearApiKey);
  $('#toggle-key-visibility')?.addEventListener('click', () => {
    const input = $('#api-key-input');
    input.type = input.type === 'password' ? 'text' : 'password';
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !$('#settings-overlay').hidden) closeSettingsModal();
  });

  // Trigger map resize after layout settles
  setTimeout(() => map?.invalidateSize(), 600);

  // If no key set, gently open settings on first visit (only when user clicks something)
});
