# Adding New City Data Support

This guide explains how to add new city trash collection data (e.g., Taichung 台中市, Kaohsiung 高雄市) to the monthly update workflow.

## Overview

New cities may have **different data sources** than Taipei/New Taipei:
- **Taichung API**: datacenter.taichung.gov.tw
- **Kaohsiung API**: data.kcg.gov.tw
- **Data Type**: Vehicle GPS positions (not scheduled collection points) or scheduled routes
- **Update Strategy**: Snapshot vehicle positions or routes monthly

## 1. Update GitHub Actions Workflow

### File: `.github/workflows/update-data.yml`

Add new city data fetching after the existing city steps (replace `{CITY}` with city name like `taichung` or `kaohsiung`):

```yaml
- name: Fetch latest data from {CITY} City API
  run: |
    echo "Fetching {CITY} City trash vehicle data..."

    # Example for Taichung: datacenter.taichung.gov.tw
    # Example for Kaohsiung: data.kcg.gov.tw
    # Note: This is a snapshot of current vehicle positions
    curl -s "{API_ENDPOINT_URL}" \
      > {city}-trash-collection-points.json

    # Display stats
    RECORD_COUNT=$(jq 'length' {city}-trash-collection-points.json)
    FILE_SIZE=$(du -h {city}-trash-collection-points.json | cut -f1)
    echo "Fetched $RECORD_COUNT {CITY} vehicle records"
    echo "File size: $FILE_SIZE"
```

### Update Change Detection

Add the new city to the change detection logic:

```yaml
- name: Check for changes
  id: check_changes
  run: |
    TAIPEI_CHANGED=false
    NTPC_CHANGED=false
    {CITY}_CHANGED=false

    # ... existing checks for Taipei and New Taipei ...

    if ! git diff --quiet {city}-trash-collection-points.json; then
      {CITY}_CHANGED=true
      echo "Changes detected in {CITY} data"
    fi

    if [ "$TAIPEI_CHANGED" = true ] || [ "$NTPC_CHANGED" = true ] || [ "${CITY}_CHANGED" = true ]; then
      echo "changed=true" >> $GITHUB_OUTPUT
      echo "{city}_changed=${CITY}_CHANGED" >> $GITHUB_OUTPUT
    else
      echo "changed=false" >> $GITHUB_OUTPUT
    fi
```

### Update Commit Logic

```yaml
- name: Commit and push if changed
  if: steps.check_changes.outputs.changed == 'true'
  run: |
    # ... existing commit setup ...

    if [ "${{ steps.check_changes.outputs.{city}_changed }}" = "true" ]; then
      {CITY}_RECORD_COUNT=$(jq 'length' {city}-trash-collection-points.json)
      COMMIT_LINES+=(\"- Updated {CITY} City data: ${CITY}_RECORD_COUNT vehicle records\")
      git add {city}-trash-collection-points.json
    fi

    # ... rest of commit logic ...
```

## 2. Add Data Trimming

### File: `.github/actions/trim-data.sh`

