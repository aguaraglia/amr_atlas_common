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

  const featureColor = (feature, layerConfig) => {
    const scale = Array.isArray(layerConfig.colorScale) ? layerConfig.colorScale : [];
    const property = layerConfig.valueProperty;
    const value = property ? Number((feature.properties || {})[property]) : NaN;
    if (!scale.length || !Number.isFinite(value)) return layerConfig.fillColor || layerConfig.color || '#2d7d61';
    const ordered = scale.slice().sort((a, b) => Number(a.max) - Number(b.max));
    const match = ordered.find(item => value <= Number(item.max));
    return (match || ordered[ordered.length - 1]).color;
  };

  const popupLabel = (field, layerConfig) => {
    const labels = layerConfig.popupLabels || {};
    return labels[field] || field;
  };

  const geoJsonOptions = layerConfig => ({
    style: feature => ({
      color: layerConfig.color || '#2d7d61',
      weight: Number(layerConfig.weight || 1.2),
      fillColor: featureColor(feature, layerConfig),
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
        .map(field => `<div><strong>${escapeHtml(popupLabel(field, layerConfig))}</strong><br>${escapeHtml(props[field])}</div>`)
        .join('');
      featureLayer.bindPopup(`<div class="map-popup"><h3>${escapeHtml(props[layerConfig.labelProperty] || layerConfig.label)}</h3>${rows || '<p>Nessun dettaglio pubblico aggiuntivo.</p>'}</div>`);
    }
  });

  document.title = `${config.title} - AMR Atlas`;
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
        ? approved.map(record => `<article class="directory-row"><span><strong>${escapeHtml(record.title)}</strong><small>${escapeHtml(record.period || 'Periodo non indicato')} - ${escapeHtml(record.geography || config.regionName)}</small></span><span>${escapeHtml(record.evidence_type || 'evidenza')}</span></article>`).join('')
        : '<p class="empty-filter">Nessun dataset AMR regionale e\' ancora approvato per la pubblicazione.</p>';
      const candidateHtml = candidates.length
        ? candidates.map(record => `<article class="directory-row"><span><strong>${escapeHtml(record.title)}</strong><small>${escapeHtml(record.publisher || '')}</small></span><span>non pubblicato - ${escapeHtml(record.publication_status)}</span></article>`).join('')
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
    const errors = [];
    const entries = [];

    const refreshMetrics = () => {
      const onMap = entries.filter(item => item.state === 'loaded' && map.hasLayer(item.group));
      const total = onMap.reduce((sum, item) => sum + (item.count || 0), 0);
      const loadedCount = entries.filter(item => item.state === 'loaded').length;
      setText('metric-visible', total.toLocaleString('it-IT'));
      setText('metric-sources', onMap.length.toLocaleString('it-IT'));
      setText('overview-localized', total.toLocaleString('it-IT'));
      setText('overview-layers', entries.length.toLocaleString('it-IT'));
      const available = entries.length;
      if (errors.length) {
        setText('status', `${loadedCount}/${available} layer caricati - ${errors.length} non disponibili`);
      } else if (loadedCount < available) {
        setText('status', `${onMap.length}/${available} layer visibili (altri su richiesta)`);
      } else {
        setText('status', `${onMap.length} layer pubblici visibili`);
      }
    };

    const loadLayerData = async entry => {
      if (entry.state === 'loaded' || entry.state === 'loading') {
        refreshMetrics();
        return;
      }
      entry.state = 'loading';
      try {
        const geojson = await fetchJson(entry.config.file);
        if (geojson.type !== 'FeatureCollection') throw new Error('non e\' un FeatureCollection');
        const layer = L.geoJSON(geojson, geoJsonOptions(entry.config));
        layer.addTo(entry.group);
        entry.state = 'loaded';
        entry.count = (geojson.features || []).length;
      } catch (error) {
        entry.state = 'failed';
        const message = `${entry.config.id}: ${error.message}`;
        errors.push(message);
        console.warn('[AMR Atlas] Skipping layer', message);
      }
      refreshMetrics();
    };

    try {
      const catalog = await fetchJson(config.catalogs.layers);
      const approvedLayers = publicRecords(catalog);
      const empty = document.getElementById('map-empty-state');
      if (empty) empty.hidden = approvedLayers.length > 0;

      for (const layerConfig of approvedLayers) {
        const group = L.layerGroup();
        const entry = { config: layerConfig, group, state: 'idle', count: 0 };
        entries.push(entry);
        overlayControl.addOverlay(group, layerConfig.label);
        if (layerConfig.defaultVisible) group.addTo(map);
      }

      map.on('overlayadd', event => {
        const entry = entries.find(item => item.group === event.layer);
        if (entry) loadLayerData(entry);
        else refreshMetrics();
      });
      map.on('overlayremove', () => refreshMetrics());

      for (const entry of entries) {
        if (entry.config.defaultVisible) await loadLayerData(entry);
      }
      refreshMetrics();
    } catch (error) {
      errors.push(error.message);
      console.warn('[AMR Atlas] Layer catalog failed', error);
      refreshMetrics();
    }
  }

  async function renderOverviewLiterature() {
    const literaturePath = config.catalogs && config.catalogs.literature;
    if (!literaturePath) return;
    try {
      const catalog = await fetchJson(literaturePath);
      const records = Array.isArray(catalog.records) ? catalog.records : [];
      setText('overview-evidence', records.length.toLocaleString('it-IT'));
    } catch (error) {
      console.warn('[AMR Atlas] Literature catalog failed', error);
    }
  }

  async function renderDashboardEvidence() {
    const root = document.getElementById('dashboard-evidence');
    if (!root) return;
    try {
      const catalog = await fetchJson(config.catalogs.evidence);
      const approved = publicRecords(catalog);
      root.innerHTML = approved.length
        ? approved.map(record => `<article class="evidence-card"><strong>${escapeHtml(record.title)}</strong><br><small>${escapeHtml(record.period || '')} - ${escapeHtml(record.geography || config.regionName)}</small><p>${escapeHtml(record.summary || '')}</p></article>`).join('')
        : '<div class="evidence-card"><strong>Dati in preparazione</strong><p>Nessuna evidenza regionale e\' pubblicata finche\' fonte, licenza, granularita\' e limiti non risultano verificati.</p></div>';
    } catch (error) {
      root.innerHTML = `<div class="evidence-card"><strong>Catalogo non disponibile</strong><p>${escapeHtml(error.message)}</p></div>`;
    }
  }

  renderEvidenceDirectory();
  renderOverviewLiterature();
  renderDashboardEvidence();
  initMap();
})();
