"use client";

import { useEffect } from "react";
import { initFrontendLogger } from "@/lib/frontend-logger";

/**
 * Mounts the SwapPilot frontend logger once on the client.
 * Captures JS errors, unhandled rejections, console.error/warn, and fetch failures.
 * Access logs from the browser console: window.__SP_DUMP_ERRORS__()
 */
export function FrontendLoggerProvider() {
  useEffect(() => {
    initFrontendLogger();
  }, []);

  return null;
}
