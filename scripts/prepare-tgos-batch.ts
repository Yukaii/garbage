/**
 * Generate TGOS batch geocoding CSV template for Taichung addresses
 *
 * Output: data/taichung-tgos-batch.csv
 * Format: id,Address,Response_Address,Response_X,Response_Y
 *
 * Usage: bun scripts/prepare-tgos-batch.ts
 */

const TAICHUNG_API = 'https://datacenter.taichung.gov.tw/swagger/OpenData/68d1a87f-7baa-4b50-8408-c36a3a7eda68?limit=10000';

interface TaichungRecord {
  area: string;
  village: string;
  caption: string;
  car_licence: string;
  task_type: string;
  // ... other fields
}

interface UniqueAddress {
  id: number;
  area: string;
  address: string;
  originalAddress: string;
  fullAddress: string;
  cleaned: boolean;
}

async function fetchTaichungData(): Promise<TaichungRecord[]> {
  console.log('Fetching Taichung data...');
  const response = await fetch(TAICHUNG_API);
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.statusText}`);
  }
  const data = await response.json();
  console.log(`Fetched ${data.length} records`);
  return data;
}

function cleanAddress(address: string): { cleaned: string; original: string; wasCleaned: boolean } {
  const original = address.trim();

  // Remove everything after parenthesis (including the parenthesis)
  // Examples:
  //   "崇德路一段645巷14號(崇德路一段與崇德路一段645巷口)" -> "崇德路一段645巷14號"
  //   "中山路與柳川東路三段路口(號)" -> "中山路與柳川東路三段路口"
  //   "五常街71號(柳川東路四段與五常街口)(橋頭)" -> "五常街71號"
  const cleaned = original.replace(/\([^)]*\)/g, '').trim();

  return {
    cleaned,
    original,
    wasCleaned: cleaned !== original
  };
}

function extractUniqueAddresses(records: TaichungRecord[]): UniqueAddress[] {
  const addressMap = new Map<string, UniqueAddress>();
  let cleanedCount = 0;

  for (const record of records) {
    const rawAddress = record.caption.trim();
    if (!rawAddress) continue;

    const { cleaned, original, wasCleaned } = cleanAddress(rawAddress);
    if (wasCleaned) cleanedCount++;

    // Skip addresses that are just intersections without street numbers
    // Example: "中山路與柳川東路三段路口" (no house number)
    if (cleaned.includes('路口') && !cleaned.match(/\d+號/)) {
      continue;
    }

    const key = `${record.area}|${cleaned}`;
    if (!addressMap.has(key)) {
      // Prepend "台中市" and area to the cleaned address
      const fullAddress = `台中市${record.area}${cleaned}`;

      addressMap.set(key, {
        id: addressMap.size + 1,
        area: record.area,
        address: cleaned,
        originalAddress: original,
        fullAddress: fullAddress,
        cleaned: wasCleaned,
      });
    }
  }

  console.log(`✓ Cleaned ${cleanedCount} addresses with parentheses`);
  return Array.from(addressMap.values());
}

function generateCSV(addresses: UniqueAddress[]): string {
  const rows = [
    // Header
    'id,Address,Response_Address,Response_X,Response_Y',
    // Data rows
    ...addresses.map(addr =>
      `${addr.id},"${addr.fullAddress}",,,""`
    )
  ];

  return rows.join('\n');
}

async function main() {
  try {
    // Fetch data
    const records = await fetchTaichungData();

    // Extract unique addresses
    console.log('Extracting unique addresses...');
    const uniqueAddresses = extractUniqueAddresses(records);
    console.log(`Found ${uniqueAddresses.size} unique addresses`);

    // Generate CSV
    console.log('Generating CSV...');
    const csv = generateCSV(uniqueAddresses);

    // Save to file
    const outputPath = 'data/taichung-tgos-batch.csv';
    await Bun.write(outputPath, csv);
    console.log(`✓ CSV template saved to: ${outputPath}`);
    console.log(`✓ Total addresses: ${uniqueAddresses.length}`);
    console.log(`✓ File size: ${(csv.length / 1024).toFixed(2)} KB`);

    // Save metadata for later processing
    const metadataPath = 'data/taichung-address-metadata.json';
    await Bun.write(metadataPath, JSON.stringify(uniqueAddresses, null, 2));
    console.log(`✓ Metadata saved to: ${metadataPath}`);

    // Print sample
    console.log('\nSample rows:');
    const sampleRows = csv.split('\n').slice(0, 5);
    console.log(sampleRows.join('\n'));

    console.log('\n📋 Next steps:');
    console.log('1. Upload data/taichung-tgos-batch.csv to TGOS batch geocoding service');
    console.log('2. Download the geocoded results CSV');
    console.log('3. Run: bun scripts/process-tgos-results.ts <downloaded-file.csv>');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
