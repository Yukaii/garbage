import { createMcpHandler } from 'mcp-handler';
import { registerTools } from './src/server';

const mcp = createMcpHandler(registerTools, {
  serverInfo: { name: 'dev.yukai/taipei-trash', version: '0.1.0' },
  instructions:
    'Garbage-truck collection points and arrival times for Taipei, New Taipei, Taichung and Kaohsiung. ' +
    'Use find_nearby_points with coordinates, or search_points with a district/road name, then get_schedule for a full route. ' +
    'Times are Asia/Taipei local time.',
});

// MCP spec: validate Origin on HTTP transports. Native clients send none; browser
// clients must be explicitly allowed (comma-separated list in MCP_ALLOWED_ORIGINS).
const allowedOrigins = new Set((process.env.MCP_ALLOWED_ORIGINS ?? '').split(',').map(o => o.trim()).filter(Boolean));

const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, MCP-Protocol-Version, Mcp-Method, Mcp-Name, Mcp-Param-*',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
};

async function handler(request: Request): Promise<Response> {
  const origin = request.headers.get('origin');
  if (origin && !allowedOrigins.has(origin)) {
    return new Response('Forbidden origin', { status: 403 });
  }

  const cors: Record<string, string> = origin ? { ...CORS_HEADERS, 'Access-Control-Allow-Origin': origin } : {};
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  const response = await mcp(request);
  for (const [k, v] of Object.entries(cors)) response.headers.set(k, v);
  return response;
}

export { handler as GET, handler as POST, handler as OPTIONS };
