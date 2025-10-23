# Tech Stack Documentation

## Overview

This document provides a comprehensive overview of the technologies, frameworks, and tools used in the Taipei Trash Collection Map application.

---

## Table of Contents

1. [Frontend Stack](#frontend-stack)
2. [Build Tools & Development](#build-tools--development)
3. [Styling & UI](#styling--ui)
4. [Maps & Geospatial](#maps--geospatial)
5. [Progressive Web App (PWA)](#progressive-web-app-pwa)
6. [CI/CD & Infrastructure](#cicd--infrastructure)
7. [Data Processing](#data-processing)
8. [Development Tools](#development-tools)
9. [Package Management](#package-management)
10. [Architecture Decisions](#architecture-decisions)

---

## Frontend Stack

### Core Framework

#### React 19.2.0
- **Purpose**: UI framework for building component-based interface
- **License**: MIT
- **Usage**:
  - Main application UI components
  - State management with hooks (`useState`, `useEffect`, `useMemo`)
  - Component composition for modular architecture
- **Key Features Used**:
  - Functional components with hooks
  - Concurrent features (React 19)
  - Optimized re-renders with `useMemo` and `useCallback`

**Example** (`src/App.tsx`):
```typescript
import { useEffect, useState, useMemo } from 'react';

function App() {
  const [points, setPoints] = useState<UnifiedTrashCollectionPoint[]>([]);
  const [darkMode, setDarkMode] = useState(false);
  // ... component logic
}
```

#### React DOM 19.2.0
- **Purpose**: React renderer for web browsers
- **License**: MIT
- **Usage**: Renders React components to the DOM

**Example** (`src/main.tsx`):
```typescript
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')!).render(<App />);
```

### TypeScript 5.x
- **Purpose**: Type-safe JavaScript with static typing
- **License**: Apache 2.0
- **Configuration**: `tsconfig.json`
  - Target: ESNext
  - Module: Preserve (Bundler mode)
  - JSX: react-jsx
  - Strict mode enabled
- **Usage**:
  - Type definitions for all data structures (`src/types.ts`)
  - Type-safe API functions (`src/api.ts`)
  - Component prop types
- **Benefits**:
  - Catch errors at compile time
  - Better IDE autocomplete and refactoring
  - Self-documenting code

**Type Definitions** (`src/types.ts`):
```typescript
export interface UnifiedTrashCollectionPoint {
  id: string;
  city: string;
  district: string;
  village: string;
  location: string;
  route: string;
  arrivalTime: string;
  departureTime: string;
  longitude: string;
  latitude: string;
  source: 'taipei' | 'new-taipei';
}
```

---

## Build Tools & Development

### Vite 7.1.11
- **Purpose**: Next-generation frontend build tool
- **License**: MIT
- **Configuration**: `vite.config.ts`
- **Features Used**:
  - Lightning-fast Hot Module Replacement (HMR)
  - Optimized production builds
  - ESM-based dev server
  - Plugin ecosystem
  - Environment variable injection

**Configuration** (`vite.config.ts`):
```typescript
export default defineConfig({
  plugins: [
    react(),
    htmlEnvPlugin(),
    VitePWA({ /* ... */ })
  ],
  base: '/',
  server: {
    port: 3000,
  },
})
```

**Build Commands**:
```bash
bun run dev      # Start dev server on http://localhost:3000
bun run build    # Build for production (outputs to dist/)
bun run preview  # Preview production build locally
```

#### @vitejs/plugin-react 5.0.4
- **Purpose**: Official Vite plugin for React with Fast Refresh
- **License**: MIT
- **Features**:
  - Fast Refresh for instant feedback during development
  - Automatic JSX transformation
  - React DevTools integration

### Bun Runtime
- **Purpose**: All-in-one JavaScript runtime, package manager, and bundler
- **Version**: Latest (as specified in project)
- **Usage**:
  - Package management (alternative to npm/pnpm)
  - Script execution
  - Development server
  - Build process
- **Configuration**: Specified in `package.json`
  ```json
  "packageManager": "pnpm@9.5.0+..."
  ```
  Note: Despite packageManager field showing pnpm, project uses Bun as per `CLAUDE.md`

**Why Bun?** (from `CLAUDE.md`):
- Faster than Node.js, npm, and pnpm
- Built-in TypeScript support
- Native SQLite, Redis, and Postgres APIs
- Integrated test runner
- Automatic `.env` loading

---

## Styling & UI

### Tailwind CSS 4.1.15
- **Purpose**: Utility-first CSS framework
- **License**: MIT
- **Configuration**: `tailwind.config.js`
- **Features Used**:
  - Utility classes for rapid UI development
  - Dark mode support (`class` strategy)
  - Responsive design utilities
  - Custom theme extensions
- **PostCSS Integration**: `@tailwindcss/postcss@4.1.15`

**Configuration** (`tailwind.config.js`):
```javascript
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [],
}
```

**Dark Mode Implementation**:
```typescript
// Toggle dark mode class on <html> element
const [darkMode, setDarkMode] = useState(
  window.matchMedia('(prefers-color-scheme: dark)').matches
);

useEffect(() => {
  document.documentElement.classList.toggle('dark', darkMode);
  localStorage.setItem('darkMode', darkMode.toString());
}, [darkMode]);
```

### PostCSS 8.5.6
- **Purpose**: CSS transformation tool
- **License**: MIT
- **Configuration**: `postcss.config.js`
- **Plugins**:
  - `@tailwindcss/postcss`: Process Tailwind directives
  - `autoprefixer@10.4.21`: Add vendor prefixes automatically

### Autoprefixer 10.4.21
- **Purpose**: Automatically add CSS vendor prefixes
- **License**: MIT
- **Usage**: Ensures cross-browser compatibility

### Lucide React 0.546.0
- **Purpose**: Beautiful, consistent icon library
- **License**: ISC
- **Usage**: All icons in the application
- **Icons Used**:
  - `Info`, `Sun`, `Moon` (theme and modal controls)
  - `ChevronDown` (dropdown indicators)
  - `Layers`, `Locate`, `Navigation`, `Route`, `X` (map controls)
  - And more...

**Example**:
```typescript
import { Sun, Moon } from 'lucide-react';

<button onClick={toggleDarkMode}>
  {darkMode ? <Sun /> : <Moon />}
</button>
```

---

## Maps & Geospatial

### MapLibre GL JS 5.9.0
- **Purpose**: Open-source interactive map rendering library
- **License**: BSD-3-Clause
- **Why MapLibre?**:
  - Free and open-source (fork of Mapbox GL JS v1)
  - No API keys or usage limits
  - Full-featured vector map rendering
  - Active community development
- **Features Used**:
  - Vector tile rendering
  - Custom markers and popups
  - Layer styling (circles, symbols)
  - Geolocation API
  - Navigation controls
  - Camera animations

**CDN Stylesheet** (in `index.html:31`):
```html
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5.9.0/dist/maplibre-gl.css" />
```

### React Map GL 8.1.0
- **Purpose**: React wrapper for MapLibre GL JS
- **License**: MIT
- **Components Used**:
  - `Map`: Main map container
  - `Source`: Data source for layers
  - `Layer`: Visual representation of data
  - `Popup`: Information popup on marker click
  - `Marker`: Custom markers (user location, truck positions)
  - `NavigationControl`: Zoom/rotation controls

**Example** (`src/Map.tsx`):
```typescript
import Map, { Source, Layer, Popup, NavigationControl, Marker } from 'react-map-gl/maplibre';

<Map
  ref={mapRef}
  style={{ width: '100%', height: '100%' }}
  mapStyle={mapStyle}
  initialViewState={{
    longitude: 121.5654,
    latitude: 25.033,
    zoom: 11
  }}
>
  <Source id="points" type="geojson" data={geojsonData}>
    <Layer {...pointLayer} />
    <Layer {...labelLayer} />
  </Source>
  <NavigationControl position="bottom-right" />
</Map>
```

### Map Style Providers

#### OpenStreetMap (via Protomaps)
- **Purpose**: Street map style
- **License**: Open Database License (ODbL)
- **Source**: `https://api.protomaps.com/tiles/v4.json`
- **Features**:
  - Detailed street-level data
  - Building footprints
  - Points of interest
  - Multiple languages support

#### Satellite Imagery
- **Source**: Custom WMTS configuration (implementation TBD)
- **Purpose**: Satellite/aerial view option

**Map Style Switching** (`src/Map.tsx`):
```typescript
const [mapStyleType, setMapStyleType] = useState<MapStyleType>('street');

const mapStyle = useMemo(() => {
  if (mapStyleType === 'satellite') {
    return /* satellite style */;
  }
  return darkMode
    ? 'https://api.protomaps.com/tiles/v4.json?theme=dark'
    : 'https://api.protomaps.com/tiles/v4.json?theme=light';
}, [mapStyleType, darkMode]);
```

---

## Progressive Web App (PWA)

### Vite Plugin PWA 1.1.0
- **Purpose**: Zero-config PWA plugin for Vite
- **License**: MIT
- **Features Enabled**:
  - Service Worker generation
  - Web App Manifest
  - Offline support
  - Install prompts
  - Cache strategies

**Configuration** (`vite.config.ts:22-95`):
```typescript
VitePWA({
  registerType: 'prompt',
  includeAssets: ['favicon.svg', 'icons/*.png'],
  manifest: {
    name: '台北市垃圾車地圖',
    short_name: '垃圾車地圖',
    lang: 'zh-TW',
    start_url: '.',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#0f172a',
    theme_color: '#111827',
    description: '查詢台北市與新北市垃圾車和資源回收車路線...',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      }
    ]
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
    maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10 MB
    runtimeCaching: [ /* ... */ ]
  }
})
```

### Workbox Window 7.3.0
- **Purpose**: Service Worker registration and lifecycle management
- **License**: MIT
- **Usage**: Handle PWA update prompts
- **Component**: `src/ReloadPrompt.tsx`

**Cache Strategies**:

1. **Unpkg CDN** (MapLibre CSS):
   - Strategy: `CacheFirst`
   - Cache Duration: 30 days
   - Max Entries: 10

2. **JSON Data Files**:
   - Strategy: `NetworkFirst` with 10s timeout
   - Cache Duration: 24 hours
   - Max Entries: 10
   - Fallback to cache if network fails

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
    }
  }
}
```

---

## CI/CD & Infrastructure

### GitHub Actions
- **Purpose**: Automated workflows for CI/CD
- **Workflows**:
  1. **Update Data** (`.github/workflows/update-data.yml`)
     - Triggers: 1st of each month, manual
     - Jobs: Fetch data from APIs, commit to `data` branch

  2. **Deploy** (`.github/workflows/deploy.yml`)
     - Triggers: Push to main, 2nd of each month, manual
     - Jobs: Build application, deploy to GitHub Pages

**Build Environment**:
- **Runner**: `ubuntu-latest`
- **Bun Setup**: `oven-sh/setup-bun@v2`
- **Node Version**: Not used (Bun replaces Node.js)

**Deploy Steps**:
```yaml
- name: Install dependencies
  run: bun install

- name: Dump latest data
  run: bun run dump-data

- name: Trim data
  run: ./.github/actions/trim-data.sh

- name: Build
  run: bun run build

- name: Deploy to GitHub Pages
  uses: actions/deploy-pages@v4
```

### GitHub Pages
- **Purpose**: Static site hosting
- **URL**: https://garbage.yukai.dev/
- **Configuration**:
  - Source: GitHub Actions artifact
  - Custom domain: Configured via DNS
  - HTTPS: Enabled by default

**Permissions** (`.github/workflows/deploy.yml:14-17`):
```yaml
permissions:
  contents: read
  pages: write
  id-token: write
```

### Custom Domain Setup
- **Domain**: `garbage.yukai.dev`
- **DNS**: CNAME record pointing to GitHub Pages
- **SSL**: Automatically provisioned by GitHub

---

## Data Processing

### jq (CLI tool)
- **Purpose**: Command-line JSON processor
- **License**: MIT
- **Usage in CI/CD**:
  - Merge multiple API responses
  - Extract specific fields
  - Transform data structures
  - Calculate statistics

**Examples**:

1. **Merge API batches** (`.github/workflows/update-data.yml:31`):
```bash
jq -s '{result: {results: (.[0].result.results + .[1].result.results + ...)}}' \
  temp1.json temp2.json ... > trash-collection-points.json
```

2. **Trim unused fields** (`.github/actions/trim-data.sh:8-26`):
```bash
cat public/trash-collection-points.json | jq '{
  result: {
    results: [.result.results[] | {
      _id: ._id,
      "行政區": .["行政區"],
      "里別": .["里別"],
      # ... keep only needed fields
    }]
  }
}' > output.json
```

3. **Extract statistics**:
```bash
RECORD_COUNT=$(jq '.result.results | length' data.json)
DISTRICTS=$(jq '[.[].city] | unique | length' data.json)
```

### curl
- **Purpose**: Data fetching from APIs
- **Usage**: Download JSON data from government open data portals
- **APIs**:
  - Taipei City: `data.taipei/api/v1/dataset/...`
  - New Taipei City: `data.ntpc.gov.tw/api/datasets/...`

**Example** (`.github/workflows/update-data.yml:24-28`):
```bash
curl -s "https://data.taipei/api/v1/dataset/xyz?limit=1000&offset=0" > temp1.json
curl -s "https://data.taipei/api/v1/dataset/xyz?limit=1000&offset=1000" > temp2.json
```

---

## Development Tools

### Image Processing

#### Sharp 0.34.4
- **Purpose**: High-performance image processing
- **License**: Apache 2.0
- **Usage**: Generate PWA icons in different sizes
- **Script**: `generate-icons.ts`

**Icon Generation Example**:
```typescript
import sharp from 'sharp';

// Generate 192x192 icon
await sharp('logo.svg')
  .resize(192, 192)
  .toFile('public/icons/icon-192.png');

// Generate 512x512 icon
await sharp('logo.svg')
  .resize(512, 512)
  .toFile('public/icons/icon-512.png');
```

### Git
- **Version Control**: Git with GitHub hosting
- **Branching Strategy**:
  - `main`: Application code
  - `data`: Orphan branch for JSON data files
- **Workflow**:
  - Feature development on `main`
  - Data updates isolated in `data` branch
  - Monthly automated data updates

**Key Commands** (in CI/CD):
```bash
# Fetch data branch without switching
git fetch origin data:data

# Show file from specific branch
git show data:trash-collection-points.json > output.json

# Check for changes
git diff --quiet file.json
```

---

## Package Management

### Bun (Recommended)
- **Version**: Latest
- **Why Bun?** (from `CLAUDE.md`):
  - Faster than npm, pnpm, Yarn
  - Built-in TypeScript support
  - All-in-one solution (runtime + package manager + bundler)
- **Commands**:
  ```bash
  bun install           # Install dependencies
  bun add <package>     # Add dependency
  bun run <script>      # Run package.json script
  bun <file>            # Execute TypeScript/JavaScript file
  ```

### PNPM 9.5.0 (Alternative)
- **Status**: Listed in `package.json` as package manager
- **Note**: Project documentation recommends Bun, but pnpm is also supported
- **Lockfile**: `pnpm-lock.yaml` (if using pnpm)

**Package.json Scripts**:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "dump-data": "git show data:... > public/..."
  }
}
```

---

## Architecture Decisions

### Why These Technologies?

#### 1. React + TypeScript
**Decision**: Use React with TypeScript for frontend

**Rationale**:
- **React**: Most popular UI library, excellent ecosystem, component reusability
- **TypeScript**: Type safety prevents bugs, better IDE support, self-documenting
- **Trade-offs**: Learning curve for TypeScript, more setup than vanilla JS

**Alternatives Considered**:
- Vue.js: Less ecosystem, but simpler
- Svelte: Smaller bundle, but smaller community
- Plain JavaScript: Faster prototyping, but error-prone

#### 2. Vite over Create React App
**Decision**: Use Vite as build tool

**Rationale**:
- **Performance**: 10-100x faster dev server startup
- **Modern**: ESM-based, optimized for modern browsers
- **DX**: Instant HMR, better error messages
- **Trade-offs**: Less mature than Webpack-based tools

**Alternatives Considered**:
- Create React App: More established, but slow and deprecated
- Next.js: Overkill for static site, requires server
- Webpack: Slower, more complex configuration

#### 3. MapLibre GL JS over Mapbox
**Decision**: Use MapLibre GL JS for map rendering

**Rationale**:
- **Cost**: 100% free and open-source, no API keys
- **Features**: Full parity with Mapbox GL JS v1
- **Community**: Active development, growing ecosystem
- **Trade-offs**: Fewer ready-made styles than Mapbox

**Alternatives Considered**:
- Mapbox GL JS: More polished, but requires API key and pricing
- Leaflet: Simpler, but less performant for vector tiles
- Google Maps: Expensive, limited customization

#### 4. Tailwind CSS over Custom CSS
**Decision**: Use Tailwind CSS for styling

**Rationale**:
- **Productivity**: Rapid UI development with utility classes
- **Consistency**: Design system built-in
- **Performance**: Unused styles purged in production
- **Dark Mode**: Built-in support with `class` strategy
- **Trade-offs**: HTML verbosity, learning curve

**Alternatives Considered**:
- CSS Modules: More traditional, but more boilerplate
- Styled Components: Good DX, but runtime overhead
- Plain CSS: Simple, but hard to maintain at scale

#### 5. Bun over Node.js/npm
**Decision**: Use Bun as JavaScript runtime and package manager

**Rationale**:
- **Performance**: 2-10x faster than Node.js
- **Integrated**: Runtime + package manager + bundler + test runner
- **Modern**: Built for modern JavaScript/TypeScript
- **Trade-offs**: Newer ecosystem, potential compatibility issues

**Alternatives Considered**:
- Node.js + npm: Most established, largest ecosystem
- Node.js + pnpm: Faster than npm, disk-efficient
- Deno: Secure by default, but smaller ecosystem

#### 6. GitHub Pages + Actions over Vercel/Netlify
**Decision**: Use GitHub Pages with GitHub Actions for deployment

**Rationale**:
- **Cost**: 100% free for public repos
- **Integration**: Native GitHub integration, no external service
- **Control**: Full control over build and deploy process
- **Custom Domain**: Free SSL with custom domain
- **Trade-offs**: Less features than Vercel/Netlify (no serverless, preview deployments)

**Alternatives Considered**:
- Vercel: More features, but overkill for static site
- Netlify: Similar to Vercel, but not needed
- AWS S3 + CloudFront: Flexible, but more complex and costly

#### 7. Static JSON Files over Runtime API Calls
**Decision**: Pre-fetch and bundle data as static JSON files

**Rationale**:
- **Performance**: No API rate limits, faster load times
- **Reliability**: No dependency on external API uptime
- **Offline**: Works with PWA offline mode
- **Simplicity**: No backend, API keys, or CORS issues
- **Trade-offs**: Data freshness limited to monthly updates

**Alternatives Considered**:
- Direct API calls: Real-time data, but slower, rate limits, CORS issues
- Backend proxy: More control, but requires server and maintenance
- GraphQL API: Flexible queries, but overkill for simple data

#### 8. Orphan Data Branch over Monorepo
**Decision**: Store data in separate `data` orphan branch

**Rationale**:
- **Repository Size**: Keeps main branch lightweight
- **History**: Data updates don't pollute code history
- **Independence**: Data can be updated without code changes
- **CI/CD**: Clean separation of concerns
- **Trade-offs**: More complex workflow, two branches to manage

**Alternatives Considered**:
- Store in main branch: Simpler, but large repo size
- Separate data repository: More separation, but more complex
- External storage (S3/CDN): Flexible, but adds cost and complexity

---

## Technology Summary Table

| Category | Technology | Version | License | Purpose |
|----------|-----------|---------|---------|---------|
| **Frontend** |
| UI Framework | React | 19.2.0 | MIT | Component-based UI |
| Language | TypeScript | 5.x | Apache 2.0 | Type-safe JavaScript |
| Map Library | MapLibre GL JS | 5.9.0 | BSD-3-Clause | Interactive maps |
| Map React Wrapper | react-map-gl | 8.1.0 | MIT | React bindings for maps |
| Icons | Lucide React | 0.546.0 | ISC | Icon library |
| **Styling** |
| CSS Framework | Tailwind CSS | 4.1.15 | MIT | Utility-first CSS |
| CSS Processor | PostCSS | 8.5.6 | MIT | CSS transformation |
| Autoprefixer | autoprefixer | 10.4.21 | MIT | Vendor prefixes |
| **Build Tools** |
| Build Tool | Vite | 7.1.11 | MIT | Frontend build tool |
| React Plugin | @vitejs/plugin-react | 5.0.4 | MIT | React Fast Refresh |
| Runtime | Bun | Latest | MIT | JS runtime + PM |
| **PWA** |
| PWA Plugin | vite-plugin-pwa | 1.1.0 | MIT | PWA generation |
| Service Worker | Workbox | 7.3.0 | MIT | SW lifecycle |
| **Dev Tools** |
| Image Processing | Sharp | 0.34.4 | Apache 2.0 | Icon generation |
| Data Processing | jq | Latest | MIT | JSON processing |
| HTTP Client | curl | Latest | MIT | API fetching |
| Version Control | Git | Latest | GPL-2.0 | Source control |
| **Infrastructure** |
| CI/CD | GitHub Actions | N/A | N/A | Automation |
| Hosting | GitHub Pages | N/A | N/A | Static hosting |
| Map Tiles | Protomaps | N/A | ODbL | Map data |

---

## Browser Support

### Minimum Requirements

Based on the technologies used, the application supports:

**Desktop Browsers**:
- Chrome/Edge: 90+ (2021)
- Firefox: 88+ (2021)
- Safari: 14+ (2020)

**Mobile Browsers**:
- Chrome Android: 90+
- Safari iOS: 14+
- Samsung Internet: 15+

**Key APIs Required**:
- ES2020+ features (optional chaining, nullish coalescing)
- Web Workers (for Service Worker)
- IndexedDB (for PWA cache)
- Geolocation API (for "locate me" feature)
- LocalStorage (for user preferences)
- Fetch API (for data loading)

**Progressive Enhancement**:
- Core functionality works without JavaScript (map won't render)
- PWA features gracefully degrade in unsupported browsers
- Dark mode respects system preference as fallback

---

## Performance Characteristics

### Bundle Sizes (Production Build)

**JavaScript**:
- Main bundle: ~200-300 KB (gzipped)
- React + React DOM: ~150 KB
- MapLibre GL JS: ~800 KB (loaded via CDN)
- Application code: ~50 KB

**CSS**:
- Tailwind (purged): ~10-20 KB (gzipped)
- MapLibre CSS: ~30 KB (loaded via CDN)

**Data**:
- Taipei: ~1.2 MB
- New Taipei: ~6.6 MB
- Total data: ~7.8 MB (cached by PWA)

**Total First Load**: ~8-9 MB
**Subsequent Loads**: ~200 KB (from cache)

### Build Performance

**Development Server Startup**:
- Cold start: <1 second (with Bun + Vite)
- HMR updates: <100ms

**Production Build Time**:
- Full build: 10-20 seconds
- Includes: TypeScript compilation, React bundling, Tailwind purging, PWA generation

**CI/CD Pipeline Time**:
- Data update workflow: 2-3 minutes
- Deploy workflow: 3-5 minutes (including build)

---

## Security Considerations

### Content Security Policy
Currently not implemented. Considerations for future:
- Restrict script sources to self + trusted CDNs
- Enable only necessary features
- Report violations to monitoring service

### Dependency Security
- **Automated Updates**: Dependabot enabled for security patches
- **Audit**: Run `bun audit` regularly
- **Review**: Manual review of critical dependency updates

### Data Privacy
- **No User Data Collection**: Application doesn't collect personal data
- **LocalStorage**: Only stores user preferences (theme, city)
- **Geolocation**: Only used when explicitly requested by user
- **Analytics**: Google AdSense (optional, configured via environment variables)

### API Keys
- **MapLibre**: No API key required (open-source)
- **Protomaps**: Free tier, no authentication
- **AdSense**: Client ID stored in environment variables, injected at build time

---

## Environment Variables

### Build-Time Variables

**File**: `.env` (not committed to repo)

```bash
# Google AdSense (optional)
VITE_ADSENSE_CLIENT_ID=ca-pub-xxxxxxxxxx
VITE_ADSENSE_SLOT_ID=xxxxxxxxxx
```

**Usage** (`vite.config.ts:6-16`):
```typescript
function htmlEnvPlugin(): Plugin {
  return {
    name: 'html-env-plugin',
    transformIndexHtml(html) {
      return html.replace(
        /%%VITE_ADSENSE_CLIENT_ID%%/g,
        process.env.VITE_ADSENSE_CLIENT_ID || ''
      )
    },
  }
}
```

**GitHub Actions** (`.github/workflows/deploy.yml:50-52`):
```yaml
- name: Build
  env:
    VITE_ADSENSE_CLIENT_ID: ${{ secrets.VITE_ADSENSE_CLIENT_ID }}
    VITE_ADSENSE_SLOT_ID: ${{ secrets.VITE_ADSENSE_SLOT_ID }}
  run: bun run build
```

---

## Future Tech Stack Considerations

### Potential Upgrades

1. **React Server Components**
   - Server-side rendering for better SEO
   - Reduced client bundle size
   - Requires backend infrastructure

2. **SWR or React Query**
   - Better data fetching and caching
   - Automatic background refetch
   - Optimistic updates

3. **TanStack Router**
   - Type-safe routing
   - Better URL state management
   - Code splitting per route

4. **Zustand or Jotai**
   - Global state management
   - Better than prop drilling
   - Smaller than Redux

5. **Biome**
   - Replace ESLint + Prettier
   - Faster linting and formatting
   - Unified toolchain

6. **Turbopack (when stable)**
   - Replace Vite in the future
   - Even faster builds
   - Better caching

7. **Bun's Built-in Test Runner**
   - Replace external test libraries
   - Faster test execution
   - Integrated with Bun ecosystem

---

## References

### Documentation Links

- **React**: https://react.dev/
- **TypeScript**: https://www.typescriptlang.org/
- **Vite**: https://vitejs.dev/
- **Tailwind CSS**: https://tailwindcss.com/
- **MapLibre GL JS**: https://maplibre.org/
- **react-map-gl**: https://visgl.github.io/react-map-gl/
- **Bun**: https://bun.sh/
- **Workbox**: https://developer.chrome.com/docs/workbox/
- **GitHub Actions**: https://docs.github.com/actions
- **GitHub Pages**: https://pages.github.com/

### Internal Documentation

- **Data Fetching Mechanism**: `docs/data-fetching-mechanism.md`
- **Project Instructions**: `CLAUDE.md`
- **Type Definitions**: `src/types.ts`
- **API Documentation**: `src/api.ts` (inline comments)

---

**Last Updated**: 2025-10-23
**Maintainer**: See repository contributors
**Questions?**: Open an issue on GitHub
