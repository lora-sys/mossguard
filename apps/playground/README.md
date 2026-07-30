# MossGuard Playground

MossGuard is an intent-verification layer for onchain AI agents. A user confirms a structured intent, a real language model independently proposes an action, Moss constructs and simulates the unsigned Capability tree on Monad mainnet, and deterministic MossGuard rules compare the intent, action, Capability parameters, unsigned transactions, Receipt Outcomes, and ordered Changes before wallet review.

> **Agent proposes. Evidence decides. Human signs.**

Moss owns `discover → load → action → simulate`, protocol semantics, calldata, and structured Receipt evidence. MossGuard owns confirmation, authenticated intent/action binding, deterministic alignment rules, explicit diffs, and the signer gate. The LLM never decides `VERIFIED`, `BLOCKED`, or `UNAVAILABLE`.

## Real AI, real Moss

The default path calls the configured StepFun/OpenAI-compatible model through `propose_intent`, then—only after a signed confirmation token passes server validation—through independently registered `propose_agent_action`. The server runs the current workspace Moss SDK and Monad `debug_traceCall`. Live failures are shown directly; mocks never silently replace AI or chain state.

The recorded real-Agent examples and adversarial shortcuts are:

1. **Small MON Transfer** — a concrete free-form Agent request for `0.002 MON → 0x1111…1111`, verified through live simulation.
2. **Limited USDC Approval** — permits Kuru Router to spend at most `2.5 USDC`; unlimited approval remains forbidden.
3. **Safe Kuru Swap** — exact-input `1 MON → USDC` with 50 BPS maximum slippage and live Kuru Receipt evidence.
4. **Transfer Drift Attack** — explicitly injects `5 MON → 50 MON` and `Alice → Bob`, then runs Moss live.
5. **Unlimited Approval Attack** — explicitly injects `MAX_UINT256` over a confirmed 10 USDC ceiling, then runs Moss live.

These examples were promoted from real free-form StepFun Agent tests. A `0.01 MON` Kuru attempt was deliberately not recorded as a successful shortcut because current live simulation halted; MossGuard returned `UNAVAILABLE` and withheld wallet review as designed.

If a live dependency fails, a user may explicitly choose a replay. Replays are always labeled `FIXTURE REPLAY — NOT LIVE CHAIN STATE`; they never show a fake transaction hash or fake balance.

## Run locally

Node 22+ and pnpm 11 are required.

```bash
pnpm install
pnpm build
cp apps/playground/.env.example apps/playground/.env
# Fill OPENAI_API_KEY and replace both signing secrets.
pnpm --filter @mossguard/playground dev
```

Open `http://localhost:3000`. A wallet is optional; the simulation account is used when disconnected. Connecting only supplies the execution address and never grants automatic signing.

## Environment

- `AI_PROVIDER`, `AI_MODEL`, `OPENAI_API_KEY`: server-only model configuration. OpenAI-compatible providers are supported through `OPENAI_BASE_URL`; existing StepFun deployments may use `OPEN_BASE_URL` and `OPENAI_MODEL_ID` aliases. `AI_REQUEST_TIMEOUT_MS` defaults to 90 seconds for slower tool calls.
- `MOSS_RPC_URL`: Monad mainnet RPC; Moss verifies chain ID 143.
- `INTENT_SIGNING_SECRET`: HMAC key for 30-minute intent confirmations.
- `WALLET_HANDOFF_SECRET`: HMAC key binding verified review envelopes to evidence digests.
- `ENABLE_WALLET_HANDOFF=false`: default. Even when enabled, a user click is required.
- `MOSS_RAW_EVIDENCE_TTL_MS`, `MOSS_MAX_EVIDENCE_RECORDS`: bounded in-memory evidence cache.

Never expose secrets through `VITE_*` variables.

## Architecture

```text
Browser / TanStack Start
  ├─ conversation + inspector + Zustand state
  ├─ wagmi wallet address (no signing side effects)
  └─ confirmed intent review
               │
               ▼
Server routes
  ├─ OpenAI tools: propose_intent / propose_agent_action
  ├─ SHA-256 canonical hashes + HMAC confirmation
  ├─ Moss Registry: discover → load → action → simulate
  ├─ deterministic transfer / approval / Kuru / integrity rules
  ├─ bounded raw evidence cache
  └─ signer gate: verified only → expiring review envelope
```

The verifier consumes original Moss `CapabilityNode` and `SimulateOutcome`. `Receipt.outcome` and `Receipt.changes` are evidence; `Receipt.text` is display-only. Any Warning, revert, missing Receipt, binding mismatch, or unknown user asset effect returns `UNAVAILABLE` and withholds wallet review.

## Tests

```bash
pnpm build
pnpm lint
pnpm typecheck
pnpm test:offline
```

Live checks remain opt-in through upstream Moss `MOSS_RUN_LIVE_TESTS=true`. Playground tests cover confirmation stability/tampering/expiry, all five scenario contracts, blocked transfer drift, blocked unlimited approval, verified Kuru swap, and fail-closed Warning handling.

## Three-minute demo

Start with the free-form `0.002 MON` transfer, then show the recorded limited 2.5 USDC approval and its concise evidence cards. Run Safe Kuru Swap and show its structured Outcome plus `VERIFIED` review eligibility. Finish with Transfer Drift or Unlimited Approval to demonstrate deterministic blocking.

## Limits and security

This is unaudited hackathon software. Simulation cannot guarantee future execution because chain state can change. Do not use production funds. The MVP supports only native/ERC-20 transfer, ERC-20 approval, and exact-input Kuru swap on Monad mainnet. There is no login, database, history, private-key custody, automatic signature, or transaction broadcast.

Moss is the work of [`nishuzumi/moss`](https://github.com/nishuzumi/moss) and remains the sole source of truth for its APIs and protocol evidence contracts.

## Screenshots and video

Captured demo assets live under `apps/playground/public/`. Record with the script above; the interface fits the complete guarded flow in one desktop view and reflows for tablet/mobile review.
