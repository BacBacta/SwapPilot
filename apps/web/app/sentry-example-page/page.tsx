"use client";

import * as Sentry from "@sentry/nextjs";

export default function SentryExamplePage() {
  return (
    <div style={{ 
      minHeight: "100vh", 
      display: "flex", 
      flexDirection: "column",
      alignItems: "center", 
      justifyContent: "center",
      gap: "20px",
      background: "#050505",
      color: "#fff"
    }}>
      <h1>Sentry Test Page</h1>
      <p>Click the button to trigger a test error</p>
      <button
        onClick={() => {
          throw new Error("Sentry Frontend Test Error!");
        }}
        style={{
          padding: "12px 24px",
          fontSize: "16px",
          background: "#7c3aed",
          color: "white",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer"
        }}
      >
        Throw Test Error
      </button>
    </div>
  );
}
