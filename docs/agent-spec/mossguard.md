# MossGuard Agent Contract

Status: accepted

## Decision 0

MossGuard is an agent because the user supplies a goal in noisy natural language, the model must choose an operation and the Moss tools required to inspect it, and the result is independently verifiable. A run stops after a bounded number of tool calls with `verified`, `blocked`, `unavailable`, or `cancelled`. Risk is bounded because every Moss tool is read-only or simulation-only and no tool can sign or broadcast a transaction.

## Role

The MossGuard Agent translates a confirmed Monad mainnet intent into an unsigned action, autonomously selects Moss inspection and simulation tools, and submits the resulting evidence to deterministic verification.

## Goal

Produce one auditable run containing a confirmed Intent, an unsigned Agent Action, real Moss Capability and simulation evidence, and a deterministic MossGuard decision that controls whether a human may review the transaction in a wallet.

## Non-goals

- Sign, broadcast, or claim ownership of a transaction.
- Declare an action safe from model reasoning or prose.
- Invent Capability, Receipt, Outcome, RPC, token, protocol, or address evidence.
- Reveal private chain-of-thought. Public plans and tool rationale must remain concise and auditable.
- Support chains other than Monad mainnet chain ID 143.

## Inputs

```yaml
intent_prompt: string
response_locale: zh | en
trusted_context: named accounts and supported asset/protocol registry
confirmed_intent: signed Intent version 1
confirmation_token: signed, expiring confirmation claims
execution_account: 0x-prefixed address
scenario_id: optional explicit demo action mutation
```

## Outputs

```yaml
run:
  run_id: uuid
  prompt_version: string
  model: provider/model
  tool_calls: ordered Moss tool traces
  stop_reason: completed | blocked | unavailable | cancelled | budget_exhausted
  latency_ms: number
proposal: unsigned AgentAction with provenance
evidence: discovered, loaded, Capability tree, simulation, Receipt and Outcome
report: deterministic MossGuard VerificationReport
gate: eligible-for-wallet-review | withheld
```

## Tools

### `propose_intent`

- **Description:** Produce a structured Intent draft from explicit user language. Use before confirmation; never use it to build or verify transactions.
- **Inputs:** JSON Intent, concise response, 2–4 public plan steps.
- **Outputs:** Schema-validated Intent draft and provenance.
- **Errors:** `TOOL_ARGUMENT_INVALID`, `TOOL_CALL_MISSING`; retry within the model-call budget, then ask the user to rephrase.

### `propose_agent_action`

- **Description:** Produce one unsigned action from a signed confirmed Intent. Use only after confirmation; never sign, send, or decide safety.
- **Inputs:** JSON AgentAction, concise response, 2–4 public plan steps.
- **Outputs:** Schema-validated action with hash and provenance.
- **Errors:** `CONFIRMATION_INVALID`, `TOOL_ARGUMENT_INVALID`, `TOOL_CALL_MISSING`; fail closed.

### `moss_discover`

- **Description:** Search the real Moss Registry for capabilities matching the proposed action. Use before loading or constructing a Capability. Do not use for unsupported chains or invented protocols.
- **Inputs:** The proposed operation.
- **Outputs:** Serializable discovery matches and a stage artifact summary.
- **Errors:** `MOSS_DISCOVERY_FAILED`; retry once only for transient runtime failures, then stop unavailable.

### `moss_load`

- **Description:** Load the canonical parameter contract for a capability returned by `moss_discover`. Do not call before a successful discovery.
- **Inputs:** Discovered protocol and method coordinate.
- **Outputs:** Serializable loaded contract and risk/parameter summary.
- **Errors:** `MOSS_LOAD_FAILED`, `TOOL_PRECONDITION_FAILED`; stop unavailable.

### `moss_action`

- **Description:** Build an unsigned Moss Capability tree from the confirmed action and a loaded contract. It cannot sign or broadcast.
- **Inputs:** The proposed action held by the harness.
- **Outputs:** Capability tree, unsigned transaction summaries, and digest.
- **Errors:** `MOSS_ACTION_FAILED`, `TOOL_PRECONDITION_FAILED`; stop unavailable.

### `moss_simulate`

- **Description:** Simulate the previously built Capability against live Monad mainnet state and produce raw Receipt/Outcome evidence. Do not call without a real Capability.
- **Inputs:** Capability held by the harness.
- **Outputs:** Gas, warnings, changes, Receipt, Outcome, and digest.
- **Errors:** `MOSS_SIMULATION_FAILED`, `TOOL_PRECONDITION_FAILED`; stop unavailable and never substitute a fixture.

### `submit_for_verification`

- **Description:** End the Agent tool loop and submit accumulated real evidence to deterministic MossGuard. This tool cannot override the verifier.
- **Inputs:** No model-authored evidence; the harness supplies the confirmed Intent, action, Capability, and simulation.
- **Outputs:** `verified`, `blocked`, or `unavailable`; wallet gate remains outside model control.
- **Errors:** `EVIDENCE_INCOMPLETE`; stop unavailable.

## Constraints

- Maximum eight post-confirmation tool calls and two calls per Moss tool.
- Tool order is constrained by typed preconditions while selection remains model-driven.
- Only scenario fixtures may mutate an Agent Action, and mutation must be explicit in provenance before Moss runs.
- Every run records model, prompt version, ordered tool calls, latency, attempts, stop reason, errors, and evidence digests.
- Inputs are hashed or redacted in durable records; raw secrets and authorization headers are never persisted.
- The wallet gate is deterministic and only `verified` can become eligible for human review.

## Stop condition

The Agent stops when it calls `submit_for_verification`, a required tool fails closed, the user cancels, or the eight-call budget is exhausted. Signing and broadcasting are separate human actions and are never part of the Agent loop.

## Harness Contract

### State

- Short-term: confirmed Intent, unsigned action, current tool plan, Moss artifacts, current call budget.
- Durable: typed `AgentRun` record keyed by `runId` and optionally `reportId`.
- The UI chat transcript is presentation state, not long-term memory.

### Memory

- Persist prompt/model provenance, evidence digests, tool traces, decision, stop reason, and metrics.
- Do not persist unrestricted chat history or private model reasoning.
- Runs expire under an explicit retention policy; evidence and run records share the report lookup key.

### Evaluation

- Per task: schema validation plus deterministic Intent ↔ Action ↔ Capability ↔ Outcome verification.
- Per capability: fixture corpus measures parse accuracy, action correctness, tool sequence validity, block/unavailable behavior, retries, and top structured errors.
- CI uses deterministic provider fixtures; opt-in live StepFun/Monad E2E validates integration without becoming a flaky merge gate.

### Observability

Each run records redacted input hash, final output/decision, ordered tool calls with latency and status, stop reason, attempts, total latency, provider/model, prompt version, and structured errors. Token usage is recorded when the provider supplies it.

### Failure handling

- Provider timeout/rate limit/5xx: bounded retry with structured error.
- Invalid or missing tool call: one repair opportunity, then fail closed.
- Moss precondition or evidence failure: no fixture fallback; stop `unavailable`.
- Warning, revert, missing Receipt, or unknown asset effect: deterministic verifier withholds the wallet gate.

### Human approval

The user confirms Intent before action generation. After a verified run, the wallet receives only a signed review envelope. The Agent, Moss, and MossGuard never sign or broadcast.
