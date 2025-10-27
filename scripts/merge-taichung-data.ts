/**
 * Merge Taichung schedule data with geocoded coordinates
 *
 * This script:
 * 1. Fetches the full Taichung trash collection schedule from the API
 * 2. Loads geocoded coordinates from taichung-geocode-lookup.json
 * 3. Merges schedule data with coordinates using address as key
 * 4. Outputs the final unified data for the app
 *
 * Usage: bun scripts/merge-taichung-data.ts
 */

const TAICHUNG_API = 'https://datacenter.taichung.gov.tw/swagger/OpenData/68d1a87f-7baa-4b50-8408-c36a3a7eda68?limit=10000';

interface TaichungScheduleRecord {
  area: string;              // 中區
  village: string;           // 中華里
  car_licence: string;       // KEQ-0315
  caption: string;           // 中山路321號(中華路一段與中山路口)
  task_type: string;         // 定點 or 沿街
  // Garbage collection times (g_d1 = day 1, g_d2 = day 2, etc.)
  g_d1_time_s?: string;      // Start time: 07:12
  g_d1_time_e?: string;      // End time: 07:20
  g_d2_time_s?: string;
  g_d2_time_e?: string;
  g_d3_time_s?: string;
  g_d3_time_e?: string;
  g_d4_time_s?: string;
  g_d4_time_e?: string;
  g_d5_time_s?: string;
  g_d5_time_e?: string;
  g_d6_time_s?: string;
  g_d6_time_e?: string;
  g_d7_time_s?: string;
  g_d7_time_e?: string;
  // Recycling collection times (r_d1 = day 1, etc.)
  r_d1_time_s?: string;
  r_d1_time_e?: string;
  r_d2_time_s?: string;
  r_d2_time_e?: string;
  r_d3_time_s?: string;
  r_d3_time_e?: string;
  r_d4_time_s?: string;
  r_d4_time_e?: string;
  r_d5_time_s?: string;
  r_d5_time_e?: string;
  r_d6_time_s?: string;
  r_d6_time_e?: string;
  r_d7_time_s?: string;
  r_d7_time_e?: string;
}

interface GeocodeLookup {
  [fullAddress: string]: {
    longitude: number;
    latitude: number;
  };
}

interface UnifiedPoint {
  area: string;
  village: string;
  route: string;             // car_licence
  location: string;          // caption
  type: string;              // task_type
  arrivalTime: string;       // Start time (HHMM format)
  departureTime: string;     // End time (HHMM format)
  longitude: string;
  latitude: string;
  collectionType: 'garbage' | 'recycling';
  dayOfWeek: number;         // 1-7 (Monday-Sunday)
}

function cleanAddress(address: string): string {
  // Remove everything in parentheses
  return address.replace(/\([^)]*\)/g, '').trim();
}

