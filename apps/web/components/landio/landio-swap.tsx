"use client";

import { useState } from "react";

const styles = {
  swapApp: {
    maxWidth: "480px",
    margin: "0 auto",
    padding: "0 16px",
  },
  swapContainer: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-xl)",
    padding: "24px",
    marginBottom: "20px",
  },
  swapHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "24px",
  },
  swapTitle: {
    fontSize: "20px",
    fontWeight: 700,
    color: "var(--text-primary)",
  },
  settingsBtn: {
    width: "40px",
    height: "40px",
    background: "var(--bg-card-inner)",
    border: "1px solid var(--border)",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    fontSize: "16px",
  },
  tokenInputBox: {
    background: "var(--bg-card-inner)",
    border: "1px solid var(--border)",
    borderRadius: "16px",
    padding: "20px",
    marginBottom: "8px",
  },
  tokenInputLabel: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "13px",
    color: "var(--text-muted)",
    marginBottom: "12px",
  },
  tokenInputRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
  },
  tokenAmountInput: {
    flex: 1,
    background: "transparent",
    border: "none",
    fontSize: "32px",
    fontWeight: 700,
    color: "var(--text-primary)",
    outline: "none",
    fontFamily: "inherit",
    width: "100%",
  },
  tokenSelector: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "8px 14px 8px 10px",
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "100px",
    cursor: "pointer",
    whiteSpace: "nowrap" as const,
  },
  tokenIcon: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    fontSize: "10px",
  },
  tokenName: {
    fontWeight: 600,
    fontSize: "15px",
  },
  usdValue: {
    fontSize: "14px",
    color: "var(--text-muted)",
    marginTop: "8px",
  },
  maxBtn: {
    padding: "4px 10px",
    background: "var(--accent-dim)",
    border: "none",
    borderRadius: "6px",
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--accent)",
    cursor: "pointer",
    marginLeft: "8px",
  },
  swapArrowContainer: {
    display: "flex",
    justifyContent: "center",
    margin: "-4px 0",
    position: "relative" as const,
    zIndex: 2,
  },
  swapArrowBtn: {
    width: "40px",
    height: "40px",
    background: "var(--bg-card)",
    border: "4px solid var(--bg-primary)",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    color: "var(--text-secondary)",
    fontSize: "18px",
    transition: "all 0.2s",
  },
  beqContainer: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-xl)",
    padding: "20px",
    marginBottom: "20px",
  },
  beqTitle: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  beqLabel: {
    fontSize: "14px",
    color: "var(--text-secondary)",
  },
  beqScore: {
    fontSize: "24px",
    fontWeight: 700,
    color: "var(--accent)",
  },
  beqProgress: {
    height: "8px",
    background: "var(--bg-card-inner)",
    borderRadius: "4px",
    overflow: "hidden",
    marginBottom: "20px",
  },
  beqProgressFill: {
    height: "100%",
    background: "linear-gradient(90deg, var(--accent), #9fff00)",
    borderRadius: "4px",
    transition: "width 0.5s ease",
  },
  beqDetails: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "12px",
  },
  beqDetailItem: {
    background: "var(--bg-card-inner)",
    borderRadius: "12px",
    padding: "14px",
  },
  beqDetailLabel: {
    fontSize: "12px",
    color: "var(--text-muted)",
    marginBottom: "4px",
  },
  beqDetailValue: {
    fontSize: "15px",
    fontWeight: 600,
  },
  routeContainer: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-xl)",
    padding: "20px",
    marginBottom: "20px",
  },
  routeHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "16px",
  },
  routeBadge: {
    padding: "4px 10px",
    background: "var(--accent)",
    color: "#000",
    fontSize: "11px",
    fontWeight: 700,
    borderRadius: "100px",
  },
  routePath: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "16px",
    background: "var(--bg-card-inner)",
    borderRadius: "12px",
    overflowX: "auto" as const,
  },
  routeToken: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "6px 12px 6px 8px",
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "100px",
    flexShrink: 0,
  },
  routeTokenIcon: {
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "8px",
    fontWeight: 700,
  },
  routeTokenName: {
    fontSize: "13px",
    fontWeight: 500,
  },
  routeArrow: {
    color: "var(--accent)",
    fontSize: "12px",
  },
  routeDex: {
    padding: "4px 8px",
    background: "var(--accent-dim)",
    borderRadius: "6px",
    fontSize: "10px",
    fontWeight: 600,
    color: "var(--accent)",
    flexShrink: 0,
  },
  providersContainer: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-xl)",
    padding: "20px",
    marginBottom: "20px",
  },
  providersHeader: {
    fontSize: "14px",
    color: "var(--text-secondary)",
    marginBottom: "16px",
  },
  providerItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "14px 16px",
    background: "var(--bg-card-inner)",
    border: "1px solid var(--border)",
    borderRadius: "12px",
    marginBottom: "8px",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  providerItemSelected: {
    borderColor: "var(--accent)",
    background: "rgba(200, 255, 0, 0.03)",
  },
  providerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  providerLogo: {
    width: "36px",
    height: "36px",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    fontWeight: 700,
  },
  providerName: {
    fontWeight: 600,
    fontSize: "14px",
  },
  providerRate: {
    fontSize: "12px",
    color: "var(--text-muted)",
  },
  providerRight: {
    textAlign: "right" as const,
  },
  providerOutput: {
    fontWeight: 700,
    fontSize: "15px",
  },
  providerSavings: {
    fontSize: "12px",
    color: "var(--ok)",
  },
  swapBtn: {
    width: "100%",
    padding: "18px",
    background: "var(--accent)",
    border: "none",
    borderRadius: "16px",
    fontSize: "16px",
    fontWeight: 700,
    color: "#000",
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "all 0.2s",
  },
  swapBtnDisabled: {
    background: "var(--bg-card-inner)",
    color: "var(--text-muted)",
    cursor: "not-allowed",
  },
  modal: {
    position: "fixed" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0, 0, 0, 0.8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modalContent: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-xl)",
    padding: "24px",
    width: "100%",
    maxWidth: "400px",
    margin: "16px",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "24px",
  },
  modalTitle: {
    fontSize: "18px",
    fontWeight: 700,
  },
  modalClose: {
    width: "32px",
    height: "32px",
    background: "var(--bg-card-inner)",
    border: "none",
    borderRadius: "8px",
    color: "var(--text-secondary)",
    cursor: "pointer",
    fontSize: "18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  slippageOptions: {
    display: "flex",
    gap: "8px",
    marginBottom: "16px",
  },
  slippageOption: {
    flex: 1,
    padding: "12px",
    background: "var(--bg-card-inner)",
    border: "1px solid var(--border)",
    borderRadius: "12px",
    textAlign: "center" as const,
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: 500,
    color: "var(--text-secondary)",
    transition: "all 0.2s",
  },
  slippageOptionActive: {
    borderColor: "var(--accent)",
    background: "var(--accent-dim)",
    color: "var(--accent)",
  },
};

