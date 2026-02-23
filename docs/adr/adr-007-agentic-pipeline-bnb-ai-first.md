# ADR-007 — Architecture Agentic Intégrée : Pipeline Unifié × BNB Chain AI-First

**Statut :** Accepté
**Date :** 2026-02-19
**Auteurs :** Équipe SwapPilot

---

## Contexte

SwapPilot est un agrégateur DEX sur BSC avec un pipeline éprouvé :
fan-out adapters → preflight → risk scoring → BEQ v2 → build-tx → exécution.

Ce document décrit l'évolution vers un "terminal agentic" en intégrant cinq briques
de l'écosystème BNB Chain AI-First, **sans rompre le pipeline existant**.

Analyse du code source réalisée sur :
- `apps/api/src/quoteBuilder.ts` (783 lignes)
- `packages/scoring/src/beq-v2.ts` (570 lignes)
- `packages/risk/src/engine.ts` (139 lignes)
- 14 adapters DEX, preflight, config, schémas Zod

---

## Décision

### Principe directeur : pipeline unique, enrichissements additifs

Chaque nouvelle brique s'insère en un point précis du pipeline sans le bypasser.
Tous les nouveaux champs sont **optionnels** dans les schémas Zod.
Chaque feature est désactivable via feature flag (`*_ENABLED=false` → comportement actuel bit-for-bit).

---

## 0. Bugs critiques — pré-work obligatoire

Ces bugs doivent être corrigés avant tout nouveau milestone.

### BUG-1 — `createdAt` figé à l'epoch 1970
**Fichier :** `apps/api/src/quoteBuilder.ts` ~ligne 746

```typescript
// ACTUEL (bug)
createdAt: new Date(0).toISOString(),

// CORRECT
createdAt: new Date().toISOString(),
```

### BUG-2 — Preflight RPC séquentiel (P99 = 5s au lieu de 2.5s)
**Fichier :** `packages/preflight/src/preflight.ts`

```typescript
// ACTUEL — séquentiel
for (const rpcUrl of urls) {
  results.push(await simulateOnce({ rpcUrl, timeoutMs, tx }));
}

// CORRECT — parallèle
results = await Promise.all(
  urls.map(rpcUrl => simulateOnce({ rpcUrl, timeoutMs, tx }))
);
```

### BUG-3 — `RISK_KNOWN_TOKENS` vide → tous les tokens classés `UNKNOWN`
**Fichier :** `packages/config/src/env.ts`

```typescript
// ACTUEL
RISK_KNOWN_TOKENS: z.string().default(''),

// CORRECT — base BSC minimale
RISK_KNOWN_TOKENS: z.string().default([
  '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
  '0x55d398326f99059fF775485246999027B3197955', // USDT
  '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', // USDC
  '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', // BTCB
  '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', // WETH
  '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', // CAKE
].join(',')),
```

Sans ce fix, le mode SAFE disqualifie 100 % des tokens en déploiement nu.

### BUG-4 — Appels RPC dupliqués sur BSC
`pancakeswap` et `uniswap-v3` appellent le même Quoter (`0xB048Bbc1...`).
`pancakeswap` (V2) et `uniswap-v2` appellent le même router (`0x10ED43...`).

**Fix :** désactiver `uniswap-v2` et `uniswap-v3` sur chain 56 dans la registry.

### BUG-5 — `passWithNoTests: true` masque les suites vides en CI
**Fichier :** `vitest.config.ts`

```typescript
// ACTUEL
passWithNoTests: true,

// CORRECT
passWithNoTests: false,
```

---

## 1. Architecture cible

```
╔══════════════════════════════════════════════════════════════════╗
║  ENTRÉE                                                          ║
║  UI classique ────────────────────────┐                         ║
║                                       ▼                         ║
║  Smart Swap (texte)                                             ║
║    → [Phase C] Session Redis (historique multi-turn)            ║
║    → [Phase A] Agent tool-use loop (Claude native, max 6 iter.) ║
║        ├─ resolve_token   → MCP get_erc20_token_info            ║
║        ├─ check_balance   → MCP get_erc20_balance               ║
║        ├─ get_token_market_data → DexScreener (prix, Δ24h...)   ║
║        ├─ get_swap_history → SwapLogStore.list({ wallet })      ║
║        └─ confirm_intent / produce_plan → QuoteRequest          ║
║    → [Phase D] Planning gate : /v1/intent/plan → planToken      ║
║              → /v1/intent/confirm-plan → pipeline BEQ           ║
║    @bnb-chain/mcp + LLM               Zod strict()              ║
╚══════════════════════════════════════════════════════════════════╝
                         │
                         ▼
╔══════════════════════════════════════════════════════════════════╗
║  quoteBuilder.ts  — PIPELINE (structure inchangée)              ║
║                                                                  ║
║  ① Fan-out adapters (10 actifs) + QuoteCache Redis              ║
║  ② Preflight parallèle (eth_call, quorum 2/N, BSC RPC)          ║
║     [BUG-2 corrigé : Promise.all]                               ║
║  ③ Sécurité parallèle [deadline individuelle] :                 ║
║     ├─ GoPlus / HoneypotIs / BscScan   (existant, 2s)           ║
║     ├─ DexScreener                     (existant, 2s)           ║
║     ├─ Onchain sellability             (existant, 2s)           ║
║     └─ HashDit API ← NOUVEAU           (2.5s, cache Redis 10m)  ║
║  ④ Feature extraction  ← NOUVEAU                               ║
║  ⑤ ML Engine (ONNX) ← NOUVEAU                                  ║
║     └─ remplace 4 placeholders: mev/churn/liquidity/slippage    ║
║     └─ complète estimatedGasUsd pour PancakeSwap                ║
║  ⑥ RiskSignals enrichis (source: ml|heuristic|mixed)            ║
║  ⑦ Agent trust factor (Phase E — feedback loop complet)          ║
║     ProviderTrustStore → agentTrustFactor per-provider          ║
║     Cold-start : 1.0 si totalSwaps < 100                        ║
║     Recomputed depuis SwapLogStore (Redis TTL 5 min)            ║
║  ⑧ BEQ v2 étendu                                                ║
║     QualityMult = reliability × sellability × agentTrustFactor  ║
║     RiskMult    = risk × preflight × mlConfidenceFactor         ║
║  ⑨ Ranking + DecisionReceipt (createdAt réel)                   ║
║  ⑩ [setImmediate] Archivage Greenfield ← NOUVEAU               ║
╚══════════════════════════════════════════════════════════════════╝
                         │
                         ▼
╔══════════════════════════════════════════════════════════════════╗
║  POST /v1/build-tx                                              ║
║  executionMode: direct (défaut) | gasless | deeplink            ║
║  gasless → EIP-712 typedData → relayer → SwapExecutor (opBNB)   ║
╚══════════════════════════════════════════════════════════════════╝
```

