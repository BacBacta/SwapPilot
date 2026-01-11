import PptxGenJS from 'pptxgenjs';

// ============================================================================
// SwapPilot Professional Pitch Deck Generator
// Best Practices: 10/20/30 Rule, Visual hierarchy, Consistent branding
// ============================================================================

const pptx = new PptxGenJS();

// Brand colors
const COLORS = {
  bg: '07080B',
  bgLight: '0D1117',
  accent: 'B6FF6A',
  accent2: '7DD3FC',
  white: 'FFFFFF',
  muted: 'A0A0A0',
  dark: '1A1A1A',
};

// Social links
const LINKS = {
  app: 'https://app-swappilot.xyz',
  docs: 'https://swappilot.gitbook.io/untitled',
  api: 'https://swappilot-api.fly.dev',
  github: 'https://github.com/BacBacta/SwapPilot',
  twitter: 'https://x.com/swappilotdex',
  telegram: 'https://t.me/swapPilot',
};

// Slide dimensions (16:9)
pptx.defineLayout({ name: 'CUSTOM', width: 13.333, height: 7.5 });
pptx.layout = 'CUSTOM';
pptx.title = 'SwapPilot Pitch Deck';
pptx.author = 'SwapPilot Team';
pptx.subject = 'DEX Aggregator on BNB Chain';

// Helper: Add gradient background
function addBackground(slide) {
  slide.background = { color: COLORS.bg };
}

// Helper: Add header with logo
function addHeader(slide, slideNum, totalSlides) {
  slide.addShape('roundRect', {
    x: 0.5, y: 0.35, w: 0.45, h: 0.45,
    fill: { color: COLORS.bgLight },
    line: { color: COLORS.muted, width: 0.5 },
    rectRadius: 0.08,
  });
  slide.addText('SP', {
    x: 0.5, y: 0.35, w: 0.45, h: 0.45,
    fontSize: 14, bold: true, color: COLORS.white,
    align: 'center', valign: 'middle',
  });
  slide.addText('SwapPilot', {
    x: 1.05, y: 0.4, w: 2, h: 0.35,
    fontSize: 16, bold: true, color: COLORS.white,
  });
  slide.addText(`${slideNum} / ${totalSlides}`, {
    x: 11.5, y: 0.4, w: 1.5, h: 0.35,
    fontSize: 11, color: COLORS.muted,
    align: 'right',
  });
}

// Helper: Section kicker
function addKicker(slide, text, y = 1.2) {
  slide.addShape('rect', {
    x: 0.5, y: y + 0.08, w: 0.35, h: 0.04,
    fill: { type: 'solid', color: COLORS.accent },
  });
  slide.addText(text.toUpperCase(), {
    x: 0.95, y: y, w: 3, h: 0.3,
    fontSize: 11, bold: true, color: COLORS.muted,
    charSpacing: 2,
  });
}

// Helper: Main title
function addTitle(slide, text, y = 1.55) {
  slide.addText(text, {
    x: 0.5, y: y, w: 6, h: 1,
    fontSize: 36, bold: true, color: COLORS.white,
    lineSpacing: 42,
  });
}

// Helper: Lead paragraph
function addLead(slide, text, y = 2.65) {
  slide.addText(text, {
    x: 0.5, y: y, w: 5.5, h: 1,
    fontSize: 16, color: COLORS.muted,
    lineSpacing: 24,
  });
}

// Helper: Card component
function addCard(slide, { x, y, w, h, title, body, emoji }) {
  slide.addShape('roundRect', {
    x, y, w, h,
    fill: { color: COLORS.bgLight },
    line: { color: '2A2A2A', width: 0.5 },
    rectRadius: 0.12,
  });
  const titleText = emoji ? `${emoji}  ${title}` : title;
  slide.addText(titleText, {
    x: x + 0.2, y: y + 0.15, w: w - 0.4, h: 0.35,
    fontSize: 14, bold: true, color: COLORS.white,
  });
  if (body) {
    slide.addText(body, {
      x: x + 0.2, y: y + 0.5, w: w - 0.4, h: h - 0.7,
      fontSize: 12, color: COLORS.muted,
      lineSpacing: 18,
      valign: 'top',
    });
  }
}

