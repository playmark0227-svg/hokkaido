// ========================================================
// Hokkaido Travel Note — App with Claude API
// Map + AI Chat (Claude) + Tinder-style Swipe + Itinerary
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

// ─────────────────────────────────────────────
// MAP (Leaflet)
// ─────────────────────────────────────────────
let map, markerLayer;
const markerById = {};

function initMap() {
  if (typeof L === 'undefined') { setTimeout(initMap, 100); return; }

  map = L.map('map', {
    center: [43.4, 142.7],
    zoom: 6,
    scrollWheelZoom: false,
    zoomControl: true,
  });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '© OpenStreetMap'
  }).addTo(map);
  markerLayer = L.layerGroup().addTo(map);
  SPOTS.forEach(spot => addMarker(spot));
  map.on('click focus', () => map.scrollWheelZoom.enable());
  map.on('mouseout', () => map.scrollWheelZoom.disable());
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

function refreshFavMarkers() {
  Object.entries(markerById).forEach(([id, marker]) => {
    const spot = SPOTS.find(s => s.id === id);
    const isFav = state.likes.includes(id);
    const color = isFav ? '#E84A38' : (REGION_COLORS[spot.region] || '#3D2817');
    const icon = L.divIcon({
      className: 'spot-pin' + (isFav ? ' is-fav' : ''),
      html: `<span style="background:${color}"></span>`,
      iconSize: isFav ? [28, 28] : [22, 22],
      iconAnchor: isFav ? [14, 14] : [11, 11],
    });
    marker.setIcon(icon);
  });
}

// ─────────────────────────────────────────────
// Anthropic client + State
// ─────────────────────────────────────────────
const STORAGE_KEY = 'anthropic_api_key';
let anthropic = null;

const state = {
  apiMessages: [],     // conversation history for Claude API
  isStreaming: false,
  candidates: [],
  cardIndex: 0,
  likes: [],
  skips: [],
  history: [],
};

function getApiKey() {
  // Priority: config.js (committed) > localStorage (user-entered)
  if (typeof window.ANTHROPIC_API_KEY === 'string' && window.ANTHROPIC_API_KEY.trim()) {
    return window.ANTHROPIC_API_KEY.trim();
  }
  return localStorage.getItem(STORAGE_KEY) || '';
}
function setApiKey(k) { localStorage.setItem(STORAGE_KEY, k); }
function clearApiKey() { localStorage.removeItem(STORAGE_KEY); }
function hasConfiguredKey() {
  return typeof window.ANTHROPIC_API_KEY === 'string' && window.ANTHROPIC_API_KEY.trim().length > 0;
}

async function waitForAnthropic() {
  if (window.Anthropic) return window.Anthropic;
  return new Promise(resolve => {
    window.addEventListener('anthropic-loaded', () => resolve(window.Anthropic), { once: true });
  });
}

async function initAnthropic() {
  const key = getApiKey();
  if (!key) { anthropic = null; return null; }
  const Anthropic = await waitForAnthropic();
  anthropic = new Anthropic({
    apiKey: key,
    dangerouslyAllowBrowser: true,
  });
  return anthropic;
}

// ─────────────────────────────────────────────
// Claude API: System prompt + Tools
// ─────────────────────────────────────────────
const SPOTS_FOR_AI = SPOTS.map(s => ({
  id: s.id,
  name: s.name,
  region: s.region,
  area: s.area,
  categories: s.categories,
  bestSeason: s.bestSeason,
  description: s.description,
}));

