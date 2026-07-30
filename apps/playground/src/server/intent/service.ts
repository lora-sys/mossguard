import { randomUUID } from "node:crypto";
import { getAddress } from "viem";
import { type ConfirmedIntent, type Intent, intentSchema } from "../../types/domain";
import { digest, signClaims, verifyClaims } from "../crypto";

export type ConfirmationClaims = {
  intentId: string;
  intentHash: string;
  chainId: 143;
  version: 1;
  issuedAt: number;
  expiresAt: number;
};

export function normalizeIntent(input: Intent): Intent {
  const intent = intentSchema.parse(input);
  if (intent.operation === "transfer")
    return {
      ...intent,
      ...(intent.sender ? { sender: getAddress(intent.sender) } : {}),
      asset:
        intent.asset.type === "erc20"
          ? { ...intent.asset, token: getAddress(intent.asset.token) }
          : intent.asset,
      recipient: { ...intent.recipient, address: getAddress(intent.recipient.address) },
    };
  if (intent.operation === "approval")
    return {
      ...intent,
      ...(intent.owner ? { owner: getAddress(intent.owner) } : {}),
      token: { ...intent.token, address: getAddress(intent.token.address) },
      spender: { ...intent.spender, address: getAddress(intent.spender.address) },
    };
  return {
    ...intent,
    ...(intent.sender ? { sender: getAddress(intent.sender) } : {}),
    tokenIn:
      intent.tokenIn.token === "native"
        ? intent.tokenIn
        : { ...intent.tokenIn, token: getAddress(intent.tokenIn.token) },
    tokenOut: { ...intent.tokenOut, token: getAddress(intent.tokenOut.token) },
  };
}

export function confirmIntent(input: Intent, secret: string, now = Date.now()) {
  if (secret.length < 16) throw new Error("INTENT_SIGNING_SECRET must be at least 16 characters");
  const normalized = normalizeIntent(input);
  const intentId = randomUUID();
  const intentHash = digest(normalized);
  const confirmedIntent: ConfirmedIntent = {
    ...normalized,
    intentId,
    intentHash,
    confirmedAt: new Date(now).toISOString(),
  };
  const claims: ConfirmationClaims = {
    intentId,
    intentHash,
    chainId: 143,
    version: 1,
    issuedAt: now,
    expiresAt: now + 30 * 60_000,
  };
  return { confirmedIntent, confirmationToken: signClaims(claims, secret) };
}

export function validateConfirmation(
  intent: ConfirmedIntent,
  token: string,
  secret: string,
  now = Date.now(),
) {
  const claims = verifyClaims<ConfirmationClaims>(token, secret);
  if (claims.expiresAt <= now) throw new Error("Confirmation expired");
  if (
    claims.intentId !== intent.intentId ||
    claims.intentHash !== digest(stripConfirmation(intent))
  )
    throw new Error("Confirmation does not match intent");
  return claims;
}

function stripConfirmation({
  intentId: _id,
  intentHash: _hash,
  confirmedAt: _at,
  ...intent
}: ConfirmedIntent): Intent {
  return intent;
}
