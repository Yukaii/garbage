#!/usr/bin/env bun
/**
 * One-off (already run; output lives on the data branch under migrations/):
 * map the point IDs used until Nov 2026 to stable IDs.
 *
 *   bun scripts/generate-id-migrations.ts [data-ref] [out-dir]
 *
 * Reads the datasets that were live when the old IDs were handed out (default:
 * the data-branch revision below) and writes <out-dir>/point-ids-v1-<city>.json,
 * keyed by the legacy ID with its city prefix stripped. The browser fetches a city's
 * map only when a saved star or a shared `?point=` link still uses a legacy ID
 * (src/utils/legacyPointIds.ts).
 */
import { $ } from 'bun';
import { mkdir } from 'node:fs/promises';
import { stablePointId } from '../src/cities/pointId';

// Last data-branch commit before stable IDs; its city files date from Oct 2025
const ref = Bun.argv[2] ?? '20499519';

async function show<T>(file: string): Promise<T> {
  return JSON.parse(await $`git show ${ref}:${file}`.quiet().text()) as T;
}

const maps: Record<string, Record<string, string>> = { taipei: {}, 'new-taipei': {}, taichung: {}, kaohsiung: {} };
const strip = (city: string, id: string) => id.slice(city.length + 1);

const taipei = await show<{ result: { results: Array<Record<string, string | number>> } }>('trash-collection-points.json');
for (const r of taipei.result.results) {
  maps.taipei![String(r._id)] = strip('taipei', stablePointId('taipei', r['路線'] as string, r['車次'] as string, r['地點'] as string));
}

const ntpc = await show<Array<Record<string, string>>>('new-taipei-trash-collection-points.json');
for (const r of ntpc) {
  maps['new-taipei']![`${r.lineid}-${r.rank}`] = strip('new-taipei', stablePointId('new-taipei', r.lineid, r.name));
}

// Old Taichung IDs were `<route>-<ASCII of address>-d<weekday>-<type>`. The weekday/type
// suffix doesn't change which stop it is, so it is dropped from the key (the client strips
// it too). Stripping non-ASCII let several stops share a key; the first one wins.
const taichung = await show<Array<Record<string, string | number>>>('taichung-trash-collection-points.json');
for (const r of taichung) {
  const locationKey = String(r.location).replace(/[^a-zA-Z0-9]/g, '');
  const legacy = `${r.route}-${locationKey}`;
  maps.taichung![legacy] ??= strip('taichung', stablePointId('taichung', r.area as string, r.location as string));
}

// Old Kaohsiung IDs were `<lng>_<lat>-<plate>` with one stop per coordinate; key on the coordinates.
const kaohsiung = await show<Array<Record<string, string>>>('kaohsiung-trash-collection-points.json');
for (const r of kaohsiung) {
  const coordKey = `${Number.parseFloat(r.longitude!).toFixed(6)}_${Number.parseFloat(r.latitude!).toFixed(6)}`;
  maps.kaohsiung![coordKey] ??= strip('kaohsiung', stablePointId('kaohsiung', r.area, r.location));
}

const outDir = Bun.argv[3] ?? 'migrations';
await mkdir(outDir, { recursive: true });
for (const [city, map] of Object.entries(maps)) {
  const path = `${outDir}/point-ids-v1-${city}.json`;
  await Bun.write(path, JSON.stringify(map));
  console.log(`${path}: ${Object.keys(map).length} legacy IDs, ${(Bun.file(path).size / 1024).toFixed(0)} KB`);
}
