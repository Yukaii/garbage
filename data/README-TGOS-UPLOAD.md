# TGOS Batch Upload Guide for Kaohsiung

## Generated Batch Files

All batch files have been automatically cleaned and are ready for TGOS upload:

- ✅ `data/kaohsiung-tgos-batch-part1.csv` - 10,000 addresses
- ✅ `data/kaohsiung-tgos-batch-part2.csv` - 2,265 addresses

**Total**: 12,265 addresses

## What Was Done

The `split-kaohsiung-batches.ts` script automatically:
1. Splits the main batch into chunks of 10,000 (TGOS daily limit)
2. Cleans addresses by replacing commas (`,`) with ideographic commas (`、`)
3. Generates a manifest file for tracking

## Upload Schedule

```
Day 1: Upload kaohsiung-tgos-batch-part1.csv (10,000 addresses)
Day 2: Upload kaohsiung-tgos-batch-part2.csv (2,265 addresses)
```

## Processing Results

After TGOS completes geocoding and you download the results:

```bash
# Step 1: Merge all batch results
bun scripts/merge-tgos-results.ts \
  data/kaohsiung-tgos-batch-part1-finish.csv \
  data/kaohsiung-tgos-batch-part2-finish.csv

# Output: data/kaohsiung-tgos-merged-results.csv

# Step 2: Process merged results (automatic normalization)
bun scripts/process-tgos-results.ts data/kaohsiung-tgos-merged-results.csv

# Output: 
# - data/kaohsiung-geocoded.json
# - data/kaohsiung-geocode-lookup.json
# - data/kaohsiung-geocoding-failed.json (if any failures)
```

The processing scripts will automatically:
- Convert `、` back to `,` in addresses
- Match with original metadata
- Handle coordinate conversion (TWD97/TM2 → WGS84)

## Regenerating Batch Files

If you need to regenerate the batch files (e.g., if source data changes):

```bash
bun scripts/split-kaohsiung-batches.ts
```

This will automatically:
- Read `data/kaohsiung-tgos-batch.csv`
- Clean addresses with commas
- Split into parts
- Create manifest

## Cleaning Details

**Addresses Modified**: 5 out of 12,265 (0.04%)

The script replaces commas in addresses like:
- `福美路69,71號` → `福美路69、71號`
- `福美路73巷7,8號` → `福美路73巷7、8號`

This prevents TGOS CSV parser errors while maintaining semantic correctness (ideographic comma is proper Chinese punctuation for lists).

## Files Overview

```
data/
├── kaohsiung-tgos-batch.csv              # Original full batch (source)
├── kaohsiung-tgos-batch-part1.csv        # Ready for upload (Day 1)
├── kaohsiung-tgos-batch-part2.csv        # Ready for upload (Day 2)
├── kaohsiung-tgos-batches-manifest.json  # Tracking manifest
└── kaohsiung-address-metadata.json       # Original addresses with metadata
```

## Notes

- ✅ All batch files are validated and ready for TGOS upload
- ✅ Processing scripts handle automatic normalization
- ✅ No manual intervention needed for address conversion
- 📋 TGOS daily limit: 10,000 records per upload

---
**Generated**: 2025-10-29  
**Script**: `scripts/split-kaohsiung-batches.ts`
