# Taiwan Trash Collection Data

This orphan branch contains static data for trash collection points across Taiwan cities.

## Structure

```
data-branch/
├── data-input/
│   └── routes/          # Waypoint definitions for route generation
│       ├── taipei/
│       ├── new-taipei/
│       ├── taichung/
│       └── kaohsiung/
├── routes/              # Generated route geometries (by GitHub Actions)
│   ├── taipei/
│   ├── new-taipei/
│   ├── taichung/
│   ├── kaohsiung/
│   └── route-metadata.json  # Route lookup metadata
├── trash-collection-points.json
├── new-taipei-trash-collection-points.json
├── taichung-trash-collection-points.json
├── kaohsiung-trash-collection-points.json
├── meta.json            # Per-city updatedAt / checkedAt / records (written by the refresh)
├── geocode/             # Address → coordinates caches (TGOS) for Taichung and Kaohsiung
│   ├── taichung.json
│   └── kaohsiung.json
└── migrations/          # One-time maps from pre-Nov-2026 point IDs to stable IDs
    └── point-ids-v1-<city>.json
```

## Why there is an `mcp/vercel.json` here

The MCP Vercel project (Root Directory `mcp`) is connected to this repository and would try to
build every push to this branch, failing because the branch has no `mcp/` app. Vercel reads
`vercel.json` from the pushed commit, so `mcp/vercel.json` with `git.deploymentEnabled: false`
is the only way to switch deployments off for this branch. Leave it in place.

## Geocode caches and ID migrations

- `geocode/<city>.json` is read by `scripts/data/update.ts` (main branch) to place Taichung and
  Kaohsiung stops. Add newly geocoded addresses by merging them in (`scripts/process-tgos-results.ts`
  does this) and committing here; never replace the file with a partial batch.
- `migrations/` is copied into the site by `bun run dump-data` so browsers can upgrade stars and
  shared links saved with the old point IDs. Generated once; don't regenerate or edit.

## Important: Script Management

**All scripts are managed in the main branch** under `scripts/`. This data branch contains **only data files**.

Scripts in the main branch that operate on this data branch:
- `scripts/generate-route-metadata.js` - Generates route-metadata.json from waypoint files
- `scripts/build-routes-valhalla.js` - Generates route geometries using Valhalla
- `scripts/generate-waypoints-from-data.js` - Creates waypoint files from raw data
- GitHub Actions workflows in `.github/workflows/`

This separation ensures:
- Single source of truth for scripts (main branch)
- Data branch remains clean with only data files
- Scripts can be versioned and tested independently
- Easier to maintain and update

## Data Sources

### Taipei City
- URL: https://data.taipei/api/v1/dataset/a6e90031-7ec4-4089-afb5-361a4efe7202
- Format: Wrapped in `result.results` object
- Updates: Monthly via GitHub Actions

### New Taipei City
- URL: https://data.ntpc.gov.tw/api/datasets/edc3ad26-8ae7-4916-a00b-bc6048d19bf8/json
- Format: Direct array, paginated (3 pages: 10k + 10k + 6,822 entries)
- Coverage: All 29 districts (三峽區, 三芝區, 三重區, 中和區, 五股區, 八里區, 土城區, 坪林區, 平溪區, 新店區, 新莊區, 板橋區, 林口區, 樹林區, 永和區, 汐止區, 泰山區, 淡水區, 深坑區, 烏來區, 瑞芳區, 石碇區, 石門區, 萬里區, 蘆洲區, 貢寮區, 金山區, 雙溪區, 鶯歌區)
- Updates: Run `bun fetch-new-taipei-data.ts` to update

## Update Schedule

This data is automatically updated monthly via GitHub Actions.

## Last Updated

Check the commit timestamp for the last data update.
