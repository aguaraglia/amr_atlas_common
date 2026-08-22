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
    pointToLayer: (feature, latlng) => {
      const colors = layerConfig.explodeColors || {};
      const key = layerConfig.explodeBy ? String((feature.properties || {})[layerConfig.explodeBy] ?? '') : '';
      const fill = colors[key] || layerConfig.fillColor || layerConfig.color || '#2d7d61';
      return L.circleMarker(latlng, {
        radius: Number(layerConfig.radius || 5),
        color: fill,
        fillColor: fill,
        fillOpacity: 0.8,
        weight: 1
      });
    },
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
      const total = onMap.reduce((sum, item) => sum + ((item.visibleCount ?? item.count) || 0), 0);
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

    const paintFiltered = (root) => {
      if (!root.geojson) return;
      root.group.clearLayers();
      if (!map.hasLayer(root.group) || !root.selected || root.selected.size === 0) {
        root.visibleCount = 0;
        return;
      }
      const property = root.config.explodeBy;
      const features = (root.geojson.features || []).filter(feature => (
        root.selected.has(String((feature.properties || {})[property] ?? 'Altro'))
      ));
      L.geoJSON({ type: 'FeatureCollection', features }, geoJsonOptions(root.config)).addTo(root.group);
      root.visibleCount = features.length;
      root.count = (root.geojson.features || []).length;
      root.state = 'loaded';
    };

    const syncNestedChecks = (root) => {
      if (root.childBox) {
        for (const [category, input] of root.childBox.entries()) {
          input.checked = root.selected.has(category);
        }
      }
      const parentInput = overlayInput(root.group);
      if (!parentInput) return;
      const total = root.children.length;
      const on = root.selected.size;
      parentInput.indeterminate = on > 0 && on < total;
      parentInput.checked = on === total && map.hasLayer(root.group);
    };

    const attachNestedControl = (root) => {
      const nameNode = overlayNameNode(root.group);
      const label = nameNode && nameNode.closest('label');
      if (!label || label.dataset.nested === '1') return;
      label.dataset.nested = '1';
      label.classList.add('layer-group-parent');
      const wrap = document.createElement('div');
      wrap.className = 'layer-group-wrap';
      label.parentNode.insertBefore(wrap, label);
      wrap.appendChild(label);
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'layer-explode-toggle';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.title = 'Mostra le categorie';
      toggle.textContent = '\u25b8';
      label.appendChild(toggle);
      const kids = document.createElement('div');
      kids.className = 'layer-children';
      kids.hidden = true;
      wrap.appendChild(kids);
      root.childBox = new Map();
      for (const child of root.children) {
        const row = document.createElement('label');
        row.className = 'layer-child-row';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.addEventListener('click', event => event.stopPropagation());
        input.addEventListener('change', event => {
          event.stopPropagation();
          if (input.checked) root.selected.add(child.category);
          else root.selected.delete(child.category);
          if (root.selected.size === 0) {
            if (map.hasLayer(root.group)) map.removeLayer(root.group);
          } else if (!map.hasLayer(root.group)) {
            root.group.addTo(map);
          } else {
            paintFiltered(root);
          }
          syncNestedChecks(root);
          refreshMetrics();
        });
        const swatch = document.createElement('span');
        swatch.className = 'layer-swatch';
        swatch.style.background = child.config.color || '#555';
        row.appendChild(input);
        row.appendChild(swatch);
        row.appendChild(document.createTextNode(' ' + countedLabel(child.category, child.count)));
        kids.appendChild(row);
        root.childBox.set(child.category, input);
      }
      toggle.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        kids.hidden = !kids.hidden;
        toggle.textContent = kids.hidden ? '\u25b8' : '\u25be';
        toggle.setAttribute('aria-expanded', kids.hidden ? 'false' : 'true');
      });
    };

    const populateExploded = (root, geojson) => {
      root.geojson = geojson;
      const property = root.config.explodeBy;
      const buckets = new Map();
      for (const feature of geojson.features || []) {
        const key = String((feature.properties || {})[property] ?? 'Altro');
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(feature);
      }
      for (const child of root.children) {
        child.count = (buckets.get(child.category) || []).length;
      }
      root.count = (geojson.features || []).length;
      setOverlayName(root.group, countedLabel(root.config.groupTotalLabel || root.config.label, root.count));
      if (!root.selected || root.selected.size === 0) {
        root.selected = new Set(root.children.map(child => child.category));
      }
      paintFiltered(root);
      attachNestedControl(root);
      syncNestedChecks(root);
      root.state = 'loaded';
      root.draws = true;
    };

    const loadLayerData = async entry => {
      const root = entry.parent || entry;
      if (root.state === 'loaded' || root.state === 'loading') {
        if (root.geojson && root.config.explodeBy) paintFiltered(root);
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
            selected: new Set(),
            draws: true
          };
          entries.push(root);
          const colors = layerConfig.explodeColors || {};
          const counts = layerConfig.explodeCounts || {};
          for (const category of Object.keys(colors)) {
            root.children.push({
              config: {
                ...layerConfig,
                label: category,
                color: colors[category] || layerConfig.color,
                fillColor: colors[category] || layerConfig.fillColor || layerConfig.color
              },
              category,
              count: Number(counts[category]) || 0
            });
          }
          overlayControl.addOverlay(root.group, countedLabel(layerConfig.groupTotalLabel || layerConfig.label, root.count));
          attachNestedControl(root);
          if (layerConfig.defaultVisible) {
            root.selected = new Set(root.children.map(child => child.category));
            root.group.addTo(map);
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
        if (entry.children && entry.selected.size === 0) {
          entry.selected = new Set(entry.children.map(child => child.category));
        }
        loadLayerData(entry);
      });
      map.on('overlayremove', event => {
        const entry = entries.find(item => item.group === event.layer);
        if (entry && entry.children) {
          entry.selected = new Set();
          entry.group.clearLayers();
          entry.visibleCount = 0;
          syncNestedChecks(entry);
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
