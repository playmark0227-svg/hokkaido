// ========================================================
// Hokkaido Travel Note - App
// Map + AI Chat Planner + Tinder-style Swipe + Itinerary
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
  if (typeof L === 'undefined') {
    // Leaflet still loading; retry shortly
    setTimeout(initMap, 100);
    return;
  }

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

  // Allow scroll zoom only when map is clicked/focused
  map.on('click focus', () => map.scrollWheelZoom.enable());
  map.on('mouseout', () => map.scrollWheelZoom.disable());
}

function addMarker(spot, options = {}) {
  if (!spot.coords) return;
  const color = options.color || REGION_COLORS[spot.region] || '#3D2817';
  const isFav = options.isFav;

  const icon = L.divIcon({
    className: 'spot-pin' + (isFav ? ' is-fav' : ''),
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
// State
// ─────────────────────────────────────────────
const state = {
  step: 0,
  answers: {
    budget: null,
    duration: null,
    themes: [],
    regions: [],
    musts: '',
  },
  candidates: [],     // filtered spots for swiping
  cardIndex: 0,
  likes: [],          // spot ids
  skips: [],
  history: [],        // for undo
};

// ─────────────────────────────────────────────
// Chat conversation flow
// ─────────────────────────────────────────────
const FLOW = [
  {
    key: 'intro',
    bot: 'はじめまして！北海道の旅プラン作りをお手伝いします。<br>いくつか質問させてください ✿',
    delay: 600,
    next: 'budget',
    autoAdvance: true,
  },
  {
    key: 'budget',
    bot: '<strong>1. ご予算</strong>はどれくらいですか？(お一人さまの目安)',
    type: 'choice',
    options: [
      { label: '〜3万円',     value: '3' },
      { label: '〜5万円',     value: '5' },
      { label: '〜10万円',    value: '10' },
      { label: '10万円以上',  value: '20' },
      { label: '気にしない',   value: 'any' },
    ],
    save: 'budget',
    next: 'duration',
  },
  {
    key: 'duration',
    bot: '<strong>2. 日程</strong>はどれくらいですか？',
    type: 'choice',
    options: [
      { label: '日帰り',   value: '0' },
      { label: '1泊2日',   value: '1' },
      { label: '2泊3日',   value: '2' },
      { label: '3泊以上',  value: '3' },
    ],
    save: 'duration',
    next: 'themes',
  },
  {
    key: 'themes',
    bot: '<strong>3. 興味のあるテーマ</strong>を教えてください (複数選択可)',
    type: 'multi',
    options: [
      { label: '🌳 自然',      value: 'nature' },
      { label: '♨️ 温泉',      value: 'hotspring' },
      { label: '🍜 グルメ',    value: 'food' },
      { label: '🏙️ 街・施設',  value: 'city' },
      { label: '🏯 文化・歴史', value: 'culture' },
      { label: '🌸 季節の風物詩', value: 'season' },
    ],
    save: 'themes',
    next: 'regions',
  },
  {
    key: 'regions',
    bot: '<strong>4. 行きたいエリア</strong>を選んでください (複数選択可)',
    type: 'multi',
    options: [
      { label: '道央（札幌・小樽・富良野・美瑛）', value: 'doo' },
      { label: '道南（函館・松前・大沼）',         value: 'donan' },
      { label: '道東（知床・釧路・網走）',         value: 'doto' },
      { label: '道北（旭川・稚内・利尻礼文）',     value: 'dohoku' },
      { label: 'おまかせ',                          value: 'any' },
    ],
    save: 'regions',
    next: 'musts',
  },
  {
    key: 'musts',
    bot: '<strong>5. マストで行きたい場所</strong>はありますか？<br>(地名やスポット名を自由入力。なければ「特になし」でOK)',
    type: 'text',
    placeholder: '例: 函館山, 旭山動物園',
    save: 'musts',
    next: 'wrap',
  },
  {
    key: 'wrap',
    bot: 'ありがとうございます！条件にぴったりのスポットを<strong id="match-count">−</strong>件ピックアップしました。<br>下のカードを <strong>右にスワイプ=行きたい</strong>、<strong>左でスキップ</strong>で絞り込んでください ✿',
    delay: 800,
    onEnter: () => {
      buildCandidates();
      $('#match-count') && ($('#match-count').textContent = state.candidates.length);
      revealSwipe();
    },
  },
];

let typingTimer = null;

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

function renderInput(step) {
  const box = $('#chat-input');
  box.innerHTML = '';
  if (!step) return;

  if (step.type === 'choice') {
    step.options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'chat-chip';
      btn.type = 'button';
      btn.textContent = opt.label;
      btn.addEventListener('click', () => pickChoice(step, opt));
      box.appendChild(btn);
    });
  } else if (step.type === 'multi') {
    const selected = new Set();
    const chips = [];
    step.options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'chat-chip chat-chip-multi';
      btn.type = 'button';
      btn.textContent = opt.label;
      btn.addEventListener('click', () => {
        if (selected.has(opt.value)) {
          selected.delete(opt.value);
          btn.classList.remove('selected');
        } else {
          if (opt.value === 'any') {
            chips.forEach(c => c !== btn && c.classList.remove('selected'));
            selected.clear();
          } else {
            const anyBtn = chips.find(c => c.dataset.value === 'any');
            if (anyBtn) { anyBtn.classList.remove('selected'); selected.delete('any'); }
          }
          selected.add(opt.value);
          btn.classList.add('selected');
        }
        confirmBtn.disabled = selected.size === 0;
      });
      btn.dataset.value = opt.value;
      box.appendChild(btn);
      chips.push(btn);
    });
    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'chat-confirm';
    confirmBtn.textContent = '決定';
    confirmBtn.disabled = true;
    confirmBtn.addEventListener('click', () => {
      pickMulti(step, [...selected], chips);
    });
    box.appendChild(confirmBtn);
  } else if (step.type === 'text') {
    const wrap = document.createElement('div');
    wrap.className = 'chat-text-input';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = step.placeholder || '';
    const send = document.createElement('button');
    send.type = 'button';
    send.className = 'chat-send';
    send.textContent = '送信';
    const skip = document.createElement('button');
    skip.type = 'button';
    skip.className = 'chat-skip';
    skip.textContent = '特になし';
    const handleSend = (text) => {
      addMessage(text || '特になし', 'user');
      state.answers[step.save] = text || '';
      goNext(step.next);
    };
    send.addEventListener('click', () => handleSend(input.value.trim()));
    skip.addEventListener('click', () => handleSend(''));
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); handleSend(input.value.trim()); }
    });
    wrap.append(input, send, skip);
    box.appendChild(wrap);
  }
}

