# Route Waypoint Inputs

Place ordered waypoint definitions here to generate road-following routes with Valhalla. When these files exist, the routing workflow will build tiles, snap to roads, and publish outputs to the `data` branch.

## Format
- One GeoJSON FeatureCollection per file under `data-input/routes/{city}/`.
- Features must be Point geometries listed in ride order for a single route.
- Include `properties.routeId` (string) and optional `truckOptions` (height, weight, width, length, axle_load) to override defaults.
- Taipei/New Taipei inputs live in the `data` branch under `data-input/routes/` to keep main light. Generate them from a data worktree with `node scripts/generate-waypoints-from-data.js` (script lives in the `data` branch under `scripts/`; it pulls `data:` branch JSON and orders by arrival time / rank) and commit to the `data` branch.

Minimal example:
```json
{
  "type": "FeatureCollection",
  "features": [
    { "type": "Feature", "geometry": { "type": "Point", "coordinates": [121.5341, 25.0339] }, "properties": { "routeId": "taipei-001" } },
    { "type": "Feature", "geometry": { "type": "Point", "coordinates": [121.5645, 25.0478] }, "properties": { "routeId": "taipei-001" } }
  ]
}
```

## Onboarding Order
- Start with **Taipei** and **New Taipei**: official lat/lon data is already accurate; use it directly as waypoints in ordered route files (e.g., `data-input/routes/taipei/route-001.geojson`).
- Additional cities can be added later with the same structure.
