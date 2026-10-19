// Local runner: mounts the Vercel handler on Bun.serve at /api/mcp.
import { POST, GET, OPTIONS } from './api/mcp';

const handlers: Record<string, (r: Request) => Promise<Response>> = { POST, GET, OPTIONS };

Bun.serve({
  port: Number(process.env.PORT ?? 3939),
  async fetch(req) {
    const { pathname } = new URL(req.url);
    if (pathname !== '/api/mcp' && pathname !== '/mcp') return new Response('Not found', { status: 404 });
    return (handlers[req.method] ?? (() => Promise.resolve(new Response('Method not allowed', { status: 405 }))))(req);
  },
});
console.log(`MCP server on http://localhost:${process.env.PORT ?? 3939}/api/mcp`);
