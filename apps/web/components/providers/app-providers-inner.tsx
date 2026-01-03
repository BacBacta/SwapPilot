"use client";

import { type ReactNode, useState, useEffect } from "react";
import { ToastProvider } from "@/components/ui/toast";
import { Web3Provider } from "@/components/providers/web3-provider";

interface AppProvidersInnerProps {
  children: ReactNode;
}

export function AppProvidersInner({ children }: AppProvidersInnerProps) {
  return (
    <Web3Provider>
      <ToastProvider>
        {children}
      </ToastProvider>
    </Web3Provider>
  );
}
