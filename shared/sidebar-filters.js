(() => {
  'use strict';
  const cfg = window.AMR_ATLAS_CONFIG || {};
  const catalogUrl = (cfg.catalogs && cfg.catalogs.evidence) || 'public/data/evidence-catalog.json';
  const targetSelect = document.getElementById('amr-target');
  const periodSelect = document.getElementById('evidence-period');
  const domainSelect = document.getElementById('evidence-domain');
  const resetButton = document.getElementById('reset-evidence-filter');
  if (!targetSelect || !periodSelect || !domainSelect || !resetButton) return;
  const amrTargets = [['AMR_BETA_LACTAM','Beta-lattamici'],['AMR_CARBAPENEM','Carbapenemi'],['AMR_CEPHALOSPORIN','Cefalosporine di terza generazione'],['AMR_FLUOROQUINOLONE','Fluorochinoloni'],['AMR_AMINOGLYCOSIDE','Aminoglicosidi'],['AMR_TETRACYCLINE','Tetracicline'],['AMR_MACROLIDE','Macrolidi'],['AMR_GLYCOPEPTIDE','Glicopeptidi'],['AMR_COLISTIN','Colistina'],['AMR_MDR','Multiresistenza']];
  const amrKeywords = {
    AMR_BETA_LACTAM: 'penicillin,penicillina,ampicillin,ampicillina,beta-lactam,beta-lattam,bla,kpc,oxa,ndm,carbapenem,cephalosporin,cefalospor,cefotaxime,ceftazidime,meticillin,meticillina,mrsa,esbl,ampc,meca,oxacillin',
    AMR_CARBAPENEM: 'carbapenem,carbapenemi,kpc,oxa-48,oxa48,oxa-244,ndm,imipenem,meropenem,crkp,crpa,cras',
    AMR_CEPHALOSPORIN: 'cephalosporin,cefalospor,cefotaxime,ceftazidime,ceftriaxone,3gc,3gcr,esbl,ctx-m,blactx,crec',
    AMR_FLUOROQUINOLONE: 'fluoroquinolone,fluorochinolon,chinolon,quinolon,ciprofloxacin,levofloxacin,enrofloxacin,qnr,gyra',
    AMR_AMINOGLYCOSIDE: 'aminoglycoside,aminoglicosid,amikacin,gentamicin,kanamycin,streptomycin,tobramycin',
    AMR_TETRACYCLINE: 'tetracycline,tetraciclina,oxytetracycline,doxycycline,tet',
    AMR_MACROLIDE: 'macrolide,macrolidi,azithromycin,erythromycin,23s',
    AMR_GLYCOPEPTIDE: 'glycopeptide,glicopeptid,vancomycin,vancomicina,vre',
    AMR_COLISTIN: 'colistin,colistina,mcr',
    AMR_MDR: 'multidrug,multiresist,mdr,xdr'
  };
  const labels = {human_amr:'AMR e sorveglianza umana',antimicrobial_use:'Uso e stewardship degli antimicrobici',healthcare:'Infezioni correlate all assistenza',veterinary:'AMR e stewardship veterinaria',wildlife:'Fauna selvatica',food:'Alimenti e filiera',livestock:'Consistenze zootecniche',environment:'Ambiente e acque reflue'};
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const years = item => (String(item.period || '').match(/(?:19|20)\d{2}/g) || []).map(Number);
  const domain = item => {
    const t = String(item.evidence_type || '');
    if (t.includes('wastewater') || t.includes('environment')) return 'environment';
    if (t.includes('wildlife')) return 'wildlife';
    if (t.includes('food')) return 'food';
    if (t.includes('livestock')) return 'livestock';
    if (t.includes('veterinary')) return 'veterinary';
    if (t.includes('antimicrobial_use') || t.includes('stewardship')) return 'antimicrobial_use';
    if (t.includes('healthcare') || t.includes('infection')) return 'healthcare';
    return 'human_amr';
  };
  const hay = (item, payload) => [item.title, item.note, item.evidence_type, item.publisher, item.period, item.geography, payload ? JSON.stringify(payload) : ''].filter(Boolean).join(' ').toLowerCase();
  const matchesClass = (item, payload, value) => value === 'AMR_ANY' || (amrKeywords[value] || '').split(',').some(k => hay(item, payload).includes(k));
  const addOptions = (select, values, fmt) => values.forEach(v => { const o = document.createElement('option'); o.value = v; o.textContent = fmt ? fmt(v) : v; select.appendChild(o); });
  amrTargets.forEach(([v,l]) => addOptions(targetSelect, [v], () => l));
  let records = [];
  const payloads = new Map();
  const renderTime = filtered => {
    const root = document.getElementById('time-distribution');
    if (!root) return;
    const counts = new Map();
    filtered.forEach(item => years(item).forEach(y => counts.set(y, (counts.get(y) || 0) + 1)));
    const ordered = [...counts.entries()].sort((a,b) => a[0]-b[0]);
    const max = Math.max(1, ...ordered.map(([,c]) => c));
    root.innerHTML = ordered.length ? ordered.map(([y,c]) => '<div class="time-row"><span>' + y + '</span><i><b style="width:' + Math.max(4,c/max*100) + '%"></b></i><strong>' + c + '</strong></div>').join('') : '<p class="empty-filter">Nessun periodo compatibile.</p>';
  };
  const showDetail = item => {
    const root = document.getElementById('selected-evidence');
    if (!root || !item) return;
    root.innerHTML = '<p><strong>' + esc(item.title) + '</strong></p><p>' + esc(item.publisher||'') + ' · ' + esc(item.period||'') + ' · ' + esc(item.geography||'') + '</p><p>' + esc(item.note||'Evidenza pubblica aggregata; non e una prevalenza regionale.') + '</p>' + (item.source_url ? '<p><a href="' + esc(item.source_url) + '" target="_blank" rel="noreferrer">Fonte originale</a></p>' : '');
  };
  const render = () => {
    const selT = targetSelect.value, selP = periodSelect.value, selD = domainSelect.value;
    const filtered = records.filter(item => matchesClass(item, payloads.get(item.id), selT) && (selP === 'ALL' || years(item).includes(Number(selP))) && (selD === 'ALL' || domain(item) === selD));
    document.getElementById('filter-metric-visible').textContent = filtered.length.toLocaleString('it-IT');
    document.getElementById('filter-metric-sources').textContent = new Set(filtered.map(i => i.publisher).filter(Boolean)).size.toLocaleString('it-IT');
    document.getElementById('filtered-count').textContent = filtered.length + ' risultati';
    const tLabel = targetSelect.selectedOptions[0] ? targetSelect.selectedOptions[0].textContent : 'tutte le classi';
    document.getElementById('filter-status').textContent = filtered.length + '/' + records.length + ' evidenze';
    document.getElementById('evidence-filter-state').textContent = [tLabel, selP === 'ALL' ? 'tutti i periodi' : selP, selD === 'ALL' ? 'tutti gli ambiti' : labels[selD]].join(' · ') + '. I filtri agiscono sul registro; i layer cartografici restano sulla mappa.';
    const list = document.getElementById('filtered-evidence-list');
    list.innerHTML = filtered.length ? filtered.slice(0,7).map(item => '<a class="filtered-row" href="#" data-id="' + esc(item.id) + '"><span><strong>' + esc(item.title) + '</strong><small>' + esc(item.publisher) + ' · ' + esc(item.period) + '</small></span><em>' + esc(labels[domain(item)]||'Evidenza') + '</em></a>').join('') + (filtered.length > 7 ? '<p class="more-filter">Altri ' + (filtered.length-7) + ' risultati nella pagina Evidenze.</p>' : '') : '<p class="empty-filter">Nessuna evidenza pubblica corrisponde ai filtri selezionati.</p>';
    list.querySelectorAll('.filtered-row[data-id]').forEach(node => node.addEventListener('click', ev => { ev.preventDefault(); showDetail(records.find(r => r.id === node.getAttribute('data-id'))); }));
    renderTime(filtered);
  };
  fetch(catalogUrl, {cache:'no-store'}).then(r => { if (!r.ok) throw new Error('HTTP '+r.status); return r.json(); }).then(catalog => {
    records = (catalog.records || []).filter(i => i.publication_status === 'public_approved');
    addOptions(domainSelect, [...new Set(records.map(domain))].sort((a,b)=>(labels[a]||a).localeCompare(labels[b]||b,'it')), v => labels[v]||v);
    addOptions(periodSelect, [...new Set(records.flatMap(years))].sort((a,b)=>b-a));
    [targetSelect, periodSelect, domainSelect].forEach(s => s.addEventListener('change', render));
    resetButton.addEventListener('click', () => { targetSelect.value='AMR_ANY'; periodSelect.value='ALL'; domainSelect.value='ALL'; render(); });
    return Promise.all(records.map(item => item.data_file ? fetch(item.data_file,{cache:'no-store'}).then(r => r.ok ? r.json() : null).then(p => { if (p) payloads.set(item.id, p); }).catch(()=>null) : Promise.resolve())).then(render);
  }).catch(err => {
    document.getElementById('evidence-filter-state').textContent = 'Filtri non disponibili: ' + err.message;
    document.getElementById('filtered-evidence-list').innerHTML = '<p class="empty-filter">Catalogo delle evidenze non disponibile.</p>';
  });
})();
