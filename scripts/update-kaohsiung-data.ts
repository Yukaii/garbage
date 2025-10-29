/**
 * Update Kaohsiung trash collection data
 *
 * This script:
 * 1. Fetches fresh data from Kaohsiung City API
 * 2. Merges with pre-geocoded coordinates (from TGOS)
 * 3. Generates the final public JSON file
 *
 * Usage: bun scripts/update-kaohsiung-data.ts
 *
 * Note: This requires data/kaohsiung-geocode-lookup.json to exist
 * (generated once via TGOS batch geocoding, see docs/adding-new-city-data.md)
 */

const KAOHSIUNG_API = 'https://data.kcg.gov.tw/Json/Get/14fe516d-ac62-4905-9325-70daae7616bd';

interface KaohsiungAPIRecord {
  area: string;
  village: string;
  caption: string;
  car_licence: string;
  trips_name: string;
  area_name: string;
  today_s: string;
  today_e: string;
  estime_s: string;
  estime_e: string;
}

interface KaohsiungCollectionPoint {
  area: string;
  village: string;
  location: string;
  route: string;
  arrivalTime: string;
  departureTime: string;
  longitude: number;
  latitude: number;
}

function cleanAddress(address: string): string {
  // Remove parenthetical information (same as prepare-kaohsiung-batch.ts)
  // Example: "九大路686巷16號九曲國宅前(凱群大樓)" -> "九大路686巷16號九曲國宅前"
  return address.replace(/\([^)]*\)/g, '').trim();
}

async function main() {
  console.log('🔄 Updating Kaohsiung trash collection data...\n');

  // Step 1: Fetch fresh API data
  console.log('📡 Fetching from Kaohsiung City API...');
  const response = await fetch(KAOHSIUNG_API);
  if (!response.ok) {
    throw new Error(`API fetch failed: ${response.statusText}`);
  }

  const json = await response.json();
  const apiData: KaohsiungAPIRecord[] = json.Data;
  console.log(`   ✓ Fetched ${apiData.length} records\n`);

  // Step 2: Load geocoded coordinates
  console.log('📍 Loading geocoded coordinates...');
  const geocodeLookupPath = 'data/kaohsiung-geocode-lookup.json';
  const geocodeFile = Bun.file(geocodeLookupPath);

  if (!(await geocodeFile.exists())) {
    console.error(`❌ Error: ${geocodeLookupPath} not found`);
    console.error('   You need to run TGOS geocoding first. See docs/adding-new-city-data.md');
    process.exit(1);
  }

  const geocoded = await geocodeFile.json();
  const geocodedKeys = Object.keys(geocoded);
  console.log(`   ✓ Loaded ${geocodedKeys.length} geocoded addresses\n`);

  // Step 3: Merge API data with coordinates
  console.log('🔗 Merging data...');
  const mergedData: KaohsiungCollectionPoint[] = [];
  const seen = new Set<string>();
  let noCoords = 0;
  let skippedNoHouseNum = 0;

  for (const record of apiData) {
    const area = record.area;
    const rawAddress = record.caption.trim();

    if (!rawAddress) continue;

    // Clean address
    const cleaned = cleanAddress(rawAddress);

    // Skip addresses without house numbers (intersections, landmarks)
    if (!cleaned.match(/\d+號/)) {
      skippedNoHouseNum++;
      continue;
    }

    // Build full address for lookup
    const fullAddress = `高雄市${area}${cleaned}`;
    const coords = geocoded[fullAddress];

    if (!coords) {
      noCoords++;
      continue;
    }

    // Deduplicate by coordinates (same location might have multiple time entries)
    const coordKey = `${coords.longitude},${coords.latitude}`;
    if (seen.has(coordKey)) continue;
    seen.add(coordKey);

    mergedData.push({
      area,
      village: record.village,
      route: record.car_licence,
      location: cleaned,
      type: '定點',
      arrivalTime: record.today_s.replace(':', ''), // "16:25" -> "1625"
      departureTime: record.today_e.replace(':', ''), // "16:31" -> "1631"
      longitude: coords.longitude.toString(),
      latitude: coords.latitude.toString(),
      collectionType: 'garbage',
    });
  }

  console.log(`   ✓ Merged ${mergedData.length} collection points`);
  console.log(`   ⚠ Skipped ${skippedNoHouseNum} without house numbers`);
  console.log(`   ⚠ Skipped ${noCoords} without coordinates\n`);

  // Step 4: Save to public directory
  const outputPath = 'public/kaohsiung-trash-collection-points.json';
  await Bun.write(outputPath, JSON.stringify(mergedData, null, 2));

  const sizeKB = ((await Bun.file(outputPath).size) / 1024).toFixed(2);
  console.log(`✅ Success!`);
  console.log(`   File: ${outputPath}`);
  console.log(`   Size: ${sizeKB} KB`);
  console.log(`   Points: ${mergedData.length}`);

  // Show sample
  console.log('\n📋 Sample entry:');
  console.log(JSON.stringify(mergedData[0], null, 2));

  console.log('\n✨ Kaohsiung data updated successfully!');
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