// Helper: Data metric box
function addMetric(slide, { x, y, w, h, label, value }) {
  slide.addShape('roundRect', {
    x, y, w, h,
    fill: { color: COLORS.bgLight },
    line: { color: '2A2A2A', width: 0.5 },
    rectRadius: 0.08,
  });
  slide.addText(label.toUpperCase(), {
    x: x + 0.15, y: y + 0.15, w: w - 0.3, h: 0.25,
    fontSize: 9, bold: true, color: COLORS.muted,
    charSpacing: 1,
  });
  slide.addText(value, {
    x: x + 0.15, y: y + 0.4, w: w - 0.3, h: 0.5,
    fontSize: 22, bold: true, color: COLORS.white,
  });
}

// Helper: CTA button
function addCTA(slide, { x, y, w, h, text, primary = false, hyperlink }) {
  slide.addShape('roundRect', {
    x, y, w, h,
    fill: { color: primary ? COLORS.accent : COLORS.bgLight },
    line: { color: primary ? COLORS.accent : '3A3A3A', width: 1 },
    rectRadius: 0.3,
  });
  const textOpts = {
    x, y, w, h,
    fontSize: 14, bold: true,
    color: primary ? COLORS.bg : COLORS.white,
    align: 'center', valign: 'middle',
  };
  if (hyperlink) {
    textOpts.hyperlink = { url: hyperlink };
  }
  slide.addText(text, textOpts);
}

// Helper: Donut chart
function addDonutChart(slide, x, y, size) {
  slide.addShape('ellipse', {
    x: x, y: y, w: size, h: size,
    fill: { color: COLORS.accent },
    line: { color: '1A1A1A', width: 1 },
  });
  const innerSize = size * 0.6;
  const offset = (size - innerSize) / 2;
  slide.addShape('ellipse', {
    x: x + offset, y: y + offset, w: innerSize, h: innerSize,
    fill: { color: COLORS.bg },
    line: { color: '2A2A2A', width: 1 },
  });
  slide.addText('1B', {
    x: x, y: y + size * 0.35, w: size, h: 0.5,
    fontSize: 28, bold: true, color: COLORS.white,
    align: 'center',
  });
  slide.addText('PILOT', {
    x: x, y: y + size * 0.55, w: size, h: 0.3,
    fontSize: 10, bold: true, color: COLORS.muted,
    align: 'center',
  });
}

// Helper: Legend item
function addLegendItem(slide, { x, y, color, label, pct }) {
  slide.addShape('roundRect', {
    x, y: y + 0.05, w: 0.18, h: 0.18,
    fill: { color },
    rectRadius: 0.04,
  });
  slide.addText(label, {
    x: x + 0.28, y, w: 1.8, h: 0.28,
    fontSize: 12, color: COLORS.white,
  });
  slide.addText(pct, {
    x: x + 2.1, y, w: 0.5, h: 0.28,
    fontSize: 12, bold: true, color: COLORS.white,
    align: 'right',
  });
}

// Helper: Progress bar
function addProgressBar(slide, { x, y, w, label, value, pct }) {
  slide.addText(label, {
    x, y, w: 1.8, h: 0.3,
    fontSize: 12, color: COLORS.white,
  });
  slide.addText(value, {
    x: x + 1.9, y, w: 0.5, h: 0.3,
    fontSize: 12, bold: true, color: COLORS.white,
    align: 'right',
  });
  slide.addShape('roundRect', {
    x: x + 2.5, y: y + 0.08, w: w - 2.5, h: 0.18,
    fill: { color: '2A2A2A' },
    rectRadius: 0.09,
  });
  const fillWidth = Math.max(0.05, (w - 2.5) * (pct / 100));
  slide.addShape('roundRect', {
    x: x + 2.5, y: y + 0.08, w: fillWidth, h: 0.18,
    fill: { color: COLORS.accent },
    rectRadius: 0.09,
  });
}

