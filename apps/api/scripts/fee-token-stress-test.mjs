#!/usr/bin/env node
/**
 * Fee-on-Transfer Token Stress Test
 * Specifically tests tokens known to have transfer fees/taxes
 * 
 * Usage:
 *   node scripts/fee-token-stress-test.mjs
 *   URL=https://swappilot-api.fly.dev node scripts/fee-token-stress-test.mjs
 *   VERBOSE=true node scripts/fee-token-stress-test.mjs
 */

import { performance } from 'node:perf_hooks';

const API_URL = process.env.URL ?? 'http://localhost:3001';
const VERBOSE = process.env.VERBOSE === 'true';

// Native tokens
const BNB = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

// Known fee-on-transfer tokens with their estimated tax rates
const FEE_TOKENS = [
  { symbol: 'SAFEMOON', address: '0x8076C74C5e3F5852037F31Ff0093Eeb8c8ADd8D3', decimals: 9, taxRate: '10%' },
  { symbol: 'BABYDOGE', address: '0xc748673057861a797275CD8A068AbB95A902e8de', decimals: 9, taxRate: '5%' },
  { symbol: 'SAFEMARS', address: '0x3aD9594151886Ce8538C1ff615EFa2385a8C3A88', decimals: 9, taxRate: '4%' },
  { symbol: 'ELONGATE', address: '0x2A9718defF471f3Bb91FA0ECEAB14154F150a385', decimals: 9, taxRate: '10%' },
  { symbol: 'PITBULL', address: '0xA57ac35CE91Ee92CaEfAA8dc04140C8e232c2E50', decimals: 9, taxRate: '2%' },
  { symbol: 'LOVELY', address: '0x9E24415d1e549EBc626a13a482Bb117a2B43e9CF', decimals: 8, taxRate: '8%' },
  { symbol: 'EGC', address: '0xC001BBe2B87079294C63EcE98BdD0a88D761434e', decimals: 9, taxRate: '14%' },
  { symbol: 'SPHRI', address: '0x8EA93d00Cc6252E2bD02A34782487EBd8F8B3a7E', decimals: 18, taxRate: '6%' },
];

// Slippage values to test
const SLIPPAGE_VALUES = [50, 100, 300, 500, 1000, 1500];

const results = [];

