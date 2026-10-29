import { parseCsv, normalizeRink, filterRinks, formatBoolean, summarizeRink, escapeHtml, renderTableRows } from './core.mjs';

const map = L.map('map', { zoomControl: true }).setView([52.05, 19.25], 6);
const tileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);
tileLayer.once('tileerror', () => {
  document.getElementById('offline-map-note').hidden = false;
});

const cluster = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 48 });
map.addLayer(cluster);
const controls = ['query', 'wojewodztwo'];
let rinks = [];

const safe = value => escapeHtml(value || 'brak danych');
const yesNo = value => escapeHtml(formatBoolean(value));

function markerIcon(rink) {
  return L.divIcon({ className: '', html: `<div class="rink-marker ${rink.status_weryfikacji === 'zweryfikowane' ? '' : 'unverified'}"></div>`, iconSize: [18, 18], iconAnchor: [9, 18] });
}

function popupHtml(rink) {
  const summary = summarizeRink(rink);
  return `<div class="popup-title">${safe(rink.nazwa)}</div><div class="popup-meta">${safe(rink.miasto)} · ${safe(rink.wojewodztwo)}<br><strong>Sezon:</strong> ${safe(summary.sezon)}<br><strong>Wymiary:</strong> ${safe(summary.wymiary)}<br><strong>Pełnowymiarowe:</strong> ${safe(summary.pelnowymiarowe)}<br><strong>Zarządca:</strong> ${safe(rink.zarzadca)}<br><span class="popup-action">Kliknij, aby zobaczyć szczegóły</span></div>`;
}

function detailItem(label, value) {
  return `<div class="detail-item"><span>${escapeHtml(label)}</span><strong>${safe(value)}</strong></div>`;
}

