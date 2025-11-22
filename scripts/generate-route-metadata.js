import fs from 'fs';
import path from 'path';

// Accept data branch path as argument (defaults to ../data-branch for workflow)
const dataBranchPath = process.argv[2] || '../data-branch';

function generateRouteMetadata(city) {
  const routesDir = path.join(dataBranchPath, `data-input/routes/${city}`);
  
  if (!fs.existsSync(routesDir)) {
    console.log(`Skipping ${city}: directory not found at ${routesDir}`);
    return {};
  }
  
  const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.geojson'));
  
  const metadata = {};
  
  files.forEach(file => {
    const data = JSON.parse(fs.readFileSync(`${routesDir}/${file}`, 'utf8'));
    const props = data.features[0].properties;
    
    const key = `${props.route_name}|${props.car_seq}`;
    metadata[key] = props.routeId;
  });
  
  return metadata;
}

console.log(`Using data branch path: ${dataBranchPath}`);

const taipei = generateRouteMetadata('taipei');
const newTaipei = generateRouteMetadata('new-taipei');
const taichung = generateRouteMetadata('taichung');
const kaohsiung = generateRouteMetadata('kaohsiung');

const output = { 
  taipei,
  'new-taipei': newTaipei,
  taichung,
  kaohsiung,
};

const outputPath = path.join(dataBranchPath, 'routes/route-metadata.json');
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(`Generated ${outputPath}`);
console.log('Taipei routes:', Object.keys(taipei).length);
console.log('New Taipei routes:', Object.keys(newTaipei).length);
console.log('Taichung routes:', Object.keys(taichung).length);
console.log('Kaohsiung routes:', Object.keys(kaohsiung).length);
