# Extending Valhalla Route Support to New Cities

This guide explains how to add offline route visualization support for new cities (Taichung, Kaohsiung, and future cities).

## Prerequisites

- City adapter already implemented in `src/cities/adapters/`
- Static data file available in `public/` with geocoded coordinates
- Data includes route/vehicle identifiers and timing information

## Overview

The route visualization system requires three components:

1. **Frontend adapter** with `carSeq` field mapping (for route matching)
2. **Waypoint files** in data branch (ordered stop coordinates per route)
3. **Valhalla-generated geometries** (road-following LineStrings)

## Step 1: Update Frontend Adapter

Each city adapter must map its vehicle/route identifier to the `carSeq` field:

### Example: Taichung

```typescript
// src/cities/adapters/TaichungAdapter.ts
override mapToUnified(point: TaichungTrashCollectionPoint): UnifiedTrashCollectionPoint {
  return {
    // ... other fields
    route: point.route,          // Vehicle license (e.g., "KEQ-0315")
    carSeq: point.route,         // Map to carSeq for route matching
    arrivalTime: point.arrivalTime,
    departureTime: point.departureTime,
    source: 'taichung',
  };
}
```

### Example: Kaohsiung

```typescript
// src/cities/adapters/KaohsiungAdapter.ts
override mapToUnified(point: KaohsiungTrashCollectionPoint): UnifiedTrashCollectionPoint {
  return {
    // ... other fields
    route: point.route,          // Vehicle license/route ID
    carSeq: point.route,         // Map to carSeq for route matching
    arrivalTime: point.arrivalTime,
    departureTime: point.departureTime,
    source: 'kaohsiung',
  };
}
```

### Key Points

- `route`: The display name shown in the UI
- `carSeq`: The identifier used for route geometry lookup
- For Taipei: `carSeq` = "第1車" (vehicle sequence)
- For Taichung/Kaohsiung: `carSeq` = vehicle license (e.g., "KEQ-0315")

## Step 2: Generate Waypoint Files (Data Branch)

Waypoint files define the ordered stops for each route. They are stored in the `data` branch under `data-input/routes/{city}/`.

### 2.1 Update Waypoint Generation Script

Edit `scripts/generate-waypoints-from-data.js` in the **data branch**:

```javascript
async function buildTaichung() {
  // Read Taichung data from main branch
  const data = readJsonFromGit("data:taichung-trash-collection-points.json");
  
  // Group by vehicle license (route identifier)
  const groups = new Map();
  
  for (const row of data) {
    const vehicleLicense = row.route?.toString().trim() || "unknown";
    if (!groups.has(vehicleLicense)) groups.set(vehicleLicense, []);
    
    groups.get(vehicleLicense).push({
      lon: toNumber(row.longitude),
      lat: toNumber(row.latitude),
      arrival: parseTimeHHMM(row.arrivalTime),
      raw: row,
    });
  }
  
  const cityDir = path.join(outBase, "taichung");
  await ensureDir(cityDir);
  
  let written = 0;
  for (const [vehicleLicense, points] of groups.entries()) {
    // Sort by arrival time
    const sorted = points
      .filter((p) => Number.isFinite(p.lon) && Number.isFinite(p.lat))
      .sort((a, b) => a.arrival - b.arrival);
    
    if (sorted.length < 2) continue; // Skip routes with < 2 stops
    
    const routeId = `taichung-${slugify(vehicleLicense, "route")}`;
    
    const fc = featureCollectionFromPoints(
      sorted.map((p) => ({
        lon: p.lon,
        lat: p.lat,
        properties: {
          routeId,
          city: "taichung",
          route_name: vehicleLicense,
          car_seq: vehicleLicense, // Same as route_name for Taichung
          arrival_time: p.raw.arrivalTime,
          departure_time: p.raw.departureTime,
          district: p.raw.area,
          village: p.raw.village,
          location: p.raw.location,
        },
      }))
    );
    
    const outPath = path.join(cityDir, `${routeId}.geojson`);
    await fs.writeFile(outPath, JSON.stringify(fc, null, 2));
    written++;
  }
  
  console.log(`Taichung route waypoint files written: ${written}`);
}
```

### 2.2 Add City to Main Execution

```javascript
async function main() {
  await buildTaipei();
  await buildNewTaipei();
  await buildTaichung();    // NEW
  await buildKaohsiung();   // NEW
}

main().catch(console.error);
```

### 2.3 Run the Script

```bash
# In data branch
bun scripts/generate-waypoints-from-data.js
```

This creates files like:
```
data-input/routes/
├── taipei/
│   ├── taipei-quanzhou-2-abc123-1-def456.geojson
│   └── ...
├── taichung/
│   ├── taichung-keq-0315-xyz789.geojson
│   └── ...
└── kaohsiung/
    ├── kaohsiung-abc-1234-uvw890.geojson
    └── ...
```

## Step 3: Generate Valhalla Route Geometries

The GitHub Actions workflow automatically processes waypoint files and generates road-following geometries.

### 3.1 Verify Workflow Configuration

Check `.github/workflows/build-routes-valhalla.yml` - it should automatically process all cities in `data-input/routes/`:

```yaml
- name: Build routed GeoJSON from waypoints
  run: |
    ROUTE_DIR=$(realpath ../data-branch/data-input/routes)
    node scripts/build-routes-valhalla.js \
      --routes-dir="$ROUTE_DIR" \
      --out-dir=build/routes \
      --valhalla-config-host=valhalla.json
```

The script (`scripts/build-routes-valhalla.js`) automatically discovers all city subdirectories.

