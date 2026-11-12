#!/usr/bin/env bun
/**
 * Update meta.json in a data-branch checkout after a refresh.
 *
 *   bun scripts/data/record-meta.ts <data-dir> <city>...   (cities that refreshed successfully)
 *
 * Every city listed gets `checkedAt` = now. `updatedAt` = now only if its file differs
 * from HEAD. Cities missing from meta.json get their last commit date. The site shows
 * `updatedAt` so users can tell how fresh the schedule is.
 */
import { $ } from 'bun';
import { SOURCES, type Source } from './sources';

export interface CityMeta {
  updatedAt: string;
  checkedAt: string;
  records: number;
}

const [dir, ...cities] = Bun.argv.slice(2);
if (!dir) throw new Error('Usage: record-meta.ts <data-dir> <city>...');

const metaFile = Bun.file(`${dir}/meta.json`);
const meta: Record<string, CityMeta> = (await metaFile.exists()) ? await metaFile.json() : {};
const now = new Date().toISOString();

for (const city of cities as Source['city'][]) {
  const source = SOURCES[city];
  if (!source) throw new Error(`Unknown city ${city}`);
  const changed = (await $`git -C ${dir} diff --quiet HEAD -- ${source.file}`.nothrow().quiet()).exitCode !== 0;
  const lastCommit = (await $`git -C ${dir} log -1 --format=%cI -- ${source.file}`.nothrow().quiet().text()).trim();
  meta[city] = {
    updatedAt: changed ? now : (meta[city]?.updatedAt || lastCommit || now),
    checkedAt: now,
    records: source.countPrevious(await Bun.file(`${dir}/${source.file}`).text()),
  };
  console.log(`${city}: ${changed ? 'updated' : 'unchanged'}, ${meta[city].records} records`);
}

// Cities this run didn't check (their fetch failed) keep an entry, dated by their last commit,
// so the site still shows how old their data is
for (const [city, source] of Object.entries(SOURCES)) {
  if (meta[city] || !(await Bun.file(`${dir}/${source.file}`).exists())) continue;
  const lastCommit = (await $`git -C ${dir} log -1 --format=%cI -- ${source.file}`.nothrow().quiet().text()).trim();
  if (lastCommit) meta[city] = { updatedAt: lastCommit, checkedAt: '', records: source.countPrevious(await Bun.file(`${dir}/${source.file}`).text()) };
}

await Bun.write(metaFile, JSON.stringify(meta, null, 2) + '\n');
