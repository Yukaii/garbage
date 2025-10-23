import sharp from 'sharp';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Read the SVG file at 160x160 size for better quality
const svgBuffer = readFileSync(resolve('./public/logo-160.svg'));

// Generate 192x192 icon
await sharp(svgBuffer)
  .resize(192, 192)
  .png()
  .toFile('./public/icons/icon-192.png');

console.log('Generated 192x192 icon');

// Generate 512x512 icon
await sharp(svgBuffer)
  .resize(512, 512)
  .png()
  .toFile('./public/icons/icon-512.png');

console.log('Generated 512x512 icon');

// Generate apple-touch-icon (180x180 is standard)
await sharp(svgBuffer)
  .resize(180, 180)
  .png()
  .toFile('./public/icons/apple-touch-icon.png');

console.log('Generated 180x180 apple-touch-icon');

console.log('All icons generated successfully!');
