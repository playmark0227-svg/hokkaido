// ========================================
// Hokkaido Tourism Portal — Spots page JS
// (Used by spots.html only — filter + grid)
// ========================================

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

// Debounce helper (search input)
function debounce(fn, ms) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), ms);
  };
}

// ----- Render spot card -----
function renderSpotCard(spot) {
  const region = REGIONS[spot.region];
  const cats = spot.categories
    .map(c => `<span class="spot-tag">${CATEGORIES[c].emoji} ${CATEGORIES[c].name}</span>`)
    .join('');

  return `
    <article class="spot-card fade-in" data-region="${spot.region}" data-categories="${spot.categories.join(',')}" data-name="${escapeHtml(spot.name + ' ' + spot.nameEn + ' ' + spot.area)}">
      <div class="spot-illustration" style="background:${spot.color}">
        <span class="spot-region-tag">${region.name}</span>
        <span class="spot-season-tag">${spot.bestSeason}</span>
        ${getIcon(spot.icon)}
      </div>
      <div class="spot-content">
        <h3 class="spot-name">${escapeHtml(spot.name)}</h3>
        <p class="spot-name-en">${escapeHtml(spot.nameEn)}</p>
        <div class="spot-area">${escapeHtml(spot.area)} &nbsp;/&nbsp; ${escapeHtml(spot.accessTime)}</div>
        <p class="spot-desc">${escapeHtml(spot.description)}</p>
        <div class="spot-meta">${cats}</div>
      </div>
    </article>
  `;
}

// Cache the grid container and card NodeList to avoid repeated DOM queries.
let gridEl = null;
let cardEls = [];

function renderAllSpots() {
  gridEl = $('#spots-grid');
  if (!gridEl) return;

  // Build all cards with DocumentFragment for a single layout pass.
  const frag = document.createDocumentFragment();
  const tmp = document.createElement('div');
  tmp.innerHTML = SPOTS.map(renderSpotCard).join('');
  while (tmp.firstChild) frag.appendChild(tmp.firstChild);
  gridEl.innerHTML = '';
  gridEl.appendChild(frag);

  // Cache the rendered cards once (they don't change after initial render)
  cardEls = $$('.spot-card', gridEl);
  updateFilterResult(SPOTS.length);

  // Filter chips
  $$('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const group = chip.dataset.group;
      $$(`.chip[data-group="${group}"]`).forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      applyFilters();
    });
  });

  // Debounced search
  const search = $('#search-input');
  if (search) search.addEventListener('input', debounce(applyFilters, 150));

  // Apply ?region=... from URL
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
  const activeCat    = $('.chip[data-group="category"].active')?.dataset.category || 'all';
  const q = ($('#search-input')?.value || '').toLowerCase().trim();

  let visible = 0;
  for (const card of cardEls) {
    const region = card.dataset.region;
    const cats = card.dataset.categories.split(',');
    const name = card.dataset.name.toLowerCase();

    const ok = (activeRegion === 'all' || activeRegion === region) &&
               (activeCat    === 'all' || cats.includes(activeCat)) &&
               (!q || name.includes(q));

    card.style.display = ok ? '' : 'none';
    if (ok) visible++;
  }
  updateFilterResult(visible);
}

function updateFilterResult(visible) {
  const el = $('#filter-result');
  if (!el) return;
  const total = SPOTS.length;
  if (visible === undefined) visible = total;
  el.innerHTML = `現在 <strong>${visible}</strong> / ${total} 件のスポットを表示中`;

  const noResults = $('#no-results');
  if (noResults) noResults.style.display = visible === 0 ? '' : 'none';
}

document.addEventListener('DOMContentLoaded', renderAllSpots);
