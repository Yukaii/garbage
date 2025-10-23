# Adding Taichung City Data Support

This guide explains how to add Taichung City (台中市) trash collection data to the monthly update workflow.

## Overview

Taichung data comes from a **different source** than Taipei/New Taipei:
- **API**: datacenter.taichung.gov.tw
- **Data Type**: Vehicle GPS positions (not scheduled collection points)
- **Update Strategy**: Snapshot vehicle positions monthly

## 1. Update GitHub Actions Workflow

### File: `.github/workflows/update-data.yml`

Add Taichung data fetching after the existing city steps:

```yaml
- name: Fetch latest data from Taichung City API
  run: |
    echo "Fetching Taichung City trash vehicle data..."

    # Taichung API endpoint - fetch vehicle positions
    # Note: This is a snapshot of current vehicle positions
    curl -s "https://datacenter.taichung.gov.tw/swagger/OpenData/c923ad20-2ec6-43b9-b3ab-54527e99f7bc?limit=1000" \
      > taichung-trash-collection-points.json

    # Display stats
    RECORD_COUNT=$(jq 'length' taichung-trash-collection-points.json)
    FILE_SIZE=$(du -h taichung-trash-collection-points.json | cut -f1)
    echo "Fetched $RECORD_COUNT Taichung vehicle records"
    echo "File size: $FILE_SIZE"
```

### Update Change Detection

Add Taichung to the change detection logic:

```yaml
- name: Check for changes
  id: check_changes
  run: |
    TAIPEI_CHANGED=false
    NTPC_CHANGED=false
    TAICHUNG_CHANGED=false

    # ... existing checks for Taipei and New Taipei ...

    if ! git diff --quiet taichung-trash-collection-points.json; then
      TAICHUNG_CHANGED=true
      echo "Changes detected in Taichung data"
    fi

    if [ "$TAIPEI_CHANGED" = true ] || [ "$NTPC_CHANGED" = true ] || [ "$TAICHUNG_CHANGED" = true ]; then
      echo "changed=true" >> $GITHUB_OUTPUT
      echo "taichung_changed=$TAICHUNG_CHANGED" >> $GITHUB_OUTPUT
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

    if [ "${{ steps.check_changes.outputs.taichung_changed }}" = "true" ]; then
      TAICHUNG_RECORD_COUNT=$(jq 'length' taichung-trash-collection-points.json)
      COMMIT_LINES+=(\"- Updated Taichung City data: $TAICHUNG_RECORD_COUNT vehicle records\")
      git add taichung-trash-collection-points.json
    fi

    # ... rest of commit logic ...
```

## 2. Add Data Trimming

### File: `.github/actions/trim-data.sh`

Add Taichung-specific trimming logic:

```bash
echo ""
echo "Trimming Taichung City data..."
cat public/taichung-trash-collection-points.json | jq '[.[] | {
  lineid,
  car,
  time,
  location,
  X,
  Y
}]' > public/taichung-trash-collection-points.tmp.json

# Get file sizes
ORIGINAL_SIZE=$(du -h public/taichung-trash-collection-points.json | cut -f1)
NEW_SIZE=$(du -h public/taichung-trash-collection-points.tmp.json | cut -f1)
RECORD_COUNT=$(jq 'length' public/taichung-trash-collection-points.tmp.json)

echo "Taichung City:"
echo "  Original: $ORIGINAL_SIZE"
echo "  Trimmed: $NEW_SIZE"
echo "  Records: $RECORD_COUNT"

mv public/taichung-trash-collection-points.tmp.json public/taichung-trash-collection-points.json
```

**Fields to Keep:**
- `lineid` - Route/line identifier
- `car` - Vehicle plate number (for deduplication)
- `time` - Timestamp (YYYYMMDDTHHMMSS)
- `location` - Location name
- `X` - Longitude
- `Y` - Latitude

**Fields to Remove:**
- `SpeedValue` - Not needed for display
- `OverSpeed` - Not needed for display

## 3. Update dump-data Script

### File: `package.json`

Update the `dump-data` script to include Taichung:

```json
{
  "scripts": {
    "dump-data": "git show data:trash-collection-points.json > public/trash-collection-points.json && git show data:new-taipei-trash-collection-points.json > public/new-taipei-trash-collection-points.json && git show data:taichung-trash-collection-points.json > public/taichung-trash-collection-points.json && echo 'Data dumped to public/'"
  }
}
```