// Helper: Timeline phase card
function addPhaseCard(slide, { x, y, w, h, phase, title, items, done = false }) {
  slide.addShape('roundRect', {
    x, y, w, h,
    fill: { color: COLORS.bgLight },
    line: { color: done ? COLORS.accent : '2A2A2A', width: done ? 1.5 : 0.5 },
    rectRadius: 0.12,
  });
  slide.addText(phase + (done ? ' ✓' : ''), {
    x: x + 0.2, y: y + 0.15, w: w - 0.4, h: 0.25,
    fontSize: 10, bold: true, color: COLORS.accent,
    charSpacing: 1,
  });
  slide.addText(title, {
    x: x + 0.2, y: y + 0.4, w: w - 0.4, h: 0.35,
    fontSize: 14, bold: true, color: COLORS.white,
  });
  slide.addText(items.join('\n'), {
    x: x + 0.2, y: y + 0.8, w: w - 0.4, h: h - 1,
    fontSize: 10, color: COLORS.muted,
    lineSpacing: 14,
    valign: 'top',
  });
}

// ============================================================================
// SLIDES
// ============================================================================

const TOTAL_SLIDES = 13;

// SLIDE 1: Cover
function createCoverSlide() {
  const slide = pptx.addSlide();
  addBackground(slide);
  addHeader(slide, 1, TOTAL_SLIDES);

  const chips = ['BNB Chain', 'BEQ Ranking', 'Non-custodial'];
  chips.forEach((chip, i) => {
    slide.addShape('roundRect', {
      x: 0.5 + i * 1.5, y: 1.2, w: 1.4, h: 0.35,
      fill: { color: COLORS.bgLight },
      line: { color: '3A3A3A', width: 0.5 },
      rectRadius: 0.18,
    });
    slide.addShape('ellipse', {
      x: 0.6 + i * 1.5, y: 1.28, w: 0.12, h: 0.12,
      fill: { color: COLORS.accent },
    });
    slide.addText(chip, {
      x: 0.78 + i * 1.5, y: 1.22, w: 1, h: 0.28,
      fontSize: 10, bold: true, color: COLORS.white,
    });
  });

  slide.addText([
    { text: 'Safer swaps on\n', options: { color: COLORS.white } },
    { text: 'BNB Chain', options: { color: COLORS.accent } },
    { text: '.', options: { color: COLORS.white } },
  ], {
    x: 0.5, y: 1.8, w: 6, h: 1.5,
    fontSize: 44, bold: true, lineSpacing: 52,
  });

  slide.addText('SwapPilot is a DEX aggregator that ranks quotes into BEQ (Best Executable Quote) and optimizes for execution safety before you sign.', {
    x: 0.5, y: 3.5, w: 5.5, h: 0.8,
    fontSize: 16, color: COLORS.muted,
    lineSpacing: 24,
  });

  addCTA(slide, { x: 0.5, y: 4.6, w: 1.8, h: 0.5, text: 'Open app →', primary: true, hyperlink: LINKS.app });
  addCTA(slide, { x: 2.5, y: 4.6, w: 1.8, h: 0.5, text: 'Read docs →', hyperlink: LINKS.docs });

  // Right side - App preview frame
  slide.addShape('roundRect', {
    x: 7, y: 1.2, w: 5.8, h: 5.5,
    fill: { color: COLORS.bgLight },
    line: { color: '2A2A2A', width: 1 },
    rectRadius: 0.2,
  });
  slide.addShape('ellipse', { x: 7.2, y: 1.4, w: 0.12, h: 0.12, fill: { color: '4A4A4A' } });
  slide.addShape('ellipse', { x: 7.4, y: 1.4, w: 0.12, h: 0.12, fill: { color: '4A4A4A' } });
  slide.addShape('ellipse', { x: 7.6, y: 1.4, w: 0.12, h: 0.12, fill: { color: '4A4A4A' } });
  slide.addText('app-swappilot.xyz', {
    x: 8.5, y: 1.35, w: 4, h: 0.25,
    fontSize: 10, color: COLORS.muted, align: 'center',
  });
  // App screenshot
  slide.addImage({
    path: './assets/hero-swap-wide.png',
    x: 7.15, y: 1.7, w: 5.5, h: 4.9,
  });

  // Clickable footer links
  slide.addText('app-swappilot.xyz', {
    x: 0.5, y: 6.9, w: 2.2, h: 0.3,
    fontSize: 10, color: COLORS.muted,
    hyperlink: { url: LINKS.app },
  });
  slide.addText('·', {
    x: 2.65, y: 6.9, w: 0.2, h: 0.3,
    fontSize: 10, color: COLORS.muted,
    align: 'center',
  });
  slide.addText('x.com/swappilotdex', {
    x: 2.85, y: 6.9, w: 2.2, h: 0.3,
    fontSize: 10, color: COLORS.muted,
    hyperlink: { url: LINKS.twitter },
  });
  slide.addText('·', {
    x: 5.05, y: 6.9, w: 0.2, h: 0.3,
    fontSize: 10, color: COLORS.muted,
    align: 'center',
  });
  slide.addText('t.me/swapPilot', {
    x: 5.25, y: 6.9, w: 1.8, h: 0.3,
    fontSize: 10, color: COLORS.muted,
    hyperlink: { url: LINKS.telegram },
  });
  slide.addText('·', {
    x: 7.05, y: 6.9, w: 0.2, h: 0.3,
    fontSize: 10, color: COLORS.muted,
    align: 'center',
  });
  slide.addText('github.com/BacBacta/SwapPilot', {
    x: 7.25, y: 6.9, w: 5.2, h: 0.3,
    fontSize: 10, color: COLORS.muted,
    hyperlink: { url: LINKS.github },
  });
}

