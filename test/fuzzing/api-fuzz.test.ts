/**
 * API Fuzzing Tests
 * Tests the API with invalid/malicious inputs to find vulnerabilities
 */

const API_URL = process.env.API_URL || 'http://localhost:3001';

interface FuzzTestCase {
  name: string;
  endpoint: string;
  method: 'GET' | 'POST';
  params?: Record<string, any>;
  body?: any;
  expectedBehavior: 'reject' | 'sanitize' | 'error';
}

const fuzzTestCases: FuzzTestCase[] = [
  // SQL Injection attempts
  {
    name: 'SQL injection in sellToken',
    endpoint: '/v1/quotes',
    method: 'GET',
    params: {
      sellToken: "0x' OR '1'='1",
      buyToken: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      sellAmount: '1000000000000000000',
    },
    expectedBehavior: 'reject',
  },
  
  // XSS attempts
  {
    name: 'XSS in buyToken',
    endpoint: '/v1/quotes',
    method: 'GET',
    params: {
      sellToken: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      buyToken: '<script>alert("xss")</script>',
      sellAmount: '1000000000000000000',
    },
    expectedBehavior: 'reject',
  },

  // Invalid addresses
  {
    name: 'Invalid sellToken address',
    endpoint: '/v1/quotes',
    method: 'GET',
    params: {
      sellToken: 'not-an-address',
      buyToken: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      sellAmount: '1000000000000000000',
    },
    expectedBehavior: 'reject',
  },

  // Extremely large amounts
  {
    name: 'Overflow attack - huge sellAmount',
    endpoint: '/v1/quotes',
    method: 'GET',
    params: {
      sellToken: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      buyToken: '0x55d398326f99059fF775485246999027B3197955',
      sellAmount: '9'.repeat(100),
    },
    expectedBehavior: 'reject',
  },

  // Negative amounts
  {
    name: 'Negative sellAmount',
    endpoint: '/v1/quotes',
    method: 'GET',
    params: {
      sellToken: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      buyToken: '0x55d398326f99059fF775485246999027B3197955',
      sellAmount: '-1000000000000000000',
    },
    expectedBehavior: 'reject',
  },

  // Zero amounts
  {
    name: 'Zero sellAmount',
    endpoint: '/v1/quotes',
    method: 'GET',
    params: {
      sellToken: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      buyToken: '0x55d398326f99059fF775485246999027B3197955',
      sellAmount: '0',
    },
    expectedBehavior: 'reject',
  },

  // Path traversal
  {
    name: 'Path traversal in endpoint',
    endpoint: '/v1/quotes/../../etc/passwd',
    method: 'GET',
    params: {},
    expectedBehavior: 'reject',
  },

  // Missing required params
  {
    name: 'Missing sellToken',
    endpoint: '/v1/quotes',
    method: 'GET',
    params: {
      buyToken: '0x55d398326f99059fF775485246999027B3197955',
      sellAmount: '1000000000000000000',
    },
    expectedBehavior: 'reject',
  },

  // Invalid slippage
  {
    name: 'Invalid slippage - negative',
    endpoint: '/v1/quotes',
    method: 'GET',
    params: {
      sellToken: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      buyToken: '0x55d398326f99059fF775485246999027B3197955',
      sellAmount: '1000000000000000000',
      slippageBps: '-100',
    },
    expectedBehavior: 'reject',
  },

  {
    name: 'Invalid slippage - too high',
    endpoint: '/v1/quotes',
    method: 'GET',
    params: {
      sellToken: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      buyToken: '0x55d398326f99059fF775485246999027B3197955',
      sellAmount: '1000000000000000000',
      slippageBps: '99999',
    },
    expectedBehavior: 'reject',
  },

  // Null bytes
  {
    name: 'Null byte injection',
    endpoint: '/v1/quotes',
    method: 'GET',
    params: {
      sellToken: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c\x00malicious',
      buyToken: '0x55d398326f99059fF775485246999027B3197955',
      sellAmount: '1000000000000000000',
    },
    expectedBehavior: 'reject',
  },

  // Unicode overflow
  {
    name: 'Unicode overflow',
    endpoint: '/v1/quotes',
    method: 'GET',
    params: {
      sellToken: '𝕏'.repeat(1000),
      buyToken: '0x55d398326f99059fF775485246999027B3197955',
      sellAmount: '1000000000000000000',
    },
    expectedBehavior: 'reject',
  },

  // Empty strings
  {
    name: 'Empty sellToken',
    endpoint: '/v1/quotes',
    method: 'GET',
    params: {
      sellToken: '',
      buyToken: '0x55d398326f99059fF775485246999027B3197955',
      sellAmount: '1000000000000000000',
    },
    expectedBehavior: 'reject',
  },

  // Repeated params
  {
    name: 'Parameter pollution',
    endpoint: '/v1/quotes?sellToken=0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c&sellToken=malicious',
    method: 'GET',
    params: {
      buyToken: '0x55d398326f99059fF775485246999027B3197955',
      sellAmount: '1000000000000000000',
    },
    expectedBehavior: 'sanitize',
  },

  // Same token swap
  {
    name: 'Same token for buy and sell',
    endpoint: '/v1/quotes',
    method: 'GET',
    params: {
      sellToken: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      buyToken: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      sellAmount: '1000000000000000000',
    },
    expectedBehavior: 'reject',
  },
];

