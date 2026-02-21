#!/usr/bin/env node
/**
 * Génère une clé privée dédiée BNB Greenfield (secp256k1 / EVM-compatible).
 *
 * Usage :
 *   node scripts/greenfield-keygen.mjs
 *
 * La clé n'est JAMAIS écrite dans un fichier — elle s'affiche uniquement
 * dans le terminal. Copiez-la immédiatement dans :
 *   fly secrets set GREENFIELD_PRIVATE_KEY=0x... --app swappilot-api
 *
 * ⚠️  Utilisez une clé DÉDIÉE (jamais votre deployer key ou hot wallet).
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomBytes } from 'crypto';

const require = createRequire(import.meta.url);

// Resolve @noble packages from the pnpm store
const pnpmStore = join(dirname(fileURLToPath(import.meta.url)), '..', 'node_modules', '.pnpm');
const { secp256k1 } = require(join(pnpmStore, '@noble+curves@1.8.1', 'node_modules', '@noble', 'curves', 'secp256k1.js'));
const { keccak_256 }  = require(join(pnpmStore, '@noble+hashes@1.7.0', 'node_modules', '@noble', 'hashes', 'sha3.js'));

// Generate private key
const privBytes  = randomBytes(32);
const privateKey = '0x' + privBytes.toString('hex');

// Derive uncompressed public key (65 bytes), drop 0x04 prefix → 64 bytes
const pubKeyFull  = secp256k1.getPublicKey(privBytes, false); // uncompressed
const pubKey64    = pubKeyFull.slice(1);                       // remove 0x04

// keccak256 of 64-byte public key → take last 20 bytes = address
const addressBytes = keccak_256(pubKey64).slice(-20);
const address      = '0x' + Buffer.from(addressBytes).toString('hex');
// EIP-55 checksum (optional visual aid — not strictly required for Greenfield)
const account = { address: toChecksumAddress(address) };

function toChecksumAddress(addr) {
  const lower  = addr.toLowerCase().slice(2);
  const hash   = Buffer.from(keccak_256(Buffer.from(lower))).toString('hex');
  return '0x' + [...lower].map((c, i) => parseInt(hash[i], 16) >= 8 ? c.toUpperCase() : c).join('');
}

console.log('');
console.log('╔══════════════════════════════════════════════════════════════╗');
console.log('║      BNB Greenfield — Nouvelle clé dédiée (ADR-007 GF)      ║');
console.log('╚══════════════════════════════════════════════════════════════╝');
console.log('');
console.log('  Adresse BNB  :', account.address);
console.log('  Clé privée   :', privateKey);
console.log('');
console.log('─── Étapes suivantes ────────────────────────────────────────────');
console.log('');
console.log('1. Alimentez l\'adresse en BNB (frais gas Greenfield, ~0.01 BNB)');
console.log('   https://www.binance.com/en/square/post/BNB-Chain');
console.log('');
console.log('2. Créez le bucket Greenfield (une seule fois) :');
console.log('   https://dcellar.io  →  Create Bucket → "swappilot-receipts-prod"');
console.log('');
console.log('3. Poussez le secret sur Fly.io :');
console.log(`   fly secrets set GREENFIELD_PRIVATE_KEY=${privateKey} --app swappilot-api`);
console.log('');
console.log('4. Activez l\'archivage :');
console.log('   fly secrets set GREENFIELD_ENABLED=true --app swappilot-api');
console.log('');
console.log('⚠️  Fermez ce terminal après avoir copié la clé privée.');
console.log('   Ne committez JAMAIS cette clé dans git.');
console.log('');