## 4. Extract City Boundaries (Already Done)

The Taichung boundaries are already set in `TaichungAdapter.ts`:

```typescript
readonly bounds = {
  north: 24.3647,
  south: 24.0097,
  east: 121.1427,
  west: 120.5608,
};
```

If you need to update these, follow the extraction process in `CLAUDE.md`.

## 5. Initial Data Setup

To test the setup before the automated workflow runs:

```bash
# Fetch initial Taichung data manually
curl -s "https://datacenter.taichung.gov.tw/swagger/OpenData/c923ad20-2ec6-43b9-b3ab-54527e99f7bc?limit=1000" \
  > taichung-trash-collection-points.json

# Check the data
jq 'length' taichung-trash-collection-points.json  # Should show ~100-200 records
jq '.[0]' taichung-trash-collection-points.json    # View first record

# Commit to data branch
git checkout data
git add taichung-trash-collection-points.json
git commit -m "feat: add initial Taichung city data"
git push origin data
git checkout main
```

## 6. Verify Integration

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
- [ ] Taichung appears in city dropdown
- [ ] Selecting Taichung loads data
- [ ] Map centers on Taichung when selected
- [ ] Vehicle markers appear on map
- [ ] No console errors

## 7. Data Characteristics

**Taichung vs Taipei/New Taipei:**

| Aspect | Taipei/New Taipei | Taichung |
|--------|-------------------|----------|
| Data Type | Scheduled collection points | Vehicle GPS snapshots |
| Update Frequency | Routes change rarely | Positions change constantly |
| Record Count | 4K-27K per city | ~100-200 vehicles |
| Time Format | HHMM or HH:MM | YYYYMMDDTHHMMSS |
| Coordinates | 經度/緯度 or longitude/latitude | X/Y |
| Arrival/Departure | Explicit times | Derived from timestamp |

## 8. Caveats & Considerations

### Data Freshness
- Taichung data is a **snapshot** of vehicle positions at fetch time
- Monthly updates mean positions may be outdated
- Consider this a "typical routes" view rather than real-time tracking

### Alternative: Real-Time Mode
If you want real-time Taichung data:

1. Change `dataType` in `TaichungAdapter.ts`:
   ```typescript
   readonly dataType = 'realtime' as const;
   readonly dataUrl = 'https://datacenter.taichung.gov.tw/swagger/OpenData/c923ad20-2ec6-43b9-b3ab-54527e99f7bc?limit=1000';
   ```

2. Remove from GitHub Actions workflow (no pre-fetching needed)

3. Handle CORS if needed (may require proxy)

**Trade-offs:**
- ✅ Always current data
- ❌ Requires network calls
- ❌ May have rate limits
- ❌ Won't work offline (PWA)

## 9. Troubleshooting

### Issue: No records fetched
```bash
# Check API directly
curl -s "https://datacenter.taichung.gov.tw/swagger/OpenData/c923ad20-2ec6-43b9-b3ab-54527e99f7bc?limit=1000" | jq '.'

# Verify API is accessible
# If blocked, may need to add User-Agent header
curl -s -H "User-Agent: Mozilla/5.0" "..." | jq '.'
```

### Issue: Data not loading in app
```bash
# Verify file exists after build
ls -lh dist/taichung-trash-collection-points.json

# Check browser console for fetch errors
# Open DevTools > Network tab when loading app
```

### Issue: Wrong coordinates
Taichung uses `X` (longitude) and `Y` (latitude), which are correctly mapped in the adapter. If coordinates seem wrong, verify:

```bash
# Check sample record
jq '.[0] | {X, Y, location}' taichung-trash-collection-points.json
```

Expected format:
- X: ~120.5 to 121.2 (longitude)
- Y: ~24.0 to 24.4 (latitude)

## 10. Next Steps

After Taichung is integrated:

1. **Monitor first automated run** (1st of next month)
2. **Verify data quality** in production
3. **Consider adding more cities** using the same pattern
4. **Optimize**: May want to deduplicate vehicles if data has duplicates

## Resources

- [Taichung Open Data Portal](https://datacenter.taichung.gov.tw/)
- [API Documentation](https://datacenter.taichung.gov.tw/swagger/)
- [Dataset: Trash Vehicle Tracking](https://datacenter.taichung.gov.tw/swagger/OpenData/c923ad20-2ec6-43b9-b3ab-54527e99f7bc)

---

**Last Updated**: 2025-10-23
**Status**: Ready for implementation