function sourceLink(url, label) {
  const first = String(url || '').split(';')[0].trim();
  if (!/^https?:\/\//i.test(first)) return '';
  return `<a class="source-link" href="${escapeHtml(first)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)} ↗</a>`;
}

function openDetails(rink) {
  const summary = summarizeRink(rink);
  document.getElementById('details-content').innerHTML = `
    <span class="status">${safe(rink.status_weryfikacji).replaceAll('_', ' ')}</span>
    <h2 id="details-title">${safe(rink.nazwa)}</h2>
    <p class="location">${safe([rink.adres, rink.kod_pocztowy, rink.miasto].filter(Boolean).join(', '))}</p>
    <div class="detail-grid">
      ${detailItem('Wymiary tafli', summary.wymiary)}
      ${detailItem('Pełnowymiarowe (30 × 60 m)', summary.pelnowymiarowe)}
      ${detailItem('Sezon', summary.sezon)}
      ${detailItem('Obiekt kryty', yesNo(rink.kryte))}
      ${detailItem('Rolkowisko latem', yesNo(rink.rolkowisko_latem))}
      ${detailItem('Liczba tafli', rink.liczba_tafli)}
      ${detailItem('Zarządca', rink.zarzadca)}
      ${detailItem('Typ zarządcy', rink.typ_zarzadcy)}
      ${detailItem('Ślizgawki publiczne', yesNo(rink.slizgawki_publiczne))}
      ${detailItem('Data weryfikacji', rink.data_weryfikacji)}
    </div>
    <h3>Zaplecze</h3>
    <ul><li>Toalety: ${yesNo(rink.toalety)}</li><li>Szatnie: ${yesNo(rink.szatnie)}</li><li>Natryski: ${yesNo(rink.natryski)}</li><li>Wypożyczalnia: ${yesNo(rink.wypozyczalnia)}</li><li>Ostrzenie łyżew: ${yesNo(rink.ostrzenie_lyzew)}</li><li>Trybuny: ${yesNo(rink.trybuny)}</li><li>Gastronomia: ${yesNo(rink.gastronomia)}</li></ul>
    <h3>Sport i dostępność</h3>
    <ul><li>Hokej: ${yesNo(rink.hokej)}</li><li>Łyżwiarstwo figurowe: ${yesNo(rink.lyzwiarstwo_figurowe)}</li><li>Curling: ${yesNo(rink.curling)}</li><li>Rezerwacje grupowe: ${yesNo(rink.rezerwacje_grupowe)}</li><li>Dostępność architektoniczna: ${yesNo(rink.dostepnosc_architektoniczna)}</li><li>Parking: ${yesNo(rink.parking)}</li></ul>
    <h3>Kontakt i źródła</h3>
    <p>${safe(rink.telefon)}${rink.email ? `<br>${safe(rink.email)}` : ''}</p>
    ${sourceLink(rink.www, 'Strona obiektu')}${sourceLink(rink.zrodlo_glowne, 'Źródło danych')}
    ${rink.uwagi ? `<p class="data-note">${safe(rink.uwagi)}</p>` : ''}`;
  document.getElementById('details').classList.add('open');
  document.getElementById('details').setAttribute('aria-hidden', 'false');
  document.getElementById('backdrop').hidden = false;
  document.getElementById('close-details').focus();
}

function closeDetails() {
  document.getElementById('details').classList.remove('open');
  document.getElementById('details').setAttribute('aria-hidden', 'true');
  document.getElementById('backdrop').hidden = true;
}

function currentFilters() {
  return Object.fromEntries(controls.map(id => [id, document.getElementById(id).value]));
}

function render() {
  cluster.clearLayers();
  const visible = filterRinks(rinks, currentFilters());
  for (const rink of visible) {
    if (!Number.isFinite(rink.lat) || !Number.isFinite(rink.lon)) continue;
    const marker = L.marker([rink.lat, rink.lon], { icon: markerIcon(rink), title: rink.nazwa });
    marker.bindPopup(popupHtml(rink), { closeButton: false });
    marker.on('mouseover', () => marker.openPopup());
    marker.on('mouseout', () => marker.closePopup());
    marker.on('click', () => openDetails(rink));
    cluster.addLayer(marker);
  }
  document.getElementById('visible-count').textContent = visible.length.toLocaleString('pl-PL');
  document.getElementById('table-count').textContent = visible.length.toLocaleString('pl-PL');
  document.getElementById('results-table-body').innerHTML = renderTableRows(visible);
}

async function load() {
  try {
    const csvText = typeof LODOWISKA_CSV === 'string'
      ? LODOWISKA_CSV
      : await fetch('data/lodowiska.csv').then(response => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.text();
        });
    rinks = parseCsv(csvText).map(normalizeRink);
    const provinces = [...new Set(rinks.map(r => r.wojewodztwo).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pl'));
    const select = document.getElementById('wojewodztwo');
    for (const province of provinces) select.add(new Option(province, province));
    render();
    document.getElementById('loading').hidden = true;
  } catch (error) {
    document.getElementById('loading').hidden = true;
    const box = document.getElementById('error');
    box.hidden = false;
    box.textContent = `Nie udało się wczytać danych: ${error.message}`;
  }
}

document.getElementById('apply-filters').addEventListener('click', render);
document.getElementById('query').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); render(); } });
document.getElementById('reset').addEventListener('click', () => { for (const id of controls) document.getElementById(id).value = ''; render(); });
document.getElementById('close-details').addEventListener('click', closeDetails);
document.getElementById('backdrop').addEventListener('click', closeDetails);
document.getElementById('results-table-body').addEventListener('click', event => {
  const target = event.target.closest('[data-rink-id]');
  if (!target) return;
  const rink = rinks.find(item => item.id === target.dataset.rinkId);
  if (!rink) return;
  openDetails(rink);
  if (Number.isFinite(rink.lat) && Number.isFinite(rink.lon)) {
    map.setView([rink.lat, rink.lon], Math.max(map.getZoom(), 13));
  }
});
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeDetails(); });
load();
