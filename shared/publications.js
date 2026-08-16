(function () {
  'use strict';
  const cfg = window.AMR_ATLAS_CONFIG || {};
  const evidenceUrl = cfg.catalogs && cfg.catalogs.evidence ? cfg.catalogs.evidence : 'public/data/evidence-catalog.json';
  const literatureUrl = cfg.catalogs && cfg.catalogs.literature ? cfg.catalogs.literature : 'public/data/literature-catalog.json';
  const rows = document.getElementById('publication-rows');
  const summary = document.getElementById('publication-summary');
  const literatureRows = document.getElementById('literature-rows');
  const literatureSummary = document.getElementById('literature-summary');
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const labels = {
    human_amr_regional: 'Resistenza umana', human_amr_surveillance: 'Sorveglianza umana', human_amr_surveillance_pediatric: 'Sorveglianza pediatrica',
    human_antimicrobial_use: 'Consumo di antimicrobici', healthcare_amr_point_prevalence: 'Prevalenza puntuale', wastewater_context: 'Contesto ambientale',
    veterinary_stewardship_guidance: 'Stewardship veterinaria', regional_surveillance: 'Sorveglianza regionale', healthcare_amr: 'AMR clinica',
    wastewater_amr: 'AMR ambientale', infection_prevention: 'Infezioni correlate all’assistenza'
  };
  const fetchCatalog = url => fetch(url).then(response => { if (!response.ok) throw new Error('HTTP ' + response.status); return response.json(); });

  fetchCatalog(evidenceUrl).then(catalog => {
    const records = Array.isArray(catalog.records) ? catalog.records.slice() : [];
    records.sort((a, b) => String(b.period || '').localeCompare(String(a.period || ''), 'it', {numeric:true}));
    const approved = records.filter(item => item.publication_status === 'public_approved').length;
    summary.textContent = `${records.length} risorse ufficiali censite; ${approved} associate a dati pubblici approvati.`;
    rows.innerHTML = records.map(item => {
      const approvedItem = item.publication_status === 'public_approved';
      const status = approvedItem ? 'Dati pubblici approvati' : 'Fonte di contesto';
      return `<tr><td>${esc(item.period)}</td><td><strong>${esc(item.title)}</strong><br><small>${esc(item.note || '')}</small></td><td>${esc(item.publisher)}</td><td>${esc(labels[item.evidence_type] || item.evidence_type || 'Risorsa')}</td><td>${status}</td><td><a href="${esc(item.source_url)}" target="_blank" rel="noreferrer">Apri ↗</a></td></tr>`;
    }).join('') || '<tr><td colspan="6">Nessuna pubblicazione disponibile.</td></tr>';
  }).catch(error => { summary.textContent = 'Catalogo non disponibile.'; rows.innerHTML = `<tr><td colspan="6">Errore di caricamento: ${esc(error.message)}</td></tr>`; });

  fetchCatalog(literatureUrl).then(catalog => {
    const records = Array.isArray(catalog.records) ? catalog.records.slice() : [];
    records.sort((a, b) => Number(b.year || 0) - Number(a.year || 0));
    literatureSummary.textContent = `${records.length} articoli selezionati con collegamento territoriale esplicito alla Lombardia.`;
    literatureRows.innerHTML = records.map(item => `<tr><td>${esc(item.year)}</td><td><strong>${esc(item.title)}</strong><br><small>${esc(item.authors || '')}${item.doi ? ` · DOI ${esc(item.doi)}` : ''}</small></td><td>${esc(item.journal)}</td><td>${esc(labels[item.scope] || item.scope || 'Studio')}</td><td>${esc(item.geographic_link || '')}</td><td><a href="${esc(item.source_url)}" target="_blank" rel="noreferrer">PubMed ↗</a></td></tr>`).join('') || '<tr><td colspan="6">Nessun articolo disponibile.</td></tr>';
  }).catch(error => { literatureSummary.textContent = 'Letteratura non disponibile.'; literatureRows.innerHTML = `<tr><td colspan="6">Errore di caricamento: ${esc(error.message)}</td></tr>`; });
}());
