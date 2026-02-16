// Browser-safe entrypoint for @swappilot/shared.
//
// Do NOT export Node-only modules here (e.g. crypto/dns/ssrfProtection), because
// apps/web imports this package and Next.js may bundle it for the client.
//
// Server-side code should import Node-only helpers from "@swappilot/shared/server".

export * from './schemas';
export * from './format';
