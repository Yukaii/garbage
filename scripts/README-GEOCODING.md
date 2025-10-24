# Taichung Address Geocoding Guide

This guide explains how to geocode Taichung trash collection addresses using the TGOS batch geocoding service.

## Overview

The Taichung open data API provides trash collection points with addresses but no lat/lng coordinates. We use Taiwan's TGOS (Taiwan Geospatial One Stop) batch geocoding service to convert addresses to coordinates.

## Statistics

- **Total records**: 20,158
- **Unique addresses**: 19,671 (after cleaning)
- **Cleaned addresses**: 1,315 (parentheses removed)
- **Filtered out**: 193 (intersection-only addresses)
- **Batches needed**: 2 (TGOS daily limit: 10,000)
- **Estimated cost**: FREE (TGOS is a government service)

## Step-by-Step Process

### Step 1: Generate TGOS Batch CSV

```bash
bun scripts/prepare-tgos-batch.ts
```

This generates:
- `data/taichung-tgos-batch.csv` - Full CSV file (19,671 addresses)
- `data/taichung-address-metadata.json` - Metadata with original addresses

**Address Cleaning Applied:**
- Removes parentheses: `崇德路一段645巷14號(路口)` → `崇德路一段645巷14號`
- Filters intersection-only addresses without house numbers
- Tracks both original and cleaned addresses

### Step 2: Split into Batches (TGOS Daily Limit: 10,000)

```bash
bun scripts/split-tgos-batches.ts
```

This generates:
- `data/taichung-tgos-batch-part1.csv` - Batch 1 (10,000 addresses, IDs 1-10000)
- `data/taichung-tgos-batch-part2.csv` - Batch 2 (9,671 addresses, IDs 10001-19671)
- `data/taichung-tgos-batches-manifest.json` - Batch metadata

### Step 3: Upload to TGOS (2 Days Required)

**Day 1:**
1. Go to TGOS batch geocoding service: https://www.tgos.tw/
2. Register/login to the service
3. Navigate to batch geocoding tool
4. Upload `data/taichung-tgos-batch-part1.csv`
5. Submit the batch job
6. Wait for processing and download results → save as `tgos-results-batch1.csv`

**Day 2:**
1. Upload `data/taichung-tgos-batch-part2.csv`
2. Submit the batch job
3. Wait for processing and download results → save as `tgos-results-batch2.csv`

### Step 4: Merge TGOS Results

```bash
bun scripts/merge-tgos-results.ts tgos-results-batch1.csv tgos-results-batch2.csv
```

This generates:
- `data/taichung-tgos-merged-results.csv` - Single merged CSV with all results

### Step 5: Process TGOS Results

```bash
bun scripts/process-tgos-results.ts data/taichung-tgos-merged-results.csv
```

This generates:
- `data/taichung-geocoded.json` - Full geocoded data with metadata
- `data/taichung-geocode-lookup.json` - Address → coordinates lookup map
- `data/taichung-geocoding-failed.json` - Failed addresses with reasons (if any)

### Step 6: Integrate into Application

The geocoded data will be used by `src/api.ts` to add coordinates to Taichung trash collection points.

## CSV Format

### Input Format (for TGOS)
```csv
id,Address,Response_Address,Response_X,Response_Y
1,"台中市中區中山路321號",,,""
2,"台中市中區中華路一段143號",,,""
```

**Note**: Parentheses are automatically removed during preparation.

### Output Format (from TGOS)
```csv
id,Address,Response_Address,Response_X,Response_Y
1,"台中市中區中山路321號","台中市中區中山路321號",120.67890,24.14567
2,"台中市中區中華路一段143號","台中市中區中華路一段143號",120.67123,24.14234
```

## Coordinate Systems

- **TGOS Input**: Taiwan addresses (Chinese)
- **TGOS Output**: May be TWD97 (EPSG:3826) or WGS84 (EPSG:4326)
- **Application**: WGS84 (standard lat/lng for web maps)

The processing script automatically handles coordinate system detection and conversion if needed.

## Troubleshooting

### Missing Coordinates

If some addresses fail to geocode:
- Check the `Response_Address` field to see TGOS interpretation
- Addresses with landmarks in parentheses (e.g., "(路口)") may need manual cleanup
- Consider using Google Maps Geocoding API as fallback for failed addresses

### Coordinate System Issues

If map points appear in wrong locations:
- Check if coordinates are in TWD97 vs WGS84
- TWD97: X > 200000, Y > 2000000
- WGS84: longitude 120-122, latitude 23-26

## Next Steps

After geocoding is complete:
1. Commit `data/taichung-geocode-lookup.json` to git
2. Update `src/api.ts` to load and use geocoded coordinates
3. Enable Taichung in the city selector
4. Test the map with Taichung data

## References

- TGOS: https://www.tgos.tw/
- Taichung Open Data: https://datacenter.taichung.gov.tw/
- TWD97 to WGS84 conversion: https://github.com/pyproj4/pyproj
