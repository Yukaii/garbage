const fs = require('fs');

function generateRouteMetadata(city) {
  const routesDir = `data-input/routes/${city}`;
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

const taipei = generateRouteMetadata('taipei');
const newTaipei = generateRouteMetadata('new-taipei');

const output = { 
  taipei,
  'new-taipei': newTaipei
};

fs.writeFileSync('routes/route-metadata.json', JSON.stringify(output, null, 2));
console.log('Generated routes/route-metadata.json');
console.log('Taipei routes:', Object.keys(taipei).length);
console.log('New Taipei routes:', Object.keys(newTaipei).length);
