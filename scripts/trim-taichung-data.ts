/**
 * Trim Taichung data to reduce file size for production
 *
 * Strategy:
 * 1. Remove fields we don't need (type, collectionType, dayOfWeek can be inferred)
 * 2. Round coordinates to 6 decimal places (~0.1m precision)
 * 3. Keep only essential fields for the app
 *
 * Usage: bun scripts/trim-taichung-data.ts
 */

interface TaichungFullPoint {
  area: string;
  village: string;
  route: string;
  location: string;
  type: string;
  arrivalTime: string;
  departureTime: string;
  longitude: string;
  latitude: string;
  collectionType: 'garbage' | 'recycling';
  dayOfWeek: number;
}

interface TaichungTrimmedPoint {
  a: string;     // area (district)
  v: string;     // village
  r: string;     // route
  l: string;     // location
  t1: string;    // arrivalTime
  t2: string;    // departureTime
  x: number;     // longitude (rounded)
  y: number;     // latitude (rounded)
  d: number;     // dayOfWeek
  c: number;     // collectionType (0=garbage, 1=recycling)
}

function trimPoint(point: TaichungFullPoint): TaichungTrimmedPoint {
  return {
    a: point.area,
    v: point.village,
    r: point.route,
    l: point.location,
    t1: point.arrivalTime,
    t2: point.departureTime,
    // Round to 6 decimal places (~0.1m precision)
    x: Math.round(parseFloat(point.longitude) * 1000000) / 1000000,
    y: Math.round(parseFloat(point.latitude) * 1000000) / 1000000,
    d: point.dayOfWeek,
    c: point.collectionType === 'garbage' ? 0 : 1,
  };
}

async function main() {
  try {
    const inputPath = 'data/taichung-trash-collection-points.json';
    const outputPath = 'data/taichung-trash-collection-points-trimmed.json';

    console.log('Loading Taichung data...');
    const fullData = await Bun.file(inputPath).json() as TaichungFullPoint[];
    console.log(`✓ Loaded ${fullData.length} collection points\n`);

    console.log('Trimming data...');
    const trimmedData = fullData.map(trimPoint);

    // Save trimmed data
    const trimmedJson = JSON.stringify(trimmedData);
    await Bun.write(outputPath, trimmedJson);

    // Calculate sizes
    const originalSize = (await Bun.file(inputPath).size) / 1024;
    const trimmedSize = trimmedJson.length / 1024;
    const reduction = ((1 - trimmedSize / originalSize) * 100).toFixed(1);

    console.log(`\n📊 Results:`);
    console.log(`  Original size: ${originalSize.toFixed(2)} KB`);
    console.log(`  Trimmed size: ${trimmedSize.toFixed(2)} KB`);
    console.log(`  Reduction: ${reduction}%`);
    console.log(`  File saved to: ${outputPath}\n`);

    // Show field mapping
    console.log('📋 Field mappings (for adapter reference):');
    console.log('  a → area (district)');
    console.log('  v → village');
    console.log('  r → route');
    console.log('  l → location');
    console.log('  t1 → arrivalTime');
    console.log('  t2 → departureTime');
    console.log('  x → longitude (rounded to 6 decimals)');
    console.log('  y → latitude (rounded to 6 decimals)');
    console.log('  d → dayOfWeek (1-7)');
    console.log('  c → collectionType (0=garbage, 1=recycling)\n');

    // Sample trimmed data
    console.log('Sample trimmed data:');
    console.log(JSON.stringify(trimmedData.slice(0, 2), null, 2));

    console.log('\n📋 Next steps:');
    console.log('1. Review the trimmed data');
    console.log('2. Update TaichungAdapter to parse trimmed format');
    console.log('3. Replace taichung-trash-collection-points.json with trimmed version');
    console.log('4. Or: Use trimmed version directly by updating adapter dataUrl');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
