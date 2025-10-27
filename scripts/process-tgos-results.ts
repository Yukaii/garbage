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

  // Skip header and BOM
  const dataLines = lines.slice(1).filter(line => line.trim());

  const results: TGOSResult[] = [];

  for (const line of dataLines) {
    // Parse CSV (handle quoted fields and multiple answers)
    // Format: id,Address,Response_Address,Response_X,Response_Y
    const parts = line.split(',');

    if (parts.length < 3) {
      console.warn(`Failed to parse line: ${line}`);
      continue;
    }

    const id = parts[0].trim();
    const address = parts[1].replace(/^"|"$/g, '').trim();
    const responseAddress = parts[2].replace(/^"|"$/g, '').trim();
    const x = parts[3] || '';
    const y = parts[4] || '';

    // Handle multiple answers from TGOS (separated by semicolons)
    // Take only the first answer
    const firstResponseAddress = responseAddress.split(';')[0].trim();
    const firstX = x.split(';')[0].trim();
    const firstY = y.split(';')[0].trim();

    results.push({
      id,
      Address: address,
      Response_Address: firstResponseAddress,
      Response_X: firstX,
      Response_Y: firstY,
    });
  }

  return results;
}

/**
 * Convert TWD97 TM2 (EPSG:3826) coordinates to WGS84 (EPSG:4326)
 *
 * TWD97 TM2 parameters:
 * - Central Meridian: 121°E
 * - Scale Factor: 0.9999
 * - False Easting: 250000 meters
 * - False Northing: 0 meters
 * - Reference Ellipsoid: GRS80
 *
 * This uses a simplified 2-step transformation:
 * 1. TM2 (projected) -> TWD97 (geodetic)
 * 2. TWD97 (geodetic) -> WGS84 (geodetic)
 *
 * Note: TWD97 and WGS84 are very close (< 1 meter difference in Taiwan),
 * so we treat TWD97 geodetic ≈ WGS84 geodetic
 */
function convertTGOSToWGS84(x: number, y: number): { longitude: number; latitude: number } {
  // Check if coordinates are already in WGS84 range
  // WGS84 longitude: 120-122, latitude: 21-26 (Taiwan region)
  if (x >= 120 && x <= 122 && y >= 21 && y <= 26) {
    // Already WGS84 (longitude, latitude) - no conversion needed
    return { longitude: x, latitude: y };
  }

  // Check if coordinates are in TWD97 TM2 range (EPSG:3826)
  // Typical range: X (easting) ~140,000-350,000, Y (northing) ~2,400,000-2,800,000
  if (x < 100000 || x > 400000 || y < 2000000 || y > 3000000) {
    console.warn(`Coordinates out of expected TWD97 TM2 range: (${x}, ${y})`);
    // Fall through and try to convert anyway
  }

  // Coordinates are in TWD97 TM2, perform conversion

  // GRS80 ellipsoid parameters (used by TWD97)
  const a = 6378137.0; // Semi-major axis (meters)
  const f = 1 / 298.257222101; // Flattening
  const b = a * (1 - f); // Semi-minor axis
  const e2 = (a * a - b * b) / (a * a); // First eccentricity squared
  const e4 = e2 * e2;
  const e6 = e4 * e2;
  const e8 = e4 * e4;

  // TM2 projection parameters
  const lon0 = 121.0; // Central meridian (121°E)
  const k0 = 0.9999; // Scale factor
  const dx = 250000; // False easting
  const dy = 0; // False northing

  // Remove false easting/northing
  const x0 = x - dx;
  const y0 = y - dy;

  // Calculate footprint latitude (using series expansion)
  const M = y0 / k0;
  const mu = M / (a * (1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256));

  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const e12 = e1 * e1;
  const e13 = e12 * e1;
  const e14 = e12 * e12;

  const fp = mu +
    (3 * e1 / 2 - 27 * e13 / 32) * Math.sin(2 * mu) +
    (21 * e12 / 16 - 55 * e14 / 32) * Math.sin(4 * mu) +
    (151 * e13 / 96) * Math.sin(6 * mu) +
    (1097 * e14 / 512) * Math.sin(8 * mu);

  // Calculate latitude
  const C1 = e2 * Math.pow(Math.cos(fp), 2);
  const T1 = Math.pow(Math.tan(fp), 2);
  const N1 = a / Math.sqrt(1 - e2 * Math.pow(Math.sin(fp), 2));
  const R1 = a * (1 - e2) / Math.pow(1 - e2 * Math.pow(Math.sin(fp), 2), 1.5);
  const D = x0 / (N1 * k0);
  const D2 = D * D;
  const D3 = D2 * D;
  const D4 = D2 * D2;
  const D5 = D4 * D;
  const D6 = D4 * D2;

  const lat = fp -
    (N1 * Math.tan(fp) / R1) *
    (D2 / 2 -
      (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * e2) * D4 / 24 +
      (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * e2 - 3 * C1 * C1) * D6 / 720);

  const lon = (D -
    (1 + 2 * T1 + C1) * D3 / 6 +
    (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * e2 + 24 * T1 * T1) * D5 / 120) / Math.cos(fp);

  // Convert radians to degrees
  const latitude = lat * (180 / Math.PI);
  const longitude = (lon * (180 / Math.PI)) + lon0;

  return { longitude, latitude };
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
