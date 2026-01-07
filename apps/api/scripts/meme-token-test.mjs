#!/usr/bin/env node
/**
 * Meme Token Integration Test Suite
 * Tests quotes and swap simulations across all providers with real BSC meme tokens
 * 
 * Usage:
 *   node scripts/meme-token-test.mjs                    # Test against local API
 *   URL=https://swappilot-api.fly.dev node scripts/meme-token-test.mjs  # Test production
 *   SIMULATE=true node scripts/meme-token-test.mjs     # Also test buildTx simulation
 */

import { performance } from 'node:perf_hooks';

// Configuration
const API_URL = process.env.URL ?? 'http://localhost:3001';
const SIMULATE_BUILD_TX = process.env.SIMULATE === 'true';
const VERBOSE = process.env.VERBOSE === 'true';

// Test wallet address (used for buildTx simulation)
const TEST_WALLET = '0x37857a1f76bd95e71CE8eF120D9c336D7c021846';

// BSC native/wrapped tokens
const BNB = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
const USDT = '0x55d398326f99059ff775485246999027b3197955';

// Real BSC Meme Tokens (mix of popular and risky)
const MEME_TOKENS = [
  // Popular meme tokens
  { symbol: 'DOGE', address: '0xbA2aE424d960c26247Dd6c32edC70B295c744C43', name: 'Dogecoin (BSC)', decimals: 8 },
  { symbol: 'SHIB', address: '0x2859e4544C4bB03966803b044A93563Bd2D0DD4D', name: 'Shiba Inu (BSC)', decimals: 18 },
  { symbol: 'FLOKI', address: '0xfb5B838b6cfEEdC2873aB27866079AC55363D37E', name: 'Floki Inu', decimals: 9 },
  { symbol: 'BABYDOGE', address: '0xc748673057861a797275CD8A068AbB95A902e8de', name: 'Baby Doge Coin', decimals: 9 },
  { symbol: 'PEPE', address: '0x25d887Ce7a35172C62FeBFD67a1856F20FaEbB00', name: 'Pepe (BSC)', decimals: 18 },
  
  // Fee-on-transfer tokens (known to have taxes)
  { symbol: 'SAFEMOON', address: '0x8076C74C5e3F5852037F31Ff0093Eeb8c8ADd8D3', name: 'SafeMoon', decimals: 9, hasFees: true },
  { symbol: 'SAFEMARS', address: '0x3aD9594151886Ce8538C1ff615EFa2385a8C3A88', name: 'SafeMars', decimals: 9, hasFees: true },
  { symbol: 'ELONGATE', address: '0x2A9718defF471f3Bb91FA0ECEAB14154F150a385', name: 'ElonGate', decimals: 9, hasFees: true },
  { symbol: 'PITBULL', address: '0xA57ac35CE91Ee92CaEfAA8dc04140C8e232c2E50', name: 'Pitbull', decimals: 9, hasFees: true },
  
  // Volatile/risky meme tokens
  { symbol: 'EGC', address: '0xC001BBe2B87079294C63EcE98BdD0a88D761434e', name: 'EverGrow Coin', decimals: 9 },
  { symbol: 'SPHRI', address: '0x8EA93d00Cc6252E2bD02A34782487EBd8F8B3a7E', name: 'Spherium', decimals: 18 },
  { symbol: 'LOVELY', address: '0x9E24415d1e549EBc626a13a482Bb117a2B43e9CF', name: 'Lovely Inu', decimals: 8, hasFees: true },
  { symbol: 'SQUID', address: '0x87230146E138d3F296a9a77e497A2A83012e9Bc5', name: 'Squid Game', decimals: 18 },
  
  // Newer/less liquid meme tokens
  { symbol: 'QUACK', address: '0xD74b782E05AA25c50e7330Af541d46E18f36661C', name: 'RichQUACK', decimals: 9 },
  { symbol: 'MBOX', address: '0x3203c9E46cA618C8C1cE5dC67e7e9D75f5da2377', name: 'Mobox', decimals: 18 },
  { symbol: 'CHESS', address: '0x20de22029ab63cf9A7Cf5fEB2b737Ca1eE4c82A6', name: 'Tranchess', decimals: 18 },
  { symbol: 'LAZIO', address: '0x77d547256A2cD95F32F3bC0A6F9b3b35eD5c86Af', name: 'Lazio Fan Token', decimals: 8 },
  { symbol: 'SANTOS', address: '0xA64455a4553C9034236734FadDAddbb64aCE4Cc7', name: 'Santos FC', decimals: 8 },
  { symbol: 'PORTO', address: '0x49f2145d6366099e13B10FbF80646C0F377eE7f6', name: 'Porto', decimals: 8 },
  
  // High risk tokens
  { symbol: 'GMT', address: '0x3019BF2a2eF8040C242C9a4c5c4BD4C81678b2A1', name: 'STEPN', decimals: 8 },
  { symbol: 'HIGH', address: '0x5f4Bde007Dc06b867f86EBFE4802e34A1fFEEd63', name: 'Highstreet', decimals: 18 },
];

