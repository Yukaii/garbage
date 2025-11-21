# Valhalla Offline Routing Pipeline

Design for generating road-following garbage truck routes fully offline and publishing the results to the static `data` branch (orphan). Routing is done at build time with Valhalla; the app only consumes precomputed GeoJSON/encoded polylines.

## Goals & Constraints
- Keep the site static; no runtime routing API calls.
- Use OSM data (Taiwan/Taipei) and truck routing profiles.
- Automate via GitHub Actions; artifacts land in `data` with minimal bloat.
- Rebuild on demand (route edits) and on a schedule to catch OSM updates.

## Inputs & Outputs
- **Inputs (main branch)**
  - Route definitions: `data-input/routes/{city}/*.geojson` (FeatureCollection of waypoint points in order; grouped by route id).
  - Optional overrides: truck profile tweaks (height/weight/length), per-route settings.
- **Outputs (data branch)**
  - `routes/{city}/route-{id}.geojson` (LineString snapped to roads).
  - `routes/{city}/routes-manifest.json` (metadata: source hash, OSM timestamp, Valhalla version, record counts, bbox).
  - Optional encoded polylines for lightweight fetch: `routes/{city}/route-{id}.polyline.txt`.
- Heavy Valhalla tiles/cache are **not** stored in `data`; keep them in GitHub Actions cache or release assets if needed.

## High-Level Flow
1) Download Taipei/Taiwan OSM extract (Geofabrik).
2) Clip to smaller bbox (Keeps build <~2GB): `osmium extract -b {west,south,east,north}`.
3) Generate Valhalla config + tiles.
4) Run routing script against waypoint definitions (costing: `truck`).
5) Emit GeoJSON/polylines + manifest into a temp dir.
6) Commit outputs to `data` (smart diff; skip commit if no changes).

## Valhalla Build Steps (inside CI job)
```bash
# 1) Config (writes valhalla.json)
valhalla_build_config \
  --mjolnir-tile-dir /data/valhalla/tiles \
  --mjolnir-admin /usr/local/share/admins.sqlite \
  --mjolnir-timezone /usr/share/zoneinfo/ \
  > valhalla.json

# 2) Build tiles from clipped PBF
valhalla_build_tiles -c valhalla.json taipei.osm.pbf

# 3) Route (example via CLI; script will loop over routes)
cat <<'JSON' | valhalla_route -j -c valhalla.json > out.json
{"locations":[{"lon":121.5341,"lat":25.0339},{"lon":121.5645,"lat":25.0478}],"costing":"truck","units":"kilometers"}
JSON
```
- Use costing `"truck"`; set truck options in requests as needed (height/weight/width/axle_load).
- If map-matching GPS traces is required later, swap in `valhalla_map_match -j`.

## GitHub Actions Design (sketch)
File: `.github/workflows/build-routes-valhalla.yml`

- **Triggers**:
  - `push` to `main` touching `data-input/routes/**` or routing scripts.
  - `schedule`: weekly rebuild (pulls fresh OSM).
  - `workflow_dispatch`.

- **Job steps** (single job; Ubuntu runner):
  1. Checkout with full history + fetch `data` branch: `fetch-depth: 0`.
  2. Cache step for `taipei.osm.pbf` and `valhalla/tiles` (keyed by OSM timestamp + Valhalla version).
  3. Download OSM from Geofabrik; optional bbox clip with `osmium`.
  4. Run Valhalla container (or local binaries) to build config + tiles.
     - Recommended: `docker run --rm -v $PWD:/data valhalla/valhalla:latest /bin/bash -c "valhalla_build_config ... && valhalla_build_tiles ..."`
  5. Run routing script (Node/TS, e.g., `bun ts-node scripts/build-routes-valhalla.ts`) pointing at `valhalla.json`, inputs in `data-input/routes/`, output to `build/routes/`.
  6. Copy outputs into a worktree of the `data` branch (`git worktree add ../data-branch data`), compare with existing files.
  7. Commit/push to `data` only if diffs exist. Include manifest with build metadata.

- **Env/dev tooling**: install `osmium-tool` for clipping; use `actions/cache` to reuse tiles and reduce build minutes.

### Implemented CI (current)
- Workflow: `.github/workflows/build-routes-valhalla.yml`
- Routing script: `scripts/build-routes-valhalla.js`
- Triggered on route input changes, weekly refresh, or manual dispatch.
- Uses Valhalla Docker image to build tiles from the Taiwan extract and generate routed GeoJSON. Publishes to the `data` branch via worktree.

## Routing Script Expectations
- Read each route definition (ordered waypoints). Validate min 2 points.
- Build Valhalla request with per-route truck options (fallback to defaults).
- Call `valhalla_route` locally (preferred to spinning HTTP service) and parse JSON geometry.
- Output: GeoJSON LineString with properties `{routeId, city, distance_km, duration_min, osm_build, valhalla_version, source_hash}`.
- Optionally emit encoded polyline (precision 6) for lightweight map rendering.
- Collect stats for manifest: total routes, bbox, build time, warnings (failed routes, retries).

## Data Branch Layout (proposed)
```
routes/
  taipei/
    route-{id}.geojson
    route-{id}.polyline.txt   # optional
    routes-manifest.json
```

## Frontend Consumption (later)
- Swap current straight lines to fetch `routes/{city}/route-*.geojson` (or polylines) from `data` branch assets.
- Use `git show data:routes/...` during build (similar to existing `dump-data` flow) to place into `public/routes/`.
- Defer until routing data is produced.

## Operational Notes
- Keep OSM extract clipped to Taipei to control CI time/storage.  
- Pin Valhalla version in workflow to avoid accidental changes; surface it in manifest.  
- If caching tiles, invalidate cache on OSM timestamp or Valhalla version bump.  
- Monitor failed routes; script should fail the workflow if any route cannot be generated.

## City Onboarding Order
- **Taipei / New Taipei first**: existing official lat/lon points are considered accurate; use them directly as ordered waypoints for initial routing runs.  
- As soon as waypoint files are added under `data-input/routes/{city}/`, the workflow can be enabled to build and publish routed lines.  
- Defer frontend wiring until these routed outputs exist.
