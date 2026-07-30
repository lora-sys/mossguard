const developmentSecrets = {
  INTENT_SIGNING_SECRET: "mossguard-local-intent-signing-only",
  WALLET_HANDOFF_SECRET: "mossguard-local-wallet-review-only",
} as const;

export function getServerSecret(name: keyof typeof developmentSecrets) {
  const configured = process.env[name];
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") throw new Error(`${name} is not configured`);
  return developmentSecrets[name];
}
