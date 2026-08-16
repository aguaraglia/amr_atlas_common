# AMR Atlas Common

Base statica condivisa per atlanti AMR regionali. Contiene runtime Leaflet,
stile, template HTML, catalogo delle pubblicazioni, percorso divulgativo e
procedura di build. Non contiene dati regionali.

Le edizioni attualmente previste sono:

- `srd_amr_atlas`: edizione Sardegna, ancora servita dal repository storico;
- `lom_amr_atlas`: edizione Lombardia basata su questa struttura.

## Contratto di un'edizione

Ogni edizione deve fornire:

- `atlas.config.json`;
- `public/data/layer-catalog.json`;
- `public/data/evidence-catalog.json`;
- eventuali asset approvati sotto `public/`;
- metadati di provenienza e pubblicabilita' sotto `metadata/`.

Il runtime carica esclusivamente record con `publication_status` uguale a
`public_approved`. Gli stati `candidate`, `verified` e `restricted` non vengono
visualizzati sulla mappa pubblica. La pagina Pubblicazioni può elencare anche
fonti candidate, identificandole chiaramente come fonti di contesto senza dati
pubblicati.

## Sezioni comuni

La build genera sei pagine coerenti per ogni edizione: Atlante, Evidenze,
Pubblicazioni, Metodo, Progetto e Divulgazione. La Divulgazione comprende dodici
moduli comuni; eventuali riferimenti regionali devono restare esplicitamente
distinti dalle evidenze epidemiologiche.

## Build

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/build-edition.ps1 `
  -EditionRoot 'K:\percorso\edizione'
```

La build viene prodotta in `site/`. Se `site/` esiste, viene spostata in
`build-backups/` prima della sostituzione.
