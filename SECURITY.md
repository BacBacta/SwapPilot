# Security Policy

## Reporting a Vulnerability

SwapPilot takes security seriously. We appreciate your efforts to responsibly disclose your findings.

### Where to Report

Please report security vulnerabilities to:
- **Email**: security@swappilot.xyz
- **Response Time**: Within 48 hours

### What to Include

Please include the following information in your report:
- Type of vulnerability (e.g., smart contract bug, API security issue, frontend vulnerability)
- Steps to reproduce the issue
- Potential impact and severity assessment
- Any suggested fixes (optional)

### What to Expect

1. **Acknowledgment**: We will acknowledge receipt of your vulnerability report within 48 hours
2. **Assessment**: Our team will assess the vulnerability and determine its severity
3. **Updates**: We will keep you informed of our progress toward resolution
4. **Credit**: With your permission, we will credit you in our security acknowledgments

## Scope

The following are in scope for vulnerability reports:

### Smart Contracts (High Priority)
- **PILOTToken** (`0xe3f77E20226fdc7BA85E495158615dEF83b48192`)
- **FeeCollector** (`0xEe841Def61326C116F92e71FceF8cb11FBC05034`)
- **ReferralRewards** (`0x3b39d37F4bB831AD7783D982a46cAb85AA887d3E`)
- **ReferralPool** (if deployed)

### Web Application
- Frontend (https://swappilot.xyz)
- API (https://swappilot-api.fly.dev)

### Infrastructure
- Authentication and authorization
- API rate limiting
- Input validation
- CORS configuration

## Out of Scope

The following are explicitly out of scope:
- Issues in third-party DEX protocols or aggregators we integrate with
- Social engineering attacks
- Denial of Service (DoS) attacks
- Issues requiring physical access to devices
- Issues in wallets or browser extensions (MetaMask, WalletConnect, etc.)
- Clickjacking on pages with no sensitive actions

## Severity Guidelines

We use the following severity levels:

### Critical
- Loss of user funds
- Unauthorized access to smart contract admin functions
- Remote code execution

### High
- Unauthorized access to user data
- Privilege escalation
- Authentication bypass
- Significant smart contract logic flaws

### Medium
- Cross-site scripting (XSS) on sensitive pages
- Information disclosure
- CSRF on state-changing operations

### Low
- Security misconfigurations with minimal impact
- Best practice violations
- Informational findings

## Bug Bounty Program

### Rewards

We offer rewards for valid vulnerabilities:

| Severity | Reward Range |
|----------|--------------|
| Critical | $5,000 - $10,000 |
| High | $1,000 - $5,000 |
| Medium | $500 - $1,000 |
| Low | $100 - $500 |

Rewards are paid in USDT or PILOT tokens at the researcher's choice.

### Eligibility

To be eligible for a reward:
- You must be the first to report a unique vulnerability
- You must provide sufficient detail to reproduce the issue
- You must not publicly disclose the vulnerability before we have had a reasonable time to address it
- You must comply with all applicable laws

## Security Best Practices

As a non-custodial DEX aggregator, SwapPilot never holds user funds or private keys. However, we still follow these security principles:

- **Smart contracts** are designed to be immutable and transparent
- **API endpoints** use authentication, rate limiting, and input validation
- **Frontend** implements security headers (CSP, HSTS, etc.)
- **No PII collection** - we do not log wallet addresses or user data by default
- **Open source** - core logic is publicly auditable

## Security Updates

Security updates and advisories will be published:
- In this repository's Security Advisories
- On our official Twitter: [@SwapPilot](https://twitter.com/swappilot)
- Via email to registered users (if applicable)

## Third-Party Security

SwapPilot integrates with multiple DEX protocols and aggregators. We rely on their security:

- **Audited protocols**: 1inch, ParaSwap, KyberSwap, 0x, OpenOcean, Odos
- **DEXs**: PancakeSwap V2/V3, Uniswap V2/V3, Thena
- **Oracles**: GoPlus Security, HoneypotIs, DexScreener

Users should independently verify the security of any protocol they interact with via SwapPilot deep links.

## Contact

For non-security-related questions:
- Email: hello@swappilot.xyz
- Twitter: [@SwapPilot](https://twitter.com/swappilot)
- Telegram: [t.me/swappilot](https://t.me/swappilot)
- GitHub: [github.com/BacBacta/SwapPilot](https://github.com/BacBacta/SwapPilot)

---

Last updated: February 16, 2026
