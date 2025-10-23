# Cities Module - Extensible Multi-City Architecture

This module implements a **registry-driven adapter pattern** for managing data from multiple cities with different data formats.

## 📁 Structure

```
src/cities/
├── adapters/
│   ├── BaseAdapter.ts       # Abstract base class for all adapters
│   ├── TaipeiAdapter.ts     # Taipei City (台北市) adapter
│   ├── NewTaipeiAdapter.ts  # New Taipei City (新北市) adapter
│   ├── TaichungAdapter.ts   # Taichung City (台中市) adapter
│   └── index.ts             # Barrel exports
├── cityRegistry.ts          # Central city registry (SINGLE SOURCE OF TRUTH)
└── README.md               # This file
```

## 🎯 Design Goals

1. **Zero Hardcoded Logic**: No if/else chains for city-specific code
2. **Single Source of Truth**: All city configuration in one place (cityRegistry.ts)
3. **Easy Extension**: Add new cities by creating one adapter class
4. **Type Safety**: Full TypeScript support with proper type inference
5. **Separation of Concerns**: Data fetching logic isolated from app logic

## 🏗️ Architecture Pattern: Adapter Pattern

Each city has an **adapter** that:
- Knows how to fetch its raw data
- Knows how to transform raw data → unified format
- Contains city-specific metadata (boundaries, display name, etc.)

The **city registry** manages all adapters and provides a unified interface.

## 📝 How to Add a New City

### Example: Adding Kaohsiung City (高雄市)

#### Step 1: Create the Adapter

Create `src/cities/adapters/KaohsiungAdapter.ts`:

```typescript
import { CityDataAdapter } from './BaseAdapter';
import type { UnifiedTrashCollectionPoint } from '../../types';

// Define the raw data structure from Kaohsiung's API
export interface KaohsiungTrashPoint {
  id: string;
  district: string;
  location: string;
  // ... other fields
}

export class KaohsiungAdapter extends CityDataAdapter<KaohsiungTrashPoint> {
  readonly cityId = 'kaohsiung';
  readonly displayName = '高雄市';
  readonly dataUrl = '/kaohsiung-trash-collection-points.json';
  readonly dataType = 'static' as const;

  // Boundaries extracted from Taiwan TopoJSON
  readonly bounds = {
    north: 22.793768,
    south: 22.565308,
    east: 120.448421,
    west: 120.183105,
  };

  async fetchRawData(): Promise<KaohsiungTrashPoint[]> {
    return this.fetchJson<KaohsiungTrashPoint[]>(this.dataUrl);
  }

  mapToUnified(point: KaohsiungTrashPoint): UnifiedTrashCollectionPoint {
    return {
      id: `kaohsiung-${point.id}`,
      city: this.displayName,
      district: point.district,
      village: '', // If not available
      location: point.location,
      route: point.route || '',
      arrivalTime: point.time,
      departureTime: this.calculateDeparture(point.time),
      longitude: point.longitude,
      latitude: point.latitude,
      source: 'kaohsiung' as any, // Update UnifiedTrashCollectionPoint type
    };
  }

  private calculateDeparture(arrival: string): string {
    // City-specific logic here
    return arrival; // Or calculate as needed
  }
}
```

#### Step 2: Update Type Definitions

Update `src/types.ts`:

```typescript
export interface UnifiedTrashCollectionPoint {
  // ... existing fields
  source: 'taipei' | 'new-taipei' | 'taichung' | 'kaohsiung';
}
```

#### Step 3: Register in City Registry

Update `src/cities/cityRegistry.ts`:

```typescript
import { KaohsiungAdapter } from './adapters/KaohsiungAdapter';

// Update City type
export type City = 'taipei' | 'new-taipei' | 'taichung' | 'kaohsiung';

class CityRegistry {
  constructor() {
    this.register(new TaipeiAdapter());
    this.register(new NewTaipeiAdapter());
    this.register(new TaichungAdapter());
    this.register(new KaohsiungAdapter()); // ← Add this line
  }
}
```

#### Step 4: Done! 🎉

That's it! The rest is automatic:
- ✅ City selector dropdown automatically includes Kaohsiung
- ✅ Viewport-based loading works automatically
- ✅ City boundaries checked automatically
- ✅ Data fetching routes through registry

## 🔧 Adapter Lifecycle Methods

### Required Methods

#### `fetchRawData(): Promise<TSource[]>`
Fetch raw data from the source (API or static file).

**Example**:
```typescript
async fetchRawData(): Promise<MyDataType[]> {
  return this.fetchJson<MyDataType[]>(this.dataUrl);
}
```

#### `mapToUnified(source: TSource): UnifiedTrashCollectionPoint`
Transform one record from raw format to unified format.

**Example**:
```typescript
mapToUnified(point: TaipeiTrashCollectionPoint): UnifiedTrashCollectionPoint {
  return {
    id: `taipei-${point._id}`,
    city: '台北市',
    district: point.行政區,
    // ... map other fields
  };
}
```

### Optional Hook Methods

#### `preprocessData(raw: any): TSource[]`
Process the API response before mapping. Useful for unwrapping nested responses.

**Example**:
```typescript
preprocessData(raw: TaipeiApiResponse): TaipeiTrashCollectionPoint[] {
  return raw.result.results; // Unwrap nested structure
}
```

#### `postprocessData(unified: UnifiedTrashCollectionPoint[]): UnifiedTrashCollectionPoint[]`
Process data after mapping. Useful for filtering, sorting, deduplication.

**Example**:
```typescript
postprocessData(unified: UnifiedTrashCollectionPoint[]): UnifiedTrashCollectionPoint[] {
  // Remove duplicates by vehicle ID
  const seen = new Set();
  return unified.filter(point => {
    if (seen.has(point.id)) return false;
    seen.add(point.id);
    return true;
  });
}
```

