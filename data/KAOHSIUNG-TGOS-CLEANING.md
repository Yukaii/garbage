# Kaohsiung TGOS Batch Cleaning Report

**Date**: 2025-10-29  
**Issue**: TGOS batch upload tool rejects CSV files with commas inside quoted address fields

## Problem

The TGOS geocoding batch upload tool reported:
```
門牌檔內容不正確：欄位數量不正確，請檢查：第2540行必須是5個欄位。
```

Line 2540 contained: `2539,"高雄市美濃區福美路69,71號",,,""`

While this is valid CSV (the comma is inside quotes), TGOS's parser doesn't properly handle quoted fields containing commas.

## Solution

Created a cleaned version of the CSV file that replaces commas (`,`) within address fields with the ideographic comma (`、`), which is the proper Chinese punctuation for listing items.

### Files

- **Original**: `data/kaohsiung-tgos-batch-part1.csv`
- **Cleaned**: `data/kaohsiung-tgos-batch-part1-cleaned.csv` ✅ Ready for TGOS upload

### Changes Made

Only 5 addresses were modified (0.05% of 10,000 total):

| Line | Original Address | Cleaned Address |
|------|------------------|----------------|
| 2540 | 高雄市美濃區福美路69,71號 | 高雄市美濃區福美路69、71號 |
| 2544 | 高雄市美濃區福美路73巷7,8號 | 高雄市美濃區福美路73巷7、8號 |
| 2932 | 高雄市美濃區龜山街7,8號 迴轉 | 高雄市美濃區龜山街7、8號 迴轉 |
| 3001 | 高雄市美濃區中興路一段51,53號 | 高雄市美濃區中興路一段51、53號 |
| 8828 | 高雄市小港區鋼成街14,16號前 | 高雄市小港區鋼成街14、16號前 |

## Automatic Normalization

The TGOS processing scripts have been updated to automatically convert `、` back to `,` when processing results:

### Updated Scripts

1. **`scripts/process-tgos-results.ts`**
   - Added `normalizeAddress()` function
   - Automatically converts `、` → `,` when parsing TGOS results
   - Auto-detects city (Taichung/Kaohsiung) from filename
   - Outputs to `data/{city}-geocoded.json` and `data/{city}-geocode-lookup.json`

2. **`scripts/merge-tgos-results.ts`**
   - Added `normalizeAddress()` function
   - Normalizes addresses during merge process
   - Auto-detects city from filename
   - Outputs to `data/{city}-tgos-merged-results.csv`

### Usage

```bash
# Upload the cleaned file to TGOS
# (Use kaohsiung-tgos-batch-part1-cleaned.csv)

# After downloading TGOS results, merge multiple batches
bun scripts/merge-tgos-results.ts \
  data/kaohsiung-tgos-batch-part1-finish.csv \
  data/kaohsiung-tgos-batch-part2-finish.csv

# Process merged results (automatic normalization)
bun scripts/process-tgos-results.ts data/kaohsiung-tgos-merged-results.csv
```

The scripts will automatically:
1. Detect this is Kaohsiung data (from filename)
2. Convert `、` back to `,` in addresses
3. Match with original metadata in `kaohsiung-address-metadata.json`
4. Output geocoded coordinates

## Verification

```bash
# Verify no commas in cleaned file
bun -e "
const text = await Bun.file('data/kaohsiung-tgos-batch-part1-cleaned.csv').text();
const lines = text.split('\n').filter(l => l.trim());
let count = 0;
for (let i = 1; i < lines.length; i++) {
  const match = lines[i].match(/^\d+,\"([^\"]+)\"/);
  if (match && match[1].includes(',')) count++;
}
console.log('Addresses with commas:', count);
console.log(count === 0 ? '✓ Ready for upload' : '✗ Still has issues');
"
# Output: Addresses with commas: 0
#         ✓ Ready for upload
```

## Notes

- The ideographic comma (`、`) is semantically correct for Chinese addresses listing multiple numbers
- Example: "69、71號" means "numbers 69 and 71"
- This is preferable to "69-71號" (which implies a range) or "69,71號" (which uses English punctuation)
- The normalization is lossless - we can always convert back

## References

- Original issue: Line 2540 rejection by TGOS upload tool
- Documentation: `docs/adding-new-city-data.md` (Section 5: Coordinate System & Data Processing)
