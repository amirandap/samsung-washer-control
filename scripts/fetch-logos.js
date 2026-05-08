#!/usr/bin/env node
/**
 * fetch-logos.js
 * Downloads brand logos via Clearbit Logo API and stores them as base64 data
 * URLs in clothing_items.logo_url.
 *
 * Usage: node scripts/fetch-logos.js
 */

import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const db = new Database(join(__dirname, '../data/washer.db'));

// ── Known brand → domain mapping ──────────────────────────────────────────────
const BRAND_DOMAINS = {
  'columbia':        'columbia.com',
  'arturo calle':    'arturocalle.com',
  'brooks brothers': 'brooksbrothers.com',
  'gap':             'gap.com',
  'happy socks':     'happysocks.com',
  'uniqlo':          'uniqlo.com',
  'homaxy':          'homaxy.com',
  'utopia towels':   'utopiatowels.com',
  'zcco':            'zccosports.com',
  'doz':             'doz.fr',
  'polo piqué':      null,
  'polo pique':      null,
};

function brandToDomain(brand) {
  const key = brand.toLowerCase().trim();
  if (key in BRAND_DOMAINS) return BRAND_DOMAINS[key];
  // Fallback: strip spaces/punctuation, add .com
  return key.replace(/[^a-z0-9]/g, '') + '.com';
}

async function fetchLogoBase64(domain) {
  // Try logo.dev first (free, no auth required), then Google favicons
  const urls = [
    `https://img.logo.dev/${domain}?token=pk_MrmhLxnNRImDCuqvxmgFPA&size=64&format=png`,
    `https://www.google.com/s2/favicons?domain=${domain}&sz=64`,
  ];
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      if (buf.byteLength < 100) continue; // skip empty/tiny responses
      const b64 = Buffer.from(buf).toString('base64');
      const mime = res.headers.get('content-type')?.split(';')[0] ?? 'image/png';
      return `data:${mime};base64,${b64}`;
    } catch { continue; }
  }
  return null;
}

// Apply migration first
try { db.exec(`ALTER TABLE clothing_items ADD COLUMN logo_url TEXT`); } catch { /* already exists */ }

const brands = db.prepare(
  `SELECT DISTINCT brand FROM clothing_items WHERE brand IS NOT NULL AND brand != '' ORDER BY brand`
).all().map(r => r.brand);

console.log(`\nFetching logos for ${brands.length} brands...\n`);

const updateStmt = db.prepare(`UPDATE clothing_items SET logo_url = ? WHERE brand = ?`);

for (const brand of brands) {
  const domain = brandToDomain(brand);
  if (!domain) {
    console.log(`⏭  ${brand}: sin dominio, saltando`);
    continue;
  }
  process.stdout.write(`⬇  ${brand} (${domain})... `);
  const logoData = await fetchLogoBase64(domain);
  if (logoData) {
    updateStmt.run(logoData, brand);
    console.log('✓');
  } else {
    console.log('✗ (no encontrado)');
  }
}

console.log('\nListo.\n');
db.close();