const SYSTEM_INSTRUCTIONS = `あなたは北海道専門の旅行プランナーです。ユーザーと自然な会話で旅の希望をヒアリングし、北海道の観光スポット情報から最適な場所を提案してください。

【トーン】
- 親しみやすく、ただし大人向けの落ち着いたトーン
- 絵文字や「♪」「！」の多用は避ける
- 1〜2文で簡潔に。長文の説明は避ける

【聞き出す情報】
質問は一度に1〜2個まで、テンポよく対話してください。最低でも3つの条件を把握したら suggest_spots ツールを呼びます。
1. 旅行の日程・期間
2. おおよその予算 (任意)
3. 興味のあるテーマ(自然/温泉/グルメ/街/文化/季節 など)
4. マストで行きたい場所 (任意)
5. 同行者・出発地 (任意)

【スポット選定の指針】
- ユーザーの条件に最も合う 8〜16 件を選ぶ
- 日帰り 6-8件、1泊 8-12件、2泊 12-16件、3泊+ 14-18件
- エリアと季節のバランスを考慮
- 同じエリアばかりにならないよう調整 (移動が現実的な範囲で)
- マスト箇所は必ず含める
- カテゴリの希望に沿いつつ、隠れた名所も1〜2件入れて良い

【ツール使用】
- 情報が揃ったら suggest_spots を呼ぶ
- ユーザーが「もっと候補が欲しい」「条件を変えたい」と言えば、別の組み合わせで再度呼んでよい
- 各ツール呼び出しに 1〜2文の選定理由(summary)を添える

【出力】
- 親しみやすく簡潔に
- ユーザーが言ったことを軽く確認しながら進める
`;

function buildSystem() {
  return [
    { type: 'text', text: SYSTEM_INSTRUCTIONS },
    {
      type: 'text',
      text: `# 利用可能な北海道観光スポット (64件)\n以下のスポットの中から提案してください。​\n\n${JSON.stringify(SPOTS_FOR_AI)}`,
      cache_control: { type: 'ephemeral' },
    },
  ];
}

const TOOLS = [{
  name: 'suggest_spots',
  description: '会話で集めた条件に基づき、おすすめの観光スポットIDを提案する。ユーザーが満足するまで何度でも呼べる。8〜16件をリストで返す。',
  input_schema: {
    type: 'object',
    properties: {
      spot_ids: {
        type: 'array',
        items: { type: 'string' },
        description: '提案するスポットIDのリスト(8〜16件)。提供されたスポットデータの id を使用。',
      },
      summary: {
        type: 'string',
        description: '提案の根拠を1〜2文で。例: 「札幌〜小樽の冬旅と温泉重視で、グルメスポットも含めました。」',
      },
    },
    required: ['spot_ids', 'summary'],
  },
}];

// ─────────────────────────────────────────────
// Chat UI helpers
// ─────────────────────────────────────────────
function addMessage(text, type = 'bot') {
  const wrap = $('#chat-window');
  const bubble = document.createElement('div');
  bubble.className = `chat-msg chat-msg-${type}`;
  bubble.innerHTML = type === 'bot'
    ? `<span class="chat-avatar">AI</span><div class="chat-bubble">${text}</div>`
    : `<div class="chat-bubble">${text}</div>`;
  wrap.appendChild(bubble);
  wrap.scrollTop = wrap.scrollHeight;
  return bubble;
}

function showTyping() {
  const wrap = $('#chat-window');
  const bubble = document.createElement('div');
  bubble.className = 'chat-msg chat-msg-bot chat-typing';
  bubble.innerHTML = `<span class="chat-avatar">AI</span><div class="chat-bubble"><span></span><span></span><span></span></div>`;
  wrap.appendChild(bubble);
  wrap.scrollTop = wrap.scrollHeight;
  return bubble;
}

function renderFreeTextInput(autoFocus = true) {
  const box = $('#chat-input');
  box.innerHTML = `
    <div class="chat-text-input">
      <input type="text" id="user-text-input" placeholder="返事を入力..." autocomplete="off" />
      <button type="button" class="chat-send" id="user-text-send">送信</button>
    </div>`;
  const input = $('#user-text-input');
  const send = $('#user-text-send');
  const handle = () => {
    const text = input.value.trim();
    if (!text || state.isStreaming) return;
    box.innerHTML = '';
    sendUserMessage(text);
  };
  send.addEventListener('click', handle);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); handle(); }
  });
  if (autoFocus) setTimeout(() => input.focus(), 200);
}

