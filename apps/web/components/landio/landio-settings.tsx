"use client";

import { useState } from "react";

const styles = {
  container: {
    maxWidth: "600px",
    margin: "0 auto",
    padding: "40px 16px",
  },
  header: {
    marginBottom: "32px",
  },
  title: {
    fontSize: "28px",
    fontWeight: 700,
    marginBottom: "8px",
  },
  subtitle: {
    fontSize: "14px",
    color: "var(--text-secondary)",
  },
  card: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-xl)",
    padding: "24px",
    marginBottom: "20px",
  },
  cardTitle: {
    fontSize: "16px",
    fontWeight: 600,
    marginBottom: "20px",
  },
  settingRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 0",
    borderBottom: "1px solid var(--border)",
  },
  settingRowLast: {
    borderBottom: "none",
  },
  settingLeft: {
    flex: 1,
  },
  settingLabel: {
    fontWeight: 500,
    fontSize: "14px",
    marginBottom: "4px",
  },
  settingDesc: {
    fontSize: "12px",
    color: "var(--text-muted)",
  },
  toggle: {
    width: "48px",
    height: "28px",
    borderRadius: "14px",
    background: "var(--bg-card-inner)",
    border: "1px solid var(--border)",
    cursor: "pointer",
    position: "relative" as const,
    transition: "all 0.2s",
  },
  toggleActive: {
    background: "var(--accent)",
    borderColor: "var(--accent)",
  },
  toggleKnob: {
    position: "absolute" as const,
    top: "3px",
    left: "3px",
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    background: "#fff",
    transition: "all 0.2s",
  },
  toggleKnobActive: {
    left: "23px",
  },
  slippageOptions: {
    display: "flex",
    gap: "8px",
  },
  slippageOption: {
    padding: "10px 16px",
    background: "var(--bg-card-inner)",
    border: "1px solid var(--border)",
    borderRadius: "10px",
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
  themeOptions: {
    display: "flex",
    gap: "8px",
  },
  themeOption: {
    flex: 1,
    padding: "16px",
    background: "var(--bg-card-inner)",
    border: "1px solid var(--border)",
    borderRadius: "12px",
    cursor: "pointer",
    textAlign: "center" as const,
    transition: "all 0.2s",
  },
  themeOptionActive: {
    borderColor: "var(--accent)",
  },
  themeIcon: {
    fontSize: "24px",
    marginBottom: "8px",
  },
  themeLabel: {
    fontSize: "13px",
    fontWeight: 500,
  },
  dangerCard: {
    background: "rgba(239, 68, 68, 0.05)",
    border: "1px solid rgba(239, 68, 68, 0.2)",
    borderRadius: "var(--radius-xl)",
    padding: "24px",
  },
  dangerTitle: {
    fontSize: "16px",
    fontWeight: 600,
    color: "var(--bad)",
    marginBottom: "12px",
  },
  dangerDesc: {
    fontSize: "13px",
    color: "var(--text-secondary)",
    marginBottom: "16px",
  },
  dangerBtn: {
    padding: "12px 20px",
    background: "transparent",
    border: "1px solid var(--bad)",
    borderRadius: "10px",
    color: "var(--bad)",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.2s",
  },
};

function Toggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <div
      style={{ ...styles.toggle, ...(active ? styles.toggleActive : {}) }}
      onClick={onToggle}
    >
      <div style={{ ...styles.toggleKnob, ...(active ? styles.toggleKnobActive : {}) }} />
    </div>
  );
}

export function LandioSettings() {
  const [slippage, setSlippage] = useState("0.5");
  const [mevProtection, setMevProtection] = useState(true);
  const [expertMode, setExpertMode] = useState(false);
  const [theme, setTheme] = useState("dark");
  const [notifications, setNotifications] = useState(true);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Settings</h1>
        <p style={styles.subtitle}>Customize your trading experience</p>
      </div>

      {/* Slippage */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Slippage Tolerance</h2>
        <div style={styles.slippageOptions}>
          {["0.1", "0.5", "1.0", "3.0"].map((val) => (
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

      {/* Trading Settings */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Trading</h2>
        
        <div style={styles.settingRow}>
          <div style={styles.settingLeft}>
            <div style={styles.settingLabel}>MEV Protection</div>
            <div style={styles.settingDesc}>Protect your trades from sandwich attacks</div>
          </div>
          <Toggle active={mevProtection} onToggle={() => setMevProtection(!mevProtection)} />
        </div>

        <div style={{ ...styles.settingRow, ...styles.settingRowLast }}>
          <div style={styles.settingLeft}>
            <div style={styles.settingLabel}>Expert Mode</div>
            <div style={styles.settingDesc}>Enable advanced trading features</div>
          </div>
          <Toggle active={expertMode} onToggle={() => setExpertMode(!expertMode)} />
        </div>
      </div>

      {/* Appearance */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Appearance</h2>
        <div style={styles.themeOptions}>
          {[
            { id: "dark", icon: "🌙", label: "Dark" },
            { id: "light", icon: "☀️", label: "Light" },
            { id: "system", icon: "💻", label: "System" },
          ].map((t) => (
            <div
              key={t.id}
              style={{
                ...styles.themeOption,
                ...(theme === t.id ? styles.themeOptionActive : {}),
              }}
              onClick={() => setTheme(t.id)}
            >
              <div style={styles.themeIcon}>{t.icon}</div>
              <div style={styles.themeLabel}>{t.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Notifications */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Notifications</h2>
        <div style={{ ...styles.settingRow, ...styles.settingRowLast }}>
          <div style={styles.settingLeft}>
            <div style={styles.settingLabel}>Push Notifications</div>
            <div style={styles.settingDesc}>Get notified about swap completions and price alerts</div>
          </div>
          <Toggle active={notifications} onToggle={() => setNotifications(!notifications)} />
        </div>
      </div>

      {/* Danger Zone */}
      <div style={styles.dangerCard}>
        <h2 style={styles.dangerTitle}>Danger Zone</h2>
        <p style={styles.dangerDesc}>
          Disconnect your wallet and clear all local data. This action cannot be undone.
        </p>
        <button style={styles.dangerBtn}>Disconnect Wallet</button>
      </div>
    </div>
  );
}
