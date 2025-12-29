/**
 * PWA Icon Generator Script
 * 
 * This script generates PNG icons from the SVG source for PWA.
 * Run with: npx tsx scripts/generate-icons.ts
 * 
 * Requires: sharp (npm install -D sharp)
 */

import { promises as fs } from 'fs';
import path from 'path';

// Icon sizes required for PWA
const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

// Simple SVG icon as fallback (same as icon.svg)
const SVG_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0F1623"/>
      <stop offset="100%" style="stop-color:#0B0F17"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FFDA6A"/>
      <stop offset="100%" style="stop-color:#F7C948"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="102" fill="url(#bg)"/>
  <circle cx="256" cy="256" r="140" fill="#F7C948" opacity="0.15"/>
  <text x="256" y="300" 
        font-family="system-ui, -apple-system, sans-serif" 
        font-size="180" 
        font-weight="800" 
        fill="url(#accent)" 
        text-anchor="middle">
    SP
  </text>
  <g fill="none" stroke="#F7C948" stroke-width="8" stroke-linecap="round" opacity="0.6">
    <path d="M140 380 L180 380 L160 360"/>
    <path d="M372 380 L332 380 L352 400"/>
  </g>
</svg>`;

async function generateIcons() {
  const iconsDir = path.join(process.cwd(), 'public', 'icons');
  
  // Ensure icons directory exists
  await fs.mkdir(iconsDir, { recursive: true });
  
  // Write SVG source
  await fs.writeFile(path.join(iconsDir, 'icon.svg'), SVG_ICON);
  
  try {
    // Try to use sharp for PNG generation
    const sharp = await import('sharp');
    
    for (const size of SIZES) {
      const outputPath = path.join(iconsDir, `icon-${size}x${size}.png`);
      
      await sharp.default(Buffer.from(SVG_ICON))
        .resize(size, size)
        .png()
        .toFile(outputPath);
      
      console.log(`✓ Generated ${outputPath}`);
    }
    
    // Generate favicon.ico (use 32x32 as base)
    await sharp.default(Buffer.from(SVG_ICON))
      .resize(32, 32)
      .png()
      .toFile(path.join(iconsDir, '..', 'favicon.ico'));
    
    console.log('✓ Generated favicon.ico');
    
  } catch (error) {
    console.log('⚠ Sharp not available, creating placeholder PNGs');
    console.log('  Run: pnpm add -D sharp');
    console.log('  Then re-run this script');
    
    // Create placeholder text files indicating what's needed
    for (const size of SIZES) {
      const placeholder = `Placeholder for ${size}x${size} PNG icon.\nGenerate from icon.svg using sharp or an online converter.`;
      await fs.writeFile(
        path.join(iconsDir, `icon-${size}x${size}.txt`),
        placeholder
      );
    }
  }
  
  console.log('\n✅ Icon generation complete!');
}

generateIcons().catch(console.error);
