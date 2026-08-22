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

  const countedLabel = (label, count) => {
    const n = Number(count);
    return Number.isFinite(n) ? `${label} (${n})` : label;
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

    const overlayNameNode = layer => {
      const id = L.stamp(layer);
      const labels = overlayControl.getContainer().querySelectorAll('.leaflet-control-layers-overlays label');
      for (const label of labels) {
        const input = label.querySelector('input');
        if (input && Number(input.layerId) === id) return label.querySelector('span');
      }
      return null;
    };

    const setOverlayName = (layer, name) => {
      const node = overlayNameNode(layer);
      if (node) node.innerHTML = ` ${name}`;
    };

    const overlayInput = layer => {
      const id = L.stamp(layer);
      const inputs = overlayControl.getContainer().querySelectorAll('.leaflet-control-layers-overlays input');
      for (const input of inputs) {
        if (Number(input.layerId) === id) return input;
      }
      return null;
    };

    const setOverlayChecked = (layer, checked) => {
      const input = overlayInput(layer);
      if (input) input.checked = !!checked;
    };

    let syncingOverlays = false;

    const refreshMetrics = () => {
      const onMap = entries.filter(item => item.state === 'loaded' && item.draws !== false && map.hasLayer(item.group));
      const total = onMap.reduce((sum, item) => sum + (item.count || 0), 0);
      const loadedCount = entries.filter(item => item.state === 'loaded' && item.draws !== false).length;
      setText('metric-visible', total.toLocaleString('it-IT'));
      setText('metric-sources', onMap.length.toLocaleString('it-IT'));
      setText('overview-localized', total.toLocaleString('it-IT'));
      setText('overview-layers', entries.filter(item => item.draws !== false).length.toLocaleString('it-IT'));
      const available = entries.filter(item => item.draws !== false).length;
      if (errors.length) {
        setText('status', `${loadedCount}/${available} layer caricati - ${errors.length} non disponibili`);
      } else if (loadedCount < available) {
        setText('status', `${onMap.length}/${available} layer visibili (altri su richiesta)`);
      } else {
        setText('status', `${onMap.length} layer pubblici visibili`);
      }
    };

    const paintGeoJson = (entry, geojson) => {
      const layer = L.geoJSON(geojson, geoJsonOptions(entry.config));
      entry.group.clearLayers();
      layer.addTo(entry.group);
      entry.count = (geojson.features || []).length;
      entry.state = 'loaded';
    };

    const populateExploded = (root, geojson) => {
      const property = root.config.explodeBy;
      const colors = root.config.explodeColors || {};
      const prefix = root.config.explodeLabelPrefix || '';
      const buckets = new Map();
      for (const feature of geojson.features || []) {
        const key = String((feature.properties || {})[property] ?? 'Altro');
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(feature);
      }
      const known = root.children.slice();
      for (const key of buckets.keys()) {
        if (!known.some(child => child.category === key)) {
          const childConfig = {
            ...root.config,
            label: `${prefix}${key}`,
            color: colors[key] || root.config.color,
            fillColor: colors[key] || root.config.fillColor || root.config.color
          };
          const child = {
            config: childConfig,
            group: L.layerGroup(),
            state: 'idle',
            count: 0,
            parent: root,
            category: key,
            draws: true
          };
          root.children.push(child);
          entries.push(child);
          overlayControl.addOverlay(child.group, countedLabel(childConfig.label, buckets.get(key).length));
          if (map.hasLayer(root.group) || root.children.some(item => map.hasLayer(item.group))) {
            child.group.addTo(map);
          }
        }
      }
      for (const child of root.children) {
        const features = buckets.get(child.category) || [];
        paintGeoJson(child, { type: 'FeatureCollection', features });
        setOverlayName(child.group, countedLabel(child.config.label, child.count));
      }
      root.state = 'loaded';
      root.count = (geojson.features || []).length;
      setOverlayName(root.group, countedLabel(root.config.groupTotalLabel || root.config.label, root.count));
    };

    const loadLayerData = async entry => {
      const root = entry.parent || entry;
      if (root.state === 'loaded' || root.state === 'loading') {
        refreshMetrics();
        return;
      }
      root.state = 'loading';
      try {
        const geojson = await fetchJson(root.config.file);
        if (geojson.type !== 'FeatureCollection') throw new Error('non e\' un FeatureCollection');
        if (root.config.explodeBy) populateExploded(root, geojson);
        else paintGeoJson(root, geojson);
      } catch (error) {
        root.state = 'failed';
        const message = `${root.config.id}: ${error.message}`;
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
        if (layerConfig.explodeBy) {
          const root = {
            config: layerConfig,
            group: L.layerGroup(),
            state: 'idle',
            count: Number(layerConfig.feature_count) || 0,
            children: [],
            draws: false
          };
          entries.push(root);
          const colors = layerConfig.explodeColors || {};
          const prefix = layerConfig.explodeLabelPrefix || '';
          const counts = layerConfig.explodeCounts || {};
          const categories = Object.keys(colors);
          for (const category of categories) {
            const childConfig = {
              ...layerConfig,
              label: `${prefix}${category}`,
              color: colors[category] || layerConfig.color,
              fillColor: colors[category] || layerConfig.fillColor || layerConfig.color
            };
            const child = {
              config: childConfig,
              group: L.layerGroup(),
              state: 'idle',
              count: Number(counts[category]),
              parent: root,
              category,
              draws: true
            };
            root.children.push(child);
            entries.push(child);
          }
          overlayControl.addOverlay(root.group, countedLabel(layerConfig.groupTotalLabel || layerConfig.label, root.count));
          for (const child of root.children) {
            overlayControl.addOverlay(child.group, countedLabel(child.config.label, child.count));
          }
          if (!root.children.length) root.draws = true;
          if (layerConfig.defaultVisible) {
            for (const child of root.children) child.group.addTo(map);
            if (!root.children.length) root.group.addTo(map);
          }
        } else {
          const group = L.layerGroup();
          const entry = { config: layerConfig, group, state: 'idle', count: Number(layerConfig.feature_count) || 0, draws: true };
          entries.push(entry);
          overlayControl.addOverlay(group, countedLabel(layerConfig.label, layerConfig.feature_count));
          if (layerConfig.defaultVisible) group.addTo(map);
        }
      }

      map.on('overlayadd', event => {
        const entry = entries.find(item => item.group === event.layer);
        if (!entry) { refreshMetrics(); return; }
        loadLayerData(entry);
        if (syncingOverlays) return;
        if (entry.children && entry.children.length) {
          syncingOverlays = true;
          for (const child of entry.children) {
            if (!map.hasLayer(child.group)) child.group.addTo(map);
          }
          syncingOverlays = false;
        } else if (entry.parent) {
          const allOn = entry.parent.children.every(child => map.hasLayer(child.group));
          setOverlayChecked(entry.parent.group, allOn);
        }
        refreshMetrics();
      });
      map.on('overlayremove', event => {
        const entry = entries.find(item => item.group === event.layer);
        if (!entry) { refreshMetrics(); return; }
        if (syncingOverlays) { refreshMetrics(); return; }
        if (entry.children && entry.children.length) {
          syncingOverlays = true;
          for (const child of entry.children) {
            if (map.hasLayer(child.group)) map.removeLayer(child.group);
          }
          syncingOverlays = false;
        } else if (entry.parent) {
          setOverlayChecked(entry.parent.group, false);
        }
        refreshMetrics();
      });

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
