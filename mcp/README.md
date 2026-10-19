# taipei-trash MCP server

Read-only [Model Context Protocol](https://modelcontextprotocol.io) server for the garbage-truck data behind https://garbage.yukai.dev. Built on `mcp-handler` 2.x + `@modelcontextprotocol/server` 2.x, so one stateless Streamable HTTP endpoint serves the 2026-07-28 spec and 2025-era clients.

It reuses the web app's city adapters (`../src/cities`), so field mapping is identical to the site. Data is fetched from the published JSON (`DATA_BASE_URL`, default `https://garbage.yukai.dev`) and cached in memory for an hour per warm instance. Cities load lazily; Taichung's file is ~50 MB (about 1 s cold, ~400 MB RSS once loaded).

## Tools

| Tool | Purpose |
|---|---|
| `list_cities` | Supported cities, ids and bounding boxes |
| `find_nearby_points` | Stops within 50–2000 m of a coordinate, nearest first |
| `search_points` | Text search by district / village / location / route within one city |
| `get_schedule` | One stop plus every stop on its route, in arrival order |

All tools are annotated read-only and return `structuredContent` (with a text mirror). Times are `Asia/Taipei`.

Points include a weekly `schedule` (collection type → ISO weekdays, Mon=1 … Sun=7) and a `servesToday` flag (computed in Taiwan time) for **New Taipei** and **Taichung**, the cities whose open data carries weekdays. Taipei and Kaohsiung publish no weekday data, so those points have neither field. The server loads adapters in `allDays` mode; the web app keeps Taichung's default "today only" view.

## Develop

```bash
cd mcp
bun install
bun test            # query logic + adapter schedule handling
bun run typecheck
bun dev.ts          # http://localhost:3939/api/mcp
```

Try it: `npx @modelcontextprotocol/inspector` and connect to `http://localhost:3939/api/mcp`.

## Deploy (Vercel)

This directory is its own Vercel project (`taipei-trash-mcp`), separate from the GitHub Pages site. The function is bundled with esbuild at build time (`bun run build` → `api/mcp.js`), because the shared adapters use extensionless imports that Node ESM can't resolve. The CLI flow is `vercel deploy --prod` from the **repo root** (the project's Root Directory is `mcp`; `.vercelignore` limits the upload):

1. Import the repo in Vercel and set **Root Directory** to `mcp`.
2. Keep **Include source files outside of the Root Directory** enabled (the default) — the function imports `../src/cities`.
3. Add the domain (`vercel api /v10/projects/<id>/domains -X POST -F name=mcp.yukai.dev`) and create the CNAME + `_vercel` TXT records Vercel returns at your DNS provider.
4. Optional env: `DATA_BASE_URL`, `MCP_ALLOWED_ORIGINS` (comma-separated; browser clients only).
5. Rate limiting is a Vercel Firewall rule (`mcp-rate-limit`, 60 requests/min per IP on `/api/mcp` and `/mcp`), managed with `vercel firewall rules`.

Production: **https://mcp.yukai.dev/mcp** (also `/api/mcp`; fallback `https://taipei-trash-mcp.vercel.app`). DNS lives in Cloudflare: a DNS-only `mcp` CNAME to the project's Vercel target and a `_vercel` TXT verification record, managed with the Cloudflare `cf` CLI. For stdio-only clients use `npx mcp-remote <url>`.

## Security notes

- No auth: the data is public and every tool is read-only.
- Requests carrying an `Origin` header are rejected (403) unless listed in `MCP_ALLOWED_ORIGINS`, per the MCP transport spec. Native clients send no `Origin`.
