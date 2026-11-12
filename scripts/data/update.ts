#!/usr/bin/env bun
/**
 * Refresh one city's collection-point data from its open-data portal.
 *
 *   bun scripts/data/update.ts <city> [--out public] [--data-ref data] [--geocode-dir dir] [--allow-shrink]
 *
 * Reads the published file (for the shrink check) and the geocode cache
 * (`geocode/<city>.json`) from the data branch at `--data-ref`. `--geocode-dir`
 * reads `<dir>/<city>.json` instead, to try a cache before committing it.
 *
 * Writes `<out>/<file>` (the data-branch file name) only if the result passes
 * validation; otherwise exits non-zero and leaves the existing file alone.
 * Addresses missing from the geocode cache go to `<out>/reports/`.
 * In GitHub Actions a summary is appended to the job's step summary.
 */
import { $ } from 'bun';
import { mkdir } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { SOURCES, type GeocodeLookup, type Source } from './sources';
import { validateRecords } from './validate';

const { positionals, values } = parseArgs({
  args: Bun.argv.slice(2),
  allowPositionals: true,
  options: {
    out: { type: 'string', default: 'public' },
    'data-ref': { type: 'string', default: 'data' },
    'geocode-dir': { type: 'string' },
    'allow-shrink': { type: 'boolean', default: false },
  },
});

const city = positionals[0] as Source['city'] | undefined;
const source = city && SOURCES[city];
if (!source) {
  console.error(`Usage: bun scripts/data/update.ts <${Object.keys(SOURCES).join('|')}> [--out dir] [--data-ref ref] [--geocode-dir dir]`);
  process.exit(2);
}

/** A file from the data branch, or undefined if it isn't there. */
async function fromDataBranch(path: string): Promise<string | undefined> {
  const shown = await $`git show ${values['data-ref']}:${path}`.quiet().nothrow();
  return shown.exitCode === 0 ? shown.stdout.toString() : undefined;
}

async function loadGeocodes(city: string): Promise<GeocodeLookup> {
  if (values['geocode-dir']) return Bun.file(`${values['geocode-dir']}/${city}.json`).json();
  const content = await fromDataBranch(`geocode/${city}.json`);
  if (!content) throw new Error(`geocode/${city}.json not found on ${values['data-ref']} (fetch the data branch first)`);
  return JSON.parse(content);
}

async function summary(lines: string[]) {
  const path = process.env.GITHUB_STEP_SUMMARY;
  if (path) await Bun.write(path, `${await Bun.file(path).text().catch(() => '')}${lines.join('\n')}\n`);
}

console.log(`Fetching ${source.city}…`);
const result = await source.fetch({ loadGeocodes });

const previous = await fromDataBranch(source.file);
const previousCount = previous ? source.countPrevious(previous) : undefined;
const problems = validateRecords({
  records: result.records,
  minRecords: source.minRecords,
  previousCount: values['allow-shrink'] ? undefined : previousCount,
});

const header = `### ${source.city}: ${result.records.length} records` + (previousCount ? ` (was ${previousCount})` : '');
const notes = result.notes.map(note => `- ${note}`);
console.log([header, ...notes].join('\n'));

if (result.missingGeocodes?.length) {
  await mkdir(`${values.out}/reports`, { recursive: true });
  const report = `${values.out}/reports/${source.city}-missing-geocodes.txt`;
  await Bun.write(report, result.missingGeocodes.join('\n') + '\n');
  console.log(`- addresses to geocode: ${report}`);
}

if (problems.length > 0) {
  const failure = problems.map(p => `- ❌ ${p}`);
  console.error(`Refusing to publish ${source.city}:\n${failure.join('\n')}`);
  await summary([header, ...notes, ...failure]);
  process.exit(1);
}

await mkdir(values.out!, { recursive: true });
await Bun.write(`${values.out}/${source.file}`, result.content);
const unchanged = previous === result.content;
await summary([header, ...notes, unchanged ? '- unchanged' : '- ✅ updated']);
console.log(unchanged ? 'No changes.' : `Wrote ${values.out}/${source.file}`);
