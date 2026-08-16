(() => {
  'use strict';

  const config = window.AMR_ATLAS_CONFIG;
  if (!config) {
    document.body.innerHTML = '<main><h1>Configurazione mancante</h1><p>Impossibile avviare l\'atlante.</p></main>';
    return;
  }

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  const setText = (id, value) => {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  };

  const fetchJson = async path => {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return response.json();
  };

  const publicRecords = catalog => (catalog.records || catalog.layers || [])
    .filter(record => record.publication_status === 'public_approved');

  document.title = `${config.title} · AMR Atlas`;
  setText('atlas-region-name', config.regionName);
  setText('atlas-title', config.title);
  setText('atlas-short-name', config.shortName);
  setText('atlas-status-label', config.dataStatusLabel);

  async function renderEvidenceDirectory() {
    const root = document.getElementById('evidence-root');
    if (!root) return;
    try {
      const catalog = await fetchJson(config.catalogs.evidence);
      const approved = publicRecords(catalog);
      const candidates = (catalog.records || []).filter(item => item.publication_status !== 'public_approved');
      const approvedHtml = approved.length
        ? approved.map(record => `<article class="directory-row"><span><strong>${escapeHtml(record.title)}</strong><small>${escapeHtml(record.period || 'Periodo non indicato')} · ${escapeHtml(record.geography || config.regionName)}</small></span><span>${escapeHtml(record.evidence_type || 'evidenza')}</span></article>`).join('')
        : '<p class="empty-filter">Nessun dataset AMR lombardo e\' ancora approvato per la pubblicazione.</p>';
      const candidateHtml = candidates.length
        ? candidates.map(record => `<article class="directory-row"><span><strong>${escapeHtml(record.title)}</strong><small>${escapeHtml(record.publisher || '')}</small></span><span>non pubblicato · ${escapeHtml(record.publication_status)}</span></article>`).join('')
        : '<p class="empty-filter">Nessuna fonte candidata registrata.</p>';
      root.innerHTML = `<div class="directory-layout"><section><h2>Evidenze pubbliche</h2><div class="directory-list">${approvedHtml}</div></section><section><h2>Registro di preparazione</h2><p>Le voci seguenti sono piste di lavoro e non dati dell\'atlante.</p><div class="directory-list">${candidateHtml}</div></section></div>`;
    } catch (error) {
      root.innerHTML = `<p class="empty-filter">Catalogo non disponibile: ${escapeHtml(error.message)}</p>`;
    }
  }

  async function initMap() {
    const mapNode = document.getElementById('map');
    if (!mapNode || typeof L === 'undefined') return;

    const map = L.map(mapNode, { zoomControl: true }).setView(config.map.center, config.map.zoom);
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri'
    });

    const overlayControl = L.control.layers({ OpenStreetMap: osm, Satellite: satellite }, {}, { collapsed: false }).addTo(map);
    const loaded = [];
    const errors = [];

    try {
      const catalog = await fetchJson(config.catalogs.layers);
      const approvedLayers = publicRecords(catalog);
      for (const layerConfig of approvedLayers) {
        try {
          const geojson = await fetchJson(layerConfig.file);
          if (geojson.type !== 'FeatureCollection') throw new Error('non e\' un FeatureCollection');
          const layer = L.geoJSON(geojson, {
            style: () => ({
              color: layerConfig.color || '#2d7d61',
              weight: Number(layerConfig.weight || 1.2),
              fillColor: layerConfig.fillColor || layerConfig.color || '#2d7d61',
              fillOpacity: Number(layerConfig.fillOpacity ?? 0.12)
            }),
            pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
              radius: Number(layerConfig.radius || 5),
              color: layerConfig.color || '#2d7d61',
              fillColor: layerConfig.fillColor || layerConfig.color || '#2d7d61',
              fillOpacity: 0.75,
              weight: 1
            }),
            onEachFeature: (feature, featureLayer) => {
              const props = feature.properties || {};
              const fields = layerConfig.popupFields || [];
              const rows = fields.filter(field => props[field] !== undefined && props[field] !== null)
                .map(field => `<div><strong>${escapeHtml(field)}</strong><br>${escapeHtml(props[field])}</div>`)
                .join('');
              featureLayer.bindPopup(`<div class="map-popup"><h3>${escapeHtml(props[layerConfig.labelProperty] || layerConfig.label)}</h3>${rows || '<p>Nessun dettaglio pubblico aggiuntivo.</p>'}</div>`);
            }
          });
          overlayControl.addOverlay(layer, layerConfig.label);
          if (layerConfig.defaultVisible) layer.addTo(map);
          loaded.push({ config: layerConfig, layer, count: geojson.features.length });
        } catch (error) {
          errors.push(`${layerConfig.id}: ${error.message}`);
        }
      }
    } catch (error) {
      errors.push(error.message);
    }

    const total = loaded.reduce((sum, item) => sum + item.count, 0);
    setText('metric-visible', total.toLocaleString('it-IT'));
    setText('metric-sources', loaded.length.toLocaleString('it-IT'));
    setText('overview-localized', total.toLocaleString('it-IT'));
    setText('overview-layers', loaded.length.toLocaleString('it-IT'));
    setText('status', errors.length ? `${loaded.length} layer caricati · ${errors.length} non disponibili` : `${loaded.length} layer pubblici caricati`);

    const empty = document.getElementById('map-empty-state');
    if (empty) empty.hidden = loaded.length > 0;
  }

  async function renderDashboardEvidence() {
    const root = document.getElementById('dashboard-evidence');
    if (!root) return;
    try {
      const catalog = await fetchJson(config.catalogs.evidence);
      const approved = publicRecords(catalog);
      setText('overview-evidence', approved.length.toLocaleString('it-IT'));
      root.innerHTML = approved.length
        ? approved.map(record => `<article class="evidence-card"><strong>${escapeHtml(record.title)}</strong><br><small>${escapeHtml(record.period || '')} · ${escapeHtml(record.geography || config.regionName)}</small><p>${escapeHtml(record.summary || '')}</p></article>`).join('')
        : '<div class="evidence-card"><strong>Dati in preparazione</strong><p>Nessuna evidenza regionale e\' pubblicata finche\' fonte, licenza, granularita\' e limiti non risultano verificati.</p></div>';
    } catch (error) {
      root.innerHTML = `<div class="evidence-card"><strong>Catalogo non disponibile</strong><p>${escapeHtml(error.message)}</p></div>`;
    }
  }

  renderEvidenceDirectory();
  renderDashboardEvidence();
  initMap();
})();
