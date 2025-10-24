/**
 * Generate TGOS batch geocoding CSV template for Kaohsiung addresses
 *
 * Output: data/kaohsiung-tgos-batch.csv
 * Format: id,Address,Response_Address,Response_X,Response_Y
 *
 * Usage: bun scripts/prepare-kaohsiung-batch.ts
 */

const KAOHSIUNG_API = 'https://data.kcg.gov.tw/Json/Get/14fe516d-ac62-4905-9325-70daae7616bd';

interface KaohsiungRecord {
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

interface KaohsiungResponse {
  Data: KaohsiungRecord[];
  ErrorCode: string;
  ID: string;
  Message: string;
  Success: boolean;
}

interface UniqueAddress {
  id: number;
  area: string;
  address: string;
  originalAddress: string;
  fullAddress: string;
  cleaned: boolean;
}

async function fetchKaohsiungData(): Promise<KaohsiungRecord[]> {
  console.log('Fetching Kaohsiung data...');
  const response = await fetch(KAOHSIUNG_API);
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.statusText}`);
  }
  const json: KaohsiungResponse = await response.json();
  console.log(`Fetched ${json.Data.length} records`);
  return json.Data;
}

function cleanAddress(address: string): { cleaned: string; original: string; wasCleaned: boolean } {
  const original = address.trim();

  // Remove everything after parenthesis (including the parenthesis)
  // Examples:
  //   "九大路686巷16號九曲國宅前(凱群大樓)" -> "九大路686巷16號九曲國宅前"
  //   "中興南路111號 (大樹菜市場前)" -> "中興南路111號"
  const cleaned = original.replace(/\([^)]*\)/g, '').trim();

  return {
    cleaned,
    original,
    wasCleaned: cleaned !== original
  };
}

function extractUniqueAddresses(records: KaohsiungRecord[]): UniqueAddress[] {
  const addressMap = new Map<string, UniqueAddress>();
  let cleanedCount = 0;
  let skippedNoHouseNum = 0;

  for (const record of records) {
    const rawAddress = record.caption.trim();
    if (!rawAddress) continue;

    const { cleaned, original, wasCleaned } = cleanAddress(rawAddress);
    if (wasCleaned) cleanedCount++;

    // Skip addresses without house numbers (intersections, landmarks)
    // Keep: "九曲路616號前", "九大路517巷口" (has street number)
    // Skip: "河濱二巷口", "九曲路瓦厝街90巷唯王社區前" (no house number)
    if (!cleaned.match(/\d+號/)) {
      skippedNoHouseNum++;
      continue;
    }

    const key = `${record.area}|${cleaned}`;
    if (!addressMap.has(key)) {
      // Prepend "高雄市" and area to the cleaned address
      const fullAddress = `高雄市${record.area}${cleaned}`;

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
  console.log(`✓ Skipped ${skippedNoHouseNum} addresses without house numbers`);
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
    const records = await fetchKaohsiungData();

    // Extract unique addresses
    console.log('Extracting unique addresses...');
    const uniqueAddresses = extractUniqueAddresses(records);
    console.log(`Found ${uniqueAddresses.length} unique addresses`);

    // Generate CSV
    console.log('Generating CSV...');
    const csv = generateCSV(uniqueAddresses);

    // Save to file
    const outputPath = 'data/kaohsiung-tgos-batch.csv';
    await Bun.write(outputPath, csv);
    console.log(`✓ CSV template saved to: ${outputPath}`);
    console.log(`✓ Total addresses: ${uniqueAddresses.length}`);
    console.log(`✓ File size: ${(csv.length / 1024).toFixed(2)} KB`);

    // Save metadata for later processing
    const metadataPath = 'data/kaohsiung-address-metadata.json';
    await Bun.write(metadataPath, JSON.stringify(uniqueAddresses, null, 2));
    console.log(`✓ Metadata saved to: ${metadataPath}`);

    // Print sample
    console.log('\nSample rows:');
    const sampleRows = csv.split('\n').slice(0, 5);
    console.log(sampleRows.join('\n'));

    // Check if we need batching
    const needsBatching = uniqueAddresses.length > 10000;
    console.log('\n📋 Next steps:');
    if (needsBatching) {
      console.log('⚠ Dataset has more than 10,000 addresses - batching required!');
      console.log('1. Run: bun scripts/split-kaohsiung-batches.ts');
      console.log('2. Upload each batch file to TGOS (one per day)');
      console.log('3. Merge results: bun scripts/merge-tgos-results.ts <batch1.csv> <batch2.csv>');
      console.log('4. Process: bun scripts/process-tgos-results.ts <merged.csv>');
    } else {
      console.log('1. Upload data/kaohsiung-tgos-batch.csv to TGOS batch geocoding service');
      console.log('2. Download the geocoded results CSV');
      console.log('3. Run: bun scripts/process-tgos-results.ts <downloaded-file.csv>');
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
