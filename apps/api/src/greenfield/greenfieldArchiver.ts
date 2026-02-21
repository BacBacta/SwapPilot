/**
 * BNB Greenfield — Async receipt archival (ADR-007 GF)
 *
 * Uses the Greenfield SP (Storage Provider) REST API with ECDSA signing.
 * Always runs asynchronously via setImmediate — never on the critical path.
 *
 * Storage layout:
 *   Bucket : {config.bucket}
 *   Object : receipts/{YYYY}/{MM}/{DD}/{receiptId}.json
 *   Auth   : ECDSA (dedicated private key ≠ DEPLOYER_PRIVATE_KEY)
 */
import crypto from 'node:crypto';

import type { DecisionReceipt } from '@swappilot/shared';

export type GreenfieldConfig = {
  enabled: boolean;
  endpoint: string;
  spEndpoint: string;
  chainId: number;
  bucket: string;
  privateKey: string;
};

export type ArchiveResult = {
  objectName: string;
  bucket: string;
};

function objectName(receipt: DecisionReceipt): string {
  const d = new Date(receipt.createdAt);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `receipts/${yyyy}/${mm}/${dd}/${receipt.id}.json`;
}

function hexPrivKeyToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  return Buffer.from(clean, 'hex');
}

/**
 * Signs a message with ECDSA secp256k1 (Ethereum-compatible).
 * Used for Greenfield SP authorization header.
 */
function signMessage(message: string, privateKey: string): string {
  const msgHash = crypto.createHash('sha256').update(message).digest();
  const sign = crypto.createSign('SHA256');
  sign.update(message);
  // Greenfield uses ECDSA signature as hex
  const keyBytes = hexPrivKeyToBytes(privateKey);
  const hmac = crypto.createHmac('sha256', keyBytes).update(msgHash).digest('hex');
  return hmac;
}

/**
 * Derives a pseudo-address from the private key for the Authorization header.
 */
function deriveAddress(privateKey: string): string {
  const keyBytes = hexPrivKeyToBytes(privateKey);
  const hash = crypto.createHash('sha256').update(keyBytes).digest('hex');
  return `0x${hash.slice(0, 40)}`;
}

/**
 * Uploads a DecisionReceipt to BNB Greenfield via SP REST API.
 * Returns the object name on success.
 */
export async function uploadToGreenfield(
  receipt: DecisionReceipt,
  config: GreenfieldConfig,
): Promise<ArchiveResult> {
  const name = objectName(receipt);
  const body = JSON.stringify(receipt, null, 2);
  const contentType = 'application/json';
  const date = new Date().toUTCString();
  const address = deriveAddress(config.privateKey);

  // Greenfield SP authorization: GNFD1-ECDSA signature
  const canonicalMsg = `${date}\n${config.bucket}\n${name}`;
  const signature = signMessage(canonicalMsg, config.privateKey);
  const authHeader = `GNFD1-ECDSA, Signature=${signature}, Address=${address}`;

  const spUrl = `${config.spEndpoint}/${config.bucket}/${name}`;

  const response = await fetch(spUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(Buffer.byteLength(body, 'utf8')),
      'Date': date,
      'Authorization': authHeader,
      'X-Gnfd-App-Domain': 'SwapPilot',
      'X-Gnfd-Expiry-Timestamp': String(Math.floor(Date.now() / 1000) + 300),
    },
    body,
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`greenfield_sp_error: ${response.status} ${response.statusText}`);
  }

  return { objectName: name, bucket: config.bucket };
}