function renderApiKeyPrompt() {
  const wrap = $('#chat-window');
  wrap.innerHTML = '';
  addMessage(
    'AI 旅プランを使うには、Claude API キーの設定が必要です。<br>右上の <strong>設定アイコン</strong> から API キーを登録してください。',
    'bot'
  );
  const box = $('#chat-input');
  box.innerHTML = `
    <button type="button" class="chat-confirm" id="open-settings-from-chat">API キーを設定する</button>
  `;
  $('#open-settings-from-chat')?.addEventListener('click', openSettingsModal);
}

// ─────────────────────────────────────────────
// Conversation with Claude
// ─────────────────────────────────────────────
async function startAiConversation(initialText) {
  // Reset
  Object.assign(state, {
    apiMessages: [],
    isStreaming: false,
    candidates: [],
    cardIndex: 0,
    likes: [],
    skips: [],
    history: [],
  });
  $('#chat-window').innerHTML = '';
  $('#chat-input').innerHTML = '';
  $('#swipe-section').hidden = true;
  $('#itinerary-section').hidden = true;
  $('#swipe-empty').hidden = true;
  refreshFavMarkers();

  if (!anthropic) {
    const a = await initAnthropic();
    if (!a) { renderApiKeyPrompt(); return; }
  }

  if (initialText && initialText.trim()) {
    await sendUserMessage(initialText.trim());
  } else {
    // Greeting opener — bot turn first, no user message
    await sendUserMessage(
      'こんにちは。北海道の旅プランを相談したいです。',
      { hideUserBubble: false }
    );
  }
}

async function sendUserMessage(text, options = {}) {
  if (state.isStreaming) return;
  state.isStreaming = true;

  if (!options.hideUserBubble) {
    addMessage(escapeHtml(text), 'user');
  }
  state.apiMessages.push({ role: 'user', content: text });
  $('#chat-input').innerHTML = '';

  await runAssistantTurn();

  state.isStreaming = false;
}

async function runAssistantTurn() {
  let typing = showTyping();
  let bubble = null;
  let accumulated = '';

  try {
    const stream = await anthropic.messages.stream({
      model: 'claude-opus-4-7',
      max_tokens: 1500,
      system: buildSystem(),
      tools: TOOLS,
      messages: state.apiMessages,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        if (event.content_block.type === 'text') {
          if (typing) { typing.remove(); typing = null; }
          bubble = addMessage('', 'bot');
        }
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          accumulated += event.delta.text;
          if (bubble) {
            bubble.querySelector('.chat-bubble').innerHTML = escapeHtml(accumulated).replace(/\n/g, '<br>');
            const w = $('#chat-window');
            w.scrollTop = w.scrollHeight;
          }
        }
      } else if (event.type === 'content_block_stop') {
        accumulated = '';
      }
    }

    const finalMessage = await stream.finalMessage();
    if (typing) { typing.remove(); typing = null; }

    state.apiMessages.push({ role: 'assistant', content: finalMessage.content });

    // Check for tool use
    const toolUse = finalMessage.content.find(b => b.type === 'tool_use');
    if (toolUse && toolUse.name === 'suggest_spots') {
      const ok = handleSuggestSpots(toolUse.input);
      state.apiMessages.push({
        role: 'user',
        content: [{
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: ok
            ? `スポット候補(${state.candidates.length}件)をユーザーに表示しました。次は会話を続けて、ユーザーがもっと候補が欲しいか / 条件を変えたいかなどあれば対応してください。`
            : 'スポットIDの一部が無効でした。再度提案してください。'
        }]
      });
      // Continue conversation flow
      await runAssistantTurn();
      return;
    }

    // No tool used — let user reply
    if (finalMessage.stop_reason === 'end_turn' || finalMessage.stop_reason === 'max_tokens') {
      renderFreeTextInput();
    }

  } catch (err) {
    if (typing) typing.remove();
    handleApiError(err);
  }
}

function handleSuggestSpots(input) {
  const ids = (input.spot_ids || []).filter(Boolean);
  const spots = ids.map(id => SPOTS.find(s => s.id === id)).filter(Boolean);
  if (spots.length < 4) return false;

  state.candidates = spots;
  state.cardIndex = 0;
  state.likes = [];
  state.skips = [];
  state.history = [];
  refreshFavMarkers();
  revealSwipe();
  return true;
}

