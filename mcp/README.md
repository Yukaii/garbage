# Taiwan Garbage Truck Map — MCP Server

Read-only [Model Context Protocol](https://modelcontextprotocol.io) server for the garbage-truck dataset powering [garbage.yukai.dev](https://garbage.yukai.dev). Built on `mcp-handler` 2.x and `@modelcontextprotocol/server` 2.x, exposing a single stateless Streamable HTTP endpoint compatible with both the `2026-07-28` spec and 2025-era clients.

The server reuses the web app's city adapters (`../src/cities`), keeping field mappings identical across the site and MCP responses. Data is fetched from the published JSON files (`DATA_BASE_URL`, defaulting to `https://garbage.yukai.dev`) and cached in memory for one hour per warm instance. Cities load lazily on demand (note: Taichung's dataset is ~50 MB, taking ~1 s on cold load and ~400 MB RSS in memory).

## Tools

| Tool | Purpose |
|---|---|
| `list_cities` | List supported cities, their IDs, and geographic bounding boxes |
| `find_nearby_points` | Find stops within 50–2,000 m of a coordinate, sorted nearest first |
| `search_points` | Search stops in a city by district, village, road, or route keyword |
| `get_schedule` | Retrieve a stop along with every stop on its route in arrival order |

All tools are annotated read-only and return `structuredContent` alongside a plain-text summary. All times are in `Asia/Taipei`.

For **New Taipei** and **Taichung** (whose open data includes weekday schedules), each stop includes a weekly `schedule` (`collectionType` → ISO weekdays, `1`=Mon … `7`=Sun) and a `servesToday` boolean computed in Taiwan time. Taipei and Kaohsiung do not publish weekday schedules, so those fields are omitted. Unlike the web app's default "today only" view for Taichung, the MCP server loads adapters in `allDays` mode so agents can answer questions about any day of the week.

## Development

```bash
cd mcp
bun install
bun test            # query logic + adapter schedule tests
bun run typecheck
bun dev.ts          # http://localhost:3939/api/mcp
```

Test interactively with MCP Inspector:
```bash
npx @modelcontextprotocol/inspector
```
Then connect to `http://localhost:3939/api/mcp`.

## Deployment (Vercel)

This directory is deployed as a standalone Vercel project (`taipei-trash-mcp`), separate from the GitHub Pages web app. The serverless function is bundled with esbuild at build time (`bun run build` → `api/mcp.js`) so that extensionless TypeScript imports in `../src/cities` resolve cleanly in Node ESM.

To deploy from the **repository root** (`.vercelignore` keeps the upload minimal):

1. Import the repository in Vercel and set **Root Directory** to `mcp`.
2. Leave **Include source files outside of the Root Directory** enabled (default) so the build can import `../src/cities`.
3. Add the custom domain (`vercel api /v10/projects/<id>/domains -X POST -F name=mcp.garbage.yukai.dev`) and configure the `CNAME` and `_vercel` `TXT` records at your DNS provider.
4. Optional environment variables: `DATA_BASE_URL`, `MCP_ALLOWED_ORIGINS` (comma-separated allowlist for browser clients).
5. Rate limiting is enforced via a Vercel Firewall rule (`mcp-rate-limit`: 60 requests/min per IP on `/api/mcp` and `/mcp`).

Production endpoint: **https://mcp.garbage.yukai.dev/mcp** (also accessible at `/api/mcp`; fallback `https://taipei-trash-mcp.vercel.app`). For stdio-only clients, use `npx mcp-remote https://mcp.garbage.yukai.dev/mcp`.

## Discovery Endpoints

- `/mcp/server-card` — [MCP Server Card](https://github.com/modelcontextprotocol/experimental-ext-server-card) (SEP-2127), served as `application/mcp-server-card+json` from `public/server-card.json`.
- `/.well-known/ai-catalog.json` — [AI Catalog](https://github.com/Agent-Card/ai-catalog) entry pointing to the Server Card (also hosted on `https://garbage.yukai.dev`).
- `/llms.txt` — plain-text guide for LLMs.

## Directory Listings

- `server.json` — the [official MCP Registry](https://registry.modelcontextprotocol.io) manifest for this remote-only server. It mirrors `public/server-card.json` (same `name`, `version`, `title`, `description`, repository and remote URL) so the two never disagree.
- Publish it with the official CLI (namespace `dev.yukai/*` requires DNS or HTTP verification of `yukai.dev` — GitHub OAuth only grants `io.github.*/*`):

  ```bash
  mcp-publisher validate server.json
  mcp-publisher login dns --domain yukai.dev --private-key "$PRIVATE_KEY"
  mcp-publisher publish server.json
  ```

- Step-by-step submission notes for the official registry, Smithery, Glama, PulseMCP, mcp.so and awesome-remote-mcp-servers (including the copy to paste and the manual account/DNS steps) live in [`docs/mcp-directory-submission.md`](../docs/mcp-directory-submission.md).

## Security Notes

- **No authentication**: all underlying data is public government open data and every tool is strictly read-only.
- **Origin check**: requests carrying an `Origin` header are rejected with `403` unless the origin is listed in `MCP_ALLOWED_ORIGINS`, per the MCP transport specification. Native and server-side clients do not send an `Origin` header.
