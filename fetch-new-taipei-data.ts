#!/usr/bin/env bun

/**
 * Script to fetch all New Taipei City trash collection data from paginated API
 *
 * The API returns data in pages:
 * - Page 0: 10,000 entries
 * - Page 1: 10,000 entries
 * - Page 2: 6,822 entries
 * - Total: 26,822 entries across 29 districts
 */

const BASE_URL = 'https://data.ntpc.gov.tw/api/datasets/edc3ad26-8ae7-4916-a00b-bc6048d19bf8/json';
const PAGE_SIZE = 10000;

async function fetchAllData() {
  let allData: any[] = [];
  let page = 0;
  let hasMore = true;

  console.log('Fetching New Taipei City trash collection data...');

  while (hasMore) {
    const url = `${BASE_URL}?page=${page}&size=${PAGE_SIZE}`;
    console.log(`Fetching page ${page}...`);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log(`  Received ${data.length} entries`);

      if (data.length === 0) {
        hasMore = false;
      } else {
        allData = allData.concat(data);

        // If we got less than PAGE_SIZE, this is the last page
        if (data.length < PAGE_SIZE) {
          hasMore = false;
        } else {
          page++;
        }
      }
    } catch (error) {
      console.error(`Error fetching page ${page}:`, error);
      hasMore = false;
    }
  }

  console.log(`\nTotal entries fetched: ${allData.length}`);

  // Get unique districts
  const districts = [...new Set(allData.map((item: any) => item.city))].sort();
  console.log(`Districts (${districts.length}): ${districts.join(', ')}`);

  // Write to file
  const outputPath = './public/new-taipei-trash-collection-points.json';
  await Bun.write(outputPath, JSON.stringify(allData));
  console.log(`\nData saved to ${outputPath}`);

  // Get file size
  const file = Bun.file(outputPath);
  const sizeInMB = (await file.size) / (1024 * 1024);
  console.log(`File size: ${sizeInMB.toFixed(2)} MB`);
}

fetchAllData();
