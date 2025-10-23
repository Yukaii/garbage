# Data Fetching Mechanism Documentation

## Architecture Overview

The application uses a **dual-branch strategy** with automated workflows to separate data from code:

1. **`main` branch**: Application code
2. **`data` branch**: JSON data files (orphan branch with no shared history)

This architecture keeps the main branch lightweight and allows data to be updated independently from code changes.

---

## 1. Data Update Workflow (Monthly Automation)

**File**: `.github/workflows/update-data.yml`

**Schedule**: 1st day of every month at 2:00 AM UTC (10:00 AM Taipei Time)

**Manual Trigger**: Available via GitHub Actions UI

### Process Flow

#### Taipei City Data Fetching

- **Source**: `data.taipei` Open Data API
- **Endpoint**: `https://data.taipei/api/v1/dataset/a6e90031-7ec4-4089-afb5-361a4efe7202`
- **Method**: Batched requests (API limit: 1000 records per request)
- **Batches**: 5 requests with offsets (0, 1000, 2000, 3000, 4000)
- **Merge Strategy**: Uses `jq -s` to combine all batches into single JSON file
- **Current Size**: ~4,031 records

```bash
# Example of batching
curl -s "...?limit=1000&offset=0" > temp1.json
curl -s "...?limit=1000&offset=1000" > temp2.json
# ... (3 more batches)

# Merge with jq
jq -s '{result: {results: (.[0].result.results + .[1].result.results + ...)}}' \
  temp1.json temp2.json ... > trash-collection-points.json
```

#### New Taipei City Data Fetching

- **Source**: `data.ntpc.gov.tw` Open Data API
- **Endpoint**: `https://data.ntpc.gov.tw/api/datasets/edc3ad26-8ae7-4916-a00b-bc6048d19bf8/json`
- **Method**: Paginated requests (page size: 10,000)
- **Pages**: 3 pages (page 0, 1, 2)
- **Merge Strategy**: Uses `jq -s 'add'` to concatenate arrays
- **Current Size**: ~26,822 records across 29 districts

```bash
# Example of pagination
curl -s "...?page=0&size=10000" > ntpc-page0.json
curl -s "...?page=1&size=10000" > ntpc-page1.json
curl -s "...?page=2&size=10000" > ntpc-page2.json

# Merge arrays
jq -s 'add' ntpc-page0.json ntpc-page1.json ntpc-page2.json > new-taipei-trash-collection-points.json
```

### Output Files (stored in `data` branch)

- `trash-collection-points.json` - Taipei City data
- `new-taipei-trash-collection-points.json` - New Taipei City data

### Smart Commit Logic

The workflow only commits if changes are detected:

```bash
if ! git diff --quiet trash-collection-points.json; then
  # Changes detected, prepare commit
fi
```

**Commit Message Format**:
```
Monthly data update: 2025-10-23

- Updated Taipei City data: 4,031 records
- Data import date: 2025-10-09 15:16:09
- Updated New Taipei City data: 26,822 records across 29 districts

- Automated update via GitHub Actions

🤖 Automated update
```

---

## 2. Build & Deploy Workflow

**File**: `.github/workflows/deploy.yml`

**Triggers**:
- Push to `main` branch
- 2nd day of every month at 3:00 AM UTC (11:00 AM Taipei Time)
- Manual trigger

**Why 2nd day?**: Ensures data is updated on the 1st, then deployment happens on the 2nd with fresh data.

### Build Process Steps

#### 1. Checkout & Setup
```yaml
- Checkout main branch
- Setup Bun (latest version)
- Install dependencies: bun install
```

#### 2. Dump Data from `data` Branch
```bash
git fetch origin data:data
bun run dump-data
```

The `dump-data` script (from `package.json:10`):
```bash
git show data:trash-collection-points.json > public/trash-collection-points.json && \
git show data:new-taipei-trash-collection-points.json > public/new-taipei-trash-collection-points.json && \
echo 'Data dumped to public/'
```

**What this does**:
- Fetches JSON files from `data` branch without switching branches
- Copies them directly into `public/` directory
- Files in `public/` are included in Vite build

#### 3. Trim Data Files
```bash
./.github/actions/trim-data.sh
```

See section 3 below for details.

#### 4. Build Application
```bash
bun run build
```

- Vite bundles the application
- JSON files in `public/` are copied to `dist/`
- Environment variables injected (AdSense IDs)

#### 5. Deploy to GitHub Pages
- Upload `dist/` artifact
- Deploy using `actions/deploy-pages@v4`

---

## 3. JSON Trimming Process

**File**: `.github/actions/trim-data.sh`

**Purpose**: Reduce file size by removing unused fields before build

### Why Trim?

- Original API responses contain many fields not used by the app
- Trimming reduces bundle size by 30-40%
- Faster downloads for users
- Reduces PWA cache size

### Taipei City Trimming