async function testQuoteWithSlippage(token, slippageBps) {
  const sellAmount = (0.1 * 1e18).toString(); // 0.1 BNB
  
  const body = {
    chainId: 56,
    sellToken: BNB,
    buyToken: token.address,
    sellAmount,
    slippageBps,
    mode: 'NORMAL',
    sellTokenDecimals: 18,
    buyTokenDecimals: token.decimals,
  };

  const start = performance.now();
  
  try {
    const res = await fetch(`${API_URL}/v1/quotes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    
    const latency = performance.now() - start;
    const data = await res.json();
    
    if (!res.ok) {
      return {
        token: token.symbol,
        slippageBps,
        success: false,
        error: data?.message || `HTTP ${res.status}`,
        latency: Math.round(latency),
      };
    }
    
    const quotes = data.rankedQuotes || [];
    const bestQuote = quotes[0];
    
    return {
      token: token.symbol,
      taxRate: token.taxRate,
      slippageBps,
      success: true,
      latency: Math.round(latency),
      providersCount: quotes.length,
      bestProvider: bestQuote?.providerId,
      bestScore: bestQuote?.score?.beqScore,
      sellability: bestQuote?.signals?.sellability?.status,
      sellabilityConfidence: bestQuote?.signals?.sellability?.confidence,
      revertRisk: bestQuote?.signals?.revertRisk?.level,
      revertReasons: bestQuote?.signals?.revertRisk?.reasons?.slice(0, 3),
    };
  } catch (err) {
    return {
      token: token.symbol,
      slippageBps,
      success: false,
      error: err.message,
      latency: Math.round(performance.now() - start),
    };
  }
}

async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║       Fee-on-Transfer Token Stress Test                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\nAPI: ${API_URL}`);
  console.log(`Tokens: ${FEE_TOKENS.length}`);
  console.log(`Slippage values: ${SLIPPAGE_VALUES.map(s => `${s/100}%`).join(', ')}`);
  console.log('\n' + '─'.repeat(60));

  for (const token of FEE_TOKENS) {
    console.log(`\n🪙 ${token.symbol} (Tax: ${token.taxRate})`);
    
    for (const slippage of SLIPPAGE_VALUES) {
      const result = await testQuoteWithSlippage(token, slippage);
      results.push(result);
      
      if (result.success) {
        const icon = result.sellability === 'OK' ? '✅' : 
                     result.sellability === 'UNCERTAIN' ? '⚠️' : '❌';
        console.log(`  ${slippage/100}%: ${icon} ${result.providersCount} providers, best: ${result.bestProvider} (${result.bestScore?.toFixed(1)}), sellability: ${result.sellability}`);
        
        if (VERBOSE && result.revertReasons?.length > 0) {
          console.log(`       Revert reasons: ${result.revertReasons.join(', ')}`);
        }
      } else {
        console.log(`  ${slippage/100}%: ❌ ${result.error}`);
      }
      
      // Rate limiting
      await new Promise(r => setTimeout(r, 150));
    }
  }

  // Analysis
  console.log('\n' + '═'.repeat(60));
  console.log('                     ANALYSIS');
  console.log('═'.repeat(60));

  // Group by token
  console.log('\n📊 RECOMMENDED SLIPPAGE BY TOKEN:');
  for (const token of FEE_TOKENS) {
    const tokenResults = results.filter(r => r.token === token.symbol && r.success);
    
    if (tokenResults.length === 0) {
      console.log(`   ${token.symbol}: ❌ No successful quotes`);
      continue;
    }
    
    // Find minimum slippage with OK sellability
    const okResults = tokenResults.filter(r => r.sellability === 'OK');
    const minSlippage = okResults.length > 0 
      ? Math.min(...okResults.map(r => r.slippageBps))
      : tokenResults[tokenResults.length - 1].slippageBps;
    
    const sellabilityStatus = okResults.length > 0 ? 'OK' : 
                              tokenResults.some(r => r.sellability === 'UNCERTAIN') ? 'UNCERTAIN' : 'FAIL';
    
    console.log(`   ${token.symbol} (tax ${token.taxRate}): recommend ${minSlippage/100}% slippage, sellability: ${sellabilityStatus}`);
  }

  // Risk signals analysis
  console.log('\n📊 RISK SIGNALS SUMMARY:');
  const successResults = results.filter(r => r.success);
  const sellabilityOk = successResults.filter(r => r.sellability === 'OK').length;
  const sellabilityUncertain = successResults.filter(r => r.sellability === 'UNCERTAIN').length;
  const sellabilityFail = successResults.filter(r => r.sellability === 'FAIL').length;
  
  console.log(`   Sellability OK: ${sellabilityOk} (${(sellabilityOk/successResults.length*100).toFixed(0)}%)`);
  console.log(`   Sellability UNCERTAIN: ${sellabilityUncertain} (${(sellabilityUncertain/successResults.length*100).toFixed(0)}%)`);
  console.log(`   Sellability FAIL: ${sellabilityFail} (${(sellabilityFail/successResults.length*100).toFixed(0)}%)`);

  // Common revert reasons
  console.log('\n📊 COMMON REVERT REASONS:');
  const reasonCounts = {};
  successResults.forEach(r => {
    (r.revertReasons || []).forEach(reason => {
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
    });
  });
  
  Object.entries(reasonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([reason, count]) => {
      console.log(`   - ${reason}: ${count}x`);
    });

  // Save results
  const fs = await import('node:fs');
  const reportPath = `./fee-token-test-${Date.now()}.json`;
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    apiUrl: API_URL,
    tokens: FEE_TOKENS,
    results,
  }, null, 2));
  
  console.log(`\n📄 Report saved to: ${reportPath}`);
}

runTests().catch(console.error);
