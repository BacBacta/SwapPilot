/**
 * Load Testing & Stress Testing
 * Tests the application's capacity to handle high volumes of concurrent requests
 */

const API_URL = process.env.API_URL || 'https://swappilot-api.fly.dev';

interface LoadTestConfig {
  name: string;
  endpoint: string;
  params: Record<string, any>;
  concurrentUsers: number;
  requestsPerUser: number;
  rampUpTime: number; // milliseconds
}

interface LoadTestResult {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  requestsPerSecond: number;
  errorRate: number;
  totalDuration: number;
  p50: number; // 50th percentile
  p95: number; // 95th percentile
  p99: number; // 99th percentile
}

// Test scenarios
const loadTestScenarios: LoadTestConfig[] = [
  {
    name: 'Light Load - Quote Fetching',
    endpoint: '/v1/quotes',
    params: {
      sellToken: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
      buyToken: '0x55d398326f99059fF775485246999027B3197955',  // USDT
      sellAmount: '1000000000000000000', // 1 BNB
    },
    concurrentUsers: 10,
    requestsPerUser: 10,
    rampUpTime: 1000,
  },
  {
    name: 'Medium Load - Quote Fetching',
    endpoint: '/v1/quotes',
    params: {
      sellToken: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      buyToken: '0x55d398326f99059fF775485246999027B3197955',
      sellAmount: '1000000000000000000',
    },
    concurrentUsers: 50,
    requestsPerUser: 20,
    rampUpTime: 2000,
  },
  {
    name: 'Heavy Load - Quote Fetching',
    endpoint: '/v1/quotes',
    params: {
      sellToken: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      buyToken: '0x55d398326f99059fF775485246999027B3197955',
      sellAmount: '1000000000000000000',
    },
    concurrentUsers: 100,
    requestsPerUser: 10,
    rampUpTime: 3000,
  },
  {
    name: 'Spike Test - Sudden Traffic',
    endpoint: '/v1/quotes',
    params: {
      sellToken: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
      buyToken: '0x55d398326f99059fF775485246999027B3197955',
      sellAmount: '1000000000000000000',
    },
    concurrentUsers: 200,
    requestsPerUser: 5,
    rampUpTime: 500, // Very fast ramp-up
  },
  {
    name: 'Health Check Load',
    endpoint: '/health',
    params: {},
    concurrentUsers: 50,
    requestsPerUser: 20,
    rampUpTime: 1000,
  },
  {
    name: 'Provider Status Load',
    endpoint: '/v1/providers/status',
    params: {},
    concurrentUsers: 30,
    requestsPerUser: 15,
    rampUpTime: 1500,
  },
];

async function makeRequest(
  endpoint: string,
  params: Record<string, any>
): Promise<{ success: boolean; responseTime: number; status?: number; error?: string }> {
  const startTime = Date.now();

  try {
    const url = new URL(endpoint, API_URL);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });

    const response = await fetch(url.toString(), {
      method: 'GET',
      signal: AbortSignal.timeout(30000), // 30s timeout
    });

    const responseTime = Date.now() - startTime;

    // Consider 2xx, 4xx as successful requests (server responded)
    // Only 5xx or connection failures are actual failures
    const isSuccess = response.status < 500;

    return {
      success: isSuccess,
      responseTime,
      status: response.status,
    };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    return {
      success: false,
      responseTime,
      error: error.message,
    };
  }
}

async function simulateUser(
  endpoint: string,
  params: Record<string, any>,
  requestsPerUser: number,
  delayBetweenRequests: number = 100
): Promise<Array<{ success: boolean; responseTime: number }>> {
  const results = [];

  for (let i = 0; i < requestsPerUser; i++) {
    const result = await makeRequest(endpoint, params);
    results.push(result);

    // Small delay between requests to simulate real user behavior
    if (i < requestsPerUser - 1) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
    }
  }

  return results;
}

function calculatePercentile(sortedValues: number[], percentile: number): number {
  const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
  return sortedValues[index] || 0;
}

async function runLoadTest(config: LoadTestConfig): Promise<LoadTestResult> {
  console.log(`\n🏋️  Running: ${config.name}`);
  console.log(`   Users: ${config.concurrentUsers} | Requests/user: ${config.requestsPerUser}`);
  console.log(`   Total requests: ${config.concurrentUsers * config.requestsPerUser}`);

  const startTime = Date.now();
  const allResults: Array<{ success: boolean; responseTime: number }> = [];

  // Ramp up users gradually
  const userPromises: Promise<any>[] = [];
  const delayPerUser = config.rampUpTime / config.concurrentUsers;

  for (let i = 0; i < config.concurrentUsers; i++) {
    // Stagger user start times
    await new Promise(resolve => setTimeout(resolve, delayPerUser));

    const userPromise = simulateUser(
      config.endpoint,
      config.params,
      config.requestsPerUser,
      50 // 50ms between requests per user
    ).then(results => {
      allResults.push(...results);
    });

    userPromises.push(userPromise);
  }

  // Wait for all users to complete
  await Promise.all(userPromises);

  const totalDuration = Date.now() - startTime;

  // Calculate statistics
  const successfulRequests = allResults.filter(r => r.success).length;
  const failedRequests = allResults.filter(r => !r.success).length;
  const responseTimes = allResults.map(r => r.responseTime);
  const sortedResponseTimes = responseTimes.sort((a, b) => a - b);

  const averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
  const minResponseTime = Math.min(...responseTimes);
  const maxResponseTime = Math.max(...responseTimes);
  const requestsPerSecond = (allResults.length / totalDuration) * 1000;

  return {
    totalRequests: allResults.length,
    successfulRequests,
    failedRequests,
    averageResponseTime: Math.round(averageResponseTime),
    minResponseTime,
    maxResponseTime,
    requestsPerSecond: Math.round(requestsPerSecond * 100) / 100,
    errorRate: (failedRequests / allResults.length) * 100,
    totalDuration,
    p50: calculatePercentile(sortedResponseTimes, 50),
    p95: calculatePercentile(sortedResponseTimes, 95),
    p99: calculatePercentile(sortedResponseTimes, 99),
  };
}