## 🌐 Data Types: Static vs Real-time

### Static Data (Schedule-based)
- Pre-fetched JSON files updated monthly
- Contains collection schedules (arrival/departure times)
- Examples: Taipei, New Taipei

```typescript
readonly dataType = 'static' as const;
readonly dataUrl = '/trash-collection-points.json';
```

### Real-time Data (GPS-based)
- Live API calls
- Current vehicle positions
- Examples: Taichung

```typescript
readonly dataType = 'realtime' as const;
readonly dataUrl = 'https://api.city.gov.tw/vehicles?limit=1000';
```

## 🗺️ City Boundaries

Boundaries are extracted from [Taiwan TopoJSON](https://github.com/jason2506/Taiwan.TopoJSON).

### Extraction Script

```bash
# Download TopoJSON
curl -o /tmp/counties.json "https://raw.githubusercontent.com/jason2506/Taiwan.TopoJSON/refs/heads/master/topojson/counties.json"

# Install extraction tool
bun add -d topojson-client

# Create extraction script
bun -e "
import * as topojson from 'topojson-client';

const data = await Bun.file('/tmp/counties.json').json();
const geojson = topojson.feature(data, data.objects.map);

// Find city
const cityName = '高雄市'; // Change this
const city = geojson.features.find(f => f.properties.name === cityName);

// Calculate bounds
function getBounds(geometry) {
  let bounds = { minLng: Infinity, maxLng: -Infinity, minLat: Infinity, maxLat: -Infinity };
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
console.log(JSON.stringify({ north: bounds.maxLat, south: bounds.minLat, east: bounds.maxLng, west: bounds.minLng }, null, 2));
"
```

## 📊 Current Supported Cities

| City | ID | Data Type | Records | Adapter |
|------|-----|-----------|---------|---------|
| 台北市 | `taipei` | Static | 4,031 | TaipeiAdapter |
| 新北市 | `new-taipei` | Static | 26,822 | NewTaipeiAdapter |
| 台中市 | `taichung` | Real-time | ~100-200 | TaichungAdapter |

## 🔍 API Reference

### cityRegistry

The global singleton instance managing all city adapters.

#### `getAdapter(cityId: City): CityDataAdapter`
Get the adapter for a specific city.

```typescript
const adapter = cityRegistry.getAdapter('taipei');
const data = await adapter.fetchData();
```

#### `getCityIds(): City[]`
Get all registered city IDs.

```typescript
const cities = cityRegistry.getCityIds(); // ['taipei', 'new-taipei', 'taichung']
```

#### `getCityOptions(): Array<{ value: City; label: string }>`
Get city options for UI dropdowns.

```typescript
const options = cityRegistry.getCityOptions();
// [
//   { value: 'taipei', label: '台北市' },
//   { value: 'new-taipei', label: '新北市' },
//   { value: 'taichung', label: '台中市' }
// ]
```

#### `getCityBounds(cityId: City): CityBounds`
Get geographic boundaries for a city.

```typescript
const bounds = cityRegistry.getCityBounds('taipei');
// { north: 25.21, south: 24.96, east: 121.67, west: 121.46 }
```

#### `hasCity(cityId: string): cityId is City`
Check if a city is registered (type guard).

```typescript
if (cityRegistry.hasCity('taipei')) {
  // TypeScript knows 'taipei' is a valid City
}
```

## 🎨 UI Integration

The UI automatically adapts to available cities:

```tsx
// City selector dropdown - automatically generates options
<select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value as City)}>
  {cityRegistry.getCityOptions().map(option => (
    <option key={option.value} value={option.value}>
      {option.label}
    </option>
  ))}
</select>

// Display name - automatically looks up from registry
<p>{cityRegistry.getAdapter(selectedCity).displayName} 收集點</p>
```

## 🧪 Testing New Adapters

### Local Development

1. Create adapter file
2. Register in cityRegistry
3. Run dev server: `bun run dev`
4. Check console for any errors
5. Verify data loads on map

### Checklist

- [ ] Adapter compiles without TypeScript errors
- [ ] Data fetches successfully (check Network tab)
- [ ] Data transforms to unified format correctly
- [ ] Boundaries are accurate (zoom to city on map)
- [ ] City appears in dropdown selector
- [ ] Viewport-based loading works (zoom in/out)
- [ ] No hardcoded city checks in other files

## 📚 References

- [Adapter Pattern (Gang of Four)](https://refactoring.guru/design-patterns/adapter)
- [Taiwan TopoJSON Repository](https://github.com/jason2506/Taiwan.TopoJSON)
- [Project Data Fetching Documentation](../../docs/data-fetching-mechanism.md)

## ❓ FAQ

### Q: Do I need to update `api.ts` when adding a city?
**A**: No! The registry handles everything automatically.

### Q: What if my city has a completely different data format?
**A**: Perfect! That's what adapters are for. Implement `mapToUnified()` to transform any format.

### Q: Can I support both static and real-time data for one city?
**A**: Yes. Set `dataType: 'realtime'` and implement `fetchRawData()` to call the live API.

### Q: How do I handle pagination in the API?
**A**: Implement custom logic in `fetchRawData()`. See `TaichungAdapter` for an example (uses `limit` query param).

### Q: What if I need to filter data based on conditions?
**A**: Use `postprocessData()` hook to filter after mapping.

## 🚀 Future Improvements

- [ ] Add caching layer for real-time data
- [ ] Support dynamic adapter loading (load city adapters on demand)
- [ ] Add adapter validation/schema checking
- [ ] Implement adapter versioning
- [ ] Add performance monitoring per adapter
- [ ] Support multi-language city names

---

**Last Updated**: 2025-10-23
**Maintainer**: See repository contributors
