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

All tools are annotated read-only and return `structuredContent` (with a text mirror). Times are `Asia/Taipei`. Taichung and New Taipei schedules vary by weekday, which the unified point format does not carry yet, so day-of-week is not exposed.

## Develop

```bash
cd mcp
bun install
bun test            # query logic
bun run typecheck
bun dev.ts          # http://localhost:3939/api/mcp
```

Try it: `npx @modelcontextprotocol/inspector` and connect to `http://localhost:3939/api/mcp`.

## Deploy (Vercel)

This directory is its own Vercel project, separate from the GitHub Pages site:

1. Import the repo in Vercel and set **Root Directory** to `mcp`.
2. Keep **Include source files outside of the Root Directory** enabled (the default) — the function imports `../src/cities`.
3. Add a domain such as `mcp.yukai.dev` and create the CNAME Vercel shows at your DNS provider.
4. Optional env: `DATA_BASE_URL`, `MCP_ALLOWED_ORIGINS` (comma-separated; browser clients only).
5. Add a Vercel Firewall rate-limit rule for `/api/mcp`.

Clients connect to `https://<your-domain>/api/mcp` (also routed from `/mcp`). For stdio-only clients use `npx mcp-remote <url>`.

## Security notes

- No auth: the data is public and every tool is read-only.
- Requests carrying an `Origin` header are rejected (403) unless listed in `MCP_ALLOWED_ORIGINS`, per the MCP transport spec. Native clients send no `Origin`.
