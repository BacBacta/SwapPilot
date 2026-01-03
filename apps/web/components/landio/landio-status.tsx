"use client";

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
  statusBanner: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "20px 24px",
    background: "rgba(34, 197, 94, 0.1)",
    border: "1px solid rgba(34, 197, 94, 0.3)",
    borderRadius: "var(--radius-xl)",
    marginBottom: "32px",
  },
  statusDot: {
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    background: "var(--ok)",
    boxShadow: "0 0 10px var(--ok)",
  },
  statusText: {
    fontSize: "16px",
    fontWeight: 600,
    color: "var(--ok)",
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
    marginBottom: "20px",
  },
  serviceList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "12px",
  },
  serviceItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px",
    background: "var(--bg-card-inner)",
    borderRadius: "12px",
  },
  serviceLeft: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  serviceIcon: {
    width: "40px",
    height: "40px",
    borderRadius: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "18px",
  },
  serviceName: {
    fontWeight: 600,
    fontSize: "14px",
    marginBottom: "2px",
  },
  serviceDesc: {
    fontSize: "12px",
    color: "var(--text-muted)",
  },
  serviceStatus: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 12px",
    background: "rgba(34, 197, 94, 0.1)",
    borderRadius: "100px",
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--ok)",
  },
  providerGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "12px",
  },
  providerCard: {
    padding: "16px",
    background: "var(--bg-card-inner)",
    borderRadius: "12px",
  },
  providerHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
  },
  providerName: {
    fontWeight: 600,
    fontSize: "14px",
  },
  providerLatency: {
    fontSize: "12px",
    color: "var(--ok)",
  },
  latencyBar: {
    height: "4px",
    background: "var(--bg-card)",
    borderRadius: "2px",
    overflow: "hidden",
  },
  latencyFill: {
    height: "100%",
    background: "var(--ok)",
    borderRadius: "2px",
  },
  uptimeGrid: {
    display: "flex",
    gap: "2px",
    marginTop: "20px",
  },
  uptimeDay: {
    flex: 1,
    height: "24px",
    borderRadius: "2px",
  },
  uptimeLegend: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: "8px",
    fontSize: "11px",
    color: "var(--text-muted)",
  },
};

export function LandioStatus() {
  const services = [
    { name: "Quote Engine", desc: "Multi-aggregator quotes", icon: "⚡", status: "Operational" },
    { name: "BEQ Scoring", desc: "Best execution quality", icon: "📊", status: "Operational" },
    { name: "MEV Protection", desc: "Anti-sandwich guard", icon: "🛡️", status: "Operational" },
    { name: "Price Oracle", desc: "Real-time token prices", icon: "💰", status: "Operational" },
  ];

  const providers = [
    { name: "1inch", latency: "142ms", percent: 95 },
    { name: "PancakeSwap", latency: "89ms", percent: 100 },
    { name: "ParaSwap", latency: "156ms", percent: 90 },
    { name: "0x Protocol", latency: "178ms", percent: 85 },
    { name: "KyberSwap", latency: "134ms", percent: 92 },
    { name: "OpenOcean", latency: "201ms", percent: 80 },
  ];

  // Generate 90 days of uptime data
  const uptimeData = Array.from({ length: 90 }, () => Math.random() > 0.02);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>System Status</h1>
        <p style={styles.subtitle}>Real-time monitoring of all services</p>
      </div>

      {/* Status Banner */}
      <div style={styles.statusBanner}>
        <div style={styles.statusDot} />
        <span style={styles.statusText}>All Systems Operational</span>
      </div>

      {/* Core Services */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Core Services</h2>
        <div style={styles.serviceList}>
          {services.map((service) => (
            <div key={service.name} style={styles.serviceItem}>
              <div style={styles.serviceLeft}>
                <div style={{ ...styles.serviceIcon, background: "var(--accent-dim)" }}>
                  {service.icon}
                </div>
                <div>
                  <div style={styles.serviceName}>{service.name}</div>
                  <div style={styles.serviceDesc}>{service.desc}</div>
                </div>
              </div>
              <div style={styles.serviceStatus}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--ok)" }} />
                {service.status}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Provider Latency */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Provider Latency</h2>
        <div style={styles.providerGrid}>
          {providers.map((provider) => (
            <div key={provider.name} style={styles.providerCard}>
              <div style={styles.providerHeader}>
                <span style={styles.providerName}>{provider.name}</span>
                <span style={styles.providerLatency}>{provider.latency}</span>
              </div>
              <div style={styles.latencyBar}>
                <div style={{ ...styles.latencyFill, width: `${provider.percent}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Uptime Chart */}
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>90-Day Uptime: 99.8%</h2>
        <div style={styles.uptimeGrid}>
          {uptimeData.map((up, i) => (
            <div
              key={i}
              style={{
                ...styles.uptimeDay,
                background: up ? "var(--ok)" : "var(--bad)",
              }}
            />
          ))}
        </div>
        <div style={styles.uptimeLegend}>
          <span>90 days ago</span>
          <span>Today</span>
        </div>
      </div>
    </div>
  );
}
