# Route Visualization Testing Guide

## Overview
The application now supports Valhalla-generated route visualization using pre-computed LineString geometries from the data branch.

## Testing Steps

### 1. Start Development Server
```bash
bun run dev
```

### 2. Open Browser Console
- Open DevTools (F12 or Cmd+Option+I)
- Go to Console tab
- Filter for `[API]` or `[Route Fetch]` logs

### 3. Test Route Selection

#### Test Case 1: Taipei Route "泉州-2"
1. **Select City**: Ensure Taipei is selected
2. **Select Route**: Choose "泉州-2" from dropdown
3. **Expected Console Logs**:
   ```
   [Route Fetch] Fetching route metadata...
   [API] Fetching route metadata: https://rawcdn.githack.com/Yukaii/garbage/data/routes/route-metadata.json
   [API] Route metadata response: 200 OK
   [API] Route metadata loaded for cities: (2) ['taipei', 'new-taipei']
   [Route Fetch] Searching for route: 泉州-2 carSeq: 第1車
   [Route Fetch] Looking up routeId with key: 泉州-2|第1車
   [Route Fetch] ✓ Found routeId: taipei-2-28c0bc-1-ebe684
   [API] Fetching route geometry: .../taipei-2-28c0bc-1-ebe684.geojson
   [API] Route geometry loaded: 1 features
   ```
4. **Expected Visual**:
   - Blue route line appears on map connecting stops
   - Line follows actual road network (not straight lines)
   - Map auto-fits to show entire route
   - Stop markers show arrival/departure times

#### Test Case 2: Another Taipei Route
1. Select any other Taipei route from dropdown
2. Verify similar console output with correct routeId
3. Verify route line renders correctly

#### Test Case 3: Fallback to Straight Lines
1. If route geometry fails to load, you should see:
   ```
   [Route Fetch] No routeId found for key: <route>|<carSeq>
   ```
2. Map should still show **straight-line fallback** connecting stops
3. This indicates route is not in metadata (needs generation)

### 4. Visual Verification Checklist

#### Route Line Style
- ✅ Blue route line (`#3b82f6`) with 4px width
- ✅ Animated lighter blue overlay (`#60a5fa`) with dashed pattern
- ✅ 80% opacity for main line
- ✅ Smooth rounded joins and caps

#### Stop Labels
- ✅ Time labels visible for all stops in selected route
- ✅ Active stops (green) have pulsing wave animation
- ✅ Labels show arrival-departure time range
- ✅ High contrast colors (green/yellow/gray)

#### Map Behavior
- ✅ Auto-fits bounds to show entire route
- ✅ Clustering disabled when route selected
- ✅ Click on label shows popup with details
- ✅ Route clears when deselecting

## Debugging Common Issues

### Issue: "No carSeq field in point data"
**Cause**: TaipeiAdapter not mapping `車次` field correctly
**Check**: 
```javascript
// In browser console
console.log(filteredPoints[0])
// Should have: { ..., carSeq: "第1車", ... }
```

### Issue: "No routeId found for key: X|Y"
**Cause**: Route not in metadata file or key format mismatch
**Solutions**:
1. Check metadata file has entry for that route/carSeq combo
2. Verify key format matches: `route_name|car_seq`
3. Re-generate metadata if needed (see data branch scripts)

### Issue: "Route geometry not found: taipei/XXX"
**Cause**: Route file missing from data branch
**Solutions**:
1. Check if file exists: `data/routes/taipei/{routeId}.geojson`
2. Re-run Valhalla route generation script
3. Verify CDN URL is correct

### Issue: Route line not visible
**Cause**: Geometry format incorrect or layer not rendering
**Check**:
```javascript
// In browser console after selecting route
mapRef.current.getSource('route-line').serialize()
// Should show: { type: 'geojson', data: { type: 'FeatureCollection', features: [...] } }
```

## Performance Testing

### Desktop
- Select route with 20+ stops
- Should load within 1 second
- Smooth rendering and animations

### Mobile
- Test on actual device or Chrome DevTools mobile emulation
- Verify touch interactions work on labels
- Route should render smoothly

## Data Generation Status

### Current Coverage
- **Taipei**: 465 routes in metadata
- **New Taipei**: 1 route in metadata ⚠️ (needs fixing)

### Next Steps
1. Generate missing New Taipei route metadata
2. Run Valhalla routing for missing routes
3. Update metadata.json with new entries

## Files Modified

### Frontend
- `src/types.ts` - Added `carSeq?` and `team?` fields
- `src/cities/adapters/TaipeiAdapter.ts` - Maps car_seq from raw data
- `src/api.ts` - Added `fetchRouteGeometry()`, `fetchRouteManifest()`, `fetchRouteMetadata()`
- `src/Map.tsx` - Complete route matching and rendering logic

### Data Branch
- `routes/route-metadata.json` - Route name → routeId mapping
- `routes/taipei/*.geojson` - 465 route geometry files
- `routes/taipei/routes-manifest.json` - Metadata about routes
- `scripts/generate-route-metadata.js` - Script to build metadata

## CDN Configuration
- **Base URL**: `https://rawcdn.githack.com/Yukaii/garbage/data`
- **Branch**: `data` (auto-updates)
- **Files**:
  - `/routes/route-metadata.json` - Global metadata
  - `/routes/{city}/routes-manifest.json` - Per-city manifest
  - `/routes/{city}/{routeId}.geojson` - Individual route geometries

## Cleanup Tasks (Post-Verification)

After confirming everything works:
1. Remove verbose `console.log()` statements
2. Keep error logging for production debugging
3. Add error boundaries for graceful failures
4. Consider adding loading spinners for route fetch

## Success Criteria

✅ Route selection triggers data load
✅ Metadata loads once and caches
✅ RouteId lookup succeeds for Taipei routes
✅ Valhalla geometry renders as blue line
✅ Fallback to straight lines works when geometry missing
✅ No console errors during normal operation
✅ Mobile and desktop both work smoothly
