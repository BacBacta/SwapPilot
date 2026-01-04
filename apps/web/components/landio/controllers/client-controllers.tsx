"use client";

import dynamic from "next/dynamic";

export const DynamicSwapController = dynamic(
  () => import("./landio-swap-controller").then((m) => m.LandioSwapController),
  { ssr: false }
);

export const DynamicRewardsController = dynamic(
  () => import("./landio-rewards-controller").then((m) => m.LandioRewardsController),
  { ssr: false }
);

export const DynamicSettingsController = dynamic(
  () => import("./landio-settings-controller").then((m) => m.LandioSettingsController),
  { ssr: false }
);

export const DynamicStatusController = dynamic(
  () => import("./landio-status-controller").then((m) => m.LandioStatusController),
  { ssr: false }
);

export const DynamicHomeController = dynamic(
  () => import("./landio-home-controller").then((m) => m.LandioHomeController),
  { ssr: false }
);
