(function () {
  'use strict';
  const t = (key, vars) => (window.amrT ? window.amrT(key, vars) : key);
  const assetUrl = path => (window.amrAsset ? window.amrAsset(path) : path);
  const locale = () => (window.amrLocale ? window.amrLocale() : 'it-IT');
  const labelFor = key => {
    const value = t('label.' + key);
    return value === 'label.' + key ? key : value;
  };
  const cfg = window.AMR_ATLAS_CONFIG || {};
  const evidenceUrl = cfg.catalogs && cfg.catalogs.evidence ? cfg.catalogs.evidence : 'public/data/evidence-catalog.json';
  const literatureUrl = cfg.catalogs && cfg.catalogs.literature ? cfg.catalogs.literature : 'public/data/literature-catalog.json';
  const rows = document.getElementById('publication-rows');
  const summary = document.getElementById('publication-summary');
  const literatureRows = document.getElementById('literature-rows');
  const literatureSummary = document.getElementById('literature-summary');
  const literatureSearch = document.getElementById('literature-search');
  const literatureScope = document.getElementById('literature-scope');
  let literatureRecords = [];
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const fetchCatalog = url => fetch(assetUrl(url)).then(response => { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); });

  fetchCatalog(evidenceUrl).then(catalog => {
    const records = Array.isArray(catalog.records) ? catalog.records.slice() : [];
    records.sort((a, b) => String(b.period || '').localeCompare(String(a.period || ''), locale(), {numeric:true}));
    const approved = records.filter(item => item.publication_status === 'public_approved').length;
    summary.textContent = t('publications.summary', { total: records.length, approved: approved });
    rows.innerHTML = records.map(item => {
      const approvedItem = item.publication_status === 'public_approved';
      const status = approvedItem ? t('publications.statusApproved') : t('publications.statusContext');
      const kind = item.evidence_type ? labelFor(item.evidence_type) : t('publications.resourceFallback');
      return `<tr><td>${esc(item.period)}</td><td>${item.source_url ? `<strong><a href="${esc(item.source_url)}" target="_blank" rel="noreferrer">${esc(item.title)}</a></strong>` : `<strong>${esc(item.title)}</strong>`}<br><small>${esc(item.note || '')}</small></td><td>${esc(item.publisher)}</td><td>${esc(kind === item.evidence_type ? (item.evidence_type || t('publications.resourceFallback')) : kind)}</td><td>${esc(status)}</td><td><a href="${esc(item.source_url)}" target="_blank" rel="noreferrer">${esc(t('publications.open'))}</a></td></tr>`;
    }).join('') || `<tr><td colspan="6">${esc(t('publications.none'))}</td></tr>`;
  }).catch(error => { summary.textContent = t('publications.catalogMissing'); rows.innerHTML = `<tr><td colspan="6">${esc(t('publications.loadError', { message: error.message }))}</td></tr>`; });

  const renderLiterature = () => {
    const query = (literatureSearch.value || '').trim().toLocaleLowerCase(locale());
    const scope = literatureScope.value;
    const filtered = literatureRecords.filter(item => {
      const haystack = [item.title, item.authors, item.journal, item.geographic_link].join(' ').toLocaleLowerCase(locale());
      return (!query || haystack.includes(query)) && (scope === 'ALL' || item.scope === scope);
    });
    literatureSummary.textContent = t('publications.literatureSummary', { shown: filtered.length, total: literatureRecords.length, region: cfg.regionName || t('publications.regionFallback') });
    literatureRows.innerHTML = filtered.map(item => {
      const scopeLabel = item.scope ? labelFor(item.scope) : t('publications.studyFallback');
      const scopeText = scopeLabel === item.scope ? (item.scope || t('publications.studyFallback')) : scopeLabel;
      return `<tr><td>${esc(item.year)}</td><td>${item.source_url ? `<strong><a href="${esc(item.source_url)}" target="_blank" rel="noreferrer">${esc(item.title)}</a></strong>` : `<strong>${esc(item.title)}</strong>`}<br><small>${esc(item.authors || '')}${item.doi ? ` · DOI ${esc(item.doi)}` : ''}</small></td><td>${esc(item.journal)}</td><td>${esc(scopeText)}</td><td>${esc(item.geographic_link || '')}</td><td><a href="${esc(item.source_url)}" target="_blank" rel="noreferrer">${esc(t('publications.pubmed'))}</a></td></tr>`;
    }).join('') || `<tr><td colspan="6">${esc(t('publications.noArticles'))}</td></tr>`;
  };

  fetchCatalog(literatureUrl).then(catalog => {
    literatureRecords = Array.isArray(catalog.records) ? catalog.records.slice() : [];
    literatureRecords.sort((a, b) => Number(b.year || 0) - Number(a.year || 0) || String(a.title || '').localeCompare(String(b.title || ''), locale()));
    const scopes = Array.from(new Set(literatureRecords.map(item => item.scope).filter(Boolean)))
      .sort((a, b) => labelFor(a).localeCompare(labelFor(b), locale()));
    literatureScope.insertAdjacentHTML('beforeend', scopes.map(scope => `<option value="${esc(scope)}">${esc(labelFor(scope))}</option>`).join(''));
    renderLiterature();
  }).catch(error => {
    literatureSummary.textContent = t('publications.literatureMissing');
    literatureRows.innerHTML = `<tr><td colspan="6">${esc(t('publications.loadError', { message: error.message }))}</td></tr>`;
  });

  literatureSearch.addEventListener('input', renderLiterature);
  literatureScope.addEventListener('change', renderLiterature);
}());
