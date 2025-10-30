# Scripts Documentation

This directory contains utility scripts for data processing, geocoding, and build tasks.

## Data Management Scripts

### `dump-data.sh`
**Purpose:** Extract data files from the `data` branch to `public/` folder before build.

**Usage:**
```bash
bun run dump-data
# or
bash scripts/dump-data.sh
```

**What it does:**
- Extracts `trash-collection-points.json` (Taipei)
- Extracts `new-taipei-trash-collection-points.json` (New Taipei)
- Extracts `taichung-trash-collection-points.json` (Taichung)
- Shows record counts and file sizes

**When to use:**
- Before building the app (`bun run build`)
- When you want to update local data from the `data` branch

---

## Geocoding Scripts (Taichung/Kaohsiung)

### `prepare-tgos-batch.ts`
**Purpose:** Generate TGOS batch geocoding CSV from Taichung trash collection API.

**Usage:**
```bash
bun scripts/prepare-tgos-batch.ts
```

**What it does:**
1. Fetches schedule data from Taichung API
2. Extracts unique addresses
3. Cleans addresses (removes parentheses)
4. Generates CSV template for TGOS batch geocoding
5. Saves metadata to `data/taichung-address-metadata.json`

**Output:**
- `data/taichung-tgos-batch.csv` - Ready for TGOS upload
- `data/taichung-address-metadata.json` - Address metadata

---

### `prepare-kaohsiung-batch.ts`
**Purpose:** Generate TGOS batch geocoding CSV from Kaohsiung trash collection API.

**Usage:**
```bash
bun scripts/prepare-kaohsiung-batch.ts
```

**Similar to `prepare-tgos-batch.ts` but for Kaohsiung City.**

---

### `split-tgos-batches.ts`
**Purpose:** Split large TGOS batch CSV into smaller parts (TGOS limit: 10,000 rows).

**Usage:**
```bash
bun scripts/split-tgos-batches.ts
```

**What it does:**
- Reads `data/taichung-tgos-batch.csv`
- Splits into parts of 10,000 rows each
- Generates manifest file

**Output:**
- `data/taichung-tgos-batch-part1.csv`
- `data/taichung-tgos-batch-part2.csv`
- etc.

---

### `merge-tgos-results.ts`
**Purpose:** Merge multiple TGOS batch result files into one.

**Usage:**
```bash
bun scripts/merge-tgos-results.ts <part1.csv> <part2.csv> ...
```

**Example:**
```bash
bun scripts/merge-tgos-results.ts \
  data/taichung-tgos-batch-part1-finish.csv \
  data/taichung-tgos-batch-part2-finish.csv
```

**What it does:**
- Combines multiple CSV result files
- Sorts by ID
- Checks for duplicates
- Generates statistics

**Output:**
- `data/taichung-tgos-merged-results.csv`

---

### `process-tgos-results.ts`
**Purpose:** Process TGOS batch results into geocoded JSON format.

**Usage:**
```bash
bun scripts/process-tgos-results.ts <tgos-results.csv>
```

**Example:**
```bash
bun scripts/process-tgos-results.ts data/taichung-tgos-merged-results.csv
```

**What it does:**
1. Parses CSV with semicolon-separated multiple answers
2. Extracts first answer only
3. Auto-detects coordinate system (WGS84 vs TWD97/TM2)
4. Converts TWD97/TM2 → WGS84 if needed
5. Validates coordinates are within Taiwan bounds

**Output:**
- `data/taichung-geocoded.json` - All geocoded addresses
- `data/taichung-geocode-lookup.json` - Address → coordinates map
- `data/taichung-geocoding-failed.json` - Failed addresses

---

### `merge-taichung-data.ts`
**Purpose:** Merge Taichung schedule data with geocoded coordinates.

**Usage:**
```bash
bun scripts/merge-taichung-data.ts
```

**What it does:**
1. Fetches full schedule from Taichung API
2. Loads geocoded coordinates
3. Merges schedule with coordinates using address as key
4. Expands into daily collection points (day 1-7 × garbage/recycling)

**Output:**
- `data/taichung-trash-collection-points.json` - Final merged data

**Requirements:**
- `data/taichung-geocode-lookup.json` must exist

---

### `trim-taichung-data.ts`
**Purpose:** Trim Taichung data for production (reduce file size).

**Usage:**
```bash
bun scripts/trim-taichung-data.ts
```

**What it does:**
- Removes unused fields
- Rounds coordinates to 6 decimal places
- Shortens field names

**Note:** Currently unused - trimming is done by `.github/actions/trim-data.sh` during build.

---

## Automation Scripts

### `triage-city-request.ts`
**Purpose:** Automated GitHub issue triage using GitHub Models (OpenAI API) with function calling.