async function fetchScheduleData(): Promise<TaichungScheduleRecord[]> {
  console.log('Fetching Taichung schedule data from API...');
  const response = await fetch(TAICHUNG_API);
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.statusText}`);
  }
  const data = await response.json();
  console.log(`✓ Fetched ${data.length} schedule records\n`);
  return data;
}

async function loadGeocodeLookup(): Promise<GeocodeLookup> {
  console.log('Loading geocoded coordinates...');
  const file = Bun.file('data/taichung-geocode-lookup.json');
  const lookup = await file.json();
  console.log(`✓ Loaded ${Object.keys(lookup).length} geocoded addresses\n`);
  return lookup;
}

function extractCollectionPoints(
  record: TaichungScheduleRecord,
  geocodeLookup: GeocodeLookup
): UnifiedPoint[] {
  const points: UnifiedPoint[] = [];

  // Clean address and build full address
  const cleanedAddress = cleanAddress(record.caption);
  const fullAddress = `台中市${record.area}${cleanedAddress}`;

  // Look up coordinates
  const coords = geocodeLookup[fullAddress];
  if (!coords) {
    // Skip if no coordinates found
    return [];
  }

  // Extract garbage collection times (g_d1-g_d7)
  for (let day = 1; day <= 7; day++) {
    const startKey = `g_d${day}_time_s` as keyof TaichungScheduleRecord;
    const endKey = `g_d${day}_time_e` as keyof TaichungScheduleRecord;
    const startTime = record[startKey];
    const endTime = record[endKey];

    if (startTime && endTime) {
      points.push({
        area: record.area,
        village: record.village,
        route: record.car_licence,
        location: cleanedAddress,
        type: record.task_type,
        arrivalTime: startTime.toString().replace(':', ''),  // Convert to HHMM
        departureTime: endTime.toString().replace(':', ''),
        longitude: coords.longitude.toString(),
        latitude: coords.latitude.toString(),
        collectionType: 'garbage',
        dayOfWeek: day,
      });
    }
  }

  // Extract recycling collection times (r_d1-r_d7)
  for (let day = 1; day <= 7; day++) {
    const startKey = `r_d${day}_time_s` as keyof TaichungScheduleRecord;
    const endKey = `r_d${day}_time_e` as keyof TaichungScheduleRecord;
    const startTime = record[startKey];
    const endTime = record[endKey];

    if (startTime && endTime) {
      points.push({
        area: record.area,
        village: record.village,
        route: record.car_licence,
        location: cleanedAddress,
        type: record.task_type,
        arrivalTime: startTime.toString().replace(':', ''),
        departureTime: endTime.toString().replace(':', ''),
        longitude: coords.longitude.toString(),
        latitude: coords.latitude.toString(),
        collectionType: 'recycling',
        dayOfWeek: day,
      });
    }
  }

  return points;
}

async function main() {
  try {
    // Fetch schedule data
    const scheduleRecords = await fetchScheduleData();

    // Load geocode lookup
    const geocodeLookup = await loadGeocodeLookup();

    // Process each record and extract collection points
    console.log('Merging schedule data with geocoded coordinates...\n');
    const allPoints: UnifiedPoint[] = [];
    let matchedCount = 0;
    let unmatchedCount = 0;

    for (const record of scheduleRecords) {
      const points = extractCollectionPoints(record, geocodeLookup);
      if (points.length > 0) {
        allPoints.push(...points);
        matchedCount++;
      } else {
        unmatchedCount++;
      }
    }

    console.log(`📊 Processing Results:`);
    console.log(`  Matched addresses: ${matchedCount}`);
    console.log(`  Unmatched addresses: ${unmatchedCount}`);
    console.log(`  Total collection points: ${allPoints.length}`);
    console.log(`  (Each address × days × collection types)\n`);

    // Save merged data
    const outputPath = 'data/taichung-trash-collection-points.json';
    await Bun.write(outputPath, JSON.stringify(allPoints, null, 2));
    const sizeKB = ((await Bun.file(outputPath).size) / 1024).toFixed(2);
    console.log(`✓ Merged data saved to: ${outputPath}`);
    console.log(`  File size: ${sizeKB} KB\n`);

    // Show sample data
    console.log('Sample collection points:');
    allPoints.slice(0, 3).forEach((point, i) => {
      console.log(`\n${i + 1}. ${point.area} ${point.location}`);
      console.log(`   Route: ${point.route} | Type: ${point.type}`);
      console.log(`   Day ${point.dayOfWeek} (${point.collectionType}): ${point.arrivalTime}-${point.departureTime}`);
      console.log(`   Coords: (${parseFloat(point.longitude).toFixed(5)}, ${parseFloat(point.latitude).toFixed(5)})`);
    });

    // Statistics
    const garbagePoints = allPoints.filter(p => p.collectionType === 'garbage');
    const recyclingPoints = allPoints.filter(p => p.collectionType === 'recycling');
    const uniqueLocations = new Set(allPoints.map(p => `${p.area}${p.location}`)).size;
    const uniqueRoutes = new Set(allPoints.map(p => p.route)).size;

    console.log(`\n📈 Statistics:`);
    console.log(`  Unique locations: ${uniqueLocations}`);
    console.log(`  Unique routes: ${uniqueRoutes}`);
    console.log(`  Garbage collection points: ${garbagePoints.length}`);
    console.log(`  Recycling collection points: ${recyclingPoints.length}`);

    console.log('\n📋 Next steps:');
    console.log('1. Review the merged data in data/taichung-trash-collection-points.json');
    console.log('2. Update TaichungAdapter to use this data structure');
    console.log('3. Commit to data branch: git checkout data && git add taichung-trash-collection-points.json');
    console.log('4. Update package.json dump-data script to include Taichung');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
