// Genera le icone PNG dell'app a partire da public/icon.svg.
// Uso: npm install --no-save sharp && node scripts/gen-icons.mjs
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = join(root, 'public', 'icon.svg');
const out = (f) => join(root, 'public', f);

const targets = [
  { file: 'apple-touch-icon.png', size: 180 }, // iOS "Aggiungi a Home"
  { file: 'icon-192.png', size: 192 },         // manifest (Android)
  { file: 'icon-512.png', size: 512 },         // manifest (splash/store)
];

for (const { file, size } of targets) {
  await sharp(svg, { density: 384 })
    .resize(size, size, { fit: 'contain', background: { r: 2, g: 2, b: 2, alpha: 1 } })
    .png()
    .toFile(out(file));
  console.log(`✓ ${file} (${size}x${size})`);
}
console.log('Fatto.');
