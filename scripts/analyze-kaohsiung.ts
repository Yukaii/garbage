const KAOHSIUNG_API = 'https://data.kcg.gov.tw/Json/Get/14fe516d-ac62-4905-9325-70daae7616bd';

const response = await fetch(KAOHSIUNG_API);
const json = await response.json();
const data = json.Data;

console.log('📊 Kaohsiung Data Analysis\n');
console.log('Total records:', data.length);

// Unique addresses
const uniqueAddresses = new Set(data.map((r: any) => r.caption));
console.log('Unique addresses:', uniqueAddresses.size);
console.log('Deduplication savings:', ((1 - uniqueAddresses.size / data.length) * 100).toFixed(1) + '%');

// Addresses with parentheses
const withParens = data.filter((r: any) => r.caption.includes('('));
console.log('\nAddresses with parentheses:', withParens.length);
console.log('Sample:');
withParens.slice(0, 10).forEach((r: any) => console.log('  -', r.caption));

// Addresses without house numbers
const noHouseNum = data.filter((r: any) => !r.caption.match(/\d+號/));
console.log('\nAddresses without house numbers:', noHouseNum.length);
console.log('Sample:');
noHouseNum.slice(0, 15).forEach((r: any) => console.log('  -', r.caption));

// Area distribution
const areaCount = new Map<string, number>();
data.forEach((r: any) => {
  const count = areaCount.get(r.area) || 0;
  areaCount.set(r.area, count + 1);
});
console.log('\nArea distribution (top 10):');
const sortedAreas = Array.from(areaCount.entries()).sort((a, b) => b[1] - a[1]);
sortedAreas.slice(0, 10).forEach(([area, count]) => {
  console.log(`  ${area}: ${count}`);
});

console.log('\nFields:', Object.keys(data[0]).join(', '));
