# MossGuard Agent takeover implementation brief

## Finding

The current application has a strong deterministic safety harness, but Moss runs as a fixed server workflow after the model has finished. Its `propose_intent` and `propose_agent_action` calls are structured output tools rather than an autonomous Moss tool loop. Evidence is cached in process memory and runs do not capture prompt version, ordered tool latency, stop reason, token use, or structured failure codes.

## Required change

1. Give the post-confirmation Agent a least-privilege Moss tool set: discover, load, build unsigned Capability, simulate, and submit for deterministic verification.
2. Keep tool selection model-driven while enforcing state-machine preconditions, per-tool limits, a total call budget, and fail-closed behavior in the harness.
3. Persist a typed, redacted `AgentRun`; version prompts and tool contracts.
4. Add deterministic semantic eval cases and expose the real ordered tool trace in the existing Agent → Moss → MossGuard UI.
5. Preserve user confirmation before action generation and human-only wallet signing after verification.

## Acceptance criteria

- A live StepFun run chooses and calls Moss tools rather than the API unconditionally invoking a hidden fixed pipeline.
- Each Moss UI stage corresponds to a completed real SDK tool execution.
- Tool calls cannot skip prerequisites, exceed the budget, sign, or broadcast.
- Limited 10 USDC approval verifies; injected unlimited approval blocks after real Moss simulation.
- Kuru swap discovers, loads, constructs, and simulates the Kuru capability.
- RPC/revert/missing-evidence paths stop unavailable with Wallet Withheld.
- Refresh can retrieve typed run metadata and evidence within the configured retention window.
- Prompt version and ordered tool traces are visible in provenance.
- Lint, build, typecheck, unit/integration tests, and browser E2E pass.