function pickChoice(step, opt) {
  addMessage(opt.label, 'user');
  state.answers[step.save] = opt.value;
  goNext(step.next);
}

function pickMulti(step, values, chips) {
  const labels = chips.filter(c => c.classList.contains('selected')).map(c => c.textContent).join(' / ');
  addMessage(labels, 'user');
  state.answers[step.save] = values;
  goNext(step.next);
}

function findStep(key) { return FLOW.find(s => s.key === key); }

function goNext(key) {
  $('#chat-input').innerHTML = '';
  const step = findStep(key);
  if (!step) return;

  const typing = showTyping();
  const delay = step.delay || (600 + Math.random() * 400);
  typingTimer = setTimeout(() => {
    typing.remove();
    addMessage(step.bot, 'bot');

    if (step.onEnter) step.onEnter();

    if (step.autoAdvance) {
      setTimeout(() => goNext(step.next), 700);
    } else if (step.type) {
      renderInput(step);
    }
  }, delay);
}

function startChat(initialText) {
  $('#chat-window').innerHTML = '';
  $('#chat-input').innerHTML = '';
  Object.assign(state, {
    step: 0,
    answers: { budget: null, duration: null, themes: [], regions: [], musts: '', intro: '' },
    candidates: [],
    cardIndex: 0,
    likes: [],
    skips: [],
    history: [],
  });
  $('#swipe-section').hidden = true;
  $('#itinerary-section').hidden = true;
  $('#swipe-empty').hidden = true;
  refreshFavMarkers();

  if (initialText && initialText.trim()) {
    state.answers.intro = initialText.trim();
    // Show user's input as the first chat message
    addMessage(escapeHtml(initialText.trim()), 'user');
    // Bot acknowledges, then begins structured Q&A
    setTimeout(() => {
      const typing = showTyping();
      setTimeout(() => {
        typing.remove();
        addMessage('ありがとうございます！もう少し詳しく教えていただけると、よりぴったりのプランをご提案できます ✿', 'bot');
        setTimeout(() => goNext('budget'), 700);
      }, 800);
    }, 400);
  } else {
    goNext('intro');
  }
}