**Original Fields** (from API response):
```json
{
  "_id": 1,
  "_importdate": {
    "date": "2025-10-09 15:16:09.244322",
    "timezone_type": 3,
    "timezone": "Asia/Taipei"
  },
  "行政區": "中山區",
  "里別": "力行里",
  "分隊": "長安分隊",        // ❌ Not used
  "局編": "100-021",        // ❌ Not used
  "車號": "119-BQ",         // ❌ Not used
  "路線": "長安-3",
  "車次": "...",           // ❌ Not used
  "抵達時間": "1830",
  "離開時間": "1840",
  "地點": "民族東路226巷17號前",
  "經度": "121.534722",
  "緯度": "25.062500"
}
```

**Kept Fields** (used by app - see `src/types.ts:2-21`):
```typescript
{
  _id: number;
  行政區: string;  // District
  里別: string;    // Village
  地點: string;    // Location
  路線: string;    // Route
  抵達時間: string; // Arrival Time
  離開時間: string; // Departure Time
  經度: string;    // Longitude
  緯度: string;    // Latitude
}
```

**Trimming Command**:
```bash
cat public/trash-collection-points.json | jq '{
  result: {
    count: .result.count,
    limit: .result.limit,
    offset: .result.offset,
    sort: .result.sort,
    results: [.result.results[] | {
      _id: ._id,
      "行政區": .["行政區"],
      "里別": .["里別"],
      "地點": .["地點"],
      "路線": .["路線"],
      "抵達時間": .["抵達時間"],
      "離開時間": .["離開時間"],
      "經度": .["經度"],
      "緯度": .["緯度"]
    }]
  }
}' > public/trash-collection-points.tmp.json

mv public/trash-collection-points.tmp.json public/trash-collection-points.json
```

### New Taipei City Trimming

**Original Fields** (from API response):
```json
{
  "city": "萬里區",
  "lineid": "207001",
  "linename": "A路線下午",
  "rank": "1",
  "name": "獅頭路15-1號(海巡)",
  "village": "萬里里",
  "longitude": "121.6945286",
  "latitude": "25.17950406",
  "time": "12:40",
  "memo": "",                    // ❌ Not used
  "garbagesunday": "",           // ❌ Not used (14 day-of-week fields)
  "garbagemonday": "Y",          // ❌ Not used
  "garbagetuesday": "Y",         // ❌ Not used
  "garbagewednesday": "",        // ❌ Not used
  "garbagethursday": "Y",        // ❌ Not used
  "garbagefriday": "Y",          // ❌ Not used
  "garbagesaturday": "Y",        // ❌ Not used
  "recyclingsunday": "",         // ❌ Not used
  "recyclingmonday": "Y",        // ❌ Not used
  // ... (6 more recycling fields)
  "foodscrapssunday": "",        // ❌ Not used
  // ... (6 more foodscraps fields)
}
```

**Kept Fields** (used by app - see `src/types.ts:34-66`):
```typescript
{
  city: string;       // District
  lineid: string;     // Line ID
  linename: string;   // Line name
  rank: string;       // Rank in route
  name: string;       // Location name
  village: string;    // Village
  longitude: string;
  latitude: string;
  time: string;       // Time in HH:MM format
}
```

**Trimming Command**:
```bash
cat public/new-taipei-trash-collection-points.json | jq '[.[] | {
  city,
  lineid,
  linename,
  rank,
  name,
  village,
  longitude,
  latitude,
  time
}]' > public/new-taipei-trash-collection-points.tmp.json

mv public/new-taipei-trash-collection-points.tmp.json public/new-taipei-trash-collection-points.json
```

### Size Comparison

After trimming (current production build):
- **Taipei**: ~1.2 MB (4,031 records)
- **New Taipei**: ~6.6 MB (26,822 records)
- **Total**: ~7.8 MB

---

## 4. Runtime Data Fetching

**File**: `src/api.ts:10-94`

### Static File URLs

```typescript
const TAIPEI_STATIC_DATA_URL = '/trash-collection-points.json';
const NEW_TAIPEI_STATIC_DATA_URL = '/new-taipei-trash-collection-points.json';
```

These files are served from the build output (`dist/`).

### Data Flow Diagram

```
User Browser
    ↓
1. Request JSON file (e.g., /trash-collection-points.json)
    ↓
2. Check Service Worker Cache (PWA)
    ↓ (miss or expired)
3. Fetch from network
    ↓
4. Cache response (24 hours)
    ↓
5. Parse JSON
    ↓
6. Map to UnifiedTrashCollectionPoint
    ↓
7. Render on map
```

### PWA Caching Strategy

**File**: `vite.config.ts:76-89`

```typescript
{
  urlPattern: /.*\.json$/i,
  handler: 'NetworkFirst',
  options: {
    cacheName: 'data-cache',
    networkTimeoutSeconds: 10,
    expiration: {
      maxEntries: 10,
      maxAgeSeconds: 60 * 60 * 24 // 24 hours
    },
    cacheableResponse: {
      statuses: [0, 200]
    }
  }
}
```