// SLIDE 2: Problem
function createProblemSlide() {
  const slide = pptx.addSlide();
  addBackground(slide);
  addHeader(slide, 2, TOTAL_SLIDES);
  
  addKicker(slide, 'Problem');
  addTitle(slide, 'Swaps still feel\nunpredictable.');
  addLead(slide, 'Users can\'t reliably estimate what they will actually receive — especially on fee-on-transfer tokens and fast-moving routes.');

  const problems = [
    { emoji: '🔀', title: 'Fragmented liquidity', body: 'Prices differ per DEX. Manual comparison is slow and error-prone. Users waste time checking multiple platforms.' },
    { emoji: '💸', title: 'Hidden costs', body: 'Slippage + token transfer taxes reduce net output after execution. What you see is not what you get.' },
    { emoji: '⚠️', title: 'Execution risk', body: 'Routes can fail; users need preflight signals and clear warnings before signing transactions.' },
  ];

  problems.forEach((p, i) => {
    addCard(slide, { x: 7, y: 1.3 + i * 1.8, w: 5.8, h: 1.6, ...p });
  });
}

// SLIDE 3: Solution
function createSolutionSlide() {
  const slide = pptx.addSlide();
  addBackground(slide);
  addHeader(slide, 3, TOTAL_SLIDES);
  
  addKicker(slide, 'Solution');
  addTitle(slide, 'One flow that\noptimizes & explains.');
  addLead(slide, 'SwapPilot separates "best raw output" from "best executable" and documents every decision transparently.');

  const solutions = [
    { emoji: '🏆', title: 'BEQ (Best Executable Quote)', body: 'Optimizes for executability first — then for output. Not just the highest number, but the safest path.' },
    { emoji: '🧾', title: 'Decision transparency', body: 'Every quote returns detailed reasoning: whyWinner · warnings · ranking rationale · assumptions.' },
    { emoji: '🎚️', title: 'Risk modes', body: 'SAFE / NORMAL / DEGEN switch the BEQ weights — reasoning stays fully transparent.' },
  ];

  solutions.forEach((s, i) => {
    addCard(slide, { x: 7, y: 1.3 + i * 1.8, w: 5.8, h: 1.6, ...s });
  });
}

