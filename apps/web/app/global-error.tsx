"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to Sentry
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "2rem",
            fontFamily: "system-ui, sans-serif",
            backgroundColor: "#0a0a0b",
            color: "#ffffff",
          }}
        >
          <div
            style={{
              maxWidth: "400px",
              textAlign: "center",
            }}
          >
            <h1
              style={{
                fontSize: "1.5rem",
                fontWeight: "600",
                marginBottom: "1rem",
              }}
            >
              Something went wrong
            </h1>
            <p
              style={{
                color: "#a1a1aa",
                marginBottom: "1.5rem",
                fontSize: "0.875rem",
              }}
            >
              An unexpected error occurred. Our team has been notified.
            </p>
            <button
              onClick={() => reset()}
              style={{
                backgroundColor: "#3b82f6",
                color: "#ffffff",
                padding: "0.75rem 1.5rem",
                borderRadius: "0.5rem",
                border: "none",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: "500",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
