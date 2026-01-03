"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

// Loading component
function LoadingScreen() {
  return (
    <div style={{ minHeight: "100vh", background: "#050505", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", color: "#fff" }}>
        <div style={{ 
          width: 48, 
          height: 48, 
          borderRadius: 12, 
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center", 
          margin: "0 auto 16px", 
          fontWeight: 700, 
          fontSize: 18 
        }}>
          SP
        </div>
        <div style={{ opacity: 0.7 }}>Loading...</div>
      </div>
    </div>
  );
}

// Dynamic import with SSR disabled - allowed in client components
const ClientLayoutInner = dynamic(
  () => import("@/components/providers/client-layout").then((mod) => mod.ClientLayout),
  { 
    ssr: false,
    loading: LoadingScreen
  }
);

interface ClientLayoutWrapperProps {
  children: ReactNode;
}

export function ClientLayoutWrapper({ children }: ClientLayoutWrapperProps) {
  return <ClientLayoutInner>{children}</ClientLayoutInner>;
}