// All providers to test
const PROVIDERS = ['1inch', 'paraswap', 'openocean', 'odos', 'kyberswap', 'pancakeswap'];

// Test amounts (in human readable format)
const TEST_AMOUNTS = [
  { bnb: '0.1', description: 'Small swap (0.1 BNB)' },
  { bnb: '1', description: 'Medium swap (1 BNB)' },
];

// Results storage
const results = {
  quotes: { success: 0, failed: 0, errors: {} },
  buildTx: { success: 0, failed: 0, errors: {} },
  byProvider: {},
  byToken: {},
  details: [],
};

// Initialize provider/token stats
PROVIDERS.forEach(p => {
  results.byProvider[p] = { quotes: 0, quotesFailed: 0, buildTx: 0, buildTxFailed: 0 };
});
MEME_TOKENS.forEach(t => {
  results.byToken[t.symbol] = { quotes: 0, quotesFailed: 0, errors: [] };
});

// Utility functions
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatError(err) {
  if (typeof err === 'string') return err;
  if (err?.message) return err.message;
  return JSON.stringify(err);
}

// Test quote endpoint
async function testQuote(sellToken, buyToken, sellAmount, tokenSymbol, description, sellDecimals = 18, buyDecimals = 18) {
  const startTime = performance.now();
  
  const body = {
    chainId: 56,
    sellToken,
    buyToken,
    sellAmount,
    slippageBps: 500, // 5% for meme tokens
    mode: 'NORMAL',
    sellTokenDecimals: sellDecimals,
    buyTokenDecimals: buyDecimals,
  };

  try {
    const res = await fetch(`${API_URL}/v1/quotes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const latency = performance.now() - startTime;
    const data = await res.json();

    if (!res.ok) {
      const errorKey = data?.message || `HTTP ${res.status}`;
      results.quotes.failed++;
      results.quotes.errors[errorKey] = (results.quotes.errors[errorKey] || 0) + 1;
      results.byToken[tokenSymbol].quotesFailed++;
      results.byToken[tokenSymbol].errors.push(errorKey);
      
      results.details.push({
        type: 'quote',
        token: tokenSymbol,
        description,
        success: false,
        error: errorKey,
        latency: Math.round(latency),
      });
      
      if (VERBOSE) console.log(`  ❌ Quote failed: ${errorKey}`);
      return null;
    }

    results.quotes.success++;
    results.byToken[tokenSymbol].quotes++;
    
    // Analyze provider responses
    const rankedQuotes = data.rankedQuotes || [];
    const providerResults = {};
    
    rankedQuotes.forEach(q => {
      const pid = q.providerId;
      providerResults[pid] = {
        buyAmount: q.raw?.buyAmount,
        beqScore: q.score?.beqScore,
        sellability: q.signals?.sellability?.status,
        revertRisk: q.signals?.revertRisk?.level,
      };
      // Initialize provider stats if not exists
      if (!results.byProvider[pid]) {
        results.byProvider[pid] = { quotes: 0, quotesFailed: 0, buildTx: 0, buildTxFailed: 0 };
      }
      results.byProvider[pid].quotes++;
    });

    results.details.push({
      type: 'quote',
      token: tokenSymbol,
      description,
      success: true,
      latency: Math.round(latency),
      providersResponded: rankedQuotes.length,
      providers: providerResults,
      bestProvider: rankedQuotes[0]?.providerId,
      bestScore: rankedQuotes[0]?.score?.beqScore,
    });

    if (VERBOSE) {
      console.log(`  ✅ Quote OK (${Math.round(latency)}ms) - ${rankedQuotes.length} providers, best: ${rankedQuotes[0]?.providerId}`);
    }

    return { data, bestQuote: rankedQuotes[0] };
  } catch (err) {
    const latency = performance.now() - startTime;
    const errorKey = formatError(err);
    
    results.quotes.failed++;
    results.quotes.errors[errorKey] = (results.quotes.errors[errorKey] || 0) + 1;
    results.byToken[tokenSymbol].quotesFailed++;
    
    results.details.push({
      type: 'quote',
      token: tokenSymbol,
      description,
      success: false,
      error: errorKey,
      latency: Math.round(latency),
    });
    
    if (VERBOSE) console.log(`  ❌ Quote error: ${errorKey}`);
    return null;
  }
}

// Test buildTx endpoint
async function testBuildTx(quote, sellToken, buyToken, sellAmount, tokenSymbol) {
  if (!quote) return null;
  
  const startTime = performance.now();
  
  const body = {
    providerId: quote.providerId,
    sellToken,
    buyToken,
    sellAmount,
    slippageBps: 500,
    account: TEST_WALLET,
    quoteRaw: quote.raw,
    quoteNormalized: quote.normalized,
  };

  try {
    const res = await fetch(`${API_URL}/v1/build-tx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const latency = performance.now() - startTime;
    const data = await res.json();

    if (!res.ok) {
      const errorKey = data?.message || `HTTP ${res.status}`;
      results.buildTx.failed++;
      results.buildTx.errors[errorKey] = (results.buildTx.errors[errorKey] || 0) + 1;
      results.byProvider[quote.providerId].buildTxFailed++;
      
      results.details.push({
        type: 'buildTx',
        token: tokenSymbol,
        provider: quote.providerId,
        success: false,
        error: errorKey,
        latency: Math.round(latency),
      });
      
      if (VERBOSE) console.log(`  ❌ BuildTx failed (${quote.providerId}): ${errorKey}`);
      return null;
    }

    results.buildTx.success++;
    results.byProvider[quote.providerId].buildTx++;
    
    results.details.push({
      type: 'buildTx',
      token: tokenSymbol,
      provider: quote.providerId,
      success: true,
      latency: Math.round(latency),
      hasData: !!data.data,
      hasApproval: !!data.approvalAddress,
    });
    
    if (VERBOSE) console.log(`  ✅ BuildTx OK (${quote.providerId}, ${Math.round(latency)}ms)`);
    return data;
  } catch (err) {
    const latency = performance.now() - startTime;
    const errorKey = formatError(err);
    
    results.buildTx.failed++;
    results.buildTx.errors[errorKey] = (results.buildTx.errors[errorKey] || 0) + 1;
    
    results.details.push({
      type: 'buildTx',
      token: tokenSymbol,
      provider: quote.providerId,
      success: false,
      error: errorKey,
      latency: Math.round(latency),
    });
    
    if (VERBOSE) console.log(`  ❌ BuildTx error: ${errorKey}`);
    return null;
  }
}

// Main test runner
async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         SwapPilot Meme Token Integration Tests            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\nAPI: ${API_URL}`);
  console.log(`Tokens: ${MEME_TOKENS.length}`);
  console.log(`Providers: ${PROVIDERS.join(', ')}`);
  console.log(`BuildTx Simulation: ${SIMULATE_BUILD_TX ? 'Yes' : 'No'}`);
  console.log('\n' + '─'.repeat(60));

  const startTime = performance.now();
  let testCount = 0;

  for (const token of MEME_TOKENS) {
    console.log(`\n🪙 Testing ${token.symbol} (${token.name})${token.hasFees ? ' [FEE-ON-TRANSFER]' : ''}`);
    
    for (const amount of TEST_AMOUNTS) {
      const sellAmount = (parseFloat(amount.bnb) * 1e18).toString();
      const description = `Buy ${token.symbol} with ${amount.bnb} BNB`;
      
      // Test BNB -> Token
      if (VERBOSE) console.log(`  → ${description}`);
      const quoteResult = await testQuote(
        BNB, 
        token.address, 
        sellAmount, 
        token.symbol, 
        description,
        18, // BNB decimals
        token.decimals || 18 // Token decimals
      );
      testCount++;
      
      if (SIMULATE_BUILD_TX && quoteResult?.bestQuote) {
        await testBuildTx(quoteResult.bestQuote, BNB, token.address, sellAmount, token.symbol);
        testCount++;
      }
      
      // Rate limiting - avoid hammering the API
      await sleep(200);
    }
    
    // Test Token -> BNB (selling)
    const sellDescription = `Sell ${token.symbol} for BNB`;
    // Calculate proper sell amount based on token decimals
    const tokenDecimals = token.decimals || 18;
    const tokenSellAmount = BigInt(1000) * BigInt(10 ** tokenDecimals);
    
    if (VERBOSE) console.log(`  → ${sellDescription}`);
    const sellQuoteResult = await testQuote(
      token.address, 
      BNB, 
      tokenSellAmount.toString(), 
      token.symbol, 
      sellDescription,
      tokenDecimals, // sellTokenDecimals
      18 // buyTokenDecimals (BNB)
    );
    testCount++;
    
    if (SIMULATE_BUILD_TX && sellQuoteResult?.bestQuote) {
      await testBuildTx(sellQuoteResult.bestQuote, token.address, BNB, tokenSellAmount.toString(), token.symbol);
      testCount++;
    }
    
    await sleep(300);
  }

  const totalTime = performance.now() - startTime;

  // Print results
  console.log('\n' + '═'.repeat(60));
  console.log('                        RESULTS');
  console.log('═'.repeat(60));
  
  console.log('\n📊 QUOTES SUMMARY:');
  console.log(`   ✅ Success: ${results.quotes.success}`);
  console.log(`   ❌ Failed: ${results.quotes.failed}`);
  console.log(`   📈 Success Rate: ${((results.quotes.success / (results.quotes.success + results.quotes.failed)) * 100).toFixed(1)}%`);
  
  if (Object.keys(results.quotes.errors).length > 0) {
    console.log('\n   Quote Errors:');
    Object.entries(results.quotes.errors)
      .sort((a, b) => b[1] - a[1])
      .forEach(([err, count]) => {
        console.log(`     - ${err}: ${count}x`);
      });
  }

  if (SIMULATE_BUILD_TX) {
    console.log('\n📊 BUILD-TX SUMMARY:');
    console.log(`   ✅ Success: ${results.buildTx.success}`);
    console.log(`   ❌ Failed: ${results.buildTx.failed}`);
    console.log(`   📈 Success Rate: ${((results.buildTx.success / (results.buildTx.success + results.buildTx.failed)) * 100).toFixed(1)}%`);
    
    if (Object.keys(results.buildTx.errors).length > 0) {
      console.log('\n   BuildTx Errors:');
      Object.entries(results.buildTx.errors)
        .sort((a, b) => b[1] - a[1])
        .forEach(([err, count]) => {
          console.log(`     - ${err}: ${count}x`);
        });
    }
  }

  console.log('\n📊 BY PROVIDER:');
  Object.entries(results.byProvider).forEach(([provider, stats]) => {
    if (stats.quotes > 0 || stats.quotesFailed > 0) {
      const quoteRate = stats.quotes > 0 ? ((stats.quotes / (stats.quotes + stats.quotesFailed)) * 100).toFixed(0) : 0;
      console.log(`   ${provider}: ${stats.quotes} quotes OK (${quoteRate}%)${SIMULATE_BUILD_TX ? `, ${stats.buildTx} buildTx OK` : ''}`);
    }
  });

  console.log('\n📊 PROBLEMATIC TOKENS:');
  const problemTokens = Object.entries(results.byToken)
    .filter(([_, stats]) => stats.quotesFailed > 0)
    .sort((a, b) => b[1].quotesFailed - a[1].quotesFailed);
  
  if (problemTokens.length === 0) {
    console.log('   ✅ No problematic tokens found!');
  } else {
    problemTokens.forEach(([symbol, stats]) => {
      console.log(`   ⚠️ ${symbol}: ${stats.quotesFailed} failures`);
      if (stats.errors.length > 0) {
        const uniqueErrors = [...new Set(stats.errors)];
        uniqueErrors.forEach(err => console.log(`      - ${err}`));
      }
    });
  }

  console.log('\n⏱️ TIMING:');
  console.log(`   Total tests: ${testCount}`);
  console.log(`   Total time: ${(totalTime / 1000).toFixed(1)}s`);
  console.log(`   Avg per test: ${(totalTime / testCount).toFixed(0)}ms`);

  // Export detailed results to JSON
  const reportPath = `./meme-token-test-${Date.now()}.json`;
  const fs = await import('node:fs');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    config: { apiUrl: API_URL, simulateBuildTx: SIMULATE_BUILD_TX },
    summary: {
      quotes: results.quotes,
      buildTx: SIMULATE_BUILD_TX ? results.buildTx : null,
    },
    byProvider: results.byProvider,
    byToken: results.byToken,
    details: results.details,
  }, null, 2));
  
  console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  console.log('═'.repeat(60));
}

// Run
runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