// SLIDE 4: How It Works
function createHowItWorksSlide() {
  const slide = pptx.addSlide();
  addBackground(slide);
  addHeader(slide, 4, TOTAL_SLIDES);
  
  addKicker(slide, 'Product');
  addTitle(slide, 'How a swap\nhappens');
  addLead(slide, 'Four steps — mapped to real API endpoints.', 2.5);

  const steps = [
    { num: '1', title: 'Quote', body: 'POST /v1/quotes\nFan-out to multiple providers in parallel on BSC (chainId 56).' },
    { num: '2', title: 'Rank', body: 'Return rankedQuotes (BEQ) + bestRawQuotes + recommended provider.' },
    { num: '3', title: 'Explain', body: 'GET /v1/receipts/:id\nwhyWinner + warnings + assumptions in one artifact.' },
    { num: '4', title: 'Execute', body: 'Use /v1/build-tx for ready-to-sign tx or open provider via deepLink.' },
  ];

  steps.forEach((step, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    addCard(slide, {
      x: 7 + col * 3, y: 1.3 + row * 2.8, w: 2.8, h: 2.5,
      title: `${step.num}. ${step.title}`,
      body: step.body,
    });
  });
}

// SLIDE 5: Coverage
function createCoverageSlide() {
  const slide = pptx.addSlide();
  addBackground(slide);
  addHeader(slide, 5, TOTAL_SLIDES);
  
  addKicker(slide, 'Coverage');
  addTitle(slide, 'Providers on\nBNB Chain');
  addLead(slide, 'Top aggregators and DEX routers. BEQ prioritizes executability over the best-looking number.', 2.5);

  const features = [
    { emoji: '🔗', title: '10+ Providers', body: 'PancakeSwap · 1inch · OKX DEX · KyberSwap · ParaSwap · Odos · OpenOcean · 0x · Uniswap V2 · Uniswap V3' },
    { emoji: '⚙️', title: 'Capabilities', body: 'Quotes + ranking · buildTx where supported · deep-links as fallback · health endpoint /v1/providers/status' },
    { emoji: '🛡️', title: 'Risk signals', body: 'Sellability · revert risk · MEV exposure · churn · optional token security (GoPlus / Honeypot.is)' },
    { emoji: '🔐', title: 'Non-custodial', body: 'Users sign in their wallet. SwapPilot does not hold keys or funds. Your keys, your crypto.' },
  ];

  features.forEach((f, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    addCard(slide, { x: 7 + col * 3, y: 1.3 + row * 2.8, w: 2.8, h: 2.5, ...f });
  });
}

// SLIDE 6: Proof
function createProofSlide() {
  const slide = pptx.addSlide();
  addBackground(slide);
  addHeader(slide, 6, TOTAL_SLIDES);
  
  addKicker(slide, 'Proof');
  addTitle(slide, 'A working system.');
  addLead(slide, 'Public app + public API. Every quote run returns detailed decision data for full auditability.', 2.5);

  addCard(slide, {
    x: 0.5, y: 3.5, w: 5.5, h: 1.5,
    emoji: '📋',
    title: 'Decision data includes',
    body: 'rankedQuotes · beqRecommendedProviderId · whyWinner · warnings · ranking.mode · preflight signals',
  });

  const metrics = [
    { label: 'Live App', value: 'app-swappilot.xyz' },
    { label: 'Public API', value: 'swappilot-api.fly.dev' },
    { label: 'Swagger UI', value: '/documentation' },
    { label: 'OpenAPI Spec', value: '/documentation/json' },
    { label: 'Quotes', value: '/v1/quotes' },
    { label: 'Build TX', value: '/v1/build-tx' },
  ];

  metrics.forEach((m, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    addMetric(slide, { x: 7 + col * 3, y: 1.3 + row * 1.7, w: 2.8, h: 1.5, ...m });
  });
}