function handleApiError(err) {
  const message = err?.message || String(err);
  let advice = '';
  if (err?.status === 401) advice = 'API キーが正しくないか、無効化されている可能性があります。右上の設定から再入力してください。';
  else if (err?.status === 429) advice = 'レート制限に達しました。少し時間を空けてから再試行してください。';
  else if (err?.status >= 500) advice = 'Anthropic 側で一時的なエラーが発生しているようです。しばらくしてから再試行してください。';
  else if (message.includes('fetch')) advice = 'ネットワーク接続をご確認ください。';

  addMessage(
    `⚠️ エラーが発生しました：<br><code style="font-size:0.85em">${escapeHtml(message)}</code><br>${advice}`,
    'bot'
  );
  renderFreeTextInput(false);
}

// ─────────────────────────────────────────────
// Swipe (existing functionality)
// ─────────────────────────────────────────────
function revealSwipe() {
  const section = $('#swipe-section');
  section.hidden = false;
  buildSwipeDeck();
  setTimeout(() => section.scrollIntoView({ behavior: 'smooth', block: 'start' }), 400);
}

function buildSwipeDeck() {
  const deck = $('#swipe-deck');
  deck.innerHTML = '';
  state.candidates.forEach((spot, i) => {
    deck.appendChild(buildSwipeCard(spot, i));
  });
  updateSwipeProgress();
  attachTopCard();
  $('#swipe-empty').hidden = true;
}

function buildSwipeCard(spot, idx) {
  const card = document.createElement('article');
  card.className = 'swipe-card';
  card.dataset.spotId = spot.id;
  card.dataset.index = idx;

  const region = REGIONS[spot.region];
  const cats = spot.categories
    .map(c => `<span class="spot-tag">${CATEGORIES[c].emoji} ${CATEGORIES[c].name}</span>`)
    .join('');

  card.innerHTML = `
    <div class="swipe-card-illust" style="background:${spot.color}">
      <span class="spot-region-tag">${region.name} · ${escapeHtml(spot.area)}</span>
      <span class="spot-season-tag">${spot.bestSeason}</span>
      ${getIcon(spot.icon)}
      <span class="swipe-stamp swipe-stamp-like">行きたい！</span>
      <span class="swipe-stamp swipe-stamp-skip">スキップ</span>
    </div>
    <div class="swipe-card-body">
      <h3>${escapeHtml(spot.name)}</h3>
      <p class="swipe-card-en">${escapeHtml(spot.nameEn)}</p>
      <p class="swipe-card-desc">${escapeHtml(spot.description)}</p>
      <div class="swipe-card-meta">${cats}</div>
      <p class="swipe-card-access">📍 ${escapeHtml(spot.accessTime)}</p>
    </div>`;
  return card;
}

let activeCard = null;
let dragData = null;

function getTopCard() {
  const cards = $$('.swipe-card', $('#swipe-deck')).filter(c => !c.dataset.gone);
  return cards[cards.length - 1] || null;
}

function attachTopCard() {
  const card = getTopCard();
  if (!card) { showSwipeEmpty(); return; }
  if (activeCard === card) return;
  activeCard = card;
  card.addEventListener('pointerdown', onPointerDown);
}

function onPointerDown(e) {
  if (e.button && e.button !== 0) return;
  const card = e.currentTarget;
  card.setPointerCapture(e.pointerId);
  dragData = { startX: e.clientX, startY: e.clientY, deltaX: 0, deltaY: 0, card };
  card.classList.add('is-dragging');
  card.addEventListener('pointermove', onPointerMove);
  card.addEventListener('pointerup', onPointerUp);
  card.addEventListener('pointercancel', onPointerUp);
}