**Strategy**: `NetworkFirst`
- Try network first with 10s timeout
- If network fails or times out, use cache
- Cache expires after 24 hours
- Max 10 cached JSON files

### Data Mapping

Both city data sources are mapped to a unified format for the app.

#### Taipei Mapping (`src/api.ts:16-30`)

```typescript
function mapTaipeiToUnified(point: TaipeiTrashCollectionPoint): UnifiedTrashCollectionPoint {
  return {
    id: `taipei-${point._id}`,
    city: '台北市',
    district: point.行政區,
    village: point.里別,
    location: point.地點,
    route: point.路線,
    arrivalTime: point.抵達時間,
    departureTime: point.離開時間,
    longitude: point.經度,
    latitude: point.緯度,
    source: 'taipei',
  };
}
```

#### New Taipei Mapping (`src/api.ts:33-56`)

```typescript
function mapNewTaipeiToUnified(point: NewTaipeiTrashCollectionPoint): UnifiedTrashCollectionPoint {
  // Convert HH:MM to HHMM format
  const arrivalTime = point.time.replace(':', '');

  // Assume 10 minutes collection time if no departure time
  const arrivalMinutes = parseInt(arrivalTime.slice(0, -2)) * 60 + parseInt(arrivalTime.slice(-2));
  const departureMinutes = arrivalMinutes + 10;
  const departureHours = Math.floor(departureMinutes / 60);
  const departureMins = departureMinutes % 60;
  const departureTime = `${departureHours}${departureMins.toString().padStart(2, '0')}`;

  return {
    id: `new-taipei-${point.lineid}-${point.rank}`,
    city: '新北市',
    district: point.city,
    village: point.village,
    location: point.name,
    route: point.linename,
    arrivalTime,
    departureTime,
    longitude: point.longitude,
    latitude: point.latitude,
    source: 'new-taipei',
  };
}
```

**Key Difference**: New Taipei data only has arrival time, so departure is calculated as +10 minutes.

### Viewport-Based Loading

**File**: `src/api.ts:223-250`

The app intelligently loads only the data needed for the current map view.

#### City Boundaries (`src/api.ts:137-158`)

```typescript
export const CITY_BOUNDS = {
  taipei: {
    north: 25.209306675338553,
    south: 24.96052289128283,
    east: 121.66597827746033,
    west: 121.45733834043676,
  },
  'new-taipei': {
    north: 25.298899838693202,
    south: 24.67314274446706,
    east: 122.00691904918543,
    west: 121.28260999667577,
  },
}
```

