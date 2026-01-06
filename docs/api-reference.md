# API Reference

## Base URL

```
https://swappilot-api.fly.dev
```

---

## Endpoints

### Health Check

```http
GET /health
```

**Response**
```json
{
  "status": "ok"
}
```

---

### Get Quotes from All Providers

```http
GET /api/v1/quote
```

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| chainId | number | Yes | Chain ID (56 for BSC) |
| sellToken | string | Yes | Source token address |
| buyToken | string | Yes | Destination token address |
| sellAmount | string | Yes | Amount in wei |
| slippageBps | number | No | Slippage in basis points (default: 50) |
| userAddress | string | No | User's wallet address |

**Example Request**
```bash
curl "https://swappilot-api.fly.dev/api/v1/quote?chainId=56&sellToken=0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE&buyToken=0x55d398326f99059fF775485246999027B3197955&sellAmount=1000000000000000000"
```

**Response**
```json
{
  "quotes": [
    {
      "providerId": "1inch",
      "status": "success",
      "sellToken": "0xEeee...",
      "buyToken": "0x55d3...",
      "sellAmount": "1000000000000000000",
      "buyAmount": "314850000000000000000",
      "gas": "150000",
      "estimatedGas": "0.15"
    }
  ]
}
```

---

### Get Quote from Specific Provider

```http
GET /api/v1/quote/:providerId
```

**Path Parameters**

| Parameter | Description |
|-----------|-------------|
| providerId | Provider ID: `1inch`, `kyberswap`, `paraswap`, `okx-dex` |

**Query Parameters**

Same as `/api/v1/quote`

---

### Build Transaction

```http
POST /api/v1/build-tx/:providerId
```

**Path Parameters**

| Parameter | Description |
|-----------|-------------|
| providerId | Provider ID |

**Request Body**
```json
{
  "chainId": 56,
  "sellToken": "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
  "buyToken": "0x55d398326f99059fF775485246999027B3197955",
  "sellAmount": "1000000000000000000",
  "slippageBps": 50,
  "userAddress": "0x..."
}
```

**Response**
```json
{
  "to": "0x111111125421cA6dc452d289314280a0f8842A65",
  "data": "0x...",
  "value": "1000000000000000000",
  "gas": "200000"
}
```

---

### Provider Status

```http
GET /api/v1/providers/status
```

**Response**
```json
{
  "providers": [
    {
      "id": "1inch",
      "name": "1inch",
      "status": "active",
      "latency": 234
    },
    {
      "id": "kyberswap",
      "name": "KyberSwap",
      "status": "active",
      "latency": 456
    }
  ]
}
```

---

## Error Responses

### Standard Error Format
```json
{
  "error": {
    "code": "INVALID_PARAMS",
    "message": "Missing required parameter: sellAmount"
  }
}
```

### Error Codes

| Code | Description |
|------|-------------|
| INVALID_PARAMS | Invalid or missing request parameters |
| PROVIDER_ERROR | Error from DEX provider |
| RATE_LIMITED | Too many requests |
| INTERNAL_ERROR | Server error |

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| /api/v1/quote | 60 requests/minute |
| /api/v1/build-tx | 30 requests/minute |

---

## SDKs & Libraries

Coming soon:
- JavaScript/TypeScript SDK
- Python SDK
- REST API Client
