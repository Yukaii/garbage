import type { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { cityRegistry, type City } from '../../src/cities/cityRegistry';
import { circleIntersectsBounds, findNearby, routeStops, searchPoints, toDto, type PointDto } from './query';
import { cityOfPointId, loadCity } from './data';

const cityIds = cityRegistry.getCityIds() as [City, ...City[]];
const citySchema = z.enum(cityIds).describe(`City id: ${cityIds.join(', ')}`);

const pointSchema = z.object({
  id: z.string(),
  city: z.string(),
  district: z.string(),
  village: z.string(),
  location: z.string(),
  route: z.string(),
  arrivalTime: z.string().describe('Truck arrival, HH:MM (Asia/Taipei)'),
  departureTime: z.string().describe('Truck departure, HH:MM (Asia/Taipei)'),
  latitude: z.number(),
  longitude: z.number(),
  distanceMeters: z.number().optional(),
  schedule: z
    .record(z.string(), z.array(z.number().int().min(1).max(7)))
    .optional()
    .describe('Weekdays served per collection type (garbage/recycling/foodscraps), ISO: Mon=1 .. Sun=7. Absent when the city publishes no weekly schedule (Taipei, Kaohsiung).'),
  servesToday: z.boolean().optional().describe('Any collection type served today (Asia/Taipei). Absent when no schedule is published.'),
});

const readOnly = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const;

function ok<T extends Record<string, unknown>>(data: T, summary: string) {
  return {
    content: [{ type: 'text' as const, text: `${summary}\n${JSON.stringify(data)}` }],
    structuredContent: data,
  };
}

function fail(message: string) {
  return { isError: true, content: [{ type: 'text' as const, text: message }] };
}

export function registerTools(server: McpServer): void {
  server.registerTool(
    'list_cities',
    {
      title: 'List supported cities',
      description: 'List the cities with garbage-truck collection data, with their ids and bounding boxes.',
      inputSchema: z.object({}),
      outputSchema: z.object({
        cities: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            bounds: z.object({ north: z.number(), south: z.number(), east: z.number(), west: z.number() }),
          }),
        ),
      }),
      annotations: readOnly,
    },
    async () => {
      const cities = cityRegistry.getAllAdapters().map(a => ({ id: a.cityId, name: a.displayName, bounds: a.bounds }));
      return ok({ cities }, `${cities.length} supported cities.`);
    },
  );

  server.registerTool(
    'find_nearby_points',
    {
      title: 'Find nearby collection points',
      description:
        'Find garbage-truck stops near a coordinate in Taipei, New Taipei, Taichung or Kaohsiung, nearest first, with arrival times. Searches every city whose area overlaps the radius unless `city` is given.',
      inputSchema: z.object({
        lat: z.number().min(21).max(26).describe('Latitude (WGS84)'),
        lng: z.number().min(118).max(123).describe('Longitude (WGS84)'),
        radiusMeters: z.number().int().min(50).max(2000).default(500),
        limit: z.number().int().min(1).max(20).default(10),
        city: citySchema.optional(),
      }),
      outputSchema: z.object({ points: z.array(pointSchema) }),
      annotations: readOnly,
    },
    async ({ lat, lng, radiusMeters, limit, city }) => {
      const candidates = city
        ? [city]
        : cityIds.filter(c => circleIntersectsBounds(lat, lng, radiusMeters, cityRegistry.getCityBounds(c)));
      if (candidates.length === 0) return fail('That location is outside the supported cities. Use list_cities.');

      try {
        const perCity = await Promise.all(candidates.map(c => loadCity(c)));
        const points = findNearby(perCity.flat(), lat, lng, radiusMeters, limit);
        return ok({ points }, `${points.length} collection point(s) within ${radiusMeters} m.`);
      } catch (error) {
        return fail(`Could not load collection data: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  );

  server.registerTool(
    'search_points',
    {
      title: 'Search collection points by name',
      description:
        'Search one city\'s stops by district, village, location or route text (Traditional Chinese). All space-separated terms must match, e.g. "大安區 安和路".',
      inputSchema: z.object({
        city: citySchema,
        query: z.string().min(1).max(100),
        limit: z.number().int().min(1).max(20).default(10),
      }),
      outputSchema: z.object({ points: z.array(pointSchema) }),
      annotations: readOnly,
    },
    async ({ city, query, limit }) => {
      try {
        const points = searchPoints(await loadCity(city), query, limit);
        return ok({ points }, `${points.length} match(es) in ${city}.`);
      } catch (error) {
        return fail(`Could not load collection data: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  );

  server.registerTool(
    'get_schedule',
    {
      title: 'Get a stop and its route schedule',
      description:
        'Get one collection point by id (from find_nearby_points or search_points) plus every stop on the same route in arrival order.',
      inputSchema: z.object({ pointId: z.string().min(1).max(200) }),
      outputSchema: z.object({ point: pointSchema, routeStops: z.array(pointSchema) }),
      annotations: readOnly,
    },
    async ({ pointId }) => {
      const city = cityOfPointId(pointId);
      if (!city) return fail(`Unrecognised point id "${pointId}". Ids come from find_nearby_points or search_points.`);
      try {
        const all = await loadCity(city);
        const point = all.find(p => p.id === pointId);
        if (!point) return fail(`No collection point with id "${pointId}".`);
        const stops: PointDto[] = routeStops(all, point);
        return ok({ point: toDto(point), routeStops: stops }, `Route ${point.route} has ${stops.length} stop(s).`);
      } catch (error) {
        return fail(`Could not load collection data: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
  );
}