**Source**: Taiwan.TopoJSON (https://github.com/jason2506/Taiwan.TopoJSON)

#### Loading Logic (`src/api.ts:223-250`)

```typescript
export function getCitiesInViewport(
  viewport: { north: number; south: number; east: number; west: number } | null,
  zoom: number
): City[] {
  // Prevent data loading when zoomed out too far
  if (zoom < MIN_DATA_LOAD_ZOOM || !viewport) {
    return [];
  }

  const cities: City[] = [];

  // Check each city for viewport intersection
  if (doesViewportIntersectCity(viewport, 'taipei')) {
    cities.push('taipei');
  }

  if (doesViewportIntersectCity(viewport, 'new-taipei')) {
    cities.push('new-taipei');
  }

  return cities;
}
```

**Key Features**:
- **Zoom threshold**: Only loads data at zoom level ≥ 10 (`MIN_DATA_LOAD_ZOOM`)
- **Multi-city support**: Can load multiple cities if viewport spans boundaries
- **Performance**: Prevents loading 30,000+ points when viewing entire Taiwan

#### Intersection Algorithm (`src/api.ts:184-199`)

```typescript
export function doesViewportIntersectCity(
  viewport: { north: number; south: number; east: number; west: number },
  city: City
): boolean {
  const cityBounds = CITY_BOUNDS[city];

  // Two bounding boxes intersect if they are NOT separated:
  return !(
    viewport.south > cityBounds.north ||  // viewport is above city
    viewport.north < cityBounds.south ||  // viewport is below city
    viewport.west > cityBounds.east ||    // viewport is right of city
    viewport.east < cityBounds.west       // viewport is left of city
  );
}
```

**Algorithm**: Bounding box intersection
- Returns `true` if any overlap exists
- Returns `false` if completely separated on any axis

---

## 5. Multi-City Maintenance

**Current Cities**: Taipei (台北市), New Taipei (新北市)

### Adding a New City (Step-by-Step Guide)

Let's use **Kaohsiung (高雄市)** as an example.

#### Step 1: Update Data Fetching Workflow

**File**: `.github/workflows/update-data.yml`

Add a new job step after the existing city steps:

```yaml
- name: Fetch latest data from Kaohsiung City API
  run: |
    echo "Fetching Kaohsiung City trash collection data..."

    # Example: assuming API similar to Taipei
    curl -s "https://api.kcg.gov.tw/api/service/Get/xyz" > kaohsiung-trash-collection-points.json

    # Display stats
    RECORD_COUNT=$(jq 'length' kaohsiung-trash-collection-points.json)
    FILE_SIZE=$(du -h kaohsiung-trash-collection-points.json | cut -f1)
    echo "Fetched $RECORD_COUNT Kaohsiung records"
    echo "File size: $FILE_SIZE"
```

Update the change detection:

```yaml
- name: Check for changes
  id: check_changes
  run: |
    TAIPEI_CHANGED=false
    NTPC_CHANGED=false
    KH_CHANGED=false  # Add this

    # ... existing checks ...

    if ! git diff --quiet kaohsiung-trash-collection-points.json; then
      KH_CHANGED=true
      echo "Changes detected in Kaohsiung data"
    fi

    if [ "$TAIPEI_CHANGED" = true ] || [ "$NTPC_CHANGED" = true ] || [ "$KH_CHANGED" = true ]; then
      echo "changed=true" >> $GITHUB_OUTPUT
      echo "kh_changed=$KH_CHANGED" >> $GITHUB_OUTPUT
    fi
```

Update the commit step:

```yaml
- name: Commit and push if changed
  if: steps.check_changes.outputs.changed == 'true'
  run: |
    # ... existing code ...

    if [ "${{ steps.check_changes.outputs.kh_changed }}" = "true" ]; then
      KH_RECORD_COUNT=$(jq 'length' kaohsiung-trash-collection-points.json)
      COMMIT_LINES+=("- Updated Kaohsiung City data: $KH_RECORD_COUNT records")
      git add kaohsiung-trash-collection-points.json
    fi
```

#### Step 2: Add Trimming Logic

**File**: `.github/actions/trim-data.sh`

Add trimming for Kaohsiung data:

```bash
echo ""
echo "Trimming Kaohsiung City data..."
cat public/kaohsiung-trash-collection-points.json | jq '[.[] | {
  # Keep only the fields your app needs
  id,
  district,
  location,
  route,
  arrivalTime,
  departureTime,
  longitude,
  latitude
}]' > public/kaohsiung-trash-collection-points.tmp.json

# Get file sizes
ORIGINAL_SIZE=$(du -h public/kaohsiung-trash-collection-points.json | cut -f1)
NEW_SIZE=$(du -h public/kaohsiung-trash-collection-points.tmp.json | cut -f1)
RECORD_COUNT=$(jq 'length' public/kaohsiung-trash-collection-points.tmp.json)

echo "Kaohsiung City:"
echo "  Original: $ORIGINAL_SIZE"
echo "  Trimmed: $NEW_SIZE"
echo "  Records: $RECORD_COUNT"

mv public/kaohsiung-trash-collection-points.tmp.json public/kaohsiung-trash-collection-points.json
```

#### Step 3: Update dump-data Script

**File**: `package.json:10`

```json
{
  "scripts": {
    "dump-data": "git show data:trash-collection-points.json > public/trash-collection-points.json && git show data:new-taipei-trash-collection-points.json > public/new-taipei-trash-collection-points.json && git show data:kaohsiung-trash-collection-points.json > public/kaohsiung-trash-collection-points.json && echo 'Data dumped to public/'"
  }
}
```

#### Step 4: Extract City Boundaries

Download TopoJSON data:

```bash
curl -o /tmp/counties.json "https://raw.githubusercontent.com/jason2506/Taiwan.TopoJSON/refs/heads/master/topojson/counties.json"
```

Create a temporary extraction script:

```bash
bun -e "
import * as fs from 'fs';

const data = JSON.parse(fs.readFileSync('/tmp/counties.json', 'utf-8'));

// Install topojson-client first: bun add -d topojson-client
const topojson = require('topojson-client');
const geojson = topojson.feature(data, data.objects.map);

// Find Kaohsiung
const cityName = '高雄市';
const city = geojson.features.find(f => f.properties.name === cityName);

if (!city) {
  console.error('City not found');
  process.exit(1);
}

function getBounds(geometry) {
  let bounds = {
    minLng: Infinity,
    maxLng: -Infinity,
    minLat: Infinity,
    maxLat: -Infinity
  };

  function process(coords) {
    if (Array.isArray(coords) && coords.length >= 2 && typeof coords[0] === 'number') {
      bounds.minLng = Math.min(bounds.minLng, coords[0]);
      bounds.maxLng = Math.max(bounds.maxLng, coords[0]);
      bounds.minLat = Math.min(bounds.minLat, coords[1]);
      bounds.maxLat = Math.max(bounds.maxLat, coords[1]);
    } else if (Array.isArray(coords)) {
      coords.forEach(process);
    }
  }

  process(geometry.coordinates);
  return bounds;
}

const bounds = getBounds(city.geometry);

console.log(JSON.stringify({
  north: bounds.maxLat,
  south: bounds.minLat,
  east: bounds.maxLng,
  west: bounds.minLng
}, null, 2));
"
```

#### Step 5: Update TypeScript Types

**File**: `src/api.ts:8`

```typescript
export type City = 'taipei' | 'new-taipei' | 'kaohsiung';
```

**File**: `src/api.ts:137-158` (add to CITY_BOUNDS)

```typescript
export const CITY_BOUNDS = {
  taipei: { /* ... */ },
  'new-taipei': { /* ... */ },
  'kaohsiung': {
    north: 22.793768,    // From extraction script
    south: 22.565308,
    east: 120.448421,
    west: 120.183105,
  },
} as const;
```

**File**: `src/types.ts` (if needed, create Kaohsiung-specific types)

```typescript
export interface KaohsiungTrashCollectionPoint {
  // Define fields based on Kaohsiung's API response
  id: string;
  district: string;
  location: string;
  // ... etc
}
```

#### Step 6: Create Fetch Function

**File**: `src/api.ts`

```typescript
// Add constant
const KAOHSIUNG_STATIC_DATA_URL = '/kaohsiung-trash-collection-points.json';

// Add mapping function
function mapKaohsiungToUnified(point: KaohsiungTrashCollectionPoint): UnifiedTrashCollectionPoint {
  return {
    id: `kaohsiung-${point.id}`,
    city: '高雄市',
    district: point.district,
    village: point.village || '',
    location: point.location,
    route: point.route,
    arrivalTime: point.arrivalTime,
    departureTime: point.departureTime,
    longitude: point.longitude,
    latitude: point.latitude,
    source: 'kaohsiung',
  };
}

// Add fetch function
async function fetchKaohsiungData(): Promise<UnifiedTrashCollectionPoint[]> {
  try {
    const response = await fetch(KAOHSIUNG_STATIC_DATA_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data: KaohsiungTrashCollectionPoint[] = await response.json();
    return data.map(mapKaohsiungToUnified);
  } catch (error) {
    console.error('Error fetching Kaohsiung trash collection points:', error);
    throw error;
  }
}
```

#### Step 7: Update Main Fetch Function

**File**: `src/api.ts:89-94`

```typescript
export async function fetchTrashCollectionPoints(city: City = 'taipei'): Promise<UnifiedTrashCollectionPoint[]> {
  if (city === 'new-taipei') {
    return fetchNewTaipeiData();
  }
  if (city === 'kaohsiung') {
    return fetchKaohsiungData();
  }
  return fetchTaipeiData();
}
```

#### Step 8: Update Viewport Function

**File**: `src/api.ts:236-242`

```typescript
export function getCitiesInViewport(
  viewport: { north: number; south: number; east: number; west: number } | null,
  zoom: number
): City[] {
  if (zoom < MIN_DATA_LOAD_ZOOM || !viewport) {
    return [];
  }

  const cities: City[] = [];

  if (doesViewportIntersectCity(viewport, 'taipei')) {
    cities.push('taipei');
  }

  if (doesViewportIntersectCity(viewport, 'new-taipei')) {
    cities.push('new-taipei');
  }

  if (doesViewportIntersectCity(viewport, 'kaohsiung')) {
    cities.push('kaohsiung');
  }

  return cities;
}
```

#### Step 9: Update UI (Optional)

**File**: `src/App.tsx`

If you have a city selector dropdown, add Kaohsiung as an option.

#### Step 10: Testing Checklist

- [ ] Verify data fetches correctly in GitHub Actions
- [ ] Check data branch contains new JSON file
- [ ] Confirm trimming reduces file size appropriately
- [ ] Test dump-data script copies file to public/
- [ ] Verify build includes Kaohsiung data in dist/
- [ ] Test viewport-based loading when zooming to Kaohsiung
- [ ] Confirm data displays correctly on map
- [ ] Check PWA caching works for Kaohsiung data
- [ ] Verify multi-city loading when viewport spans cities
- [ ] Test zoom level restrictions (< MIN_DATA_LOAD_ZOOM)

### Common Taiwan City Names (for reference)

When extracting from TopoJSON:

- 臺北市 / 台北市 (Taipei City)
- 新北市 (New Taipei City)
- 桃園市 (Taoyuan City)
- 臺中市 / 台中市 (Taichung City)
- 臺南市 / 台南市 (Tainan City)
- 高雄市 (Kaohsiung City)
- 基隆市 (Keelung City)
- 新竹市 (Hsinchu City)
- 嘉義市 (Chiayi City)

---

## 6. Key Design Decisions

### 6.1 Orphan Branch Strategy

**Decision**: Store data in separate `data` branch with no shared history

**Benefits**:
- Main branch stays lightweight (no large JSON files in history)
- Data can be updated independently from code
- Easy to rollback data without affecting code
- CI/CD can update data on schedule without code changes

**Trade-offs**:
- Requires two branches to maintain
- More complex deployment workflow
- Must remember to dump data during build

### 6.2 Two-Day Update Cycle

**Decision**: Update data on 1st, deploy on 2nd of each month

**Rationale**:
- Ensures data is committed before deployment
- Allows manual inspection of data changes if needed
- Prevents race conditions between data update and deploy

**Workflow**:
```
Day 1 (2:00 AM UTC):
  - Fetch fresh data from APIs
  - Commit to data branch

Day 2 (3:00 AM UTC):
  - Fetch data from data branch
  - Build and deploy with new data
```

### 6.3 Build-Time Field Trimming

**Decision**: Trim unused fields at build time, not in `data` branch

**Benefits**:
- Data branch preserves complete API response (auditability)
- Can change which fields to keep without re-fetching data
- Easy to add new fields to app later
- Build output is optimized for production

**Alternative Rejected**: Trim before committing to `data` branch
- Would lose information permanently
- Harder to debug data issues
- Can't add fields back without re-fetching

### 6.4 Static JSON Files (Not Runtime API Calls)

**Decision**: Serve pre-fetched JSON from build, not live API calls

**Benefits**:
- No runtime API key management
- No CORS issues
- Faster load times (single domain)
- Works offline with PWA
- No API rate limits for users
- Predictable performance

**Trade-offs**:
- Data freshness limited to monthly updates
- Larger initial bundle size

**Why Monthly Updates Are Acceptable**:
- Trash routes rarely change
- Users prefer reliability over real-time data
- Reduces load on government APIs

### 6.5 Viewport-Based Loading

**Decision**: Only load data for cities visible in viewport

**Benefits**:
- Reduces memory usage on mobile devices
- Faster initial load (doesn't parse 30,000+ points)
- Better performance when zoomed in
- Scales to more cities without performance degradation

**Implementation**:
- Checks viewport intersection with city boundaries
- Only fetches/renders points in visible cities
- Zoom threshold prevents loading when viewing entire Taiwan

### 6.6 Unified Data Format

**Decision**: Map all city data to common `UnifiedTrashCollectionPoint` interface

**Benefits**:
- Single rendering logic for all cities
- Easy to add cities with different API formats
- Type safety with TypeScript
- Consistent UI/UX across cities

**Mapping Challenges**:
- New Taipei doesn't provide departure time (calculate +10 minutes)
- Different time formats (HHMM vs HH:MM)
- Different field names (地點 vs name)

---

## 7. Performance Characteristics

### File Sizes (Production Build)

```
dist/
├── trash-collection-points.json        1.2 MB (4,031 records)
├── new-taipei-trash-collection-points.json  6.6 MB (26,822 records)
└── ... (other build assets)

Total data: ~7.8 MB
```

### Load Times (4G Network)

- First visit: ~2-3 seconds (download + parse)
- Cached visit: ~200ms (PWA cache hit)
- Offline: Instant (from service worker cache)

### Memory Usage

- All data loaded: ~50 MB RAM (on mobile)
- Single city: ~20 MB RAM
- Viewport-only loading: ~5-10 MB RAM

### Network Requests

```
Initial Load:
- index.html
- app.[hash].js (React + app code)
- app.[hash].css (Tailwind styles)
- trash-collection-points.json (if Taipei visible)
- new-taipei-trash-collection-points.json (if New Taipei visible)
- MapLibre GL JS resources

Subsequent Loads:
- Only JSON files (if not cached or expired)
```

---

## 8. Troubleshooting

### Data Not Updating

**Symptom**: Map shows old data after monthly update

**Possible Causes**:
1. Data update workflow failed
2. Deploy workflow didn't run
3. PWA cache not expired
4. Browser cache issue

**Solutions**:
```bash
# Check data branch
git checkout data
git log -1  # Should show recent monthly update

# Check if data was dumped correctly
git checkout main
ls -lh public/*.json

# Force cache refresh (in browser)
# - Open DevTools > Application > Storage > Clear site data
# - Or wait 24 hours for cache expiration
```

### Build Fails on Trim Step

**Symptom**: Deploy workflow fails at "Trim public data files"

**Possible Causes**:
1. `jq` syntax error
2. JSON file not found in public/
3. Field name changed in API response

**Solutions**:
```bash
# Test trimming locally
bun run dump-data
./.github/actions/trim-data.sh

# Verify JSON structure
cat public/trash-collection-points.json | jq '.result.results[0]'

# Check field names match
cat public/trash-collection-points.json | jq '.result.results[0] | keys'
```

### City Not Loading in Viewport

**Symptom**: Zooming to city doesn't load data

**Possible Causes**:
1. City bounds incorrect
2. Zoom level below threshold
3. Viewport calculation error

**Debug**:
```typescript
// Add logging in src/api.ts
export function getCitiesInViewport(viewport, zoom) {
  console.log('Viewport:', viewport);
  console.log('Zoom:', zoom);
  console.log('Min zoom:', MIN_DATA_LOAD_ZOOM);

  const cities: City[] = [];

  if (doesViewportIntersectCity(viewport, 'taipei')) {
    console.log('Taipei intersects');
    cities.push('taipei');
  }

  return cities;
}
```

### API Fetching Fails in Workflow

**Symptom**: Update workflow fails with HTTP error

**Possible Causes**:
1. API endpoint changed
2. API rate limiting
3. API requires authentication
4. API response format changed

**Solutions**:
```bash
# Test API manually
curl -s "https://data.taipei/api/v1/dataset/a6e90031-7ec4-4089-afb5-361a4efe7202?scope=resourceAquire&limit=1" | jq '.'

# Check API documentation
# - Taipei: https://data.taipei/
# - New Taipei: https://data.ntpc.gov.tw/

# Update workflow if API changed
vim .github/workflows/update-data.yml
```

---

## 9. Future Improvements

### Potential Enhancements

1. **Differential Updates**
   - Only download changed records
   - Reduce monthly update payload
   - Faster updates for users

2. **Data Compression**
   - Gzip compression on JSON files
   - Brotli compression for modern browsers
   - Could reduce size by 70-80%

3. **Lazy Loading**
   - Load data only when user pans to new area
   - Reduce initial bundle size
   - Better mobile experience

4. **Real-Time Updates**
   - WebSocket connection for live truck positions
   - Optional feature for users who want real-time data
   - Fallback to static data

5. **Incremental Static Regeneration**
   - Update data more frequently (daily or weekly)
   - Keep static benefits with fresher data

6. **Smart Caching**
   - Cache invalidation based on data version
   - Selective cache updates (only changed cities)
   - Reduce bandwidth for frequent users

7. **Data Validation**
   - Schema validation in CI/CD
   - Detect API format changes early
   - Alert maintainers of issues

8. **Multi-Language Support**
   - Translate city/district names
   - Keep original Chinese for data integrity
   - Display layer for translations

---

## 10. References

### External Data Sources

- **Taipei City Open Data**: https://data.taipei/
  - Dataset ID: `a6e90031-7ec4-4089-afb5-361a4efe7202`
  - API Docs: https://data.taipei/api-doc

- **New Taipei City Open Data**: https://data.ntpc.gov.tw/
  - Dataset ID: `edc3ad26-8ae7-4916-a00b-bc6048d19bf8`

- **Taiwan TopoJSON**: https://github.com/jason2506/Taiwan.TopoJSON
  - Used for city boundary extraction

### Internal Files

- `src/api.ts` - Data fetching logic
- `src/types.ts` - TypeScript type definitions
- `.github/workflows/update-data.yml` - Monthly data update
- `.github/workflows/deploy.yml` - Build and deploy
- `.github/actions/trim-data.sh` - JSON trimming script
- `package.json` - npm/bun scripts including dump-data
- `vite.config.ts` - Build configuration and PWA settings

### Related Documentation

- See `CLAUDE.md` for city boundary extraction guide
- See `README.md` for user-facing documentation (if exists)
- See GitHub Actions logs for workflow execution history

---

## Appendix A: Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     MONTHLY DATA UPDATE                      │
│                   (1st of each month)                        │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┴────────────────┐
         │                                 │
    ┌────▼─────┐                    ┌────▼──────┐
    │  Taipei  │                    │ New Taipei│
    │    API   │                    │    API    │
    └────┬─────┘                    └────┬──────┘
         │                                │
         │ Batch (5×1000)                 │ Pages (3×10000)
         │                                │
    ┌────▼─────┐                    ┌────▼──────┐
    │   Merge  │                    │   Merge   │
    │   (jq)   │                    │   (jq)    │
    └────┬─────┘                    └────┬──────┘
         │                                │
         └───────────────┬────────────────┘
                         │
                    ┌────▼─────┐
                    │  Commit  │
                    │   to     │
                    │  'data'  │
                    │  branch  │
                    └────┬─────┘
                         │
┌────────────────────────┴─────────────────────────────────────┐
│                     BUILD & DEPLOY                            │
│                   (2nd of each month)                         │
└────────────────────────┬─────────────────────────────────────┘
                         │
                    ┌────▼─────┐
                    │  Fetch   │
                    │  'data'  │
                    │  branch  │
                    └────┬─────┘
                         │
                    ┌────▼─────┐
                    │   Dump   │
                    │   JSON   │
                    │   files  │
                    └────┬─────┘
                         │
                    ┌────▼─────┐
                    │   Trim   │
                    │  unused  │
                    │  fields  │
                    └────┬─────┘
                         │
                    ┌────▼─────┐
                    │  Build   │
                    │  (Vite)  │
                    └────┬─────┘
                         │
                    ┌────▼─────┐
                    │  Deploy  │
                    │  GitHub  │
                    │  Pages   │
                    └────┬─────┘
                         │
┌────────────────────────┴─────────────────────────────────────┐
│                     RUNTIME (User)                            │
└────────────────────────┬─────────────────────────────────────┘
                         │
                    ┌────▼─────┐
                    │  Load    │
                    │  App     │
                    └────┬─────┘
                         │
                    ┌────▼─────┐
                    │  Check   │
                    │  PWA     │
                    │  Cache   │
                    └────┬─────┘
                         │
          ┌──────────────┴──────────────┐
          │                             │
     Cache Miss                    Cache Hit
          │                             │
    ┌─────▼─────┐                 ┌─────▼─────┐
    │  Fetch    │                 │   Load    │
    │  JSON     │                 │   from    │
    │  from     │                 │  Cache    │
    │  Network  │                 └─────┬─────┘
    └─────┬─────┘                       │
          │                             │
          └──────────────┬──────────────┘
                         │
                    ┌────▼─────┐
                    │   Map    │
                    │   to     │
                    │ Unified  │
                    │  Format  │
                    └────┬─────┘
                         │
                    ┌────▼─────┐
                    │  Filter  │
                    │    by    │
                    │ Viewport │
                    └────┬─────┘
                         │
                    ┌────▼─────┐
                    │  Render  │
                    │    on    │
                    │   Map    │
                    └──────────┘
```

---

## Appendix B: File Size Impact

### Original API Responses (before trimming)

**Taipei City** (all fields from data.taipei API):
```json
{
  "_id": 1,
  "_importdate": { "date": "...", "timezone_type": 3, "timezone": "Asia/Taipei" },
  "行政區": "中山區",
  "里別": "力行里",
  "分隊": "長安分隊",      // 🗑️ Removed
  "局編": "100-021",      // 🗑️ Removed
  "車號": "119-BQ",       // 🗑️ Removed
  "路線": "長安-3",
  "車次": "...",         // 🗑️ Removed
  "抵達時間": "1830",
  "離開時間": "1840",
  "地點": "民族東路226巷17號前",
  "經度": "121.534722",
  "緯度": "25.062500"
}
```

**Estimated size**: ~1.8 MB (with all fields)
**After trimming**: ~1.2 MB (33% reduction)

**New Taipei City** (all fields from data.ntpc.gov.tw API):
```json
{
  "city": "萬里區",
  "lineid": "207001",
  "linename": "A路線下午",
  "rank": "1",
  "name": "獅頭路15-1號(海巡)",
  "village": "萬里里",
  "longitude": "121.6945286",
  "latitude": "25.17950406",
  "time": "12:40",
  "memo": "",                    // 🗑️ Removed (21 fields removed)
  "garbagesunday": "",           // 🗑️ Removed
  "garbagemonday": "Y",          // 🗑️ Removed
  "garbagetuesday": "Y",         // 🗑️ Removed
  "garbagewednesday": "",        // 🗑️ Removed
  "garbagethursday": "Y",        // 🗑️ Removed
  "garbagefriday": "Y",          // 🗑️ Removed
  "garbagesaturday": "Y",        // 🗑️ Removed
  "recyclingsunday": "",         // 🗑️ Removed
  "recyclingmonday": "Y",        // 🗑️ Removed
  "recyclingtuesday": "",        // 🗑️ Removed
  "recyclingwednesday": "",      // 🗑️ Removed
  "recyclingthursday": "Y",      // 🗑️ Removed
  "recyclingfriday": "",         // 🗑️ Removed
  "recyclingsaturday": "",       // 🗑️ Removed
  "foodscrapssunday": "",        // 🗑️ Removed
  "foodscrapsmonday": "Y",       // 🗑️ Removed
  "foodscrapstuesday": "Y",      // 🗑️ Removed
  "foodscrapswednesday": "",     // 🗑️ Removed
  "foodscrapsfriday": "",        // 🗑️ Removed
  "foodscrapssaturday": ""       // 🗑️ Removed
}
```

**Estimated size**: ~11 MB (with all fields)
**After trimming**: ~6.6 MB (40% reduction)

### Total Bundle Impact

```
Complete Build Size:
├── HTML, CSS, JS:           ~500 KB (gzipped)
├── MapLibre GL:            ~800 KB
├── React libraries:        ~300 KB
├── Taipei data:           1.2 MB
├── New Taipei data:       6.6 MB
└── Icons, fonts:          ~200 KB
                          ─────────
Total:                     ~9.6 MB

If we didn't trim:
├── Taipei data:           1.8 MB (+600 KB)
├── New Taipei data:      11.0 MB (+4.4 MB)
                          ─────────
Total:                    ~14.6 MB (+5 MB increase, +52%)
```

**Savings**: 5 MB (34% reduction in data size)

---

**Last Updated**: 2025-10-23
**Maintainer**: See repository contributors
**Questions?**: Open an issue on GitHub