---

## 2. Extensions du modèle de données

Toutes les extensions utilisent des champs **optionnels** pour préserver la compatibilité.

### 2.1 `RiskSignalsSchema` (`packages/shared/src/schemas.ts`)

```typescript
// Ajouter après le champ `preflight` existant :

ml: z.object({
  enabled:      z.boolean(),
  modelVersion: z.string().optional(),
  confidence:   z.number().min(0).max(1).optional(),
  source:       z.enum(['ml', 'heuristic', 'mixed']).optional(),
}).optional(),

hashdit: z.object({
  riskLevel: z.union([
    z.literal(-1), z.literal(0), z.literal(1),
    z.literal(2), z.literal(3), z.literal(4), z.literal(5),
  ]),
  flags:     z.array(z.string()),  // risk_detail[].name
  fetchedAt: z.string(),           // ISO timestamp
  cached:    z.boolean(),
}).optional(),

agentReputation: z.object({
  agentId:       z.string(),
  trustScore:    z.number().min(0).max(1),
  totalSwaps:    z.number().int().nonnegative(),
  successRate:   z.number().min(0).max(1),
  avgSavingsBps: z.number().optional(),
  updatedAt:     z.string(),
}).optional(),
```

### 2.2 `BeqV2ComponentsSchema` (`packages/shared/src/schemas.ts`)

```typescript
// Ajouter aux champs optionnels existants :
agentTrustFactor:   z.number().min(0).max(1).optional(), // défaut runtime : 1.0
mlConfidenceFactor: z.number().min(0).max(1).optional(), // défaut runtime : 1.0
```

**Formule BEQ étendue** (dans `packages/scoring/src/beq-v2.ts`) :
```typescript
// Actuel
qualityMultiplier = reliabilityFactor * sellabilityFactor
riskMultiplier    = riskFactor * preflightFactor

// Étendu — backward-compatible (défaut 1.0 = pas de pénalité si absent)
qualityMultiplier = reliabilityFactor * sellabilityFactor * (agentTrustFactor ?? 1.0)
riskMultiplier    = riskFactor * preflightFactor * (mlConfidenceFactor ?? 1.0)
```

**Règle cold-start absolue :** `totalSwaps < 100` pour un provider → `agentTrustFactor = 1.0`.

### 2.3 `DecisionReceiptSchema` (`packages/shared/src/schemas.ts`)

```typescript
intentParsing: z.object({
  originalText:       z.string(),
  confidence:         z.number().min(0).max(1),
  parsedQuoteRequest: QuoteRequestSchema,
  clarifications:     z.array(z.string()).optional(),
}).optional(),

mlInsights: z.object({
  modelVersion:       z.string(),
  featuresSummary:    z.record(z.string(), z.unknown()).optional(),
  predictionsSummary: z.record(z.string(), z.string()).optional(),
}).optional(),

trust: z.object({
  agentId:    z.string(),
  trustScore: z.number().min(0).max(1),
  rationale:  z.string(),
}).optional(),

securityAudit: z.object({
  hashdit:     z.object({ riskLevel: z.number(), flags: z.array(z.string()) }).optional(),
  goplus:      z.record(z.string(), z.unknown()).optional(),
  honeypotis:  z.record(z.string(), z.unknown()).optional(),
  dexscreener: z.record(z.string(), z.unknown()).optional(),
  onchain:     z.record(z.string(), z.unknown()).optional(),
}).optional(),

archival: z.object({
  greenfield: z.object({
    objectName: z.string(),
    txHash:     z.string(),
    archivedAt: z.string(),
  }).optional(),
}).optional(),
```

### 2.4 Build-tx — `executionMode` (inline dans `apps/api/src/server.ts`)

