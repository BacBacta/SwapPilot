# SwapPilot UI Component Library

## Design Tokens

### Typography Scale

| Name | Size | Weight | Usage |
|------|------|--------|-------|
| `display` | 36px | 800 | Hero numbers, main totals |
| `h1` | 24px | 700 | Page titles, large values |
| `h2` | 18px | 600 | Section headers, card titles |
| `body` | 14px | 400 | Body text, descriptions |
| `caption` | 12px | 500 | Labels, secondary info |
| `micro` | 11px | 500 | Badges, timestamps |

### Color Tokens

```
sp-bg         #0B0F17     Main background
sp-surface    #0F1623     Card backgrounds
sp-surface2   #151D2E     Elevated surfaces
sp-surface3   #1A2436     Highest elevation
sp-border     12% white   Default borders
sp-borderHover 20% white  Hover state borders
sp-borderActive sp-accent Focus state borders
sp-text       95% white   Primary text
sp-muted      65% white   Secondary text
sp-muted2     45% white   Tertiary text
sp-accent     #F7C948     Primary accent (yellow)
sp-ok         #35C87A     Success (green)
sp-warn       #FFBF47     Warning (amber)
sp-bad        #FF5D5D     Error (red)
sp-blue       #4D8EFF     Info/secondary accent
```

### Shadows

| Name | Usage |
|------|-------|
| `shadow-soft` | Light theme cards |
| `shadow-softDark` | Dark theme cards |
| `shadow-glow` | Accent/focus states |
| `shadow-glowOk` | Success emphasis |
| `shadow-card` | Subtle card elevation |
| `shadow-cardDark` | Dark card elevation |

### Animations

| Name | Duration | Usage |
|------|----------|-------|
| `animate-shimmer` | 2s | Loading skeletons |
| `animate-fadeIn` | 0.2s | Element entrance |
| `animate-scaleIn` | 0.15s | Modal/popover entrance |
| `animate-slideUp` | 0.25s | Drawer entrance |

---

## Components

### Button

```tsx
import { Button } from "@/components/ui/primitives";

<Button variant="primary">Execute</Button>
<Button variant="secondary">Learn More</Button>
<Button variant="soft">Cancel</Button>
<Button variant="ghost">Settings</Button>

<Button size="sm">Small</Button>
<Button size="md">Medium</Button>
<Button size="lg">Large</Button>

<Button loading>Processing...</Button>
<Button disabled>Unavailable</Button>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `"primary" \| "secondary" \| "soft" \| "ghost"` | `"primary"` | Visual style |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | Button size |
| `loading` | `boolean` | `false` | Show spinner |
| `disabled` | `boolean` | `false` | Disable button |

---

### Pill

Status badges and tags.

```tsx
import { Pill } from "@/components/ui/primitives";

<Pill>Neutral</Pill>
<Pill tone="ok">Verified</Pill>
<Pill tone="warn">MEV Risk</Pill>
<Pill tone="bad">Failed</Pill>
<Pill tone="accent">Best</Pill>
<Pill tone="blue">Info</Pill>

<Pill size="sm">Small</Pill>
<Pill size="md">Medium</Pill>
```

| Prop | Type | Default |
|------|------|---------|
| `tone` | `"neutral" \| "ok" \| "warn" \| "bad" \| "accent" \| "blue"` | `"neutral"` |
| `size` | `"sm" \| "md"` | `"sm"` |

---

### TokenInput

Modern token input with selector.

```tsx
import { TokenInput, SwapDirectionButton } from "@/components/ui/token-input";

<TokenInput
  label="From"
  token="ETH"
  balance="12.45"
  value="8500"
  usdValue="≈ $8,500.00"
  onChange={(v) => setValue(v)}
  onTokenClick={() => openPicker()}
  onMaxClick={() => setMax()}
/>

<SwapDirectionButton onClick={swapTokens} />

<TokenInput
  label="To"
  token="USDC"
  value="8478"
  loading={isLoading}
  readOnly
/>
```

| Prop | Type | Description |
|------|------|-------------|
| `label` | `string` | Header label ("From" / "To") |
| `token` | `string` | Token symbol |
| `balance` | `string?` | User balance |
| `value` | `string` | Input value |
| `usdValue` | `string?` | USD equivalent |
| `loading` | `boolean` | Show shimmer |
| `readOnly` | `boolean` | Disable editing |
| `onTokenClick` | `() => void` | Open token picker |
| `onMaxClick` | `() => void` | Set max amount |

---

### SearchInput

```tsx
import { SearchInput } from "@/components/ui/inputs";

<SearchInput
  value={query}
  onChange={setQuery}
  placeholder="Search tokens..."
  autoFocus
/>
```

---

### Slider

```tsx
import { Slider } from "@/components/ui/inputs";

<Slider
  value={slippage}
  min={0.1}
  max={5}
  step={0.1}
  onChange={setSlippage}
  label="Slippage tolerance"
  suffix="%"
/>
```

---

### Tabs

Segmented control for mode switching.

```tsx
import { Tabs } from "@/components/ui/inputs";

<Tabs
  tabs={[
    { value: "BEQ", label: "Best Executable" },
    { value: "RAW", label: "Raw Output" },
  ]}
  value={mode}
  onChange={setMode}
  size="sm"
/>
```

---

### PresetButtons

Quick selection buttons.

```tsx
import { PresetButtons } from "@/components/ui/inputs";

<PresetButtons
  options={[
    { value: 0.5, label: "0.5%" },
    { value: 1, label: "1%" },
    { value: 2, label: "2%" },
  ]}
  value={slippage}
  onChange={setSlippage}
/>
```

---

### Toggle

On/off switch.

```tsx
import { Toggle } from "@/components/ui/primitives";