// SLIDE 7: Business Model
function createBusinessModelSlide() {
  const slide = pptx.addSlide();
  addBackground(slide);
  addHeader(slide, 7, TOTAL_SLIDES);
  
  addKicker(slide, 'Business Model');
  addTitle(slide, 'Revenue aligned\nwith usage.');
  addLead(slide, 'Simple monetization primitives already built into the stack. No projections — just shipped code.');

  const models = [
    { emoji: '💰', title: 'Fee engine (API)', body: 'Endpoints /v1/fees/calculate and /v1/pilot/tier compute fees and holding-based discounts dynamically.' },
    { emoji: '🔥', title: 'Fee distribution (Contracts)', body: 'FeeCollector contract: 15% buy & burn · 85% treasury distribution. Deployed on BSC.' },
    { emoji: '🤝', title: 'Referral incentives (Contracts)', body: 'ReferralPool + ReferralRewards contracts support referral-based reward flows for growth.' },
  ];

  models.forEach((m, i) => {
    addCard(slide, { x: 7, y: 1.3 + i * 1.8, w: 5.8, h: 1.6, ...m });
  });
}

// SLIDE 8: Distribution
function createDistributionSlide() {
  const slide = pptx.addSlide();
  addBackground(slide);
  addHeader(slide, 8, TOTAL_SLIDES);
  
  addKicker(slide, 'Distribution');
  addTitle(slide, 'Token allocation');
  
  addDonutChart(slide, 1.5, 2.5, 2.8);
  
  slide.addText('Fixed supply · No inflation · No mint function', {
    x: 0.5, y: 5.6, w: 4.5, h: 0.3,
    fontSize: 12, color: COLORS.muted, align: 'center',
  });

  const allocations = [
    { color: 'B6FF6A', label: 'Public Sale', pct: '35%' },
    { color: '8FCC55', label: 'Treasury', pct: '20%' },
    { color: '7DD3FC', label: 'CEX & Marketing', pct: '12%' },
    { color: '5AAFDC', label: 'Liquidity', pct: '12%' },
    { color: '5A5A5A', label: 'Team', pct: '11%' },
    { color: '4A4A4A', label: 'Advisors', pct: '5%' },
    { color: '3A3A3A', label: 'Referral', pct: '5%' },
  ];

  slide.addShape('roundRect', {
    x: 6.5, y: 1.3, w: 6.3, h: 5.5,
    fill: { color: COLORS.bgLight },
    line: { color: '2A2A2A', width: 0.5 },
    rectRadius: 0.15,
  });

  allocations.forEach((a, i) => {
    addLegendItem(slide, { x: 6.8, y: 1.7 + i * 0.7, ...a });
  });
}

// SLIDE 9: Tokenomics
function createTokenomicsSlide() {
  const slide = pptx.addSlide();
  addBackground(slide);
  addHeader(slide, 9, TOTAL_SLIDES);
  
  addKicker(slide, 'Tokenomics');
  addTitle(slide, 'Key metrics');
  addLead(slide, 'Clear, investor-ready figures from the tokenomics documentation.');

  const metrics = [
    { label: 'Total Supply', value: '1,000,000,000' },
    { label: 'Public Sale Price', value: '$0.0057' },
    { label: 'Fully Diluted Valuation', value: '$5.7M' },
    { label: 'Initial Market Cap', value: '$966K' },
  ];

  metrics.forEach((m, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    addMetric(slide, { x: 7 + col * 3, y: 1.3 + row * 1.8, w: 2.8, h: 1.6, ...m });
  });

  addCard(slide, { x: 7, y: 4.9, w: 5.8, h: 1.8, title: 'TGE Circulating Supply', body: '' });
  slide.addText('169.5M tokens (16.95%)', {
    x: 7.2, y: 5.4, w: 5.4, h: 0.8,
    fontSize: 28, bold: true, color: COLORS.white,
  });
}