```typescript
// BuildTxRequestSchema — ajout
executionMode: z.enum(['direct', 'gasless', 'deeplink']).default('direct').optional(),

// BuildTxResponseSchema — ajout
execution: z.object({
  mode:   z.enum(['direct', 'gasless', 'deeplink']),
  metaTx: z.object({
    typedData: z.unknown(),
    relayUrl:  z.string(),
    expiresAt: z.string(),
  }).optional(),
  deepLink: z.string().optional(),
}).optional(),
```

> **Note :** les schémas build-tx sont inline dans `server.ts`, pas dans `shared/schemas.ts`.

---

## 3. Intégrations BNB Chain — spécifications techniques

### 3.1 HashDit (M4 — Priorité absolue)

**Nature :** API REST uniquement (pas de npm SDK).
**Endpoint :** `POST https://api.hashdit.io/security-api/public/app/v1/detect`
**Accès :** gated — contacter `support@hashdit.com` (projet, chains, QPS estimé, usecase).
**Rate limit :** 1 200 calls/min.

#### Authentification HMAC-SHA256

```typescript
// packages/adapters/src/hashditClient.ts (nouveau fichier)
import crypto from 'node:crypto';

function buildHashDitHeaders(appid: string, appsecret: string, body: string) {
  const timestamp = Date.now().toString();
  const nonce     = crypto.randomUUID().replace(/-/g, ''); // 32-char hex

  // Format exact du message signé :
  const message = [
    appid,
    timestamp,
    nonce,
    'POST;/security-api/public/app/v1/detect;',
    body,
  ].join(';');

  const signature = crypto
    .createHmac('sha256', appsecret)
    .update(message)
    .digest('hex');

  return {
    'Content-Type':          'application/json;charset=UTF-8',
    'X-Signature-appid':     appid,
    'X-Signature-timestamp': timestamp,
    'X-Signature-nonce':     nonce,
    'X-Signature-signature': signature,
  };
}
```

#### Réponse et gestion du polling

```typescript
// has_result: false → résultat pas encore disponible, re-poller
// Stratégie : timeout global 2.5s, 1 seul poll si has_result=false
// Si toujours pas disponible → retourner null (pas de pénalité BEQ)

export type HashDitResult = {
  riskLevel: -1 | 0 | 1 | 2 | 3 | 4 | 5;
  flags:     string[];   // risk_detail[].name
  fetchedAt: string;     // ISO timestamp
  cached:    boolean;
} | null;
```

**Niveaux de risque HashDit :**

| `riskLevel` | Label | Signification |
|---|---|---|
| -1 | Invalid | Adresse invalide |
| 0 | Very Low Risk | Contrat de confiance établie |
| 1 | Some Risk | Pas de problème évident |
| 2 | Low Risk | Drapeaux mineurs |
| 3 | Medium Risk | Potentiel d'impact sur les fonds |
| 4 | High Risk | Perte partielle possible |
| 5 | Significant Risk | Code malveillant (honeypot, rug pull) |

#### Cache Redis

Clé : `hashdit:{chainId}:{tokenAddress_toLowerCase}`, TTL : 600s (10 min).

#### Mapping `riskLevel` → impact BEQ

| `riskLevel` | Mode SAFE | Mode NORMAL | Mode DEGEN |
|---|---|---|---|
| 5 | `FAIL` → disqualifié | `sellabilityFactor × 0.40` | `sellabilityFactor × 0.70` |
| 4 | `FAIL` → disqualifié | `sellabilityFactor × 0.50` | `sellabilityFactor × 0.75` |
| 3 | `sellabilityFactor × 0.70` | `sellabilityFactor × 0.85` | inchangé |
| 0–2 | inchangé | inchangé | inchangé |
| -1 | warning dans receipt | inchangé | inchangé |

#### Intégration dans `quoteBuilder.ts`

```typescript
// Remplacer le bloc Promise.all des 3 checks (lignes ~530-560) par :
const [
  onchainSellability,
  dexScreenerSellability,
  tokenSecuritySellability,
  hashditResult,          // ← NOUVEAU
] = await Promise.all([
  rpc    ? withDeadline(assessOnchainSellability(...), 2000)      : null,
  dexSCr ? withDeadline(assessDexScreenerSellability(...), 2000)  : null,
  tokSec ? withDeadline(assessTokenSecuritySellability(...), 2000) : null,
  hashdt ? withDeadline(hashditClient.scan(parsed.buyToken, parsed.chainId), 2500) : null,
]);
```

---

### 3.2 MCP BNB Chain (`@bnb-chain/mcp`) — Couche Intent uniquement

**Nature :** serveur MCP (JSON-RPC over SSE/stdio) — **pas une librairie importable**.

> ⚠️ Le MCP server ne remplace PAS les appels `viem` dans `quoteBuilder.ts`.
> Il est utilisé **exclusivement** pour la couche Intent (M2) et l'archivage Greenfield.

**Déploiement :** SSE sur port interne.
```bash
npx @bnb-chain/mcp@latest --sse --port 3001
```

**Client TypeScript** (`apps/api/src/intent/mcpClient.ts`) :
```typescript
import { Client }             from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

const transport = new SSEClientTransport(
  new URL(process.env.MCP_BNB_SERVER_URL ?? 'http://localhost:3001/sse')
);
const mcpClient = new Client({ name: 'swappilot-api', version: '1.0.0' }, {});
await mcpClient.connect(transport);
```

