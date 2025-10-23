---
description: Use Bun instead of Node.js, npm, pnpm, or vite.
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: false
---

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";

// import .css files directly and it works
import './index.css';

import { createRoot } from "react-dom/client";

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.md`.

## City Boundary Data for Viewport-Based Loading

The application uses official Taiwan city boundary data to implement intelligent viewport-based data loading. This allows the app to automatically load data for cities visible in the current map view.

### Data Source

City boundaries are extracted from **Taiwan.TopoJSON**:
- Repository: https://github.com/jason2506/Taiwan.TopoJSON
- File: `topojson/counties.json`
- Format: TopoJSON (compact geospatial data format)

### Current Implementation

City boundaries are defined in `src/api.ts` as `CITY_BOUNDS` constant:

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

### Adding New Cities/Counties

To expand support to other Taiwan cities (e.g., Taichung, Kaohsiung, Tainan):

#### 1. Download TopoJSON Data

```bash
curl -o /tmp/counties.json "https://raw.githubusercontent.com/jason2506/Taiwan.TopoJSON/refs/heads/master/topojson/counties.json"
```

#### 2. Extract Bounding Box

Install topojson-client temporarily (development only):

```bash
bun add -d topojson-client
```

Create extraction script (`extract_bounds.js`):

```javascript
import * as topojson from 'topojson-client';

const data = await Bun.file('/tmp/counties.json').json();
const geojson = topojson.feature(data, data.objects.map);

// Find your city (check available names first)
console.log('Available cities:', geojson.features.map(f => f.properties.name));

// Extract bounds for specific city
const cityName = '高雄市'; // Example: Kaohsiung City
const city = geojson.features.find(f => f.properties.name === cityName);

if (!city) {
  console.error(`City "${cityName}" not found`);
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

console.log(`\n${cityName} Bounds:`);
console.log(JSON.stringify({
  north: bounds.maxLat,
  south: bounds.minLat,
  east: bounds.maxLng,
  west: bounds.minLng
}, null, 2));
```

Run the script:

```bash
bun extract_bounds.js
```

#### 3. Update Code

**a. Update City type** (`src/api.ts`):

```typescript
export type City = 'taipei' | 'new-taipei' | 'kaohsiung';
```

**b. Add bounds to CITY_BOUNDS** (`src/api.ts`):

```typescript
export const CITY_BOUNDS = {
  // ... existing cities
  'kaohsiung': {
    north: ..., // from extraction script
    south: ...,
    east: ...,
    west: ...,
  },
} as const;
```

**c. Update getCitiesInViewport** (`src/api.ts`):

```typescript
export function getCitiesInViewport(...) {
  // ... existing code

  if (doesViewportIntersectCity(viewport, 'kaohsiung')) {
    cities.push('kaohsiung');
  }

  return cities;
}
```

**d. Add data fetching function** (`src/api.ts`):

```typescript
async function fetchKaohsiungData(): Promise<UnifiedTrashCollectionPoint[]> {
  // Implement data fetching from Kaohsiung's open data API
  // Map to UnifiedTrashCollectionPoint format
}
```

**e. Update main fetch function** (`src/api.ts`):

```typescript
export async function fetchTrashCollectionPoints(city: City = 'taipei'): Promise<UnifiedTrashCollectionPoint[]> {
  if (city === 'new-taipei') return fetchNewTaipeiData();
  if (city === 'kaohsiung') return fetchKaohsiungData();
  return fetchTaipeiData();
}
```

**f. Update UI** (`src/App.tsx`):

Add the new city to the dropdown selector if needed.

#### 4. Cleanup

Remove the temporary development dependency:

```bash
bun remove topojson-client
```

### City Name Reference

Common Taiwan city names in TopoJSON:
- 臺北市 / 台北市 (Taipei City)
- 新北市 (New Taipei City)
- 桃園市 (Taoyuan City)
- 臺中市 / 台中市 (Taichung City)
- 臺南市 / 台南市 (Tainan City)
- 高雄市 (Kaohsiung City)
- 基隆市 (Keelung City)
- 新竹市 (Hsinchu City)
- 嘉義市 (Chiayi City)

### Testing

After adding a new city:
1. Verify the bounds are correct by zooming to that city's region
2. Check that data loads when viewport intersects the city
3. Test multi-city loading when viewport spans multiple cities
4. Verify zoom level restrictions work (< MIN_DATA_LOAD_ZOOM)

### Performance Considerations

- **MIN_DATA_LOAD_ZOOM**: Adjust in `src/api.ts` based on total dataset size
- **Viewport intersection**: Current implementation uses simple bounding box overlap
- **Data caching**: Consider implementing if adding many cities
- **Loading strategy**: Data loads only when city set changes, not on every zoom/pan
