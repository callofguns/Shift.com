// Turns public/logo-mark.svg into the PNG icons phones need for the home screen.
// Run with: npm run icons
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

const svg = await readFile('public/logo-mark.svg', 'utf8');
// "Maskable" icons get cropped into circles/squircles by Android, so they need a
// full-bleed background and the artwork shrunk into the middle "safe zone".
const maskable = svg
  .replace('rx="116"', 'rx="0"')
  .replace('<defs>', '<g transform="translate(51.2 51.2) scale(0.8)"><defs>')
  .replace('</svg>', '</g></svg>')
  .replace('<rect width="512" height="512" rx="0" fill="#1E7A46"/>', '')
  .replace('<svg ', '<svg ')
  .replace(/(<svg[^>]*>)/, '$1<rect width="512" height="512" fill="#1E7A46"/>');
// iOS draws its own rounded corners and doesn't like transparency.
const square = svg.replace('rx="116"', 'rx="0"');
// Small one-color icon Android shows in the status bar.
const badge = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <path d="M60.5 30.3 A22 22 0 1 0 63.5 48 L 49 48" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const out = [
  [svg, 'public/icons/icon-192.png', 192],
  [svg, 'public/icons/icon-512.png', 512],
  [maskable, 'public/icons/maskable-512.png', 512],
  [square, 'public/icons/apple-touch-icon.png', 180],
  [svg, 'public/favicon-32.png', 32],
  [badge, 'public/icons/badge-96.png', 96],
];
for (const [src, file, size] of out) {
  await sharp(Buffer.from(src), { density: 300 }).resize(size, size).png().toFile(file);
  console.log('made', file);
}
