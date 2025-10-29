/**
 * Split Kaohsiung TGOS batch CSV into multiple files (max 10,000 records per file)
 *
 * TGOS has a daily limit of 10,000 records, so we need to split large batches.
 * Also cleans addresses by replacing commas with ideographic commas (、)
 * to avoid TGOS CSV parser issues.
 *
 * Usage: bun scripts/split-kaohsiung-batches.ts
 */

const BATCH_SIZE = 10000;
const INPUT_FILE = 'data/kaohsiung-tgos-batch.csv';
const OUTPUT_PREFIX = 'data/kaohsiung-tgos-batch';

/**
 * Clean address by replacing comma with ideographic comma
 * TGOS CSV parser doesn't handle commas inside quoted fields properly
 */
function cleanAddressForTGOS(line: string): string {
  // Parse line to extract address field (field 2, within quotes)
  const match = line.match(/^(\d+),"([^"]+)"(,.*)$/);
  if (!match) return line;

  const [, id, address, rest] = match;

  // Replace commas with ideographic comma (、) in the address
  const cleanedAddress = address.replace(/,/g, '、');

  return `${id},"${cleanedAddress}"${rest}`;
}

async function splitCSV() {
  console.log(`Reading ${INPUT_FILE}...`);
  const file = Bun.file(INPUT_FILE);
  const text = await file.text();
  const lines = text.split('\n').filter(line => line.trim());

  // First line is header
  const header = lines[0];
  const dataLines = lines.slice(1);

  console.log(`Total addresses: ${dataLines.length}`);
  console.log(`Batch size: ${BATCH_SIZE}`);

  const numBatches = Math.ceil(dataLines.length / BATCH_SIZE);
  console.log(`Number of batches needed: ${numBatches}\n`);

  const batches: string[] = [];

  let totalCleaned = 0;

  for (let i = 0; i < numBatches; i++) {
    const start = i * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, dataLines.length);
    const batchLines = dataLines.slice(start, end);

    // Clean addresses in batch lines
    const cleanedLines = batchLines.map(line => {
      const cleaned = cleanAddressForTGOS(line);
      if (cleaned !== line) totalCleaned++;
      return cleaned;
    });

    // Create CSV content with header
    const csv = [header, ...cleanedLines].join('\n');

    // Save batch file
    const batchNum = i + 1;
    const outputPath = `${OUTPUT_PREFIX}-part${batchNum}.csv`;
    await Bun.write(outputPath, csv);

    const sizeKB = (csv.length / 1024).toFixed(2);
    console.log(`✓ Batch ${batchNum}/${numBatches}: ${outputPath}`);
    console.log(`  Records: ${batchLines.length}`);
    console.log(`  Size: ${sizeKB} KB`);
    console.log(`  ID range: ${batchLines[0].split(',')[0]} - ${batchLines[batchLines.length - 1].split(',')[0]}`);
    console.log();

    batches.push(outputPath);
  }

  // Create a manifest file
  const manifest = {
    city: 'kaohsiung',
    totalRecords: dataLines.length,
    batchSize: BATCH_SIZE,
    numBatches: numBatches,
    batches: batches.map((path, idx) => ({
      file: path,
      batchNumber: idx + 1,
      startId: idx * BATCH_SIZE + 1,
      endId: Math.min((idx + 1) * BATCH_SIZE, dataLines.length),
      recordCount: idx === numBatches - 1
        ? dataLines.length - (idx * BATCH_SIZE)
        : BATCH_SIZE,
    })),
    createdAt: new Date().toISOString(),
  };

  const manifestPath = 'data/kaohsiung-tgos-batches-manifest.json';
  await Bun.write(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`✓ Manifest saved to: ${manifestPath}`);

  // Summary
  console.log(`\n📊 Cleaning Summary:`);
  console.log(`  Total addresses cleaned: ${totalCleaned} (${((totalCleaned / dataLines.length) * 100).toFixed(2)}%)`);
  console.log(`  Cleaned addresses have commas (,) replaced with ideographic commas (、)`);
  console.log(`  This prevents TGOS CSV parser errors with quoted fields`);

  console.log('\n📋 Next steps:');
  console.log('1. Upload each batch file to TGOS (one per day due to 10,000 limit):');
  batches.forEach((batch, idx) => {
    console.log(`   Day ${idx + 1}: Upload ${batch}`);
  });
  console.log('2. Download geocoded results for each batch');
  console.log('3. Merge results: bun scripts/merge-tgos-results.ts <batch1-results.csv> <batch2-results.csv> ...');
  console.log('   (The merge script will automatically normalize addresses back)');
}

splitCSV().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