export function LandioSwap() {
  const [fromAmount, setFromAmount] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [slippage, setSlippage] = useState("0.5");
  const [selectedProvider, setSelectedProvider] = useState(0);

  const hasQuote = parseFloat(fromAmount) > 0;
  const toAmount = hasQuote ? (parseFloat(fromAmount) * 0.2847).toFixed(4) : "";

  const providers = [
    { name: "PancakeSwap V3", logo: "🥞", color: "linear-gradient(135deg, #1fc7d4, #0098a1)", output: "0.2847", rate: "Best rate", savings: "+$2.15 vs avg" },
    { name: "1inch", logo: "1", color: "linear-gradient(135deg, #2b6def, #1e4bc8)", output: "0.2839", rate: "Multi-route", savings: "+$0.89 vs avg" },
    { name: "ParaSwap", logo: "P", color: "linear-gradient(135deg, #7b3fe4, #5e2fb8)", output: "0.2831", rate: "Standard", savings: null },
  ];

  return (
    <section style={{ paddingTop: "40px" }}>
      <div style={styles.swapApp}>
        {/* Main Swap Card */}
        <div style={styles.swapContainer}>
          <div style={styles.swapHeader}>
            <h2 style={styles.swapTitle}>Swap</h2>
            <button style={styles.settingsBtn} onClick={() => setShowSettings(true)}>⚙️</button>
          </div>

          {/* From Token */}
          <div style={styles.tokenInputBox}>
            <div style={styles.tokenInputLabel}>
              <span>You pay</span>
              <span>
                Balance: 2.5 BNB
                <button style={styles.maxBtn} onClick={() => setFromAmount("2.5")}>MAX</button>
              </span>
            </div>
            <div style={styles.tokenInputRow}>
              <input
                type="text"
                style={styles.tokenAmountInput}
                placeholder="0"
                value={fromAmount}
                onChange={(e) => setFromAmount(e.target.value)}
              />
              <div style={styles.tokenSelector}>
                <div style={{ ...styles.tokenIcon, background: "linear-gradient(135deg, #f0b90b, #d4a00a)", color: "#000" }}>BNB</div>
                <span style={styles.tokenName}>BNB</span>
                <span style={{ color: "var(--text-muted)", fontSize: "10px" }}>▼</span>
              </div>
            </div>
            <div style={styles.usdValue}>≈ ${fromAmount ? (parseFloat(fromAmount) * 580).toFixed(2) : "0.00"}</div>
          </div>

          {/* Swap Arrow */}
          <div style={styles.swapArrowContainer}>
            <button style={styles.swapArrowBtn}>↓</button>
          </div>

          {/* To Token */}
          <div style={styles.tokenInputBox}>
            <div style={styles.tokenInputLabel}>
              <span>You receive</span>
              <span>Balance: 0 ETH</span>
            </div>
            <div style={styles.tokenInputRow}>
              <input
                type="text"
                style={styles.tokenAmountInput}
                placeholder="0"
                value={toAmount}
                readOnly
              />
              <div style={styles.tokenSelector}>
                <div style={{ ...styles.tokenIcon, background: "linear-gradient(135deg, #627eea, #4a5fc1)", color: "#fff" }}>ETH</div>
                <span style={styles.tokenName}>ETH</span>
                <span style={{ color: "var(--text-muted)", fontSize: "10px" }}>▼</span>
              </div>
            </div>
            <div style={styles.usdValue}>≈ ${toAmount ? (parseFloat(toAmount) * 2030).toFixed(2) : "0.00"}</div>
          </div>
        </div>

        {/* BEQ Score - Only show when quote exists */}
        {hasQuote && (
          <div style={styles.beqContainer}>
            <div style={styles.beqTitle}>
              <span style={styles.beqLabel}>Best Execution Quality</span>
              <span style={styles.beqScore}>87/100</span>
            </div>
            <div style={styles.beqProgress}>
              <div style={{ ...styles.beqProgressFill, width: "87%" }} />
            </div>
            <div style={styles.beqDetails}>
              <div style={styles.beqDetailItem}>
                <div style={styles.beqDetailLabel}>Price Impact</div>
                <div style={{ ...styles.beqDetailValue, color: "var(--ok)" }}>-0.12%</div>
              </div>
              <div style={styles.beqDetailItem}>
                <div style={styles.beqDetailLabel}>Gas Cost</div>
                <div style={styles.beqDetailValue}>$0.42</div>
              </div>
              <div style={styles.beqDetailItem}>
                <div style={styles.beqDetailLabel}>MEV Risk</div>
                <div style={{ ...styles.beqDetailValue, color: "var(--ok)" }}>Protected</div>
              </div>
              <div style={styles.beqDetailItem}>
                <div style={styles.beqDetailLabel}>Net Output</div>
                <div style={styles.beqDetailValue}>+$2.15</div>
              </div>
            </div>
          </div>
        )}

        {/* Route Preview */}
        {hasQuote && (
          <div style={styles.routeContainer}>
            <div style={styles.routeHeader}>
              <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>Route</span>
              <span style={styles.routeBadge}>BEST</span>
            </div>
            <div style={styles.routePath}>
              <div style={styles.routeToken}>
                <div style={{ ...styles.routeTokenIcon, background: "linear-gradient(135deg, #f0b90b, #d4a00a)", color: "#000" }}>B</div>
                <span style={styles.routeTokenName}>BNB</span>
              </div>
              <span style={styles.routeArrow}>→</span>
              <span style={styles.routeDex}>PancakeSwap V3</span>
              <span style={styles.routeArrow}>→</span>
              <div style={styles.routeToken}>
                <div style={{ ...styles.routeTokenIcon, background: "linear-gradient(135deg, #26a17b, #1a8a65)", color: "#fff" }}>U</div>
                <span style={styles.routeTokenName}>USDT</span>
              </div>
              <span style={styles.routeArrow}>→</span>
              <span style={styles.routeDex}>1inch</span>
              <span style={styles.routeArrow}>→</span>
              <div style={styles.routeToken}>
                <div style={{ ...styles.routeTokenIcon, background: "linear-gradient(135deg, #627eea, #4a5fc1)", color: "#fff" }}>E</div>
                <span style={styles.routeTokenName}>ETH</span>
              </div>
            </div>
          </div>
        )}

        {/* Provider Comparison */}
        {hasQuote && (
          <div style={styles.providersContainer}>
            <div style={styles.providersHeader}>Available Providers</div>
            {providers.map((provider, idx) => (
              <div
                key={provider.name}
                style={{
                  ...styles.providerItem,
                  ...(selectedProvider === idx ? styles.providerItemSelected : {}),
                }}
                onClick={() => setSelectedProvider(idx)}
              >
                <div style={styles.providerLeft}>
                  <div style={{ ...styles.providerLogo, background: provider.color, color: "#fff" }}>{provider.logo}</div>
                  <div>
                    <div style={styles.providerName}>{provider.name}</div>
                    <div style={styles.providerRate}>{provider.rate}</div>
                  </div>
                </div>
                <div style={styles.providerRight}>
                  <div style={styles.providerOutput}>{provider.output} ETH</div>
                  {provider.savings ? (
                    <div style={styles.providerSavings}>{provider.savings}</div>
                  ) : (
                    <div style={styles.providerRate}>Baseline</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Swap Button */}
        <button
          style={{
            ...styles.swapBtn,
            ...(hasQuote ? {} : styles.swapBtnDisabled),
          }}
          disabled={!hasQuote}
        >
          {hasQuote ? "Swap" : "Enter an amount"}
        </button>
      </div>

      {/* Slippage Modal */}
      {showSettings && (
        <div style={styles.modal} onClick={() => setShowSettings(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Settings</h3>
              <button style={styles.modalClose} onClick={() => setShowSettings(false)}>×</button>
            </div>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "16px" }}>Slippage Tolerance</p>
            <div style={styles.slippageOptions}>
              {["0.1", "0.5", "1.0"].map((val) => (
                <div
                  key={val}
                  style={{
                    ...styles.slippageOption,
                    ...(slippage === val ? styles.slippageOptionActive : {}),
                  }}
                  onClick={() => setSlippage(val)}
                >
                  {val}%
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
