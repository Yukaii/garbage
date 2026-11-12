#!/usr/bin/env bun
/**
 * Copy the Valhalla route geometries into the site, minified.
 *
 *   bun scripts/data/export-routes.ts <routes-dir> <out-dir>
 *
 * The data branch stores routes/ pretty-printed with 6-decimal coordinates (108 MB).
 * Published: minified, coordinates rounded to 5 decimals (~1 m, plenty for a line on a
 * map) and consecutive duplicate points dropped (~35 MB). Served same-origin at /routes/,
 * so each deploy ships the routes on the data branch instead of a pinned CDN commit.
 */
import { Glob } from 'bun';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

type Position = [number, number];
type Json = Record<string, unknown>;

const round = (n: number) => Math.round(n * 1e5) / 1e5;

/** Round a LineString's coordinates and drop points that repeat the previous one. */
export function simplifyLine(coordinates: Position[]): Position[] {
  const out: Position[] = [];
  for (const [lng, lat] of coordinates) {
    const point: Position = [round(lng), round(lat)];
    const prev = out[out.length - 1];
    if (!prev || prev[0] !== point[0] || prev[1] !== point[1]) out.push(point);
  }
  return out;
}

export function minifyGeoJson(geojson: Json): Json {
  const features = geojson.features as Array<{ geometry?: { type: string; coordinates: Position[] } }> | undefined;
  for (const feature of features ?? []) {
    if (feature.geometry?.type === 'LineString') feature.geometry.coordinates = simplifyLine(feature.geometry.coordinates);
  }
  return geojson;
}

if (import.meta.main) {
  const [src, out] = Bun.argv.slice(2);
  if (!src || !out) throw new Error('Usage: bun scripts/data/export-routes.ts <routes-dir> <out-dir>');

  let files = 0;
  let before = 0;
  let after = 0;
  for await (const path of new Glob('**/*.{geojson,json}').scan(src)) {
    const input = Bun.file(`${src}/${path}`);
    before += input.size;
    const json = (await input.json()) as Json;
    const text = JSON.stringify(path.endsWith('.geojson') ? minifyGeoJson(json) : json);
    await mkdir(dirname(`${out}/${path}`), { recursive: true });
    await Bun.write(`${out}/${path}`, text);
    after += text.length;
    files++;
  }
  console.log(`routes: ${files} files, ${(before / 1048576).toFixed(1)} MB → ${(after / 1048576).toFixed(1)} MB`);
}
