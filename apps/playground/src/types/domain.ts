import { z } from "zod";

export const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/) as z.ZodType<`0x${string}`>;
const chain = z.literal(143);
const nativeAsset = z.object({
  type: z.literal("native"),
  token: z.literal("native"),
  symbol: z.literal("MON"),
  decimals: z.literal(18),
});
const erc20Asset = z.object({
  type: z.literal("erc20"),
  token: addressSchema,
  symbol: z.string().optional(),
  decimals: z.number().int().min(0).max(255),
});

export const intentSchema = z.discriminatedUnion("operation", [
  z.object({
    version: z.literal(1),
    operation: z.literal("transfer"),
    chainId: chain,
    sender: addressSchema.optional(),
    asset: z.union([nativeAsset, erc20Asset]),
    amount: z.string().regex(/^\d+(\.\d+)?$/),
    recipient: z.object({
      label: z.string().optional(),
      address: addressSchema,
      resolutionSource: z.enum(["user-input", "demo-address-book"]),
    }),
  }),
  z.object({
    version: z.literal(1),
    operation: z.literal("approval"),
    chainId: chain,
    owner: addressSchema.optional(),
    token: z.object({
      address: addressSchema,
      symbol: z.string().optional(),
      decimals: z.number().int().min(0).max(255),
    }),
    spender: z.object({
      label: z.string().optional(),
      address: addressSchema,
      resolutionSource: z.enum(["protocol-registry", "user-input"]),
    }),
    maxAmountDisplay: z.string().regex(/^\d+(\.\d+)?$/),
    unlimitedAllowed: z.literal(false),
  }),
  z.object({
    version: z.literal(1),
    operation: z.literal("swap"),
    chainId: chain,
    sender: addressSchema.optional(),
    protocol: z.literal("kuru"),
    tokenIn: z.union([
      z.object({ token: z.literal("native"), symbol: z.literal("MON"), decimals: z.literal(18) }),
      z.object({
        token: addressSchema,
        symbol: z.string().optional(),
        decimals: z.number().int().min(0).max(255),
      }),
    ]),
    tokenOut: z.object({
      token: addressSchema,
      symbol: z.string().optional(),
      decimals: z.number().int().min(0).max(255),
    }),
    amountIn: z.string().regex(/^\d+(\.\d+)?$/),
    maxSlippageBps: z.number().int().min(50).max(5000),
  }),
]);

export type Intent = z.infer<typeof intentSchema>;
export type ConfirmedIntent = Intent & {
  intentId: string;
  intentHash: string;
  confirmedAt: string;
};

export const actionSchema = z.discriminatedUnion("operation", [
  z.object({
    version: z.literal(1),
    operation: z.literal("transfer"),
    chainId: chain,
    sender: addressSchema,
    asset: z.union([
      z.object({ type: z.literal("native"), token: z.literal("native") }),
      z.object({ type: z.literal("erc20"), token: addressSchema }),
    ]),
    amount: z.string(),
    recipient: addressSchema,
  }),
  z.object({
    version: z.literal(1),
    operation: z.literal("approval"),
    chainId: chain,
    owner: addressSchema,
    token: addressSchema,
    spender: addressSchema,
    amountBaseUnits: z.string().regex(/^\d+$/),
  }),
  z.object({
    version: z.literal(1),
    operation: z.literal("swap"),
    chainId: chain,
    sender: addressSchema,
    protocol: z.literal("kuru"),
    tokenIn: z.union([addressSchema, z.literal("native")]),
    tokenOut: addressSchema,
    amountIn: z.string(),
    slippageBps: z.number().int().min(50).max(5000),
  }),
]);

export type AgentAction = z.infer<typeof actionSchema>;
export type ProposedAction = {
  actionId: string;
  actionHash: string;
  status: "proposed";
  action: AgentAction;
  provenance: {
    source: "live-ai" | "scenario-injection";
    provider: string;
    model: string;
    messageId: string;
    toolCallId: string;
    createdAt: string;
    promptVersion?: string;
    runId?: string;
    injectedFields?: string[];
  };
};

export type VerificationCheck = {
  id: string;
  field: string;
  status: "passed" | "failed" | "unavailable";
  expected?: string;
  actual?: string;
  message: string;
};
export type VerificationReport = {
  reportId: string;
  decision: "verified" | "blocked" | "unavailable";
  intentId: string;
  intentHash: string;
  actionId: string;
  actionHash: string;
  chainId: 143;
  executionAccount: `0x${string}`;
  checks: VerificationCheck[];
  violations: VerificationCheck[];
  unavailableReasons: VerificationCheck[];
  evidenceSummary: {
    transactionCount: number;
    receiptCount: number;
    warningCount: number;
    protocols: string[];
  };
  generatedAt: string;
  verifier: {
    name: "MossGuard";
    version: string;
    mossRepository: "nishuzumi/moss";
    mossCommit: string;
  };
};

export type WalletReviewGate =
  | { status: "withheld" }
  | {
      status: "eligible-for-wallet-review";
      envelope: {
        envelopeId: string;
        intentHash: string;
        actionHash: string;
        capabilityDigest: string;
        simulationDigest: string;
        executionAccount: `0x${string}`;
        chainId: 143;
        expiresAt: number;
        signature: string;
        transactions: unknown[];
      };
    };

export type ScenarioId =
  | "safe-mon-transfer"
  | "safe-limited-approval"
  | "transfer-drift"
  | "unlimited-approval"
  | "safe-kuru-swap";