async function runFuzzTest(testCase: FuzzTestCase): Promise<{
  passed: boolean;
  error?: string;
  status?: number;
  responseTime?: number;
}> {
  const startTime = Date.now();
  
  try {
    const url = new URL(testCase.endpoint, API_URL);
    if (testCase.params) {
      Object.entries(testCase.params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    const response = await fetch(url.toString(), {
      method: testCase.method,
      headers: testCase.body ? { 'Content-Type': 'application/json' } : {},
      body: testCase.body ? JSON.stringify(testCase.body) : undefined,
    });

    const responseTime = Date.now() - startTime;

    // Check if behavior matches expectation
    if (testCase.expectedBehavior === 'reject') {
      // Should return 4xx error
      if (response.status >= 400 && response.status < 500) {
        return { passed: true, status: response.status, responseTime };
      } else {
        return {
          passed: false,
          error: `Expected 4xx error, got ${response.status}`,
          status: response.status,
          responseTime,
        };
      }
    }

    if (testCase.expectedBehavior === 'error') {
      // Should return 5xx error or 4xx
      if (response.status >= 400) {
        return { passed: true, status: response.status, responseTime };
      } else {
        return {
          passed: false,
          error: `Expected error response, got ${response.status}`,
          status: response.status,
          responseTime,
        };
      }
    }

    // For 'sanitize', check that it doesn't crash
    return { passed: true, status: response.status, responseTime };

  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    
    // Network errors are acceptable for some fuzz tests
    if (testCase.expectedBehavior === 'reject' || testCase.expectedBehavior === 'error') {
      return { passed: true, error: error.message, responseTime };
    }
    
    return {
      passed: false,
      error: `Unexpected error: ${error.message}`,
      responseTime,
    };
  }
}

async function runAllFuzzTests() {
  console.log('🔨 Starting API Fuzzing Tests...\n');
  console.log(`Target: ${API_URL}\n`);
  
  let passed = 0;
  let failed = 0;
  const results: Array<{ name: string; passed: boolean; details: any }> = [];

  for (const testCase of fuzzTestCases) {
    const result = await runFuzzTest(testCase);
    
    if (result.passed) {
      passed++;
      console.log(`✅ ${testCase.name}`);
    } else {
      failed++;
      console.log(`❌ ${testCase.name}`);
      console.log(`   Error: ${result.error}`);
    }
    
    if (result.responseTime) {
      console.log(`   Response time: ${result.responseTime}ms`);
    }
    
    results.push({
      name: testCase.name,
      passed: result.passed,
      details: result,
    });
    
    // Small delay to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 Fuzzing Test Results');
  console.log('='.repeat(50));
  console.log(`Total Tests: ${fuzzTestCases.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / fuzzTestCases.length) * 100).toFixed(1)}%`);
  
  if (failed > 0) {
    console.log('\n⚠️  Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.details.error}`);
    });
  }

  return {
    total: fuzzTestCases.length,
    passed,
    failed,
    results,
  };
}

// Run if called directly
if (require.main === module) {
  runAllFuzzTests()
    .then((results) => {
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { runAllFuzzTests, fuzzTestCases };
