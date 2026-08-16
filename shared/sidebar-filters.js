(() => {
  'use strict';
  const cfg = window.AMR_ATLAS_CONFIG || {};
  const catalogUrl = cfg.catalogs && cfg.catalogs.evidence ? cfg.catalogs.evidence : 'public/data/evidence-catalog.json';
  const domainSelect = document.getElementById('evidence-domain');
  const periodSelect = document.getElementById('evidence-period');
  const publisherSelect = document.getElementById('evidence-publisher');
  const resetButton = document.getElementById('reset-evidence-filter');
  if (!domainSelect || !periodSelect || !publisherSelect || !resetButton) return;

  const labels = {
    human_amr: 'AMR e sorveglianza umana',
    antimicrobial_use: 'Uso e stewardship degli antimicrobici',
    healthcare: 'Infezioni correlate all’assistenza',
    veterinary: 'AMR e stewardship veterinaria',
    environment: 'Ambiente e acque reflue'
  };
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const years = item => (String(item.period || '').match(/(?:19|20)\d{2}/g) || []).map(Number);
  const domain = item => {
    const type = String(item.evidence_type || '');
    if (type.includes('wastewater') || type.includes('environment')) return 'environment';
    if (type.includes('veterinary')) return 'veterinary';
    if (type.includes('antimicrobial_use') || type.includes('stewardship')) return 'antimicrobial_use';
    if (type.includes('healthcare') || type.includes('infection')) return 'healthcare';
    return 'human_amr';
  };
  const addOptions = (select, values, formatter = value => value) => {
    values.forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = formatter(value);
      select.appendChild(option);
    });
  };
  let records = [];

  const renderTime = filtered => {
    const root = document.getElementById('time-distribution');
    if (!root) return;
    const counts = new Map();
    filtered.forEach(item => years(item).forEach(year => counts.set(year, (counts.get(year) || 0) + 1)));
    const ordered = [...counts.entries()].sort((a, b) => a[0] - b[0]);
    const max = Math.max(1, ...ordered.map(([, count]) => count));
    root.innerHTML = ordered.length ? ordered.map(([year, count]) => `<div class="time-row"><span>${year}</span><i><b style="width:${Math.max(4, count / max * 100)}%"></b></i><strong>${count}</strong></div>`).join('') : '<p class="empty-filter">Nessun periodo compatibile.</p>';
  };

  const render = () => {
    const selectedDomain = domainSelect.value;
    const selectedPeriod = periodSelect.value;
    const selectedPublisher = publisherSelect.value;
    const filtered = records.filter(item =>
      (selectedDomain === 'ALL' || domain(item) === selectedDomain) &&
      (selectedPeriod === 'ALL' || years(item).includes(Number(selectedPeriod))) &&
      (selectedPublisher === 'ALL' || item.publisher === selectedPublisher)
    );
    const publishers = new Set(filtered.map(item => item.publisher).filter(Boolean));
    document.getElementById('filter-metric-visible').textContent = filtered.length.toLocaleString('it-IT');
    document.getElementById('filter-metric-sources').textContent = publishers.size.toLocaleString('it-IT');
    document.getElementById('filtered-count').textContent = `${filtered.length} risultati`;
    const parts = [selectedDomain === 'ALL' ? 'tutti gli ambiti' : labels[selectedDomain], selectedPeriod === 'ALL' ? 'tutti i periodi' : selectedPeriod, selectedPublisher === 'ALL' ? 'tutte le fonti' : selectedPublisher];
    document.getElementById('filter-status').textContent = `${filtered.length}/${records.length} evidenze`;
    document.getElementById('evidence-filter-state').textContent = `${parts.join(' · ')}. I filtri agiscono sul registro; i layer cartografici restano controllabili dalla mappa.`;
    const list = document.getElementById('filtered-evidence-list');
    list.innerHTML = filtered.length ? filtered.slice(0, 7).map(item => `<a class="filtered-row" href="${esc(item.source_url)}" target="_blank" rel="noreferrer"><span><strong>${esc(item.title)}</strong><small>${esc(item.publisher)} · ${esc(item.period)}</small></span><em>${esc(labels[domain(item)] || 'Evidenza')} ↗</em></a>`).join('') + (filtered.length > 7 ? `<p class="more-filter">Altri ${filtered.length - 7} risultati nella pagina Evidenze.</p>` : '') : '<p class="empty-filter">Nessuna evidenza pubblica corrisponde ai filtri selezionati.</p>';
    renderTime(filtered);
  };

  fetch(catalogUrl, {cache: 'no-store'}).then(response => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }).then(catalog => {
    records = (catalog.records || []).filter(item => item.publication_status === 'public_approved');
    const domains = [...new Set(records.map(domain))].sort((a, b) => labels[a].localeCompare(labels[b], 'it'));
    const periods = [...new Set(records.flatMap(years))].sort((a, b) => b - a);
    const publishers = [...new Set(records.map(item => item.publisher).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'it'));
    addOptions(domainSelect, domains, value => labels[value]);
    addOptions(periodSelect, periods);
    addOptions(publisherSelect, publishers);
    [domainSelect, periodSelect, publisherSelect].forEach(select => select.addEventListener('change', render));
    resetButton.addEventListener('click', () => {
      domainSelect.value = 'ALL';
      periodSelect.value = 'ALL';
      publisherSelect.value = 'ALL';
      render();
    });
    render();
  }).catch(error => {
    document.getElementById('evidence-filter-state').textContent = `Filtri non disponibili: ${error.message}`;
    document.getElementById('filtered-evidence-list').innerHTML = '<p class="empty-filter">Catalogo delle evidenze non disponibile.</p>';
  });
})();