// SLIDE 10: Vesting
function createVestingSlide() {
  const slide = pptx.addSlide();
  addBackground(slide);
  addHeader(slide, 10, TOTAL_SLIDES);
  
  addKicker(slide, 'Vesting');
  addTitle(slide, 'Unlocks designed\nfor stability');
  addLead(slide, 'TGE unlock percentage by allocation bucket. Gradual release prevents dumps.');

  addCard(slide, {
    x: 0.5, y: 3.8, w: 5.5, h: 1.8,
    emoji: '📅',
    title: 'Milestones',
    body: '16.95% at TGE\n52.83% at Month 6\n78.67% at Month 12',
  });

  const vestingData = [
    { label: 'Public Sale', value: '25%', pct: 25 },
    { label: 'Liquidity', value: '35%', pct: 35 },
    { label: 'CEX & Marketing', value: '25%', pct: 25 },
    { label: 'Treasury', value: '5%', pct: 5 },
    { label: 'Team', value: '0%', pct: 0 },
    { label: 'Advisors', value: '0%', pct: 0 },
    { label: 'Referral', value: '0%', pct: 0 },
  ];

  slide.addShape('roundRect', {
    x: 6.5, y: 1.3, w: 6.3, h: 5.5,
    fill: { color: COLORS.bgLight },
    line: { color: '2A2A2A', width: 0.5 },
    rectRadius: 0.15,
  });

  vestingData.forEach((v, i) => {
    addProgressBar(slide, { x: 6.8, y: 1.7 + i * 0.7, w: 5.8, ...v });
  });
}

// SLIDE 11: Roadmap
function createRoadmapSlide() {
  const slide = pptx.addSlide();
  addBackground(slide);
  addHeader(slide, 11, TOTAL_SLIDES);
  
  addKicker(slide, 'Roadmap');
  slide.addText('Execution milestones', {
    x: 0.5, y: 1.5, w: 12, h: 0.6,
    fontSize: 36, bold: true, color: COLORS.white,
  });

  const phases = [
    { phase: 'PHASE 1', title: 'Foundation', items: ['Core aggregation engine', 'BSC mainnet', '1inch/Kyber/Para/OKX', 'Wallet connect', 'Real-time monitoring'], done: true },
    { phase: 'PHASE 2', title: 'Q1 2026', items: ['Multi-chain expansion', 'Ethereum, Arbitrum, Base', 'Analytics dashboard', 'Price alerts', 'Limit orders'] },
    { phase: 'PHASE 3', title: 'Q2 2026', items: ['Cross-chain swaps', 'DCA / recurring buys', 'Portfolio tracking', 'Mobile app iOS/Android'] },
    { phase: 'PHASE 4', title: 'Q3–Q4 2026', items: ['Public API & SDK', 'Developer widget', 'Institutional features', 'DAO governance'] },
  ];

  phases.forEach((p, i) => {
    addPhaseCard(slide, { x: 0.5 + i * 3.1, y: 2.3, w: 3, h: 4.2, ...p });
  });
}

// SLIDE 12: CTA
function createCTASlide() {
  const slide = pptx.addSlide();
  addBackground(slide);
  addHeader(slide, 12, TOTAL_SLIDES);

  addKicker(slide, 'Call to Action', 2.2);
  
  slide.addText([
    { text: 'See it live.\n', options: { color: COLORS.white } },
    { text: 'Verify everything', options: { color: COLORS.accent } },
    { text: '.', options: { color: COLORS.white } },
  ], {
    x: 0.5, y: 2.6, w: 12, h: 1.5,
    fontSize: 48, bold: true, lineSpacing: 56, align: 'center',
  });

  slide.addText('Try the app, read the documentation, and review the tokenomics.\nEverything is public and verifiable.', {
    x: 2, y: 4.2, w: 9, h: 0.8,
    fontSize: 18, color: COLORS.muted, align: 'center', lineSpacing: 26,
  });

  addCTA(slide, { x: 2.4, y: 5.3, w: 2, h: 0.55, text: 'Open app →', primary: true, hyperlink: LINKS.app });
  addCTA(slide, { x: 4.6, y: 5.3, w: 2, h: 0.55, text: 'Read docs →', hyperlink: LINKS.docs });
  addCTA(slide, { x: 6.8, y: 5.3, w: 2, h: 0.55, text: 'Twitter →', hyperlink: LINKS.twitter });
  addCTA(slide, { x: 9.0, y: 5.3, w: 2, h: 0.55, text: 'Telegram →', hyperlink: LINKS.telegram });

  // Clickable footer links
  slide.addText('app-swappilot.xyz', {
    x: 1.1, y: 6.5, w: 2.2, h: 0.3,
    fontSize: 11, color: COLORS.muted,
    align: 'left',
    hyperlink: { url: LINKS.app },
  });
  slide.addText('·', {
    x: 3.25, y: 6.5, w: 0.2, h: 0.3,
    fontSize: 11, color: COLORS.muted,
    align: 'center',
  });
  slide.addText('x.com/swappilotdex', {
    x: 3.45, y: 6.5, w: 2.2, h: 0.3,
    fontSize: 11, color: COLORS.muted,
    align: 'left',
    hyperlink: { url: LINKS.twitter },
  });
  slide.addText('·', {
    x: 5.65, y: 6.5, w: 0.2, h: 0.3,
    fontSize: 11, color: COLORS.muted,
    align: 'center',
  });
  slide.addText('t.me/swapPilot', {
    x: 5.85, y: 6.5, w: 1.8, h: 0.3,
    fontSize: 11, color: COLORS.muted,
    align: 'left',
    hyperlink: { url: LINKS.telegram },
  });
  slide.addText('·', {
    x: 7.65, y: 6.5, w: 0.2, h: 0.3,
    fontSize: 11, color: COLORS.muted,
    align: 'center',
  });
  slide.addText('github.com/BacBacta/SwapPilot', {
    x: 7.85, y: 6.5, w: 4.4, h: 0.3,
    fontSize: 11, color: COLORS.muted,
    align: 'left',
    hyperlink: { url: LINKS.github },
  });
}

