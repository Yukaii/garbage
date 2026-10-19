# Taipei Trash Collection Map

Static React + Vite + MapLibre PWA showing garbage-truck collection points for Taipei, New Taipei, Taichung and Kaohsiung. Hosted on **GitHub Pages** at https://garbage.yukai.dev (see `.github/workflows/deploy.yml`). Data lives on the orphan `data` branch and is copied into `public/` at build time (`bun run dump-data`).

## Commands

- `bun install` — install (lockfile is `bun.lock`; CI should use `--frozen-lockfile`)
- `bun run dev` — Vite dev server
- `bun run typecheck` — `tsc --noEmit` over `src/` and `vite.config.ts`
- `bun run build` — production build into `dist/`

## MCP server

`mcp/` is a separate Vercel project (Root Directory `mcp`) exposing the data as a read-only MCP server; the web app itself stays on GitHub Pages. It imports the adapters from `src/cities`, so keep adapter changes compatible with both (`setDataBaseUrl` in `BaseAdapter.ts` resolves their root-relative URLs outside the browser; `fetchData({ allDays: true })` skips Taichung's today-only filter). Weekly schedules live in the optional `schedule` field; New Taipei's comes from the compact `*Days` fields that `.github/actions/trim-data.sh` writes into the published JSON. Live at https://mcp.garbage.yukai.dev/mcp. See `mcp/README.md`.

## Agent discovery metadata

Keep these in sync when tools, cities, data fields or URLs change:

- `public/llms.txt` (site guide + data-file schemas) and `mcp/public/llms.txt` (MCP guide).
- `mcp/server.json` (official MCP Registry manifest) and `mcp/public/server-card.json` (Server Card) must agree on `name`, `version` and `description`; the registry manifest mirrors the card and only adds `remotes`/`icons`/`_meta`. Directory submission steps are in `docs/mcp-directory-submission.md`.
- `public/.well-known/ai-catalog.json` → Server Card at `https://mcp.garbage.yukai.dev/mcp/server-card` (`mcp/public/server-card.json`, served with `application/mcp-server-card+json` by `mcp/vercel.json`). Card fields must not contradict `server/discover` (`serverInfo.name` is `dev.yukai/taipei-trash`, protocol `2026-07-28`).
- The site's JSON-LD `SearchAction` targets `?q=`, which `App.tsx` reads and writes; don't advertise URL parameters the app doesn't handle.
- GitHub Pages deploy passes `include-hidden-files: true` so `/.well-known/` ships (artifact action v4+ drops dotfiles by default).

## Tooling conventions

Default to using Bun instead of Node.js for scripts and package management. The web app itself is built with **Vite** (not `Bun.serve()` HTML imports).

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

## Cities

`src/cities/cityRegistry.ts` is the single source of truth. Each city is a `CityDataAdapter` subclass in `src/cities/adapters/` that declares `cityId`, `displayName`, `dataUrl`, `bounds` (north/south/east/west) and implements `fetchRawData()` / `mapToUnified()` returning `UnifiedTrashCollectionPoint` (`src/types.ts`). Viewport-based loading (`getCitiesInViewport` in `src/api.ts`) derives from registry bounds, so there is no per-city `if` to edit.

Current adapters: `taipei`, `new-taipei`, `taichung`, `kaohsiung`.

### Adding a city

1. Create `src/cities/adapters/<City>Adapter.ts` extending `CityDataAdapter` (bounds can be derived from Taiwan.TopoJSON `topojson/counties.json`, https://github.com/jason2506/Taiwan.TopoJSON).
2. Export it from `src/cities/adapters/index.ts`.
3. Add the id to the `City` union and register it in `src/cities/cityRegistry.ts`.
4. Add the fetch step to `.github/workflows/update-data.yml` and the file to `scripts/dump-data.sh`.
5. Verify: bounds on the map, data loads when the viewport intersects the city, multi-city loading, and the `MIN_DATA_LOAD_ZOOM` restriction.

More detail: `src/cities/README.md`, `docs/adding-new-city-data.md`, `docs/data-fetching-mechanism.md`, `docs/EXTENDING-ROUTES-TO-NEW-CITIES.md`.
