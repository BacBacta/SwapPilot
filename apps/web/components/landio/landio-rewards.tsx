"use client";

import { useState } from "react";

const styles = {
  container: {
    maxWidth: "800px",
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
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "16px",
    marginBottom: "32px",
  },
  statCard: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-xl)",
    padding: "24px",
  },
  statLabel: {
    fontSize: "13px",
    color: "var(--text-muted)",
    marginBottom: "8px",
  },
  statValue: {
    fontSize: "28px",
    fontWeight: 700,
  },
  statChange: {
    fontSize: "12px",
    color: "var(--ok)",
    marginTop: "4px",
  },
  card: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-xl)",
    padding: "24px",
    marginBottom: "20px",
  },
  cardTitle: {
    fontSize: "18px",
    fontWeight: 600,
    marginBottom: "8px",
  },
  cardSubtitle: {
    fontSize: "14px",
    color: "var(--text-secondary)",
    marginBottom: "20px",
  },
  inputGroup: {
    marginBottom: "20px",
  },
  inputLabel: {
    fontSize: "13px",
    color: "var(--text-muted)",
    marginBottom: "8px",
    display: "block",
  },
  input: {
    width: "100%",
    padding: "16px",
    background: "var(--bg-card-inner)",
    border: "1px solid var(--border)",
    borderRadius: "12px",
    fontSize: "18px",
    fontWeight: 600,
    color: "var(--text-primary)",
    outline: "none",
    fontFamily: "inherit",
  },
  lockPeriods: {
    display: "flex",
    gap: "8px",
    marginBottom: "20px",
  },
  lockPeriod: {
    flex: 1,
    padding: "12px",
    background: "var(--bg-card-inner)",
    border: "1px solid var(--border)",
    borderRadius: "12px",
    textAlign: "center" as const,
    cursor: "pointer",
    transition: "all 0.2s",
  },
  lockPeriodActive: {
    borderColor: "var(--accent)",
    background: "var(--accent-dim)",
  },
  lockPeriodLabel: {
    fontSize: "14px",
    fontWeight: 600,
    marginBottom: "4px",
  },
  lockPeriodApy: {
    fontSize: "12px",
    color: "var(--accent)",
  },
  btn: {
    width: "100%",
    padding: "16px",
    background: "var(--accent)",
    border: "none",
    borderRadius: "12px",
    fontSize: "16px",
    fontWeight: 700,
    color: "#000",
    cursor: "pointer",
    fontFamily: "inherit",
  },
  rewardRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px",
    background: "var(--bg-card-inner)",
    borderRadius: "12px",
    marginBottom: "12px",
  },
  rewardLabel: {
    fontSize: "14px",
    color: "var(--text-secondary)",
  },
  rewardValue: {
    fontSize: "18px",
    fontWeight: 700,
    color: "var(--accent)",
  },
  referralLink: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "16px",
    background: "var(--bg-card-inner)",
    border: "1px solid var(--border)",
    borderRadius: "12px",
  },
  referralCode: {
    flex: 1,
    fontSize: "14px",
    color: "var(--accent)",
    fontFamily: "monospace",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  copyBtn: {
    padding: "8px 16px",
    background: "var(--accent)",
    border: "none",
    borderRadius: "8px",
    fontSize: "12px",
    fontWeight: 700,
    color: "#000",
    cursor: "pointer",
  },
};

export function LandioRewards() {
  const [stakeAmount, setStakeAmount] = useState("");
  const [lockPeriod, setLockPeriod] = useState("30");

  const lockPeriods = [
    { days: "30", apy: "12%" },
    { days: "90", apy: "18%" },
    { days: "180", apy: "25%" },
    { days: "365", apy: "35%" },
  ];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Rewards</h1>
        <p style={styles.subtitle}>Stake PILOT tokens and earn rewards</p>
      </div>

      {/* Stats Grid */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Total Staked</div>
          <div style={styles.statValue}>12,450</div>
          <div style={styles.statChange}>PILOT</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Your Rewards</div>
          <div style={{ ...styles.statValue, color: "var(--accent)" }}>847.32</div>
          <div style={styles.statChange}>+12.5% this month</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Current APY</div>
          <div style={{ ...styles.statValue, color: "var(--ok)" }}>18%</div>
          <div style={styles.statChange}>90-day lock</div>
        </div>
      </div>

      {/* Staking Card */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Stake PILOT</h2>
        <p style={styles.cardSubtitle}>Lock your tokens to earn rewards</p>

        <div style={styles.inputGroup}>
          <label style={styles.inputLabel}>Amount to Stake</label>
          <input
            type="text"
            style={styles.input}
            placeholder="0.00"
            value={stakeAmount}
            onChange={(e) => setStakeAmount(e.target.value)}
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.inputLabel}>Lock Period</label>
          <div style={styles.lockPeriods}>
            {lockPeriods.map((period) => (
              <div
                key={period.days}
                style={{
                  ...styles.lockPeriod,
                  ...(lockPeriod === period.days ? styles.lockPeriodActive : {}),
                }}
                onClick={() => setLockPeriod(period.days)}
              >
                <div style={styles.lockPeriodLabel}>{period.days} days</div>
                <div style={styles.lockPeriodApy}>{period.apy} APY</div>
              </div>
            ))}
          </div>
        </div>

        <button style={styles.btn}>Stake PILOT</button>
      </div>

      {/* Claimable Rewards */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Claimable Rewards</h2>
        <p style={styles.cardSubtitle}>Your earned rewards ready to claim</p>

        <div style={styles.rewardRow}>
          <span style={styles.rewardLabel}>Staking Rewards</span>
          <span style={styles.rewardValue}>423.50 PILOT</span>
        </div>
        <div style={styles.rewardRow}>
          <span style={styles.rewardLabel}>Referral Rewards</span>
          <span style={styles.rewardValue}>156.82 PILOT</span>
        </div>
        <div style={{ ...styles.rewardRow, marginBottom: "20px" }}>
          <span style={styles.rewardLabel}>Trading Rebates</span>
          <span style={styles.rewardValue}>267.00 PILOT</span>
        </div>

        <button style={styles.btn}>Claim Rewards</button>
      </div>

      {/* Referral Program */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Referral Program</h2>
        <p style={styles.cardSubtitle}>Earn 5% of your referrals&apos; swap fees</p>

        <div style={styles.referralLink}>
          <span style={styles.referralCode}>https://swappilot.io/r/abc123xyz</span>
          <button style={styles.copyBtn}>Copy</button>
        </div>
      </div>
    </div>
  );
}
