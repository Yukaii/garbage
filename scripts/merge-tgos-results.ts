/**
 * Merge multiple TGOS batch result files into a single CSV
 *
 * Usage: bun scripts/merge-tgos-results.ts <batch1-results.csv> <batch2-results.csv> ...
 *
 * Example:
 *   bun scripts/merge-tgos-results.ts \
 *     tgos-results-batch1.csv \
 *     tgos-results-batch2.csv
 */

interface TGOSResult {
  id: string;
  address: string;
  responseAddress: string;
  x: string;
  y: string;
}

/**
 * Normalize address by converting ideographic comma back to regular comma
 * This is needed because TGOS batch upload doesn't handle commas in quoted fields,
 * so we replaced them with ideographic commas (、) before upload.
 */
function normalizeAddress(address: string): string {
  // Convert ideographic comma (、) back to regular comma (,)
  return address.replace(/、/g, ',');
}

async function parseCSV(filePath: string): Promise<TGOSResult[]> {
  console.log(`Reading ${filePath}...`);
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
      console.warn(`  ⚠ Failed to parse line: ${line.substring(0, 50)}...`);
      continue;
    }

    const [, id, rawAddress, responseAddress, x, y] = match;

    // Normalize address (convert 、 back to , if it was cleaned for TGOS)
    const address = normalizeAddress(rawAddress);

    results.push({
      id,
      address,
      responseAddress: responseAddress || '',
      x: x || '',
      y: y || '',
    });
  }

  console.log(`  ✓ Parsed ${results.length} records\n`);
  return results;
}

function generateCSV(results: TGOSResult[]): string {
  const rows = [
    // Header
    'id,Address,Response_Address,Response_X,Response_Y',
    // Data rows
    ...results.map(r =>
      `${r.id},"${r.address}","${r.responseAddress}",${r.x},${r.y}`
    )
  ];

  return rows.join('\n');
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Error: Please provide at least one TGOS results CSV file');
    console.error('Usage: bun scripts/merge-tgos-results.ts <batch1.csv> <batch2.csv> ...');
    process.exit(1);
  }

  // Auto-detect city from first filename (taichung or kaohsiung)
  const cityName = args[0].toLowerCase().includes('kaohsiung') ? 'kaohsiung' : 'taichung';
  console.log(`Detected city: ${cityName}`);
  console.log(`Merging ${args.length} batch file(s)...\n`);

  try {
    const allResults: TGOSResult[] = [];

    // Parse all batch files
    for (const filePath of args) {
      const results = await parseCSV(filePath);
      allResults.push(...results);
    }

    // Sort by ID to maintain order
    allResults.sort((a, b) => parseInt(a.id) - parseInt(b.id));

    console.log(`Total merged records: ${allResults.length}`);

    // Check for duplicates
    const ids = new Set<string>();
    const duplicates: string[] = [];
    for (const result of allResults) {
      if (ids.has(result.id)) {
        duplicates.push(result.id);
      }
      ids.add(result.id);
    }

    if (duplicates.length > 0) {
      console.warn(`⚠ Warning: Found ${duplicates.length} duplicate IDs`);
      console.warn(`  Sample duplicates: ${duplicates.slice(0, 5).join(', ')}`);
    }

    // Generate merged CSV
    const csv = generateCSV(allResults);

    // Save merged file
    const outputPath = `data/${cityName}-tgos-merged-results.csv`;
    await Bun.write(outputPath, csv);

    const sizeKB = (csv.length / 1024).toFixed(2);
    console.log(`\n✓ Merged CSV saved to: ${outputPath}`);
    console.log(`  Total records: ${allResults.length}`);
    console.log(`  File size: ${sizeKB} KB`);

    // Count geocoded vs failed
    const geocoded = allResults.filter(r => r.x && r.y);
    const failed = allResults.filter(r => !r.x || !r.y);

    console.log(`\n📊 Statistics:`);
    console.log(`  Successfully geocoded: ${geocoded.length} (${((geocoded.length / allResults.length) * 100).toFixed(1)}%)`);
    console.log(`  Failed: ${failed.length} (${((failed.length / allResults.length) * 100).toFixed(1)}%)`);

    console.log('\n📋 Next step:');
    console.log(`  bun scripts/process-tgos-results.ts ${outputPath}`);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