// ─────────────────────────────────────────────
// Filter candidates based on chat answers
// ─────────────────────────────────────────────
function buildCandidates() {
  const a = state.answers;
  const themes = a.themes || [];
  const regions = (a.regions || []).filter(r => r !== 'any');
  const mustText = (a.musts || '').toLowerCase();

  let candidates = SPOTS.slice();

  // Region filter
  if (regions.length) {
    candidates = candidates.filter(s => regions.includes(s.region));
  }
  // Theme filter
  if (themes.length) {
    candidates = candidates.filter(s =>
      s.categories.some(c => themes.includes(c))
    );
  }

  // Score & sort: prefer spots matching musts, then matching themes count
  function score(spot) {
    let sc = 0;
    if (mustText) {
      const hay = [spot.name, spot.nameEn, spot.area].join(' ').toLowerCase();
      const words = mustText.split(/[\s,、・]/).filter(Boolean);
      words.forEach(w => { if (hay.includes(w)) sc += 100; });
    }
    sc += spot.categories.filter(c => themes.includes(c)).length * 10;
    sc += Math.random();
    return sc;
  }
  candidates.sort((a, b) => score(b) - score(a));

  // Limit to a reasonable number based on duration
  const dur = parseInt(a.duration || '1', 10);
  const limit = [8, 12, 16, 24][dur] || 12;
  candidates = candidates.slice(0, limit);

  state.candidates = candidates;
  state.cardIndex = 0;
}

// ─────────────────────────────────────────────
// Swipe deck
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
    </div>
  `;
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
  dragData = {
    startX: e.clientX,
    startY: e.clientY,
    deltaX: 0,
    deltaY: 0,
    card,
  };
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
  card.style.setProperty('--like-op',  dragData.deltaX > 0 ? op : 0);
  card.style.setProperty('--skip-op',  dragData.deltaX < 0 ? op : 0);
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
  // Rebuild the deck quick & dirty: re-insert the card visually at the top
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

function showSwipeEmpty() {
  $('#swipe-empty').hidden = false;
}

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
    // Sort by region to make a logical order
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

  // Fit map to liked spots
  if (liked.length && map) {
    const bounds = L.latLngBounds(liked.map(s => s.coords).filter(Boolean));
    if (bounds.isValid()) map.flyToBounds(bounds, { padding: [40, 40] });
  }
}

// ─────────────────────────────────────────────
// Wire up
// ─────────────────────────────────────────────
let chatStarted = false;
function maybeStartChat() {
  if (chatStarted) return;
  chatStarted = true;
  startChat();
}

function scrollToPlanner() {
  const planner = $('#planner');
  if (planner) planner.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function launchChatFromInput(text) {
  chatStarted = true;
  scrollToPlanner();
  // Slight delay so the scroll begins before chat renders
  setTimeout(() => startChat(text), 300);
}

document.addEventListener('DOMContentLoaded', () => {
  initMap();

  // Map CTA: form submit → start chat with input text
  $('#map-cta-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const input = $('#map-cta-input');
    const text = (input?.value || '').trim();
    launchChatFromInput(text);
    if (input) input.value = '';
  });
  // Map CTA: "skip" → just start chat without text
  $('#map-cta-skip')?.addEventListener('click', () => launchChatFromInput(''));

  // Auto-start chat once planner section enters viewport (fallback)
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

  // Smooth-scroll for in-page anchor links
  $$('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const id = a.getAttribute('href');
      if (id.length > 1 && document.querySelector(id)) {
        e.preventDefault();
        document.querySelector(id).scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // Re-flow Leaflet after layout settles
  setTimeout(() => map && map.invalidateSize(), 600);

  $('#reset-chat')?.addEventListener('click', () => { chatStarted = false; maybeStartChat(); });
  $('#restart-btn')?.addEventListener('click', () => {
    chatStarted = false;
    scrollToPlanner();
    setTimeout(() => maybeStartChat(), 300);
  });
  $('#swipe-skip')?.addEventListener('click', () => {
    const c = getTopCard(); if (c) finishSwipe(c, 'skip');
  });
  $('#swipe-like')?.addEventListener('click', () => {
    const c = getTopCard(); if (c) finishSwipe(c, 'like');
  });
  $('#swipe-undo')?.addEventListener('click', undoLast);
  $('#show-itinerary')?.addEventListener('click', showItinerary);
});
