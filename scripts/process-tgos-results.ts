/**
 * Process TGOS batch geocoding results and generate final geocoded data
 *
 * Input: TGOS geocoded CSV file (with Response_X and Response_Y filled)
 * Output: data/taichung-geocoded.json
 *
 * Usage: bun scripts/process-tgos-results.ts <tgos-results.csv>
 */

interface TGOSResult {
  id: string;
  Address: string;
  Response_Address: string;
  Response_X: string;
  Response_Y: string;
}

interface GeocodedAddress {
  id: number;
  address: string;
  responseAddress: string;
  longitude: number;
  latitude: number;
}

interface FailedAddress {
  id: string;
  address: string;
  responseAddress: string;
  reason: string;
}

async function parseCSV(filePath: string): Promise<TGOSResult[]> {
  const file = Bun.file(filePath);
  const text = await file.text();
  const lines = text.split('\n');

  // Skip header
  const dataLines = lines.slice(1).filter(line => line.trim());

  const results: TGOSResult[] = [];

  for (const line of dataLines) {
    // Parse CSV (handle quoted fields)
    const match = line.match(/^(\d+),"([^"]+)","?([^"]*)"?,?([^,]*),?([^,]*)$/);
    if (!match) {
      console.warn(`Failed to parse line: ${line}`);
      continue;
    }

    const [, id, address, responseAddress, x, y] = match;

    results.push({
      id,
      Address: address,
      Response_Address: responseAddress || '',
      Response_X: x || '',
      Response_Y: y || '',
    });
  }

  return results;
}

function convertTGOSToWGS84(x: number, y: number): { longitude: number; latitude: number } {
  // TGOS uses TWD97 (EPSG:3826) coordinate system
  // We need to convert to WGS84 (EPSG:4326)

  // For now, if TGOS returns WGS84 directly (longitude/latitude), use as-is
  // Otherwise, proper coordinate transformation is needed

  // Check if coordinates are already in WGS84 range
  if (x >= 120 && x <= 122 && y >= 23 && y <= 26) {
    // Already WGS84 (longitude, latitude)
    return { longitude: x, latitude: y };
  }

  // If coordinates are in TWD97 (much larger numbers)
  // You would need a proper transformation library
  // For now, return as-is and warn
  console.warn(`Coordinate may need transformation: (${x}, ${y})`);
  return { longitude: x, latitude: y };
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Error: Please provide the TGOS results CSV file');
    console.error('Usage: bun scripts/process-tgos-results.ts <tgos-results.csv>');
    process.exit(1);
  }

  const inputPath = args[0];

  try {
    console.log(`Reading TGOS results from: ${inputPath}`);
    const results = await parseCSV(inputPath);
    console.log(`Parsed ${results.length} results`);

    // Process and validate
    const geocoded: GeocodedAddress[] = [];
    const failed: FailedAddress[] = [];
    let successCount = 0;
    let failCount = 0;

    for (const result of results) {
      const x = parseFloat(result.Response_X);
      const y = parseFloat(result.Response_Y);

      if (isNaN(x) || isNaN(y)) {
        const reason = !result.Response_X && !result.Response_Y
          ? 'No coordinates returned'
          : 'Invalid coordinate format';

        failed.push({
          id: result.id,
          address: result.Address,
          responseAddress: result.Response_Address,
          reason,
        });

        failCount++;
        continue;
      }

      const { longitude, latitude } = convertTGOSToWGS84(x, y);

      // Validate coordinates are within reasonable Taiwan bounds
      if (longitude < 120 || longitude > 122 || latitude < 21 || latitude > 26) {
        failed.push({
          id: result.id,
          address: result.Address,
          responseAddress: result.Response_Address,
          reason: `Coordinates out of bounds: (${longitude}, ${latitude})`,
        });
        failCount++;
        continue;
      }

      geocoded.push({
        id: parseInt(result.id),
        address: result.Address,
        responseAddress: result.Response_Address,
        longitude,
        latitude,
      });

      successCount++;
    }

    console.log(`\n✓ Successfully geocoded: ${successCount}`);
    console.log(`✗ Failed to geocode: ${failCount}`);
    console.log(`Success rate: ${((successCount / results.length) * 100).toFixed(1)}%`);

    // Save failed addresses log
    if (failed.length > 0) {
      const failedPath = 'data/taichung-geocoding-failed.json';
      await Bun.write(failedPath, JSON.stringify(failed, null, 2));
      console.log(`⚠ Failed addresses logged to: ${failedPath}`);

      // Show sample of failed addresses
      console.log('\nSample failed addresses:');
      failed.slice(0, 5).forEach(item => {
        console.log(`  ID ${item.id}: ${item.address}`);
        console.log(`    Reason: ${item.reason}`);
      });
    }

    // Save geocoded data
    const outputPath = 'data/taichung-geocoded.json';
    await Bun.write(outputPath, JSON.stringify(geocoded, null, 2));
    console.log(`\n✓ Geocoded data saved to: ${outputPath}`);

    // Generate lookup map (address -> coordinates)
    const lookupMap: Record<string, { longitude: number; latitude: number }> = {};
    for (const item of geocoded) {
      lookupMap[item.address] = {
        longitude: item.longitude,
        latitude: item.latitude,
      };
    }

    const lookupPath = 'data/taichung-geocode-lookup.json';
    await Bun.write(lookupPath, JSON.stringify(lookupMap, null, 2));
    console.log(`✓ Lookup map saved to: ${lookupPath}`);

    // Print sample
    console.log('\nSample geocoded addresses:');
    geocoded.slice(0, 5).forEach(item => {
      console.log(`  ${item.address}`);
      console.log(`    → (${item.longitude}, ${item.latitude})`);
    });

    console.log('\n📋 Next steps:');
    console.log('1. Integrate geocoded data into the Taichung data fetching function');
    console.log('2. Update src/api.ts to use the geocoded coordinates');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