function onPointerMove(e) {
  if (!dragData) return;
  dragData.deltaX = e.clientX - dragData.startX;
  dragData.deltaY = e.clientY - dragData.startY;
  const card = dragData.card;
  card.style.transform = `translate(${dragData.deltaX}px, ${dragData.deltaY * 0.3}px) rotate(${dragData.deltaX / 18}deg)`;
  const op = Math.min(1, Math.abs(dragData.deltaX) / 120);
  card.style.setProperty('--like-op', dragData.deltaX > 0 ? op : 0);
  card.style.setProperty('--skip-op', dragData.deltaX < 0 ? op : 0);
}

function onPointerUp(e) {
  if (!dragData) return;
  const card = dragData.card;
  card.removeEventListener('pointermove', onPointerMove);
  card.removeEventListener('pointerup', onPointerUp);
  card.removeEventListener('pointercancel', onPointerUp);
  card.classList.remove('is-dragging');
  const dx = dragData.deltaX;
  dragData = null;
  if (dx > 100) finishSwipe(card, 'like');
  else if (dx < -100) finishSwipe(card, 'skip');
  else {
    card.style.transform = '';
    card.style.setProperty('--like-op', 0);
    card.style.setProperty('--skip-op', 0);
  }
}

function finishSwipe(card, direction) {
  const dist = direction === 'like' ? 1200 : -1200;
  card.style.transition = 'transform .4s ease, opacity .4s ease';
  card.style.transform = `translate(${dist}px, 80px) rotate(${dist / 40}deg)`;
  card.style.opacity = '0';
  card.dataset.gone = '1';

  const id = card.dataset.spotId;
  if (direction === 'like') state.likes.push(id);
  else state.skips.push(id);
  state.history.push({ id, direction });
  refreshFavMarkers();
  $('#swipe-undo').disabled = false;

  setTimeout(() => {
    card.remove();
    activeCard = null;
    updateSwipeProgress();
    attachTopCard();
  }, 400);
}

function undoLast() {
  const last = state.history.pop();
  if (!last) return;
  if (last.direction === 'like') state.likes = state.likes.filter(x => x !== last.id);
  else state.skips = state.skips.filter(x => x !== last.id);
  refreshFavMarkers();
  const spot = state.candidates.find(s => s.id === last.id);
  if (!spot) return;
  const newCard = buildSwipeCard(spot, state.candidates.indexOf(spot));
  newCard.style.opacity = '0';
  $('#swipe-deck').appendChild(newCard);
  requestAnimationFrame(() => { newCard.style.transition = 'opacity .3s'; newCard.style.opacity = ''; });
  activeCard = null;
  attachTopCard();
  $('#swipe-empty').hidden = true;
  $('#swipe-undo').disabled = state.history.length === 0;
  updateSwipeProgress();
}

function updateSwipeProgress() {
  const total = state.candidates.length;
  const done = state.history.length;
  $('#swipe-progress-text').textContent = `${done} / ${total}`;
}

function showSwipeEmpty() { $('#swipe-empty').hidden = false; }

// ─────────────────────────────────────────────
// Itinerary
// ─────────────────────────────────────────────
function showItinerary() {
  const section = $('#itinerary-section');
  const list = $('#itinerary-list');
  const liked = state.likes.map(id => SPOTS.find(s => s.id === id)).filter(Boolean);

  $('#itinerary-count').textContent = `${liked.length}件のスポット`;

  if (liked.length === 0) {
    list.innerHTML = `<p class="itinerary-empty">気になるスポットが選ばれていません。<br>もう一度プランを作ってみてください。</p>`;
  } else {
    const regionOrder = ['doo','donan','doto','dohoku'];
    liked.sort((a, b) => regionOrder.indexOf(a.region) - regionOrder.indexOf(b.region));
    list.innerHTML = liked.map((spot, i) => `
      <article class="itinerary-item">
        <div class="itinerary-num">${String(i+1).padStart(2,'0')}</div>
        <div class="itinerary-illust" style="background:${spot.color}">${getIcon(spot.icon)}</div>
        <div class="itinerary-content">
          <h3>${escapeHtml(spot.name)}</h3>
          <p class="itinerary-meta">${REGIONS[spot.region].name} · ${escapeHtml(spot.area)} · ${spot.bestSeason}</p>
          <p>${escapeHtml(spot.description)}</p>
        </div>
      </article>
    `).join('');
  }

  section.hidden = false;
  setTimeout(() => section.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);

  if (liked.length && map) {
    const bounds = L.latLngBounds(liked.map(s => s.coords).filter(Boolean));
    if (bounds.isValid()) map.flyToBounds(bounds, { padding: [40, 40] });
  }
}

