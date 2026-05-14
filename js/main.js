// ========================================
// Hokkaido Tourism Portal - Main JS
// ========================================

// ----- Helpers -----
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

// ----- Render spot card -----
function renderSpotCard(spot) {
  const region = REGIONS[spot.region];
  const cats = spot.categories
    .map(c => `<span class="spot-tag">${CATEGORIES[c].emoji} ${CATEGORIES[c].name}</span>`)
    .join('');

  return `
    <article class="spot-card fade-in" data-region="${spot.region}" data-categories="${spot.categories.join(',')}" data-name="${escapeHtml(spot.name + ' ' + spot.nameEn + ' ' + spot.area)}">
      <div class="spot-illustration" style="--card-color: ${spot.color}">
        <span class="spot-region-tag">${region.name}</span>
        <span class="spot-season-tag">${spot.bestSeason}</span>
        ${getIcon(spot.icon)}
      </div>
      <div class="spot-content">
        <h3 class="spot-name">${escapeHtml(spot.name)}</h3>
        <p class="spot-name-en">${escapeHtml(spot.nameEn)}</p>
        <div class="spot-area">${escapeHtml(spot.area)}・${escapeHtml(spot.accessTime)}</div>
        <p class="spot-desc">${escapeHtml(spot.description)}</p>
        <div class="spot-meta">${cats}</div>
      </div>
    </article>
  `;
}

// ----- Render region cards (on home page) -----
function renderRegionCards(container) {
  if (!container) return;
  const counts = {};
  SPOTS.forEach(s => { counts[s.region] = (counts[s.region] || 0) + 1; });

  const descs = {
    doo:    '札幌・小樽・富良野・美瑛など、定番スポットがぎゅっと詰まったエリア。',
    donan:  '函館・松前など、夜景と歴史ロマンが香る道南エリア。',
    doto:   '知床・釧路・網走など、大自然と神秘の湖が広がる東のエリア。',
    dohoku: '旭山動物園・宗谷岬・利尻礼文など、日本最北の絶景が並ぶエリア。'
  };

  container.innerHTML = Object.entries(REGIONS).map(([key, r]) => `
    <a href="spots.html?region=${key}" class="region-card fade-in"
       style="--card-color: ${r.color}; --card-bg: ${r.color}">
      <div class="region-icon">${getIcon(r.icon)}</div>
      <h3 class="region-name">${r.name}</h3>
      <p class="region-name-en">${r.nameEn.toUpperCase()} HOKKAIDO</p>
      <p class="region-desc">${descs[key]}</p>
      <span class="region-count">${counts[key] || 0}スポット</span>
    </a>
  `).join('');
}

// ----- Render featured spots (random selection on home) -----
function renderFeatured(container, count = 6) {
  if (!container) return;
  // Curated featured list
  const featuredIds = [
    'sapporo-snow-festival', 'mt-hakodate', 'shiretoko',
    'biei-blue-pond', 'asahiyama-zoo', 'otaru-canal'
  ];
  const featured = featuredIds
    .map(id => SPOTS.find(s => s.id === id))
    .filter(Boolean)
    .slice(0, count);

  container.innerHTML = featured.map(renderSpotCard).join('');
}

// ----- Render all spots with filters -----
function renderAllSpots() {
  const grid = $('#spots-grid');
  const counter = $('#spot-count');
  if (!grid) return;

  // initial render
  grid.innerHTML = SPOTS.map(renderSpotCard).join('');
  updateFilterResult();

  // Setup filter chips
  $$('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const group = chip.dataset.group;
      $$(`.chip[data-group="${group}"]`).forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      applyFilters();
    });
  });

  // Search input
  const search = $('#search-input');
  if (search) {
    search.addEventListener('input', applyFilters);
  }

  // URL params
  const params = new URLSearchParams(location.search);
  const r = params.get('region');
  if (r) {
    const chip = $(`.chip[data-group="region"][data-region="${r}"]`);
    if (chip) {
      $$('.chip[data-group="region"]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      applyFilters();
    }
  }
}

function applyFilters() {
  const activeRegion = $('.chip[data-group="region"].active')?.dataset.region || 'all';
  const activeCat = $('.chip[data-group="category"].active')?.dataset.category || 'all';
  const q = ($('#search-input')?.value || '').toLowerCase().trim();

  let visible = 0;
  $$('.spot-card').forEach(card => {
    const region = card.dataset.region;
    const cats = card.dataset.categories.split(',');
    const name = card.dataset.name.toLowerCase();

    const regionOk = activeRegion === 'all' || activeRegion === region;
    const catOk = activeCat === 'all' || cats.includes(activeCat);
    const qOk = !q || name.includes(q);

    if (regionOk && catOk && qOk) {
      card.style.display = '';
      visible++;
    } else {
      card.style.display = 'none';
    }
  });

  updateFilterResult(visible);
}

function updateFilterResult(visible) {
  const el = $('#filter-result');
  if (!el) return;
  const total = SPOTS.length;
  if (visible === undefined) visible = total;
  el.innerHTML = `<strong>${visible}</strong> / ${total} 件のスポットを表示中`;

  const noResults = $('#no-results');
  if (noResults) noResults.style.display = visible === 0 ? '' : 'none';
}

// ----- FAQ toggle -----
function setupFAQ() {
  $$('.faq-item').forEach(item => {
    item.addEventListener('click', () => {
      item.classList.toggle('open');
      const a = item.querySelector('.faq-a');
      if (a) a.style.display = item.classList.contains('open') ? '' : 'none';
    });
  });
}

// ----- Initialize on DOM ready -----
document.addEventListener('DOMContentLoaded', () => {
  renderRegionCards($('#region-cards'));
  renderFeatured($('#featured-spots'));
  renderAllSpots();
  setupFAQ();
});