function printResults(config: LoadTestConfig, result: LoadTestResult) {
  console.log('\n   📊 Results:');
  console.log(`   ✅ Success: ${result.successfulRequests}/${result.totalRequests} (${(100 - result.errorRate).toFixed(1)}%)`);
  console.log(`   ❌ Failed: ${result.failedRequests}`);
  console.log(`   ⚡ Requests/sec: ${result.requestsPerSecond}`);
  console.log(`   ⏱️  Response Times:`);
  console.log(`      Average: ${result.averageResponseTime}ms`);
  console.log(`      Min: ${result.minResponseTime}ms`);
  console.log(`      Max: ${result.maxResponseTime}ms`);
  console.log(`      P50: ${result.p50}ms`);
  console.log(`      P95: ${result.p95}ms`);
  console.log(`      P99: ${result.p99}ms`);
  console.log(`   🕐 Total Duration: ${(result.totalDuration / 1000).toFixed(2)}s`);

  // Performance rating
  const avgResponseTime = result.averageResponseTime;
  let rating = '';
  if (avgResponseTime < 200) rating = '🟢 Excellent';
  else if (avgResponseTime < 500) rating = '🟡 Good';
  else if (avgResponseTime < 1000) rating = '🟠 Fair';
  else rating = '🔴 Poor';

  console.log(`   📈 Performance: ${rating}`);
}

async function runAllLoadTests() {
  console.log('🚀 Starting Load Testing Suite...');
  console.log(`Target: ${API_URL}\n`);
  console.log('=' .repeat(60));

  const results: Array<{ config: LoadTestConfig; result: LoadTestResult }> = [];

  for (const config of loadTestScenarios) {
    try {
      const result = await runLoadTest(config);
      printResults(config, result);
      results.push({ config, result });

      // Cool down period between tests
      console.log('\n   💤 Cooling down for 3 seconds...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error: any) {
      console.log(`\n   ❌ Test failed: ${error.message}`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 LOAD TEST SUMMARY');
  console.log('='.repeat(60));

  results.forEach(({ config, result }) => {
    const status = result.errorRate < 5 ? '✅' : '⚠️';
    console.log(`${status} ${config.name}`);
    console.log(`   ${result.requestsPerSecond} req/s | ${result.averageResponseTime}ms avg | ${result.errorRate.toFixed(1)}% errors`);
  });

  // Overall statistics
  const totalRequests = results.reduce((sum, r) => sum + r.result.totalRequests, 0);
  const totalSuccess = results.reduce((sum, r) => sum + r.result.successfulRequests, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.result.failedRequests, 0);
  const overallErrorRate = (totalFailed / totalRequests) * 100;

  console.log('\n📈 Overall Statistics:');
  console.log(`   Total Requests: ${totalRequests}`);
  console.log(`   Success: ${totalSuccess} (${((totalSuccess / totalRequests) * 100).toFixed(1)}%)`);
  console.log(`   Failed: ${totalFailed} (${overallErrorRate.toFixed(1)}%)`);

  // Recommendations
  console.log('\n💡 Recommendations:');
  const avgResponseTime = results.reduce((sum, r) => sum + r.result.averageResponseTime, 0) / results.length;
  
  if (avgResponseTime < 200) {
    console.log('   ✅ Excellent performance! System can handle current load well.');
  } else if (avgResponseTime < 500) {
    console.log('   ✅ Good performance. Consider caching for further optimization.');
  } else if (avgResponseTime < 1000) {
    console.log('   ⚠️  Fair performance. Consider:');
    console.log('      - Adding Redis caching');
    console.log('      - Optimizing database queries');
    console.log('      - Implementing rate limiting');
  } else {
    console.log('   🔴 Poor performance. Urgent optimization needed:');
    console.log('      - Implement caching strategy');
    console.log('      - Add CDN for static assets');
    console.log('      - Scale horizontally');
    console.log('      - Optimize critical paths');
  }

  if (overallErrorRate > 5) {
    console.log('   ⚠️  High error rate detected. Review:');
    console.log('      - API rate limits');
    console.log('      - Connection pool sizes');
    console.log('      - Timeout configurations');
  }

  return results;
}

// Run if called directly
if (require.main === module) {
  runAllLoadTests()
    .then((results) => {
      const hasHighErrorRate = results.some(r => r.result.errorRate > 10);
      process.exit(hasHighErrorRate ? 1 : 0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { runAllLoadTests, runLoadTest, loadTestScenarios };
