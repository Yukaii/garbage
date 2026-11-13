#!/usr/bin/env bun
/**
 * Generate TGOS batch geocoding CSV template(s) from hwms.moenv.gov.tw
 * for Changhua County (changhua) and/or Yunlin County (yunlin).
 *
 * Output:
 *   data/<city>-tgos-batch.csv
 *   data/<city>-address-metadata.json
 *
 * Format: id,Address,Response_Address,Response_X,Response_Y
 *
 * Usage:
 *   bun scripts/geocoding/prepare-hwms-batch.ts [changhua|yunlin|all]
 */

import {
  buildHwmsGeocodeQuery,
  extractEmbeddedCoords,
  fetchHwmsCountyStops,
  HWMS_COUNTIES,
  type HwmsCity,
} from '../data/hwms';

interface UniqueAddress {
  id: number;
  district: string;
  originalLocation: string;
  fullAddress: string;
  tgosAddress: string;
  hasHouseNumber: boolean;
}

const TGOS_BATCH_LIMIT = 10_000;

async function loadExistingGeocodeKeys(city: HwmsCity): Promise<Set<string>> {
  const localFile = Bun.file(`data/geocode/${city}.json`);
  if (await localFile.exists()) {
    return new Set(Object.keys(await localFile.json()));
  }
  const fromBranch = await Bun.$`git show origin/data:geocode/${city}.json`.quiet().nothrow();
  if (fromBranch.exitCode === 0) {
    return new Set(Object.keys(JSON.parse(fromBranch.stdout.toString())));
  }
  return new Set();
}

function toCsv(addresses: UniqueAddress[]): string {
  return [
    'id,Address,Response_Address,Response_X,Response_Y',
    ...addresses.map(a => `${a.id},"${a.tgosAddress}",,,""`),
  ].join('\n');
}

async function prepareCity(city: HwmsCity): Promise<void> {
  const countyName = HWMS_COUNTIES[city].name;
  const rawStops = await fetchHwmsCountyStops(city);
  const existing = await loadExistingGeocodeKeys(city);

  const uniqueMap = new Map<string, UniqueAddress>();
  let embeddedSkipped = 0;
  let cachedSkipped = 0;
  let emptySkipped = 0;

  for (const stop of rawStops) {
    if (!stop.time.trim()) continue;
    const embedded = extractEmbeddedCoords(stop.location);
    if (embedded.latitude !== undefined && embedded.longitude !== undefined) {
      embeddedSkipped++;
      continue;
    }

    const fullAddress = buildHwmsGeocodeQuery(countyName, stop.district, stop.location);
    if (!fullAddress) {
      emptySkipped++;
      continue;
    }
    if (existing.has(fullAddress)) {
      cachedSkipped++;
      continue;
    }
    if (uniqueMap.has(fullAddress)) continue;

    // TGOS batch CSV fails when unescaped commas appear inside quoted fields;
    // process-tgos-results.ts converts `、` back to `,` on ingest.
    const tgosAddress = fullAddress.replace(/,/g, '、').replace(/"/g, '');
    uniqueMap.set(fullAddress, {
      id: uniqueMap.size + 1,
      district: stop.district,
      originalLocation: stop.location,
      fullAddress,
      tgosAddress,
      hasHouseNumber: /\d+號/.test(fullAddress),
    });
  }

  const addresses = [...uniqueMap.values()];
  const houseNumCount = addresses.filter(a => a.hasHouseNumber).length;
  const csv = toCsv(addresses);
  const csvPath = `data/${city}-tgos-batch.csv`;
  const metaPath = `data/${city}-address-metadata.json`;

  await Bun.write(csvPath, csv);
  await Bun.write(metaPath, JSON.stringify(addresses, null, 2));

  console.log(`\n✓ ${countyName} (${city}):`);
  console.log(`  Raw stops: ${rawStops.length}`);
  console.log(`  Embedded-coord stops (no TGOS needed): ${embeddedSkipped}`);
  if (cachedSkipped > 0) console.log(`  Already cached in geocode/${city}.json: ${cachedSkipped}`);
  if (emptySkipped > 0) console.log(`  Empty/unusable descriptions skipped: ${emptySkipped}`);
  console.log(`  Unique TGOS queries: ${addresses.length} (${houseNumCount} with 號, ${addresses.length - houseNumCount} intersections/landmarks)`);
  console.log(`  CSV saved: ${csvPath} (${(csv.length / 1024).toFixed(1)} KB)`);
  console.log(`  Metadata saved: ${metaPath}`);

  if (addresses.length > TGOS_BATCH_LIMIT) {
    const parts = Math.ceil(addresses.length / TGOS_BATCH_LIMIT);
    console.log(`  ⚠ Exceeds ${TGOS_BATCH_LIMIT} rows — splitting into ${parts} parts...`);
    for (let i = 0; i < parts; i++) {
      const slice = addresses.slice(i * TGOS_BATCH_LIMIT, (i + 1) * TGOS_BATCH_LIMIT);
      const partPath = `data/${city}-tgos-batch-part${i + 1}.csv`;
      await Bun.write(partPath, toCsv(slice));
      console.log(`    ✓ ${partPath} (${slice.length} rows)`);
    }
  }
}

async function main() {
  const target = (Bun.argv[2] ?? 'all').toLowerCase();
  const cities: HwmsCity[] =
    target === 'all'
      ? ['changhua', 'yunlin']
      : target === 'changhua' || target === 'yunlin'
        ? [target]
        : (() => {
            throw new Error(`Unknown city "${target}". Use changhua, yunlin, or all.`);
          })();

  for (const city of cities) {
    await prepareCity(city);
  }

  console.log('\n📋 Next steps:');
  console.log('1. Upload each data/<city>-tgos-batch.csv on https://www.tgos.tw/ (batch geocoding)');
  console.log('2. Download the geocoded CSV result(s)');
  console.log('3. Process results:');
  for (const city of cities) {
    console.log(`   bun scripts/geocoding/process-tgos-results.ts <downloaded-${city}.csv>`);
  }
}

if (import.meta.main) await main();
