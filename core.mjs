const TRUE_VALUES = new Set(['tak', 'true', '1']);
const FALSE_VALUES = new Set(['nie', 'false', '0']);

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const input = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }
  if (!rows.length) return [];
  const headers = rows.shift().map(header => header.trim());
  return rows.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

function parseBoolean(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return null;
}

export function normalizeRink(row) {
  const result = { ...row };
  result.lat = Number.parseFloat(row.lat);
  result.lon = Number.parseFloat(row.lon);
  for (const key of ['kryte', 'caloroczne', 'pelnowymiarowe', 'rolkowisko_latem', 'toalety', 'szatnie', 'natryski', 'wypozyczalnia', 'ostrzenie_lyzew', 'trybuny', 'gastronomia', 'dostepnosc_architektoniczna', 'parking', 'komunikacja_publiczna', 'slizgawki_publiczne', 'hokej', 'lyzwiarstwo_figurowe', 'curling', 'rezerwacje_grupowe']) {
    result[key] = parseBoolean(row[key]);
  }
  result.searchText = [row.nazwa, row.miasto, row.wojewodztwo, row.adres, row.zarzadca]
    .filter(Boolean).join(' ').toLocaleLowerCase('pl');
  return result;
}

export function filterRinks(rinks, filters = {}) {
  const query = String(filters.query ?? '').trim().toLocaleLowerCase('pl');
  return rinks.filter(rink => {
    if (query && !rink.searchText.includes(query)) return false;
    if (filters.wojewodztwo && rink.wojewodztwo !== filters.wojewodztwo) return false;
    for (const key of ['caloroczne', 'kryte', 'pelnowymiarowe', 'rolkowisko_latem', 'wypozyczalnia', 'hokej']) {
      if (filters[key] === 'tak' && rink[key] !== true) return false;
      if (filters[key] === 'nie' && rink[key] !== false) return false;
    }
    return true;
  });
}

export function formatBoolean(value) {
  if (value === true) return 'tak';
  if (value === false) return 'nie';
  return 'brak danych';
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function summarizeRink(rink) {
  return {
    wymiary: rink.wymiary || 'brak danych',
    pelnowymiarowe: formatBoolean(rink.pelnowymiarowe),
    sezon: rink.caloroczne === true ? 'całoroczne' : rink.miesiace_dzialania || (rink.caloroczne === false ? 'sezonowe' : 'brak danych'),
    kryte: formatBoolean(rink.kryte),
    zarzadca: rink.zarzadca || 'brak danych',
    status: rink.status_weryfikacji || 'niezweryfikowane'
  };
}

export function renderTableRows(rinks) {
  if (!rinks.length) {
    return '<tr><td colspan="8" class="empty-table">Brak obiektów spełniających wybrane kryteria.</td></tr>';
  }
  return rinks.map(rink => {
    const summary = summarizeRink(rink);
    const location = [rink.adres, rink.kod_pocztowy, rink.miasto].filter(Boolean).join(', ');
    return `<tr data-rink-id="${escapeHtml(rink.id)}">
      <td><strong>${escapeHtml(rink.nazwa)}</strong></td>
      <td>${escapeHtml(location || 'brak danych')}</td>
      <td>${escapeHtml(summary.sezon)}</td>
      <td>${escapeHtml(summary.wymiary)}</td>
      <td>${escapeHtml(summary.pelnowymiarowe)}</td>
      <td>${escapeHtml(summary.zarzadca)}</td>
      <td>${escapeHtml(formatBoolean(rink.rolkowisko_latem))}</td>
      <td><button type="button" class="table-details" data-rink-id="${escapeHtml(rink.id)}">Szczegóły</button></td>
    </tr>`;
  }).join('');
}