// SLIDE 13: Disclaimer
function createDisclaimerSlide() {
  const slide = pptx.addSlide();
  addBackground(slide);
  addHeader(slide, 'Disclaimer', TOTAL_SLIDES);

  addKicker(slide, 'Legal Notice');
  addTitle(slide, 'Important\ndisclosures');
  addLead(slide, 'Please read carefully before participating in the Public Sale.');

  const disclaimers = [
    { emoji: '⚠️', title: 'Not financial advice', body: 'This document is for informational purposes only. Nothing herein constitutes investment advice.' },
    { emoji: '📉', title: 'No guarantees', body: 'PILOT token value may fluctuate. Past performance is not indicative of future results.' },
    { emoji: '⚖️', title: 'Regulatory uncertainty', body: 'Cryptocurrency regulations vary by jurisdiction and are subject to change.' },
    { emoji: '🔧', title: 'Technology risks', body: 'Smart contracts carry inherent risks including bugs and exploits.' },
    { emoji: '🔮', title: 'Forward-looking statements', body: 'Roadmap and projections are subject to change.' },
  ];

  disclaimers.forEach((d, i) => {
    const col = i < 3 ? 0 : 1;
    const row = i < 3 ? i : i - 3;
    addCard(slide, { x: 7 + col * 3, y: 1.3 + row * 1.7, w: 2.8, h: 1.5, ...d });
  });

  slide.addText('By participating in the Public Sale, you acknowledge that you have read and understood these disclosures.', {
    x: 0.5, y: 6.8, w: 12, h: 0.3,
    fontSize: 10, color: COLORS.muted,
  });
}

// ============================================================================
// Generate all slides
// ============================================================================

console.log('🚀 Creating professional PowerPoint presentation...\n');

createCoverSlide();
createProblemSlide();
createSolutionSlide();
createHowItWorksSlide();
createCoverageSlide();
createProofSlide();
createBusinessModelSlide();
createDistributionSlide();
createTokenomicsSlide();
createVestingSlide();
createRoadmapSlide();
createCTASlide();
createDisclaimerSlide();

const outputPath = '/workspaces/SwapPilot/pitch-deck/SwapPilot-Professional-PitchDeck.pptx';
pptx.writeFile({ fileName: outputPath })
  .then(() => {
    console.log(`✅ PowerPoint created: ${outputPath}`);
    console.log(`📄 Slides: ${TOTAL_SLIDES}`);
    console.log(`📐 Format: 16:9 Widescreen (1920×1080)`);
    console.log(`\n🔗 Links updated:`);
    console.log(`   • Twitter: ${LINKS.twitter}`);
    console.log(`   • App: ${LINKS.app}`);
    console.log(`   • Docs: ${LINKS.docs}`);
  })
  .catch(err => {
    console.error('❌ Error creating PowerPoint:', err);
  });