**Usage:**
This script is automatically run by the GitHub Action `.github/workflows/triage-city-request.yml` when an issue is created or reopened with city request keywords.

**What it does:**
1. Analyzes issue using GPT-4o via GitHub Models
2. Extracts requested city name
3. Checks if city is already supported
4. Detects duplicate requests
5. Adds appropriate labels
6. Posts friendly comment in Traditional Chinese
7. Closes issue if duplicate or already supported

**Environment Variables:**
- `GITHUB_TOKEN` - Authentication (auto-provided by Actions)
- `GITHUB_REPOSITORY` - Repository name (e.g., `yukaii/garbage`)
- `ISSUE_NUMBER` - Issue number to process
- `ISSUE_TITLE` - Issue title
- `ISSUE_BODY` - Issue body content

**Manual Execution:**
```bash
GITHUB_TOKEN=your_token \
GITHUB_REPOSITORY=yukaii/garbage \
ISSUE_NUMBER=123 \
ISSUE_TITLE="請求支援新城市" \
ISSUE_BODY="希望支援的城市：桃園市" \
bun scripts/triage-city-request.ts
```

**Documentation:** See [docs/ISSUE_TRIAGE.md](../docs/ISSUE_TRIAGE.md) for detailed information.

---

### `setup-labels.sh`
**Purpose:** Create necessary labels in the repository for issue triage.

**Usage:**
```bash
GITHUB_TOKEN=your_token ./scripts/setup-labels.sh
```

**Labels Created:**
- `已支援` (green) - City already supported
- `待評估` (yellow) - Needs evaluation
- `城市請求` (blue) - City request

---

## GitHub Actions Build Scripts

### `.github/actions/trim-data.sh`
**Purpose:** Trim data files to reduce bundle size during CI/CD build.

**Usage:**
```bash
bash .github/actions/trim-data.sh
```

**What it does:**
- Trims Taipei data (removes unused fields)
- Trims New Taipei data (removes day/recycling columns)
- Trims Taichung data (removes 'type' field)
- Shows before/after sizes

**When it runs:**
- Automatically during `vite build` (if configured)
- Manually for testing

---

## Workflow: Adding a New City

### 1. Fetch and prepare addresses
```bash
bun scripts/prepare-tgos-batch.ts
```

### 2. Split into batches (if > 10,000 addresses)
```bash
bun scripts/split-tgos-batches.ts
```

### 3. Upload to TGOS for geocoding
- Upload each `*-part*.csv` to https://www.tgos.tw/
- Download results as `*-part*-finish.csv`

### 4. Merge geocoding results
```bash
bun scripts/merge-tgos-results.ts \
  data/city-tgos-batch-part1-finish.csv \
  data/city-tgos-batch-part2-finish.csv
```

### 5. Process geocoded results
```bash
bun scripts/process-tgos-results.ts data/city-tgos-merged-results.csv
```

### 6. Merge with schedule data
```bash
bun scripts/merge-city-data.ts  # Create this for new city
```

### 7. Commit to data branch
```bash
git checkout data
git add city-trash-collection-points.json
git commit -m "feat: add City data"
git push origin data
git checkout main
```

### 8. Update code
- Create `CityAdapter.ts`
- Update `cityRegistry.ts`
- Update `dump-data.sh`
- Update `trim-data.sh`

---

## Data Branch Structure

The `data` branch is an **orphan branch** storing only large JSON data files:

```
data/
├── trash-collection-points.json              # Taipei (2.3M)
├── new-taipei-trash-collection-points.json   # New Taipei (22M)
└── taichung-trash-collection-points.json     # Taichung (52M)
```

**Why orphan branch?**
- Keeps data separate from code history
- Prevents large files from bloating main branch
- Easier to manage large binary/JSON files

---

## File Size Reference

| City | Raw Size | Trimmed Size | Record Count |
|------|----------|--------------|--------------|
| Taipei | 3.1M | 1.2M | 4,031 |
| New Taipei | 23M | 6.6M | 26,822 |
| Taichung | 52M | 49M | 170,189 |

---

## Common Issues

### "data branch does not exist"
```bash
# Create data branch
git checkout --orphan data
git rm -rf .
# Add data files
git commit -m "Initial data"
git push origin data
git checkout main
```

### "jq: command not found"
```bash
# macOS
brew install jq

# Ubuntu/Debian
sudo apt-get install jq
```

### TGOS coordinate conversion fails
- Check if coordinates are already WGS84 (120-122°, 21-26°)
- If TWD97/TM2, script auto-converts
- Verify Taiwan bounds validation

---

**Last Updated:** 2025-10-28