// ─────────────────────────────────────────────
// Settings modal
// ─────────────────────────────────────────────
function openSettingsModal() {
  const ov = $('#settings-overlay');
  if (!ov) return;
  ov.hidden = false;
  $('#api-key-input').value = getApiKey();
  $('#settings-status').className = 'settings-status';
  $('#settings-status').textContent = '';
}

function closeSettingsModal() {
  $('#settings-overlay').hidden = true;
}

async function handleSaveApiKey() {
  const input = $('#api-key-input');
  const status = $('#settings-status');
  const key = input.value.trim();
  if (!key) {
    status.className = 'settings-status is-error';
    status.textContent = 'API キーを入力してください';
    return;
  }
  setApiKey(key);
  await initAnthropic();
  status.className = 'settings-status is-success';
  status.textContent = '保存しました。AIプランナーが使えます ✓';

  setTimeout(() => {
    closeSettingsModal();
    chatStarted = false;
    startAiConversation('');
    document.querySelector('#planner')?.scrollIntoView({ behavior: 'smooth' });
  }, 800);
}

function handleClearApiKey() {
  clearApiKey();
  anthropic = null;
  $('#api-key-input').value = '';
  const status = $('#settings-status');
  status.className = 'settings-status is-success';
  status.textContent = 'API キーを削除しました';
  // If chat is visible, reset to prompt
  if (chatStarted) {
    chatStarted = false;
    renderApiKeyPrompt();
  }
}

// ─────────────────────────────────────────────
// Boot
// ─────────────────────────────────────────────
let chatStarted = false;
function maybeStartChat() {
  if (chatStarted) return;
  chatStarted = true;
  startAiConversation('');
}

function scrollToPlanner() {
  $('#planner')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function launchChatFromInput(text) {
  chatStarted = true;
  scrollToPlanner();
  setTimeout(() => startAiConversation(text), 300);
}

document.addEventListener('DOMContentLoaded', async () => {
  initMap();
  await initAnthropic();

  // Map CTA form
  $('#map-cta-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const text = ($('#map-cta-input')?.value || '').trim();
    launchChatFromInput(text);
    if ($('#map-cta-input')) $('#map-cta-input').value = '';
  });
  $('#map-cta-skip')?.addEventListener('click', () => launchChatFromInput(''));

  // Auto-start chat once planner section enters viewport
  const plannerEl = $('#planner');
  if (plannerEl && 'IntersectionObserver' in window) {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          maybeStartChat();
          obs.disconnect();
        }
      });
    }, { threshold: 0.25 });
    obs.observe(plannerEl);
  }

  // Smooth-scroll for in-page anchors
  $$('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (id.length > 1 && document.querySelector(id)) {
        e.preventDefault();
        document.querySelector(id).scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  setTimeout(() => map && map.invalidateSize(), 600);

  // Reset chat
  $('#reset-chat')?.addEventListener('click', () => { chatStarted = false; maybeStartChat(); });
  $('#restart-btn')?.addEventListener('click', () => {
    chatStarted = false;
    scrollToPlanner();
    setTimeout(() => maybeStartChat(), 300);
  });

  // Swipe actions
  $('#swipe-skip')?.addEventListener('click', () => { const c = getTopCard(); if (c) finishSwipe(c, 'skip'); });
  $('#swipe-like')?.addEventListener('click', () => { const c = getTopCard(); if (c) finishSwipe(c, 'like'); });
  $('#swipe-undo')?.addEventListener('click', undoLast);
  $('#show-itinerary')?.addEventListener('click', showItinerary);

  // Settings modal
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
});