**Outils MCP utilisés dans SwapPilot :**

| Outil | Usage |
|-------|-------|
| `get_erc20_token_info` | Résolution symbol → adresse dans l'intent |
| `get_erc20_balance` | Vérification solde avant QuoteRequest |
| `estimate_gas` | Estimation indicative dans la confirmation intent |
| `gnfd_upload_object` | Archivage Greenfield des receipts |
| `gnfd_download_object` | Lecture receipt passé ("refais le même swap") |

---

### 3.3 opBNB — Executor gasless (M5) uniquement

> ⚠️ **Clarification technique fondamentale :**
> opBNB (chain 204) et BSC (chain 56) sont des chaînes **séparées**.
> Un `eth_call` sur opBNB ne peut PAS simuler l'état de BSC.
> L'utilisation d'opBNB pour le preflight BSC est **techniquement impossible**.

**Rôle réel d'opBNB dans ce plan :**
- Block time 250ms, frais ~$0.001/tx → idéal pour l'executor du metaTx gasless.
- `SwapExecutor.sol` déployé sur opBNB valide la signature EIP-712 et interagit avec BSC via le bridge natif.

**Architecture gasless (M5 testnet) :**
```
Utilisateur (BSC) → signe EIP-712 metaTx (sans gas BSC)
                                    ↓
                          Relayer SwapPilot
                                    ↓
                  SwapExecutor.sol sur opBNB ← bridge BSC
                                    ↓
                  PancakeSwap Router sur BSC (winner BEQ)
```

La production reste `executionMode: 'direct'` par défaut. Gasless = testnet uniquement en v1.

---

### 3.4 BNB Greenfield — Archivage asynchrone

**SDK :** `@bnb-chain/greenfield-js-sdk@^2.2.2`

> ⚠️ Latence write : ~2s (tx Greenfield) + upload SP.
> **Toujours asynchrone via `setImmediate`. Jamais dans le chemin critique.**

**Pattern d'intégration** (`apps/api/src/quoteBuilder.ts`) :
```typescript
// APRÈS le return de la réponse — non-bloquant
setImmediate(async () => {
  if (process.env.GREENFIELD_ENABLED !== 'true') return;
  try {
    await greenfieldArchiver.upload(receipt);
  } catch (err) {
    logger.warn({ err }, 'greenfield_archival_failed'); // silencieux
  }
});
```

**Structure de stockage :**
```
Bucket     : swappilot-receipts-{NODE_ENV}
Object     : receipts/{YYYY}/{MM}/{DD}/{receiptId}.json
Visibilité : VISIBILITY_TYPE_PRIVATE
Auth       : ECDSA (clé privée dédiée ≠ DEPLOYER_PRIVATE_KEY)
Coût       : facturation minimum 128 KB/objet, ~$0.10/GB/mois
```

---

## 4. ML léger (M1)

### 4.1 Les 4 signaux à remplacer

État actuel dans `packages/risk/src/engine.ts` :
```typescript
mevExposure: { level: q.sourceType === 'dex' ? 'HIGH' : 'MEDIUM', reasons: ['heuristic_placeholder'] }
churn:       { level: 'MEDIUM', reasons: ['heuristic_placeholder'] }
liquidity:   { level: 'MEDIUM', reasons: ['heuristic_placeholder'] }
slippage:    { level: 'MEDIUM', reasons: ['heuristic_placeholder'] }
```

Le ML remplace ces 4 valeurs. Le champ `ml.source` trace l'origine (`'ml'` | `'heuristic'`).

### 4.2 Features vérifiées dans le code source

| Feature | Source | Fiabilité |
|---------|--------|-----------|
| `preflight.pRevert` | `packages/preflight/` | ✅ Toujours présent |
| `preflight.outputMismatchRatio` | `packages/preflight/` | ⚠️ Seulement PancakeV2/UniV2 |
| `sellability.status` + `confidence` | merge dans `quoteBuilder.ts` | ✅ Toujours présent |
| `dexscreener.liquidityUsd` | extrait des reasons | ⚠️ Format string parsé |
| `hashdit.riskLevel` | après M4 | ✅ Disponible après M4 |
| `integrationConfidence` | `providerMeta` | ✅ Toujours présent |
| `raw.estimatedGas` | adapter | ✅ Présent (sauf stubs) |
| `gasPrice` RPC | `quoteBuilder.ts` | ✅ Présent si RPC ok |

**Exclusions obligatoires du training set :**
`estimatedGasUsd` fictifs : 1inch (`'0.50'`), Odos (`'0.30'`), OpenOcean (`'0.25'`),
UniswapV3 (`'0.40'`), UniswapV2 (`'0.30'`) → flag `gasUsdSource: 'hardcoded'` requis.

### 4.3 Cibles ML v1

| Cible | Type | Notes |
|-------|------|-------|
| `slippageLevel` | Classification LOW/MEDIUM/HIGH | |
| `liquidityLevel` | Classification LOW/MEDIUM/HIGH | |
| `mevExposureLevel` | Classification LOW/MEDIUM/HIGH | |
| `churnLevel` | Classification LOW/MEDIUM/HIGH | |
| `estimatedGasUsd` | Régression float | PancakeSwap uniquement |
| `mlConfidence` | Régression 0–1 | Calibrage Platt scaling |