Add city-specific trimming logic to reduce file size (adjust fields based on your city's data structure):

```bash
echo ""
echo "Trimming {CITY} City data..."
cat public/{city}-trash-collection-points.json | jq '[.[] | {
  # Keep only essential fields needed for display
  # Adjust based on your city's data structure
  field1,
  field2,
  field3
}]' > public/{city}-trash-collection-points.tmp.json

# Get file sizes
ORIGINAL_SIZE=$(du -h public/{city}-trash-collection-points.json | cut -f1)
NEW_SIZE=$(du -h public/{city}-trash-collection-points.tmp.json | cut -f1)
RECORD_COUNT=$(jq 'length' public/{city}-trash-collection-points.tmp.json)

echo "{CITY} City:"
echo "  Original: $ORIGINAL_SIZE"
echo "  Trimmed: $NEW_SIZE"
echo "  Records: $RECORD_COUNT"

mv public/{city}-trash-collection-points.tmp.json public/{city}-trash-collection-points.json
```

**Example Fields to Keep (Taichung/Kaohsiung):**
- `lineid` / `route` - Route/line identifier
- `car` / `vehicle` - Vehicle plate number (for deduplication)
- `time` / `timestamp` - Timestamp
- `location` / `address` - Location name
- `X` / `longitude` - Longitude
- `Y` / `latitude` - Latitude

**Common Fields to Remove:**
- `SpeedValue` - Not needed for display
- `OverSpeed` - Not needed for display
- Internal IDs, metadata, etc.

## 3. Update dump-data Script

### File: `package.json`

Update the `dump-data` script to include the new city:

```json
{
  "scripts": {
    "dump-data": "git show data:trash-collection-points.json > public/trash-collection-points.json && git show data:new-taipei-trash-collection-points.json > public/new-taipei-trash-collection-points.json && git show data:{city}-trash-collection-points.json > public/{city}-trash-collection-points.json && echo 'Data dumped to public/'"
  }
}
```

## 4. Extract City Boundaries

Extract city boundaries for your new city from Taiwan.TopoJSON. The boundaries are needed for the city adapter:

**Example for Taichung** (`TaichungAdapter.ts`):

```typescript
readonly bounds = {
  north: 24.3647,
  south: 24.0097,
  east: 121.1427,
  west: 120.5608,
};
```

If you need to extract boundaries for a new city, follow the extraction process in `CLAUDE.md`.

## 5. Coordinate System & Data Processing

### TGOS Geocoding Coordinate Systems

**IMPORTANT**: When using TGOS API for geocoding (applies to both Taichung and Kaohsiung), the API supports multiple coordinate output formats:

#### Option 1: Request WGS84 Output Directly (Recommended)

When using TGOS geocoding API, you can specify **WGS84 (EPSG:4326)** as the output coordinate system. This is the **recommended approach** as it eliminates the need for coordinate conversion.

**How to Request WGS84:**
- When submitting geocoding requests to TGOS, set the output coordinate system parameter to WGS84/EPSG:4326
- The API will return coordinates directly in decimal degrees (longitude, latitude)
- Range: longitude ~120-122°, latitude ~21-26° (Taiwan region)

#### Option 2: Convert from TWD97/TM2 (EPSG:3826)

If you receive coordinates in **TWD97 TM2 (EPSG:3826)**, the `process-tgos-results.ts` script will automatically detect and convert them.

**TWD97/TM2 Coordinate System Details:**
- **EPSG:3826**: TWD97 Transverse Mercator 2 Zone
- **Central Meridian**: 121°E
- **Scale Factor**: 0.9999
- **False Easting**: 250,000 meters
- **False Northing**: 0 meters
- **Ellipsoid**: GRS80

**Example Coordinates:**
- TWD97/TM2: `X=217256.345, Y=2671067.671` (meters)
- WGS84: `longitude=120.681°, latitude=24.144°` (degrees)

**Automatic Detection:**
The processing script automatically detects the coordinate system:
- If X is ~120-122 and Y is ~21-26 → Already WGS84, no conversion
- If X is ~100k-400k and Y is ~2M-3M → TWD97/TM2, converts to WGS84

**Note**: This applies to **both Taichung and Kaohsiung** geocoding data.

### Handling Multiple TGOS Responses

TGOS may return **multiple answers** for a single address, separated by semicolons:

```csv
130,台中市中區大誠街9號,臺中市中區大誠里13鄰大誠街9號;臺中市中區大誠里15鄰大誠街9號,217256.345;217259.660,2671067.671;2671061.868
```

**Response Format:**
- `Response_Address`: Multiple addresses separated by `;`
- `Response_X`: Multiple X coordinates separated by `;`
- `Response_Y`: Multiple Y coordinates separated by `;`

**Processing Strategy**: Take **only the first answer** (most likely match)

### Processing TGOS Results

The `process-tgos-results.ts` script handles:

1. **CSV Parsing**: Handles semicolons in response fields
2. **Multiple Answers**: Extracts first answer only
3. **Coordinate Conversion**: Automatically detects and converts TWD97/TM2 → WGS84 if needed
4. **Validation**: Checks coordinates are within Taiwan bounds

**Usage:**
```bash
# For Taichung
bun scripts/process-tgos-results.ts data/taichung-tgos-batch-part1-finish.csv

# For Kaohsiung
bun scripts/process-tgos-results.ts data/kaohsiung-tgos-batch-part1-finish.csv
```

**Output:**
- `data/{city}-geocoded.json`: Geocoded addresses with WGS84 coordinates
- `data/{city}-geocode-lookup.json`: Address → coordinates lookup map
- `data/{city}-geocoding-failed.json`: Failed geocoding attempts (if any)

**Note:** The script works with both WGS84 and TWD97/TM2 input coordinates. It automatically detects the coordinate system based on the numeric range and converts only when necessary.

## 6. Initial Data Setup

To test the setup before the automated workflow runs (replace URLs and filenames with your city's):

```bash
# Fetch initial city data manually
# Example for Taichung:
curl -s "https://datacenter.taichung.gov.tw/swagger/OpenData/c923ad20-2ec6-43b9-b3ab-54527e99f7bc?limit=1000" \
  > {city}-trash-collection-points.json

# Check the data
jq 'length' {city}-trash-collection-points.json  # Check record count
jq '.[0]' {city}-trash-collection-points.json    # View first record

# Commit to data branch
git checkout data
git add {city}-trash-collection-points.json
git commit -m "feat: add initial {CITY} city data"
git push origin data
git checkout main
```

## 7. Verify Integration

After setup, verify everything works:

### Build Test
```bash
bun run dump-data
bun run build
```

### Runtime Test
```bash
bun run dev
```

**Checklist:**
- [ ] City appears in city dropdown
- [ ] Selecting city loads data
- [ ] Map centers on city when selected
- [ ] Markers appear on map
- [ ] No console errors

## 8. Data Characteristics Comparison

**Different cities may have different data formats:**

| Aspect | Taipei/New Taipei | Taichung/Kaohsiung |
|--------|-------------------|-------------------|
| Data Type | Scheduled collection points | Vehicle GPS snapshots or scheduled routes |
| Update Frequency | Routes change rarely | Positions change constantly |
| Record Count | 4K-27K per city | Varies (~100-1000+ records) |
| Time Format | HHMM or HH:MM | YYYYMMDDTHHMMSS or similar |
| Coordinates | 經度/緯度 or longitude/latitude | X/Y or longitude/latitude |
| Arrival/Departure | Explicit times | May be derived from timestamp |

## 9. Caveats & Considerations

### Data Freshness
- Real-time API data is a **snapshot** at fetch time
- Monthly updates mean positions may be outdated
- Consider this a "typical routes" view rather than real-time tracking

### Alternative: Real-Time Mode
If you want real-time data for a city:

1. Change `dataType` in the city adapter:
   ```typescript
   readonly dataType = 'realtime' as const;
   readonly dataUrl = 'https://api.example.com/endpoint';
   ```

2. Remove from GitHub Actions workflow (no pre-fetching needed)

3. Handle CORS if needed (may require proxy)

**Trade-offs:**
- ✅ Always current data
- ❌ Requires network calls
- ❌ May have rate limits
- ❌ Won't work offline (PWA)

## 10. Troubleshooting

### Issue: No records fetched
```bash
# Check API directly
curl -s "{API_URL}" | jq '.'

# Verify API is accessible
# If blocked, may need to add User-Agent header
curl -s -H "User-Agent: Mozilla/5.0" "{API_URL}" | jq '.'
```

### Issue: Data not loading in app
```bash
# Verify file exists after build
ls -lh dist/{city}-trash-collection-points.json

# Check browser console for fetch errors
# Open DevTools > Network tab when loading app
```

### Issue: Wrong coordinates
Verify coordinate format matches what your city adapter expects:

```bash
# Check sample record
jq '.[0]' {city}-trash-collection-points.json
```

Expected WGS84 ranges:
- Longitude: ~120-122° (Taiwan west-east)
- Latitude: ~21-26° (Taiwan south-north)

## 11. Next Steps

After a new city is integrated:

1. **Monitor first automated run** (1st of next month)
2. **Verify data quality** in production
3. **Consider adding more cities** using the same pattern
4. **Optimize**: May want to deduplicate vehicles/points if data has duplicates

## Resources

- [Taichung Open Data Portal](https://datacenter.taichung.gov.tw/)
- [Kaohsiung Open Data Portal](https://data.kcg.gov.tw/)
- [TGOS Map Service](https://www.tgos.tw/)

---

**Last Updated**: 2025-10-27
**Status**: Generic guide for adding Taichung, Kaohsiung, or other cities