### 3.2 Trigger the Workflow

1. **Commit waypoint files** to data branch
2. **Trigger workflow** manually or wait for weekly schedule:
   ```bash
   gh workflow run build-routes-valhalla.yml
   ```
3. **Monitor progress** in GitHub Actions tab
4. **Verify output** in data branch under `routes/{city}/`:
   ```
   routes/
   ├── taichung/
   │   ├── taichung-keq-0315-xyz789.geojson
   │   └── routes-manifest.json
   └── kaohsiung/
       ├── kaohsiung-abc-1234-uvw890.geojson
       └── routes-manifest.json
   ```

## Step 4: Update Route Metadata

The route metadata file maps `{route_name}|{car_seq}` → `routeId` for frontend lookup.

### 4.1 Update Metadata Generation Script

Edit `generate-route-metadata.js` in the **data branch**:

```javascript
const taipei = generateRouteMetadata('taipei');
const newTaipei = generateRouteMetadata('new-taipei');
const taichung = generateRouteMetadata('taichung');      // NEW
const kaohsiung = generateRouteMetadata('kaohsiung');    // NEW

const output = { 
  taipei,
  'new-taipei': newTaipei,
  taichung,         // NEW
  kaohsiung,        // NEW
};

fs.writeFileSync('routes/route-metadata.json', JSON.stringify(output, null, 2));
console.log('Generated routes/route-metadata.json');
console.log('Taipei routes:', Object.keys(taipei).length);
console.log('New Taipei routes:', Object.keys(newTaipei).length);
console.log('Taichung routes:', Object.keys(taichung).length);
console.log('Kaohsiung routes:', Object.keys(kaohsiung).length);
```

### 4.2 Run the Script

```bash
# In data branch, after Valhalla geometries are generated
node generate-route-metadata.js
git add routes/route-metadata.json
git commit -m "Add Taichung and Kaohsiung route metadata"
git push origin data
```

## Step 5: Test in Frontend

### 5.1 Development Testing

```bash
bun run dev
```

1. Open browser with DevTools console
2. Select Taichung or Kaohsiung city
3. Choose a route from the dropdown
4. Verify console logs:
   ```
   [Route Fetch] Looking up routeId with key: KEQ-0315|KEQ-0315
   [Route Fetch] ✓ Found routeId: taichung-keq-0315-xyz789
   [API] Route geometry loaded: 1 features
   ```
5. Check map: Blue route line should follow roads

### 5.2 Expected Behavior

✅ Route line follows actual road network (not straight lines)
✅ Map auto-fits to show entire route
✅ Stop labels visible with time ranges
✅ Smooth animations and transitions

### 5.3 Fallback Behavior

If route geometry not found:
- Console shows: `[Route Fetch] No routeId found for key: ...`
- Map displays straight-line fallback connecting stops
- No errors, graceful degradation

## Troubleshooting

### Issue: "No carSeq field in point data"

**Cause**: Adapter not mapping vehicle identifier to `carSeq`

**Fix**: Update adapter's `mapToUnified()` method to include:
```typescript
carSeq: point.route, // or appropriate field
```

### Issue: "No routeId found for key: X|Y"

**Cause**: 
1. Route not in metadata file, OR
2. Key format mismatch

**Fix**:
1. Verify `routes/route-metadata.json` has entry for that route
2. Check key format matches: `route_name|car_seq`
3. Re-run metadata generation if needed

### Issue: "Route geometry not found: {city}/XXX"

**Cause**: Route file missing from data branch

**Fix**:
1. Check if file exists in data branch: `routes/{city}/{routeId}.geojson`
2. Re-run Valhalla routing workflow
3. Verify CDN URL is correct

### Issue: No routes generated for city

**Cause**: Waypoint generation failed or data structure mismatch

**Debug**:
1. Check waypoint generation script logs
2. Verify data file structure matches expected format
3. Ensure at least 2 stops per route (minimum for routing)
4. Check coordinates are valid WGS84 (longitude: 120-122, latitude: 22-25)

## Summary Checklist

- [ ] Frontend adapter maps vehicle ID to `carSeq`
- [ ] Waypoint generation script added for city
- [ ] Waypoint files committed to data branch
- [ ] Valhalla workflow run successfully
- [ ] Route geometries present in `routes/{city}/`
- [ ] Metadata generation script updated
- [ ] `route-metadata.json` includes new city
- [ ] Frontend route selection tested
- [ ] Route visualization works (or falls back gracefully)

## Performance Considerations

### Waypoint File Size
- Keep waypoint files under 100KB each
- Split very long routes (100+ stops) if needed
- Gzip compression happens automatically via CDN

### Valhalla Build Time
- Taiwan OSM extract: ~2GB
- Tile building: ~10-15 minutes
- Route generation: ~1 minute per 100 routes
- Plan for 30-60 minute total CI time

### CDN Caching
- Route geometries cached indefinitely by CDN
- Metadata loaded once per session
- Consider IndexedDB for offline support (future)

## Future Improvements

### Multi-Vehicle Routes
If a route has multiple vehicles (e.g., "第1車", "第2車"):
- Generate separate waypoint files per vehicle
- Use `{route_name}|{car_seq}` as unique key
- Frontend will fetch geometry for each vehicle separately

### Dynamic Updates
To update routes without full rebuild:
1. Generate only changed waypoint files
2. Run routing for changed routes only
3. Update metadata incrementally
4. Commit minimal changes to data branch

### Route Analytics
Add to waypoint properties:
- Expected passenger/trash volume
- Special notes (narrow roads, restricted access)
- Alternative routes for road closures
