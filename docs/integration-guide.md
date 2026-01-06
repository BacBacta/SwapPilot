# Integration Guide

## Embedding SwapPilot

### Widget (Coming Soon)

```html
<iframe
  src="https://app-swappilot.xyz/widget"
  width="400"
  height="600"
  frameborder="0"
></iframe>
```

---

## Using the API

### JavaScript Example

```javascript
async function getQuotes(sellToken, buyToken, amount) {
  const params = new URLSearchParams({
    chainId: '56',
    sellToken,
    buyToken,
    sellAmount: amount,
    slippageBps: '50'
  });

  const response = await fetch(
    `https://swappilot-api.fly.dev/api/v1/quote?${params}`
  );
  
  return response.json();
}

// Usage
const quotes = await getQuotes(
  '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // BNB
  '0x55d398326f99059fF775485246999027B3197955', // USDT
  '1000000000000000000' // 1 BNB in wei
);

console.log(quotes);
```

### Python Example

```python
import requests

def get_quotes(sell_token, buy_token, amount):
    params = {
        'chainId': 56,
        'sellToken': sell_token,
        'buyToken': buy_token,
        'sellAmount': amount,
        'slippageBps': 50
    }
    
    response = requests.get(
        'https://swappilot-api.fly.dev/api/v1/quote',
        params=params
    )
    
    return response.json()

# Usage
quotes = get_quotes(
    '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',  # BNB
    '0x55d398326f99059fF775485246999027B3197955',  # USDT
    '1000000000000000000'  # 1 BNB in wei
)

print(quotes)
```

---

## Best Practices

### Caching
- Cache quotes for max 30 seconds
- Re-fetch before execution

### Error Handling
- Always handle provider errors gracefully
- Implement retry logic with exponential backoff

### User Experience
- Show loading states during quote fetching
- Display clear error messages
- Allow slippage customization

---

## Support

For integration support:
- **GitHub**: [github.com/BacBacta/SwapPilot](https://github.com/BacBacta/SwapPilot)
- **Issues**: [Report issues](https://github.com/BacBacta/SwapPilot/issues)