<Toggle on={enabled} onChange={setEnabled} />
```

---

### Progress

Progress bar with color variants.

```tsx
import { Progress } from "@/components/ui/primitives";

<Progress value={75} tone="ok" />
<Progress value={50} tone="accent" />
<Progress value={25} tone="blue" />
```

---

### Skeleton

Loading placeholder with shimmer animation.

```tsx
import { Skeleton } from "@/components/ui/primitives";

<Skeleton className="h-6 w-32" />
<Skeleton className="h-10 w-full" />
```

---

### Surfaces

Layout containers for theming.

```tsx
import { CardDark, CardLight, AppShellDark, AppShellLight } from "@/components/ui/surfaces";

// Dark theme (swap, status, providers)
<AppShellDark>
  <CardDark className="p-4">Content</CardDark>
</AppShellDark>

// Light theme (modals, settings, receipt)
<AppShellLight>
  <CardLight className="p-4">Content</CardLight>
</AppShellLight>
```

---

## Theme System

### Two-Theme Approach

| Theme | Usage | Background |
|-------|-------|------------|
| **Dark Shell** | Swap, Status, Provider pages | `bg-dark` gradient |
| **Light Surfaces** | Modals, Settings, Receipt | `bg-light` gradient |

### Applying Themes

```tsx
// Dark theme page
<AppShellDark>
  <TopbarDark active="Swap" />
  <CardDark>...</CardDark>
</AppShellDark>

// Light theme modal
<CardLight className="p-6">
  <h2 className="text-sp-lightText">Settings</h2>
  <p className="text-sp-lightMuted">...</p>
</CardLight>
```

---

## Comparison with Market Leaders

| Feature | SwapPilot v2 | Uniswap | 1inch | KyberSwap |
|---------|--------------|---------|-------|-----------|
| Token input style | ✅ Modern | ✅ | ✅ | ✅ |
| Focus states | ✅ Glow | ✅ | ✅ | ✅ |
| Loading shimmer | ✅ | ✅ | ✅ | ✅ |
| Swap direction btn | ✅ | ✅ | ✅ | ✅ |
| Typography scale | ✅ 6 levels | ✅ | ✅ | ✅ |
| Provider comparison | ✅ Cards | ❌ | ✅ | ✅ |
| Route visualization | 🔜 Planned | ❌ | ✅ | ✅ |

---

## New Interactive Components (v2.1)

### SwapInterface

Main swap component with full interactivity.

**Location:** `components/swap/swap-interface.tsx`

```tsx
import { SwapInterface } from "@/components/swap/swap-interface";

<SwapInterface />
```

**Features:**
- Token input with picker modal
- BEQ/RAW mode toggle
- Settings drawer
- Receipt drawer
- Real API integration via `useSwapQuotes` hook
- Provider quote comparison with delta percentages

### TokenPickerModal

Modal for selecting tokens with search.

**Location:** `components/swap/token-picker-modal.tsx`

```tsx
import { TokenPickerModal } from "@/components/swap/token-picker-modal";

<TokenPickerModal
  open={isOpen}
  onClose={() => setIsOpen(false)}
  onSelect={(symbol) => setToken(symbol)}
  selectedToken="BNB"
/>
```

**Features:**
- Recent tokens row
- Search with fuzzy matching
- Token icons with balances
- Selected state highlighting

### SettingsDrawer

Slide-out settings panel.

**Location:** `components/swap/settings-drawer.tsx`

```tsx
import { SettingsDrawer } from "@/components/swap/settings-drawer";

<SettingsDrawer
  open={isOpen}
  onClose={() => setIsOpen(false)}
/>
```

**Features:**
- Slippage tolerance (slider + presets)
- Transaction deadline
- MEV protection toggle
- Expert mode toggle
- Theme selector

### ReceiptDrawer

Decision receipt drawer showing why a quote was selected.

**Location:** `components/swap/receipt-drawer.tsx`

```tsx
import { ReceiptDrawer } from "@/components/swap/receipt-drawer";

<ReceiptDrawer
  open={isOpen}
  onClose={() => setIsOpen(false)}
  receipt={decisionReceipt}
  selectedQuote={rankedQuote}
  loading={false}
/>
```

**Features:**
- Selected provider highlight
- Risk signals (sellability, revert, MEV)
- Compared providers list
- Copy JSON button
- Receipt metadata

### AppShell (Layout)

Responsive app shell with navigation.

**Location:** `components/layout/app-shell.tsx`

```tsx
import { AppShell } from "@/components/layout/app-shell";

<AppShell>
  <YourPageContent />
</AppShell>
```

**Components included:**
- `MobileHeader` - Sticky header with logo and network status
- `MobileNav` - Bottom tab navigation (Swap, Status, Settings)
- `DesktopSidebar` - Collapsible sidebar with navigation + network info

### useSwapQuotes Hook

React hook for API integration.

**Location:** `lib/use-swap-quotes.ts`

```tsx
import { useSwapQuotes } from "@/lib/use-swap-quotes";

const {
  quotes,           // { status, data, error }
  receipt,          // { status, data, error }
  fetchQuotes,      // (params) => Promise<void>
  fetchReceipt,     // (receiptId) => Promise<void>
  reset,            // () => void
  bestExecutableQuote,
  bestRawQuote,
  rankedQuotes,
} = useSwapQuotes();
```

**Helper functions:**
- `formatQuoteOutput(quote)` - Format buy amount
- `formatQuoteUsd(quote)` - Format USD value
- `getConfidenceFromQuote(quote)` - Get confidence percentage
- `getQuoteFlags(quote)` - Get flags array ["MEV", "SELL_OK", etc]
- `TOKEN_ADDRESSES` - Mapping of symbol to contract address