### 4.4 Package `packages/ml/`

```
packages/ml/
├── src/
│   ├── index.ts      # export: createMLEngine
│   ├── inference.ts  # onnxruntime-node, timeout 25ms, AbortController
│   ├── features.ts   # buildFeatureVector() → Float32Array
│   ├── cache.ts      # Map<string, MLPrediction>, TTL 30s, max 1000 entries
│   ├── fallback.ts   # Réplique de la logique heuristique existante
│   └── types.ts
├── models/           # .onnx gitignored, chargés depuis ML_MODELS_PATH
└── package.json
```

**Gate de déploiement :** P95 latence < 25ms ET fallback < 20% ET corrélation slippage +5%.

### 4.5 Feedback loop (prérequis M1)

Étendre `SwapLogSchema` dans `server.ts` :
```typescript
actualSlippage:  z.number().optional(),
beqV2Details:    BeqV2ComponentsSchema.optional(),
mlPredictions:   z.record(z.string(), z.string()).optional(),
gasUsdActual:    z.string().optional(),
```

**Collecte requise :** ≥ 1 000 swaps avec `actualSlippage` renseigné avant entraînement.

---

## 5. Intent Solver (M2)

### Invariant absolu
L'intent ne choisit pas la route, ne construit pas la tx, n'exécute rien.
Il produit uniquement un `QuoteRequest` valide.

### Flux

```
POST /v1/intent/parse
  1. Rate limit : 20 req/min/IP
  2. LLM (claude-haiku-4-5-20251001 ou gpt-4o-mini)
  3. MCP get_erc20_token_info() → résolution symbol → adresse
  4. MCP get_erc20_balance() → vérification solde
  5. QuoteRequestSchema.strict().parse() → rejet si invalide
  → { parsedRequest, confidence, explanation, clarifications? }

POST /v1/intent/quote
  → Appelle POST /v1/quotes avec parsedRequest (même pipeline BEQ)
  → Retourne QuoteResponse standard
```

**Ambiguïté token → clarification obligatoire, jamais de guess silencieux.**

### Intent types supportés (v1)

| Type | Mapping |
|------|---------|
| Swap simple | QuoteRequest direct |
| Optimisation prix | `mode: 'DEGEN'` |
| Sécurité max | `mode: 'SAFE'` |
| Conditionnel | Watcher re-submit toutes les 30s |

---

## 5bis. Intent Solver v2 — Architecture Agentique

### Phase A — Native Claude Tool Use (fondation)

Remplacement de `callClaude()` (JSON extraction via system prompt) par une vraie boucle tool-use. `intentSolver.ts` reste **inchangé** comme fallback.

**Nouveau fichier :** `apps/api/src/intent/agenticSolver.ts`

```typescript
export async function parseIntentAgentic(
  turns: ConversationTurn[],   // historique complet ou [{ role:'user', content: text }]
  config: IntentConfig,
  mcp: MCPClient | null,
  swapLogStore: SwapLogStore,
  walletAddress?: string,
): Promise<ParseIntentResult>
```

La boucle POST `/v1/messages` avec le paramètre `tools` de l'API Anthropic. Max 6 itérations. `INTENT_AGENTIC_ENABLED=false` → fallback sur `intentSolver.ts` (bit-for-bit identique).

**Invariant préservé :** l'agent produit uniquement un `QuoteRequest` valide. Il ne choisit pas la route, ne construit pas la tx, n'exécute rien.

**Gate :** `INTENT_AGENTIC_ENABLED=false` (défaut).

### Phase B — Outils marché enrichis

**Nouveau fichier :** `apps/api/src/intent/marketTools.ts`

| Outil LLM | Implémentation | Données retournées |
|-----------|---------------|-------------------|
| `resolve_token` | `mcp.getTokenInfo(symbol, chainId)` | address, decimals |
| `check_balance` | `mcp.getTokenBalance(wallet, token, chainId)` | balance BigInt |
| `get_token_market_data` | DexScreener `/token-pairs/v1/bsc/{addr}` | priceUsd, priceChange24h, volumeUsd24h, liquidityUsd |
| `get_swap_history` | `swapLogStore.list({ wallet, from: 30j })` | 10 swaps récents formatés |
| `confirm_intent` | capture locale | QuoteRequest final |

`get_token_market_data` est une lecture légère indépendante de `assessDexScreenerSellability()` — pas de scoring sellability. Échec réseau → retourne `null` (agent continue sans données marché).

### Phase C — Session multi-turn

**Nouveau fichier :** `apps/api/src/intent/sessionStore.ts`

Pattern identique à `redisQuoteCache.ts` :
- `RedisSessionStore` — clé `intent:session:{uuid}`, TTL configurable (défaut 30 min)
- `MemorySessionStore` — fallback si Redis absent
- `sessionId` optionnel dans le request `/v1/intent/parse` → toujours retourné en réponse
- Réponse backward-compatible : `sessionId` est un champ additionnel ignoré par anciens clients

**Gate :** `INTENT_SESSION_TTL_SECONDS=1800` (défaut).

### Phase D — Planning Gate + Confirmation explicite

**Nouveaux endpoints :**

```
POST /v1/intent/plan          → { plan, planToken, parsedRequest, sessionId }
POST /v1/intent/confirm-plan  → QuoteResponse (pipeline BEQ standard, inchangé)
```

6ème outil LLM : `produce_plan` — identique à `confirm_intent` + champ `plan: string` (texte lisible présenté à l'utilisateur avant exécution).

**Nouveau fichier :** `apps/api/src/intent/planTokenStore.ts`
- Clé Redis `intent:plan:{uuid}`, TTL 120s, one-use (DELETE atomique avant réponse)
- Fallback `MemoryPlanTokenStore` si Redis absent
- 410 si planToken expiré ou déjà consommé

**Gate :** `INTENT_PLAN_MODE_ENABLED=false` (défaut) — endpoints retournent 501 si désactivé.

---

## 6. Agent Trust (M3) — Feedback loop complet (Phase E)

### 6.1 Formule (inchangée)

```typescript
function computeTrustScore(stats: ProviderStats): number {
  if (stats.totalSwaps < 100) return 1.0;  // cold-start guard absolu
  const base  = stats.successRate * Math.log10(Math.max(stats.totalSwaps, 10));
  const bonus = 1 + (stats.avgSavingsBps ?? 0) / 10_000;
  return Math.min(base * bonus, 1.0);
}
// avgSavingsBps = moyenne((actualBuyAmount - expectedBuyAmount) / expectedBuyAmount × 10_000)
// Positif = meilleure exécution que prévu. Négatif = slippage effectif subi.
```

**Pas de nouveau contrat en v1.**

### 6.2 Nouveaux fichiers

**`apps/api/src/trust/providerTrustComputer.ts`**

```typescript
export async function computeProviderTrust(
  providerId: string,
  swapLogStore: SwapLogStore,
  coldStartGuard = 100,
): Promise<ProviderTrustScore>
```

Lit `swapLogStore.list()`, filtre par `providerId`, applique la formule.

**`apps/api/src/trust/providerTrustStore.ts`**

Pattern identique à `redisQuoteCache.ts` :
- `RedisProviderTrustStore` — clé `trust:provider:{providerId}`, TTL configurable (défaut 5 min)
- `MemoryProviderTrustStore` — fallback
- Sur cache miss → `computeProviderTrust()` → stocke → retourne

### 6.3 Fix `packages/scoring/src/beq-v2.ts` — 1 seule ligne

Le champ `agentTrustFactor?: number` existe déjà dans `BeqV2Input` (ligne 72) mais est ignoré :

```typescript
// Ligne 502 — AVANT (hardcodé, jamais utilisé)
const agentTrustFactor = 1.0;

// APRÈS (lit l'input, défaut 1.0 = pas de pénalité si absent)
const agentTrustFactor = input.agentTrustFactor ?? 1.0;
```

### 6.4 Injection dans `apps/api/src/quoteBuilder.ts`

Avant le call `rankQuotes()` (lignes 779–787), charger les trust scores par provider :

```typescript
const trustScores = await Promise.all(
  resolvedQuotes.map(q =>
    providerTrustStore.get(q.providerId).catch(() => ({ trustFactor: 1.0 }))
  )
);
const quotesWithTrust = resolvedQuotes.map((q, i) => ({
  ...q,
  agentTrustFactor: trustScores[i]?.trustFactor ?? 1.0,
}));
const ranked = rankQuotes({ ..., quotes: quotesWithTrust });
```

Fallback systématique : échec du store → `trustFactor: 1.0` → comportement actuel bit-for-bit.

### 6.5 Endpoint monitoring

```
GET /v1/analytics/trust-scores   (admin token requis)
→ { providers: ProviderTrustScore[] }
```

### V2 (hors scope v1)
Contrat `AgentRegistry.sol` sur BSC avec `totalSwaps`, `successRate`, `avgSavingsBps`, `lastUpdated`, `metadataURI`.

---

## 7. Roadmap — milestones ordonnés

| # | Milestone | Prérequis | Gate | Risque cold-start |
|---|-----------|-----------|------|-------------------|
| M0 | Bugs critiques | — | — | — |
| M4 | HashDit | M0 | `HASHDIT_ENABLED=true` | Aucun |
| FL | Feedback loop data | M4 | ≥1000 swaps avec `actualSlippage` | — |
| M1 | ML Engine | FL | `ML_ENABLED=true`, P95<25ms | Fallback heuristique |
| **A** | **Native tool calling** | **M1** | **`INTENT_AGENTIC_ENABLED=true`** | — |
| **B** | **Market tools enrichis** | **A** | **Inclus dans Phase A** | — |
| **C** | **Session multi-turn** | **A** | **`INTENT_SESSION_TTL_SECONDS=1800`** | — |
| **D** | **Planning gate** | **C** | **`INTENT_PLAN_MODE_ENABLED=true`** | — |
| **E** | **Provider trust feedback** | **FL** | **`PROVIDER_TRUST_ENABLED=true`** | Guard `<100 swaps → 1.0` |
| M2 | Intent + MCP (full) | A,B,C,D | `INTENT_ENABLED=true` | — |
| M3 | Trust off-chain (full) | E | Guard `< 100 swaps → 1.0` | Guard absolu |
| M5 | Gasless / opBNB | M1 | Testnet d'abord | — |
| GF | Greenfield | M0 | Async uniquement | — |

### Critères d'acceptation par milestone

**M0 :** Zéro régression, P95 preflight divisé par ~2.

**M4 :** `HASHDIT_ENABLED=false` → comportement actuel bit-for-bit.
Token `riskLevel=5` → disqualifié en SAFE. Cache Redis actif (TTL 10min).

**FL :** `actualSlippage` renseigné sur ≥ 1 000 swaps.

**M1 :** `ML_ENABLED=false` → comportement actuel bit-for-bit.
P95 inférence < 25ms. Taux fallback < 20%. Corrélation slippage +5% vs heuristique.

**Phase A :** `INTENT_AGENTIC_ENABLED=false` → comportement actuel bit-for-bit (intentSolver.ts).
Logs montrent la boucle tool-use avec les appels d'outils.

**Phase B :** `get_token_market_data` retourne prix/Δ24h dans `explanation`. `get_swap_history` opérationnel si `walletAddress` fourni.

**Phase C :** 2 requêtes avec même `sessionId` — la 2ème reflète le contexte de la 1ère sans répéter les tokens.

**Phase D :** `POST /v1/intent/plan` retourne `plan` + `planToken`. `POST /v1/intent/confirm-plan` retourne `QuoteResponse`. Attendre >2 min → 410 Plan expiré.

**Phase E :** ≥200 SwapLogs avec `expectedBuyAmount` et `status` variés → `GET /v1/analytics/trust-scores` montre des scores < 1.0 pour providers peu fiables → BEQ les pénalise dans le ranking.

**M2 :** Ambiguïté → clarification. Quotes identiques à saisie manuelle équivalente.

**M3 :** Providers avec < 100 swaps → `agentTrustFactor = 1.0` (pas de pénalité).

**M5 :** Testnet : wallet sans BNB peut signer et voir son swap exécuté via relayer.

---

## 8. Fichiers modifiés par milestone

| Milestone | Nouveaux fichiers | Fichiers modifiés |
|-----------|-------------------|-------------------|
| M0 | — | `quoteBuilder.ts`, `preflight.ts`, `env.ts`, `vitest.config.ts` |
| M4 | `hashditClient.ts`, `hashditClient.test.ts` | `schemas.ts`, `engine.ts`, `quoteBuilder.ts`, `server.ts`, `receipt-drawer.tsx`, `settings-*.tsx` |
| FL | — | `server.ts` (SwapLogSchema), `use-execute-swap.ts` |
| M1 | `packages/ml/` (6 fichiers + tests) | `schemas.ts`, `engine.ts`, `normalize.ts`, `beq-v2.ts`, `quoteBuilder.ts`, `receipt-drawer.tsx` |
| **A** | **`intent/agenticSolver.ts`** | **`env.ts`, `server.ts`, `api.ts` (web)** |
| **B** | **`intent/marketTools.ts`** | **`agenticSolver.ts` (tools array)** |
| **C** | **`intent/sessionStore.ts`** | **`env.ts`, `server.ts`, `api.ts` (web), `intent-input.tsx`** |
| **D** | **`intent/planTokenStore.ts`** | **`env.ts`, `server.ts`, `api.ts` (web), `intent-input.tsx`** |
| **E** | **`trust/providerTrustComputer.ts`, `trust/providerTrustStore.ts`** | **`beq-v2.ts` (1 ligne l.502), `quoteBuilder.ts`, `env.ts`, `server.ts`** |
| M2 | `apps/api/src/intent/` (3 fichiers), Smart Swap UI | `schemas.ts`, `server.ts`, `settings-provider.tsx` |
| M3 | `agentTrustService.ts` | `schemas.ts`, `beq-v2.ts` |
| M5 | `SwapExecutor.sol`, `apps/api/src/relayer/` | `server.ts` (BuildTxSchema), `settings-drawer.tsx` |
| GF | `greenfieldArchiver.ts` | `quoteBuilder.ts`, `schemas.ts` |

---

## 9. Gaps de tests identifiés (aucune couverture actuelle)

| Zone | Priorité |
|------|---------|
| `quoteBuilder.ts` — fichier le plus critique du projet | 🔴 Critique |
| Hooks frontend (`use-swap-quotes`, `use-execute-swap`) | 🔴 Critique |
| 9 adapters DEX (seul PancakeSwap est testé) | 🟠 Important |
| `engine.ts` — 1 seul test existant | 🟠 Important |
| `beq-v2.ts` — pas de tests directs | 🟡 Normal |
| `receipt-drawer.tsx` — zéro test UI | 🟡 Normal |

**Pattern pour les nouveaux tests adapters :**
```typescript
// Suivre packages/adapters/test/pancakeswapDexAdapter.test.ts
vi.stubGlobal('fetch', vi.fn());
```

**Tests React components :** créer `apps/web/vitest.config.ts` avec `environment: 'jsdom'`.

---

## 10. Observabilité — métriques Prometheus nouvelles

```
# HashDit
hashdit_request_duration_ms   histogram (labels: cached, has_result)
hashdit_cache_hits_total       counter
hashdit_cache_misses_total     counter
hashdit_high_risk_total        counter (labels: mode)  — riskLevel >= 4
hashdit_timeout_total          counter

# ML
ml_inference_duration_ms       histogram
ml_fallback_total              counter (labels: reason)
ml_confidence_p50              gauge
ml_confidence_p95              gauge

# Intent (base)
intent_parse_duration_ms       histogram
intent_parse_errors_total      counter (labels: kind)
intent_clarifications_total    counter

# Agent tool-use (Phase A)
intent_tool_calls_total        counter (labels: tool_name)
intent_tool_loop_iterations    histogram
intent_agentic_duration_ms     histogram

# Sessions (Phase C)
intent_session_hits_total      counter
intent_session_misses_total    counter

# Provider trust (Phase E)
trust_score_per_provider       gauge (labels: provider_id)
trust_computation_duration_ms  histogram
trust_cache_hits_total         counter
trust_cache_misses_total       counter

# Greenfield
greenfield_upload_duration_ms  histogram
greenfield_upload_errors_total counter

# Preflight (suivi BUG-2)
preflight_duration_ms          histogram  — doit baisser après BUG-2
```

**Redaction logs (impératif) :**
- Ne jamais logger : `HASHDIT_APP_SECRET`, `PRIVATE_KEY`, `typedData` EIP-712.
- `account` dans les logs Intent → tronqué à 10 chars.

---

## 11. Variables d'environnement

```bash
# BUG-3 fix
RISK_KNOWN_TOKENS=0xbb4CdB...,0x55d398...,0x8ac76a...,0x7130d2...,0x2170Ed...,0x0E09FA...

# HashDit
HASHDIT_ENABLED=true
HASHDIT_APP_ID=xxx
HASHDIT_APP_SECRET=xxx
HASHDIT_TIMEOUT_MS=2500
HASHDIT_CACHE_TTL_S=600

# ML
ML_ENABLED=false
ML_MODELS_PATH=/app/models
ML_INFERENCE_TIMEOUT_MS=25
ML_MODEL_VERSION=v1.0.0

# Intent / MCP
INTENT_ENABLED=false
INTENT_LLM_PROVIDER=claude
INTENT_LLM_MODEL=claude-haiku-4-5-20251001
ANTHROPIC_API_KEY=xxx
MCP_BNB_SERVER_URL=http://localhost:3001/sse
INTENT_TIMEOUT_MS=3000

# Intent agentique (Phases A-D)
INTENT_AGENTIC_ENABLED=false       # Phase A : active la boucle tool-use Claude native
INTENT_SESSION_TTL_SECONDS=1800    # Phase C : durée de vie session (30 min)
INTENT_PLAN_MODE_ENABLED=false     # Phase D : gate de confirmation avant quotes

# Provider Trust (Phase E)
PROVIDER_TRUST_ENABLED=false       # Active le feedback loop BEQ
PROVIDER_TRUST_CACHE_TTL_MS=300000 # TTL Redis trust scores (5 min)
PROVIDER_TRUST_COLD_START_GUARD=100 # Min swaps avant pénalité trust

# Gasless / opBNB (chain 204)
RELAYER_ENABLED=false
OPBNB_RPC_URLS=https://opbnb-mainnet-rpc.bnbchain.org
RELAYER_PRIVATE_KEY=xxx
EXECUTOR_ADDRESS=0x...

# Greenfield
GREENFIELD_ENABLED=false
GREENFIELD_ENDPOINT=https://gnfd-tendermint-fullnode-mainnet-us.bnbchain.org
GREENFIELD_CHAIN_ID=1017
GREENFIELD_BUCKET=swappilot-receipts-prod
GREENFIELD_PRIVATE_KEY=xxx
```

---

## 12. Décisions architecturales

| Question | Décision | Rationale |
|----------|----------|-----------|
| HashDit HIGH : SAFE only ou tous modes ? | SAFE disqualifie. NORMAL ×0.5. DEGEN ×0.75. | Cohérent avec la sémantique fail-closed/open |
| trustScore on-chain ou off-chain ? | Off-chain v1, on-chain v2 | Gas + latence d'update incompatibles avec le pipeline |
| Gasless : EIP-7702 ou EIP-712 + executor ? | EIP-712 + executor (opBNB) | EIP-7702 non standardisé BSC en 2026 |
| ML governance | Gate P95<25ms + fallback<20% + corrélation+5%. Re-train hebdo. | Rollback via `ML_MODEL_VERSION` swap atomique |
| MCP remplace viem ? | Non — MCP = Intent + Greenfield uniquement | viem pour tous les hot paths |
| opBNB pour preflight BSC ? | Impossible (chaînes séparées) | Confirmé techniquement |
| cold-start ML | `mlConfidenceFactor = 1.0` par défaut | Pas de pénalité sans données |
| cold-start Trust | `agentTrustFactor = 1.0` si `totalSwaps < 100` | Guard absolu |

---

## Références

- [bnbchain-mcp GitHub](https://github.com/bnb-chain/bnbchain-mcp)
- [HashDit API docs](https://hashdit.github.io/hashdit/docs/hashdit-api/address-analysis-api/)
- [opBNB docs](https://docs.bnbchain.org/bnb-opbnb/)
- [BNB Greenfield JS SDK](https://docs.bnbchain.org/bnb-greenfield/for-developers/apis-and-sdks/sdk-js/)
- [Model Context Protocol SDK](https://modelcontextprotocol.io/)
