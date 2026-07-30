import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { useAccount } from "wagmi";
import { usePlayground } from "../../stores/playground-store";
import type {
  ConfirmedIntent,
  Intent,
  ProposedAction,
  ScenarioId,
  VerificationReport,
  WalletReviewGate,
} from "../../types/domain";
import { WalletButton } from "./wallet";

const DEMO_ACCOUNT = "0xcccccccccccccccccccccccccccccccccccccccc";
type Locale = "zh" | "en";
const copy = {
  zh: {
    playground: "演示台",
    demoCases: "演示案例",
    liveExamples: "真实输入示例",
    liveAgent: "实时智能体",
    liveAgentSub: "输入真实意图，由 AI 生成并验证",
    safeTransfer: "小额 MON 转账",
    safeTransferSub: "0.002 MON → 0x1111…1111",
    safeApproval: "限额 USDC 授权",
    safeApprovalSub: "Kuru 最多使用 2.5 USDC",
    transferDrift: "转账漂移",
    transferDriftSub: "收款地址与金额攻击",
    unlimited: "无限授权",
    unlimitedSub: "MAX_UINT256 攻击",
    safeSwap: "安全 Kuru 兑换",
    safeSwapSub: "1 MON → USDC · 滑点 0.5%",
    manifesto: "智能体提案。证据来裁决。人类来签名。",
    builtOn: "基于 MOSS 构建",
    guarded: "受保护执行",
    live: "实时",
    scenario: "案例",
    fixture: "夹具",
    livePipeline: "实时流程",
    fault: "故障注入",
    fixtureReplay: "夹具回放 · 非实时链状态",
    title: "链上智能体演示台",
    placeholder: "描述你的链上意图…",
    hint: "试试“发送 1 MON 到 0x…”或“在 Kuru 将 1 MON 兑换为 USDC，最大滑点 0.5%”",
    inspector: "执行检查器",
    intent: "意图",
    action: "操作",
    moss: "Moss",
    diff: "差异",
    evidence: "证据",
    status: "状态",
    deterministic: "确定性验证",
    deterministicSub: "基于规则核对意图、能力与执行结果",
    mossBuilt: "基于 Moss 构建",
    mossBuiltSub: "仅构建并实时模拟，绝不签名",
    control: "用户掌控",
    controlSub: "你确认意图，你完成签名。",
    draft: "意图草案",
    requires: "需要确认",
    confirm: "✓ 确认意图",
    edit: "编辑会使后续结果失效",
    available: "可用",
    pending: "等待中",
    confirmed: "已确认意图",
    agentAction: "智能体操作",
    capability: "能力树",
    simulation: "模拟结果",
    structured: "结构化证据",
    verified: "已验证",
    verifiedBody: "已与确认意图核验一致。\n可进入钱包复核。",
    blocked: "已阻止",
    unavailable: "证据不可用，钱包交接已阻止。",
    field: "字段",
    expected: "预期",
    actual: "实际",
    operation: "操作",
    asset: "资产",
    amount: "金额",
    recipient: "收款方",
    address: "地址",
    token: "代币",
    maximum: "最大额度",
    spender: "授权对象",
    unlimitedAllowed: "无限授权",
    notAllowed: "不允许",
    tokenIn: "输入代币",
    tokenOut: "输出代币",
    amountIn: "输入金额",
    slippage: "最大滑点",
    noEvidence: "受保护流程推进后，证据将显示在这里。",
    replay: "回放明确标注的夹具",
    serviceUnavailable: "实时服务不可用",
    noMock: "未使用模拟结果替代。",
    emptyTitle: "陈述你的意图。\n签名权始终由人掌控。",
    emptyBody: "真实 AI 提案，Moss 模拟，确定性规则决定交易是否可以进入钱包复核。",
    watchAttack: "观看攻击演示",
    flowIntent: "确认意图",
    flowAction: "独立提案",
    flowMoss: "实时模拟",
    flowVerify: "证据核验",
    flowSign: "人类签名",
  },
  en: {
    playground: "PLAYGROUND",
    demoCases: "DEMO CASES",
    liveExamples: "LIVE EXAMPLES",
    liveAgent: "Live Agent",
    liveAgentSub: "Free-form verified flow",
    safeTransfer: "Small MON Transfer",
    safeTransferSub: "0.002 MON → 0x1111…1111",
    safeApproval: "Limited USDC Approval",
    safeApprovalSub: "Kuru may spend at most 2.5 USDC",
    transferDrift: "Transfer Drift",
    transferDriftSub: "Recipient + amount attack",
    unlimited: "Unlimited Approval",
    unlimitedSub: "MAX_UINT256 attack",
    safeSwap: "Safe Kuru Swap",
    safeSwapSub: "1 MON → USDC · Slippage 0.5%",
    manifesto: "Agent proposes. Evidence decides. Human signs.",
    builtOn: "BUILT ON MOSS",
    guarded: "GUARDED EXECUTION",
    live: "LIVE",
    scenario: "SCENARIO",
    fixture: "FIXTURE",
    livePipeline: "LIVE PIPELINE",
    fault: "FAULT INJECTION",
    fixtureReplay: "FIXTURE REPLAY · NOT LIVE CHAIN STATE",
    title: "Onchain Agent Playground",
    placeholder: "Describe your onchain intent…",
    hint: "Try “Send 1 MON to 0x…” or “Swap 1 MON to USDC on Kuru with max 0.5% slippage”",
    inspector: "EXECUTION INSPECTOR",
    intent: "intent",
    action: "action",
    moss: "moss",
    diff: "diff",
    evidence: "evidence",
    status: "status",
    deterministic: "Deterministic verification",
    deterministicSub: "Rule-based checks on intent, capability and outcomes",
    mossBuilt: "Built on Moss",
    mossBuiltSub: "Construction and live simulation, never signing",
    control: "User in control",
    controlSub: "You confirm intent. You sign.",
    draft: "DRAFT INTENT",
    requires: "REQUIRES CONFIRMATION",
    confirm: "✓ Confirm intent",
    edit: "Edit invalidates downstream",
    available: "AVAILABLE",
    pending: "PENDING",
    confirmed: "CONFIRMED INTENT",
    agentAction: "AGENT ACTION",
    capability: "CAPABILITY TREE",
    simulation: "SIMULATION OUTCOME",
    structured: "STRUCTURED EVIDENCE",
    verified: "VERIFIED",
    verifiedBody: "Verified against confirmed intent.\nEligible for wallet review.",
    blocked: "BLOCKED",
    unavailable: "Evidence unavailable. Wallet withheld.",
    field: "FIELD",
    expected: "EXPECTED",
    actual: "ACTUAL",
    operation: "Operation",
    asset: "Asset",
    amount: "Amount",
    recipient: "Recipient",
    address: "Address",
    token: "Token",
    maximum: "Maximum",
    spender: "Spender",
    unlimitedAllowed: "Unlimited",
    notAllowed: "Not allowed",
    tokenIn: "Token in",
    tokenOut: "Token out",
    amountIn: "Amount in",
    slippage: "Max slippage",
    noEvidence: "Evidence will appear here as the guarded flow advances.",
    replay: "Replay clearly labeled fixture",
    serviceUnavailable: "LIVE SERVICE UNAVAILABLE",
    noMock: "No mock result was substituted.",
    emptyTitle: "State your intent.\nKeep the signing boundary human.",
    emptyBody:
      "Real AI proposes. Moss simulates. Deterministic rules decide whether a transaction reaches wallet review.",
    watchAttack: "Watch attack demo",
    flowIntent: "Confirm intent",
    flowAction: "Independent action",
    flowMoss: "Live simulation",
    flowVerify: "Verify evidence",
    flowSign: "Human signs",
  },
} as const;
const cases: Array<{ id?: ScenarioId; badge: "LIVE" | "FAULT" }> = [
  { badge: "LIVE" },
  {
    id: "transfer-drift",
    badge: "FAULT",
  },
  {
    id: "unlimited-approval",
    badge: "FAULT",
  },
  { id: "safe-kuru-swap", badge: "LIVE" },
];

const livePrompts = {
  transfer: "Send 0.002 MON to 0x1111111111111111111111111111111111111111.",
  approval: "Approve the Kuru Router to spend at most 2.5 USDC.",
} as const;

function isFaultScenario(id?: ScenarioId) {
  return id === "transfer-drift" || id === "unlimited-approval";
}

export function MossGuardApp() {
  const store = usePlayground();
  const wallet = useAccount();
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [locale, setLocale] = useState<Locale>("zh");
  const t = copy[locale];
  useEffect(() => {
    const saved = localStorage.getItem("mossguard-locale");
    if (saved === "en") setLocale("en");
  }, []);
  function changeLocale(next: Locale) {
    setLocale(next);
    localStorage.setItem("mossguard-locale", next);
    document.documentElement.lang = next === "zh" ? "zh-CN" : "en";
  }
  const executionAccount = wallet.address ?? DEMO_ACCOUNT;

  async function selectScenario(id?: ScenarioId) {
    store.reset(id);
    if (!id) return;
    const scenarios = await fetch("/api/scenarios").then((response) => response.json());
    const scenario = scenarios[id];
    setPrompt(scenario.prompt);
    await proposeIntent(scenario.prompt, scenario.intent);
  }

  async function proposeIntent(text: string, trusted?: Intent) {
    setBusy(true);
    store.set({ aiStatus: "connecting", executionStage: "ai-parsing-intent", error: undefined });
    store.addMessage({ role: "USER", text });
    try {
      const response = await fetch("/api/propose", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phase: "intent",
          prompt: text,
          context: trusted ? { trustedScenarioIntent: trusted } : { executionAccount },
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail ?? data.error);
      store.set({
        draftIntent: data.intent,
        aiStatus: "connected",
        executionStage: "draft-intent",
        activeInspectorTab: "intent",
      });
      store.addMessage({
        role: "AGENT",
        text: "I structured your request as a draft intent. Review every field before confirming.",
      });
    } catch (error) {
      store.set({
        aiStatus: "unavailable",
        executionStage: "unavailable",
        activeInspectorTab: "status",
        error: error instanceof Error ? error.message : String(error),
      });
      store.addMessage({
        role: "AGENT",
        text: "Live AI request failed. No mock response was substituted.",
        tone: "danger",
      });
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!store.draftIntent) return;
    setBusy(true);
    try {
      const confirmed = await post("/api/confirm", store.draftIntent);
      store.set({ ...confirmed, executionStage: "confirmed-intent", activeInspectorTab: "action" });
      store.addMessage({
        role: "USER",
        text: "Intent confirmed. The authorization boundary is now signed.",
      });
      const proposed = await post("/api/propose", {
        phase: "action",
        confirmedIntent: confirmed.confirmedIntent,
        confirmationToken: confirmed.confirmationToken,
        executionAccount,
      });
      store.set({
        proposedAction: proposed.action,
        executionStage: "action-proposed",
        activeInspectorTab: "action",
      });
      store.addMessage({
        role: "AGENT",
        text: "I independently proposed a concrete action. MossGuard will not trust my self-assessment.",
      });
      await execute(confirmed.confirmedIntent, confirmed.confirmationToken, proposed.action);
    } catch (error) {
      store.set({
        error: error instanceof Error ? error.message : String(error),
        aiStatus: "unavailable",
      });
    } finally {
      setBusy(false);
    }
  }

  async function execute(
    confirmedIntent: unknown,
    confirmationToken: string,
    proposedAction: unknown,
  ) {
    store.set({ mossStatus: "connecting", executionStage: "moss-simulate" });
    store.addMessage({
      role: "MOSS",
      text: "Discovering capability → loading contract → building unsigned transaction → simulating on Monad.",
    });
    try {
      const result = await post("/api/execute", {
        confirmedIntent,
        confirmationToken,
        proposedAction,
        executionAccount,
        scenarioId: store.scenarioId,
      });
      store.set({
        proposedAction: result.proposedAction,
        capability: result.capability,
        simulation: result.simulation,
        verification: result.report,
        gate: result.gate,
        injection: result.injection,
        stages: result.stages,
        mossStatus: "connected",
        executionStage: result.report.decision,
        activeInspectorTab: result.report.decision === "unavailable" ? "status" : "evidence",
      });
      store.addMessage({
        role: "MOSSGUARD",
        text:
          result.report.decision === "verified"
            ? "Verified against confirmed intent. Eligible for wallet review."
            : result.report.decision === "blocked"
              ? `Transaction withheld. ${result.report.violations.length} deterministic mismatch${result.report.violations.length === 1 ? "" : "es"} detected.`
              : "MossGuard could not obtain enough verified evidence. No wallet handoff is available.",
        tone:
          result.report.decision === "verified"
            ? "success"
            : result.report.decision === "blocked"
              ? "danger"
              : "info",
      });
    } catch (error) {
      store.set({
        mossStatus: "unavailable",
        error: error instanceof Error ? error.message : String(error),
        executionStage: "unavailable",
        activeInspectorTab: "status",
      });
      store.addMessage({
        role: "MOSS",
        text: "Live Moss simulation did not complete. No mock result was substituted.",
        tone: "danger",
      });
    }
  }

  return (
    <div className="app-shell">
      <header>
        <Brand locale={locale} />
        <div className="header-meta">
          <fieldset className="language-switch" aria-label="语言 / Language">
            <button
              className={locale === "zh" ? "active" : ""}
              onClick={() => changeLocale("zh")}
              type="button"
            >
              中
            </button>
            <button
              className={locale === "en" ? "active" : ""}
              onClick={() => changeLocale("en")}
              type="button"
            >
              EN
            </button>
          </fieldset>
          <span className="network">
            <b>◆</b> Monad Mainnet <small>143</small>
          </span>
          <StatusDot label="AI" state={store.aiStatus} locale={locale} />
          <StatusDot label="Moss" state={store.mossStatus} locale={locale} />
          <WalletButton locale={locale} />
        </div>
      </header>
      <aside className="rail">
        <div className="rail-title">{t.playground}</div>
        <p className="eyebrow">{t.demoCases}</p>
        {cases.map((item, index) => (
          <button
            type="button"
            key={item.id ?? "live-agent"}
            className={`case ${store.scenarioId === item.id && (item.id || store.mode === "live") ? "active" : ""}`}
            onClick={() => selectScenario(item.id)}
          >
            <span className="case-glyph">◇</span>
            <span>
              <strong>{[t.liveAgent, t.transferDrift, t.unlimited, t.safeSwap][index]}</strong>
              <small>
                {[t.liveAgentSub, t.transferDriftSub, t.unlimitedSub, t.safeSwapSub][index]}
              </small>
            </span>
            <em className={item.badge === "FAULT" ? "fault" : "live"}>
              {locale === "zh" ? (item.badge === "FAULT" ? "攻击" : "实时") : item.badge}
            </em>
          </button>
        ))}
        <p className="eyebrow live-examples-title">{t.liveExamples}</p>
        <div className="live-examples">
          <button type="button" onClick={() => setPrompt(livePrompts.transfer)}>
            {t.safeTransfer}
            <small>{t.safeTransferSub}</small>
          </button>
          <button type="button" onClick={() => setPrompt(livePrompts.approval)}>
            {t.safeApproval}
            <small>{t.safeApprovalSub}</small>
          </button>
        </div>
        <div className="manifesto">
          {t.manifesto}
          <span>
            {t.builtOn} <b>⬡</b>
          </span>
        </div>
      </aside>
      <main className="conversation">
        <div className="section-head">
          <div>
            <p className="eyebrow">
              {t.guarded} /{" "}
              {store.mode === "live" ? t.live : store.mode === "scenario" ? t.scenario : t.fixture}
            </p>
            <h1>
              {store.scenarioId
                ? store.scenarioId === "safe-mon-transfer"
                  ? t.safeTransfer
                  : store.scenarioId === "safe-limited-approval"
                    ? t.safeApproval
                    : store.scenarioId === "transfer-drift"
                      ? t.transferDrift
                      : store.scenarioId === "unlimited-approval"
                        ? t.unlimited
                        : t.safeSwap
                : t.title}
            </h1>
          </div>
          {(store.scenarioId || store.mode === "fixture") && (
            <span className={isFaultScenario(store.scenarioId) ? "mode fault" : "mode live"}>
              {store.mode === "fixture"
                ? t.fixtureReplay
                : isFaultScenario(store.scenarioId)
                  ? t.fault
                  : t.livePipeline}
            </span>
          )}
        </div>
        <DataProvenance locale={locale} />
        <div className="thread">
          {store.messages.length === 0 && (
            <Empty locale={locale} onDemo={() => selectScenario("transfer-drift")} />
          )}
          {store.messages.map((message, index) => (
            <article className={`message ${message.tone ?? ""}`} key={message.id}>
              <div className="avatar">
                {message.role === "USER"
                  ? "○"
                  : message.role === "AGENT"
                    ? "⌁"
                    : message.role === "MOSS"
                      ? "⬡"
                      : "◇"}
              </div>
              <div>
                <span>
                  {message.role} <time>0{index + 1}</time>
                </span>
                <p>{localizeMessage(message.text, locale)}</p>
              </div>
            </article>
          ))}
          {store.draftIntent && !store.confirmedIntent && (
            <IntentCard
              intent={store.draftIntent}
              locale={locale}
              busy={busy}
              onChange={(intent) => store.invalidateAfterIntentEdit(intent)}
              onConfirm={confirm}
            />
          )}
          {store.injection.length > 0 && (
            <div className="injection">
              <b>{t.fault}</b>
              <span>
                {locale === "zh" ? "演示中已修改智能体操作" : "Agent Action Modified for Demo"}
              </span>
              <small>
                {locale === "zh" ? "修改字段" : "Modified fields"}: {store.injection.join(", ")}
              </small>
            </div>
          )}{" "}
          {store.stages.length > 0 && <Timeline stages={store.stages} locale={locale} />}
        </div>
        <form
          className="composer"
          onSubmit={(event) => {
            event.preventDefault();
            if (prompt.trim()) proposeIntent(prompt.trim());
          }}
        >
          <textarea
            aria-label={locale === "zh" ? "描述你的链上意图" : "Describe your onchain intent"}
            autoComplete="off"
            name="onchain-intent"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={t.placeholder}
          />
          <button
            aria-label={locale === "zh" ? "提交链上意图" : "Submit onchain intent"}
            disabled={busy || !prompt.trim()}
            type="submit"
          >
            {busy ? "…" : "↗"}
          </button>
          <small>{t.hint}</small>
        </form>
      </main>
      <Inspector locale={locale} />
      <footer>
        <b>◇ {t.deterministic}</b>
        <span>{t.deterministicSub}</span>
        <b>⬡ {t.mossBuilt}</b>
        <span>{t.mossBuiltSub}</span>
        <b>○ {t.control}</b>
        <span>{t.controlSub}</span>
      </footer>
    </div>
  );
}

async function post(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail ?? data.error);
  return data;
}
function Brand({ locale }: { locale: Locale }) {
  return (
    <div className="brand">
      <span>◇</span>
      <div>
        <b>MossGuard</b>
        <small>
          {locale === "zh" ? "Monad AI 智能体信任层" : "AI Agent Trust Layer for Monad"}
        </small>
      </div>
    </div>
  );
}
function StatusDot({ label, state, locale }: { label: string; state: string; locale: Locale }) {
  const localized = localizeStage(state, locale);
  return (
    <span className={`service ${state}`}>
      <i />
      {label}: {localized}
    </span>
  );
}
function Empty({ locale, onDemo }: { locale: Locale; onDemo: () => void }) {
  const t = copy[locale];
  const [first, second] = t.emptyTitle.split("\n");
  const steps = [t.flowIntent, t.flowAction, t.flowMoss, t.flowVerify, t.flowSign];
  return (
    <div className="empty">
      <span aria-hidden="true">◇</span>
      <h2>
        {first}
        <br />
        {second}
      </h2>
      <p>{t.emptyBody}</p>
      <ol className="trust-flow" aria-label={locale === "zh" ? "受保护执行流程" : "Guarded flow"}>
        {steps.map((step, index) => (
          <li key={step}>
            <i>{index + 1}</i>
            <b>{step}</b>
          </li>
        ))}
      </ol>
      <button className="watch-demo" type="button" onClick={onDemo}>
        <span aria-hidden="true">▶</span> {t.watchAttack}
      </button>
    </div>
  );
}
function IntentCard({
  intent,
  locale,
  busy,
  onChange,
  onConfirm,
}: {
  intent: Intent;
  locale: Locale;
  busy: boolean;
  onChange: (intent: Intent) => void;
  onConfirm: () => void;
}) {
  const t = copy[locale];
  const values =
    intent.operation === "transfer"
      ? [
          [t.operation, locale === "zh" ? "转账" : "Transfer"],
          [t.asset, intent.asset.symbol ?? intent.asset.token],
          [t.amount, intent.amount],
          [t.recipient, intent.recipient.label ?? intent.recipient.address],
          [t.address, intent.recipient.address],
        ]
      : intent.operation === "approval"
        ? [
            [t.operation, locale === "zh" ? "授权" : "Approval"],
            [t.token, intent.token.symbol ?? intent.token.address],
            [t.maximum, intent.maxAmountDisplay],
            [t.spender, intent.spender.label ?? intent.spender.address],
            [t.unlimitedAllowed, t.notAllowed],
          ]
        : [
            [t.operation, locale === "zh" ? "Kuru 兑换" : "Kuru Swap"],
            [t.tokenIn, intent.tokenIn.symbol ?? intent.tokenIn.token],
            [t.tokenOut, intent.tokenOut.symbol ?? intent.tokenOut.token],
            [t.amountIn, intent.amountIn],
            [t.slippage, `${intent.maxSlippageBps} BPS`],
          ];
  return (
    <section className="intent-card">
      <header>
        <b>{t.draft}</b>
        <span>{t.requires}</span>
      </header>
      {values.map(([key, value]) => (
        <div className="kv" key={key}>
          <span>{key}</span>
          <strong>{value}</strong>
        </div>
      ))}
      <div className="intent-actions">
        <button type="button" onClick={() => onChange(intent)}>
          {t.edit}
        </button>
        <button type="button" disabled={busy} onClick={onConfirm}>
          {t.confirm}
        </button>
      </div>
    </section>
  );
}
function Timeline({
  stages,
  locale,
}: {
  stages: Array<{ stage: string; summary: string }>;
  locale: Locale;
}) {
  const names: Record<string, string> = {
    discover: "发现",
    load: "加载",
    action: "构建",
    simulate: "模拟",
    normalize: "规范化",
  };
  const summaries: Record<string, string> = {
    "Loaded canonical parameter contract": "已加载标准参数契约",
    "Built unsigned Capability tree": "已构建未签名能力树",
    "Simulated against Monad mainnet": "已在 Monad 主网完成模拟",
    "Retained raw structured evidence": "已保留原始结构化证据",
  };
  return (
    <div className="timeline">
      {stages.map((stage) => (
        <div key={stage.stage}>
          <i>✓</i>
          <b>{locale === "zh" ? (names[stage.stage] ?? stage.stage) : stage.stage}</b>
          <small>
            {locale === "zh"
              ? (summaries[stage.summary] ?? stage.summary.replace("Found ", "已发现 "))
              : stage.summary}
          </small>
        </div>
      ))}
    </div>
  );
}

function DataProvenance({ locale }: { locale: Locale }) {
  const store = usePlayground();
  const isFixture = store.mode === "fixture";
  const items = [
    ["STEPFUN AI", isFixture ? "REPLAY" : store.aiStatus === "connected" ? "LIVE" : "READY"],
    ["MONAD STATE", isFixture ? "FIXTURE" : store.mossStatus === "connected" ? "LIVE" : "READY"],
    ["MOSS SIMULATION", isFixture ? "REPLAY" : store.simulation ? "LIVE" : "READY"],
    [
      locale === "zh" ? "操作变更" : "ACTION MUTATION",
      store.injection.length ? "DEMO INJECTION" : "NONE",
    ],
    [locale === "zh" ? "验证器" : "VERIFIER", "DETERMINISTIC"],
  ];
  return (
    <section
      className="provenance-strip"
      aria-label={locale === "zh" ? "证据来源" : "Evidence sources"}
    >
      {items.map(([label, state]) => (
        <div
          className={state === "DEMO INJECTION" ? "injected" : state === "FIXTURE" ? "fixture" : ""}
          key={label}
        >
          <span>{label}</span>
          <b>{state}</b>
        </div>
      ))}
    </section>
  );
}

function Inspector({ locale }: { locale: Locale }) {
  const store = usePlayground();
  const t = copy[locale];
  const tabs = ["intent", "action", "moss", "diff", "evidence", "status"] as const;
  const report = store.verification;
  return (
    <aside className="inspector">
      <div className="inspector-title">
        <span>{t.inspector}</span>
        <small>{localizeStage(store.executionStage, locale)}</small>
      </div>
      <nav>
        {tabs.map((tab) => (
          <button
            type="button"
            className={store.activeInspectorTab === tab ? "active" : ""}
            key={tab}
            onClick={() => store.set({ activeInspectorTab: tab })}
          >
            {t[tab]}
          </button>
        ))}
      </nav>
      <div className="inspection">
        {store.activeInspectorTab === "intent" && (
          <ObjectView
            title={store.confirmedIntent ? t.confirmed : t.draft}
            value={store.confirmedIntent ?? store.draftIntent}
            tone="green"
            locale={locale}
          />
        )}
        {store.activeInspectorTab === "action" && (
          <ObjectView
            title={t.agentAction}
            value={store.proposedAction}
            tone={store.injection.length ? "red" : "purple"}
            locale={locale}
          />
        )}
        {store.activeInspectorTab === "moss" && (
          <>
            <ObjectView
              title={t.capability}
              value={store.capability}
              tone="purple"
              locale={locale}
            />
            <ObjectView
              title={t.simulation}
              value={store.simulation}
              tone="green"
              locale={locale}
            />
          </>
        )}
        {store.activeInspectorTab === "diff" && <Diff report={report} locale={locale} />}
        {store.activeInspectorTab === "evidence" && (
          <>
            <AlignmentMatrix
              locale={locale}
              intent={store.confirmedIntent}
              action={store.proposedAction}
              report={report}
              outcome={store.simulation?.results[0]?.receipt?.outcome}
            />
            <EvidenceLedger
              locale={locale}
              intent={store.confirmedIntent}
              action={store.proposedAction}
              simulation={store.simulation}
              report={report}
            />
            <WalletGateCard locale={locale} gate={store.gate} report={report} />
            <DecisionClimax locale={locale} report={report} />
            <details className="raw-evidence">
              <summary>
                {locale === "zh" ? "展开原始 Moss 证据" : "Expand raw Moss evidence"}
              </summary>
              <ObjectView
                title={t.structured}
                value={store.simulation}
                tone="purple"
                locale={locale}
              />
            </details>
          </>
        )}
        {store.activeInspectorTab === "status" && <StatusPanel locale={locale} />}
      </div>
    </aside>
  );
}

type AlignmentRow = {
  field: string;
  intent: string;
  action: string;
  outcome: string;
  mismatch: boolean;
};

function compact(value: unknown) {
  if (value === undefined || value === null) return "—";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return JSON.stringify(value);
}

function displayUnits(value: unknown, decimals: number) {
  const raw = compact(value);
  if (!/^\d+$/.test(raw)) return raw;
  try {
    return formatUnits(BigInt(raw), decimals);
  } catch {
    return raw;
  }
}

function approvalDisplay(value: unknown, decimals: number, symbol: string) {
  const raw = compact(value);
  return raw.length > 30 ? `MAX_UINT256 · ${symbol}` : `${displayUnits(raw, decimals)} ${symbol}`;
}

function AlignmentMatrix({
  locale,
  intent,
  action,
  report,
  outcome,
}: {
  locale: Locale;
  intent?: ConfirmedIntent;
  action?: ProposedAction;
  report?: VerificationReport;
  outcome?: unknown;
}) {
  if (!intent || !action || !report) return null;
  const result = (outcome && typeof outcome === "object" ? outcome : {}) as Record<string, unknown>;
  const mismatches = report.violations.map((item) => item.field.toLowerCase());
  const failed = (field: string) => mismatches.some((item) => item.includes(field));
  let rows: AlignmentRow[];
  if (intent.operation === "transfer" && action.action.operation === "transfer") {
    rows = [
      {
        field: locale === "zh" ? "金额" : "Amount",
        intent: `${intent.amount} ${intent.asset.symbol ?? "TOKEN"}`,
        action: `${action.action.amount} ${intent.asset.symbol ?? "TOKEN"}`,
        outcome: `${displayUnits(result.amount ?? action.action.amount, intent.asset.decimals)} ${intent.asset.symbol ?? "TOKEN"}`,
        mismatch: failed("amount"),
      },
      {
        field: locale === "zh" ? "收款方" : "Recipient",
        intent: intent.recipient.label ?? intent.recipient.address,
        action: action.action.recipient,
        outcome: compact(result.to ?? result.recipient ?? action.action.recipient),
        mismatch: failed("recipient"),
      },
    ];
  } else if (intent.operation === "approval" && action.action.operation === "approval") {
    rows = [
      {
        field: locale === "zh" ? "授权额度" : "Approval cap",
        intent: `≤ ${intent.maxAmountDisplay} ${intent.token.symbol ?? "TOKEN"}`,
        action: approvalDisplay(
          action.action.amountBaseUnits,
          intent.token.decimals,
          intent.token.symbol ?? "TOKEN",
        ),
        outcome: approvalDisplay(
          result.amount ?? action.action.amountBaseUnits,
          intent.token.decimals,
          intent.token.symbol ?? "TOKEN",
        ),
        mismatch: failed("amount") || failed("approval"),
      },
      {
        field: locale === "zh" ? "授权对象" : "Spender",
        intent: intent.spender.label ?? intent.spender.address,
        action: action.action.spender,
        outcome: compact(result.spender ?? action.action.spender),
        mismatch: failed("spender"),
      },
    ];
  } else if (intent.operation === "swap" && action.action.operation === "swap") {
    rows = [
      {
        field: locale === "zh" ? "兑换路径" : "Swap route",
        intent: `${intent.tokenIn.symbol ?? "MON"} → ${intent.tokenOut.symbol ?? "TOKEN"}`,
        action: `${intent.tokenIn.symbol ?? "MON"} → ${intent.tokenOut.symbol ?? "TOKEN"}`,
        outcome: `${intent.tokenIn.symbol ?? "MON"} → ${intent.tokenOut.symbol ?? "TOKEN"}`,
        mismatch: failed("token") || failed("protocol"),
      },
      {
        field: locale === "zh" ? "输入 / 滑点" : "Input / slippage",
        intent: `${intent.amountIn} · ≤ ${intent.maxSlippageBps / 100}%`,
        action: `${action.action.amountIn} · ${action.action.slippageBps / 100}%`,
        outcome: `${displayUnits(result.amountIn ?? action.action.amountIn, intent.tokenIn.decimals)} ${intent.tokenIn.symbol ?? "MON"} → ${displayUnits(result.amountOut ?? "output > 0", intent.tokenOut.decimals)} ${intent.tokenOut.symbol ?? "TOKEN"}`,
        mismatch: failed("amount") || failed("slippage"),
      },
    ];
  } else return null;
  return (
    <section className="alignment-matrix">
      <header>
        <div>
          <span>{locale === "zh" ? "证据对齐矩阵" : "EVIDENCE ALIGNMENT"}</span>
          <b>Intent → Action → Outcome</b>
        </div>
        <em className={report.decision}>{report.decision.toUpperCase()}</em>
      </header>
      <div className="alignment-head">
        <span>{locale === "zh" ? "字段" : "Field"}</span>
        <span>{locale === "zh" ? "用户确认" : "Confirmed intent"}</span>
        <span>{locale === "zh" ? "智能体提议" : "Agent action"}</span>
        <span>{locale === "zh" ? "Moss 结果" : "Moss outcome"}</span>
      </div>
      {rows.map((row) => (
        <div className={`alignment-row ${row.mismatch ? "mismatch" : "match"}`} key={row.field}>
          <b>{row.field}</b>
          <span title={row.intent}>{row.intent}</span>
          <span title={row.action}>{row.action}</span>
          <span title={row.outcome}>{row.outcome}</span>
        </div>
      ))}
    </section>
  );
}

function shortHash(value: string) {
  return value.length > 20 ? `${value.slice(0, 10)}…${value.slice(-8)}` : value;
}

function EvidenceLedger({
  locale,
  intent,
  action,
  simulation,
  report,
}: {
  locale: Locale;
  intent?: ConfirmedIntent;
  action?: ProposedAction;
  simulation?: ReturnType<typeof usePlayground.getState>["simulation"];
  report?: VerificationReport;
}) {
  if (!intent || !action || !report) return null;
  const passed = report.checks.filter((check) => check.status === "passed");
  const result = simulation?.results[0];
  const cards = [
    {
      label: locale === "zh" ? "已确认意图" : "CONFIRMED INTENT",
      value: shortHash(intent.intentHash),
      meta: `${locale === "zh" ? "确认于" : "Confirmed"} ${new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(intent.confirmedAt))}`,
    },
    {
      label: locale === "zh" ? "智能体来源" : "AGENT PROVENANCE",
      value: `${action.provenance.provider} · ${action.provenance.model}`,
      meta: `${action.provenance.source === "live-ai" ? "LIVE AI" : "DEMO INJECTION"} · ${shortHash(action.provenance.toolCallId)}`,
    },
    {
      label: locale === "zh" ? "Moss 模拟证据" : "MOSS SIMULATION",
      value: result ? `${result.protocol} · ${result.method}` : "—",
      meta: `${report.evidenceSummary.transactionCount} TX · ${report.evidenceSummary.receiptCount} RECEIPT · ${report.evidenceSummary.warningCount} WARNING${result?.gas ? ` · GAS ${result.gas}` : ""}`,
    },
    {
      label: locale === "zh" ? "确定性核验器" : "DETERMINISTIC VERIFIER",
      value: `${passed.length}/${report.checks.length} ${locale === "zh" ? "项检查通过" : "checks passed"}`,
      meta: `${report.verifier.name} ${report.verifier.version} · MOSS ${shortHash(report.verifier.mossCommit)}`,
    },
  ];
  return (
    <section className="evidence-ledger">
      <header>
        <span>{locale === "zh" ? "后端证据账本" : "BACKEND EVIDENCE LEDGER"}</span>
        <b>{locale === "zh" ? "每一层都可追溯" : "Every layer is traceable"}</b>
      </header>
      <div className="ledger-grid">
        {cards.map((card) => (
          <article key={card.label}>
            <span>{card.label}</span>
            <b title={card.value}>{card.value}</b>
            <small>{card.meta}</small>
          </article>
        ))}
      </div>
      <div className="check-chips">
        {report.checks.map((check) => (
          <span className={check.status} key={check.id} title={check.message}>
            {check.status === "passed" ? "✓" : check.status === "failed" ? "×" : "!"} {check.field}
          </span>
        ))}
      </div>
    </section>
  );
}

function WalletGateCard({
  locale,
  gate,
  report,
}: {
  locale: Locale;
  gate?: WalletReviewGate;
  report?: VerificationReport;
}) {
  if (!report) return null;
  const eligible = gate?.status === "eligible-for-wallet-review";
  const envelope = eligible ? gate.envelope : undefined;
  const checks = [
    [locale === "zh" ? "意图绑定" : "Intent bound", envelope?.intentHash ?? report.intentHash],
    [locale === "zh" ? "操作绑定" : "Action bound", envelope?.actionHash ?? report.actionHash],
    [locale === "zh" ? "能力摘要" : "Capability digest", envelope?.capabilityDigest],
    [locale === "zh" ? "模拟摘要" : "Simulation digest", envelope?.simulationDigest],
  ];
  return (
    <section className={`wallet-envelope ${eligible ? "eligible" : "withheld"}`}>
      <header>
        <div>
          <span>WALLET GATE</span>
          <strong>
            {eligible
              ? locale === "zh"
                ? "签名前安全信封"
                : "Pre-sign review envelope"
              : locale === "zh"
                ? "交易已扣留"
                : "Transaction withheld"}
          </strong>
        </div>
        <b>{eligible ? "REVIEW ELIGIBLE" : "WITHHELD"}</b>
      </header>
      <div className="gate-bindings">
        {checks.map(([label, value]) => (
          <div key={label}>
            <i>{value ? "✓" : "—"}</i>
            <span>{label}</span>
            <code title={value}>
              {value ? shortHash(value) : locale === "zh" ? "未创建" : "Not created"}
            </code>
          </div>
        ))}
      </div>
      <footer>
        <span>CHAIN {envelope?.chainId ?? report.chainId}</span>
        <span>{shortHash(envelope?.executionAccount ?? report.executionAccount)}</span>
        <span>
          {envelope
            ? `${locale === "zh" ? "有效至" : "Expires"} ${new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en", { hour: "2-digit", minute: "2-digit" }).format(envelope.expiresAt)}`
            : locale === "zh"
              ? "未向钱包交付"
              : "Not delivered to wallet"}
        </span>
      </footer>
      {envelope && (
        <details>
          <summary>{locale === "zh" ? "查看钱包复核载荷" : "View wallet review payload"}</summary>
          <pre>{JSON.stringify(envelope, null, 2)}</pre>
        </details>
      )}
    </section>
  );
}

function DecisionClimax({ locale, report }: { locale: Locale; report?: VerificationReport }) {
  if (!report) return null;
  const copyByDecision = {
    verified:
      locale === "zh"
        ? "证据链已闭合，可由用户进入钱包复核。"
        : "Evidence aligned. Human wallet review is eligible.",
    blocked:
      locale === "zh"
        ? "发现确定性偏差，交易未交付钱包。"
        : "Deterministic drift detected. Transaction never reached the wallet.",
    unavailable:
      locale === "zh"
        ? "证据不足，系统按失败关闭原则扣留交易。"
        : "Evidence incomplete. The transaction is withheld fail-closed.",
  };
  return (
    <section className={`decision-climax ${report.decision}`} aria-live="polite">
      <div className="gate-line">
        <span>AGENT</span>
        <i>→</i>
        <span>MOSS</span>
        <i>→</i>
        <span>MOSSGUARD</span>
        <i>→</i>
        <span>WALLET</span>
      </div>
      <strong>{report.decision.toUpperCase()}</strong>
      <p>{copyByDecision[report.decision]}</p>
    </section>
  );
}
function ObjectView({
  title,
  value,
  tone,
  locale = "en",
}: {
  title: string;
  value: unknown;
  tone: string;
  locale?: Locale;
}) {
  return (
    <section className={`object-view ${tone}`}>
      <header>
        <b>{title}</b>
        <span>{value ? copy[locale].available : copy[locale].pending}</span>
      </header>
      {value ? <pre>{JSON.stringify(value, null, 2)}</pre> : <p>{copy[locale].noEvidence}</p>}
    </section>
  );
}
function Diff({
  report,
  locale,
}: {
  report?: import("../../types/domain").VerificationReport;
  locale: Locale;
}) {
  const t = copy[locale];
  if (!report)
    return (
      <ObjectView
        title={locale === "zh" ? "意图差异" : "INTENT DIFF"}
        value={undefined}
        tone="purple"
        locale={locale}
      />
    );
  return (
    <>
      <section className="diff-table">
        <header>
          <b>{t.field}</b>
          <b>{t.expected}</b>
          <b>{t.actual}</b>
          <b>{t.status}</b>
        </header>
        {report.checks
          .filter((check) => check.status !== "passed")
          .map((check) => (
            <div key={check.id}>
              <span>{localizeCheckField(check.field, locale)}</span>
              <span>{check.expected}</span>
              <span>{check.actual}</span>
              <strong>
                {locale === "zh" ? (check.status === "failed" ? "失败" : "不可用") : check.status}
              </strong>
            </div>
          ))}
      </section>
      <div className={`decision ${report.decision}`}>
        <strong>{report.decision === "blocked" ? t.blocked : t.unavailable}</strong>
        <p>
          {report.decision === "blocked"
            ? locale === "zh"
              ? `检测到 ${report.violations.length} 项意图违规，交易已在签名前阻止。`
              : `${report.violations.length} intent violation(s) detected. Transaction withheld before signing.`
            : t.unavailable}
        </p>
      </div>
    </>
  );
}
function StatusPanel({ locale }: { locale: Locale }) {
  const store = usePlayground();
  const t = copy[locale];
  async function replay() {
    if (!store.scenarioId) return;
    const response = await fetch(`/api/fixture/${store.scenarioId}`);
    const result = await response.json();
    if (!response.ok) return;
    store.set({
      mode: "fixture",
      proposedAction: result.proposedAction,
      simulation: result.simulation,
      verification: result.report,
      gate: result.gate,
      injection: result.injection,
      stages: result.stages,
      executionStage: result.report.decision,
      activeInspectorTab: result.report.decision === "unavailable" ? "status" : "evidence",
      error: undefined,
    });
    store.addMessage({
      role: "MOSSGUARD",
      text: "FIXTURE REPLAY — NOT LIVE CHAIN STATE. This replay was explicitly selected by the user.",
      tone: "info",
    });
  }
  return (
    <>
      <div className="status-orbit">
        <span>{store.executionStage === "idle" ? "◇" : "⬡"}</span>
        <h3>{localizeStage(store.executionStage, locale)}</h3>
        <p>
          AI: {localizeStage(store.aiStatus, locale)}
          <br />
          Moss: {localizeStage(store.mossStatus, locale)}
        </p>
      </div>
      {store.error && (
        <div className="error-panel">
          <b>{t.serviceUnavailable}</b>
          <p>{store.error}</p>
          <small>{t.noMock}</small>
          {store.scenarioId && (
            <button type="button" onClick={replay}>
              {t.replay}
            </button>
          )}
        </div>
      )}
    </>
  );
}

function localizeMessage(message: string, locale: Locale) {
  if (locale === "en") return message;
  const exact: Record<string, string> = {
    "Send 0.002 MON to 0x1111111111111111111111111111111111111111.":
      "向 0x1111111111111111111111111111111111111111 发送 0.002 MON。",
    "Approve the Kuru Router to spend at most 2.5 USDC.": "授权 Kuru Router 最多使用 2.5 USDC。",
    "Send 5 MON to Alice.": "向 Alice 发送 5 MON。",
    "Approve Kuru to spend up to 10 USDC.": "授权 Kuru 最多使用 10 USDC。",
    "Swap 1 MON to USDC on Kuru with maximum 0.5% slippage.":
      "在 Kuru 将 1 MON 兑换为 USDC，最大滑点 0.5%。",
    "I structured your request as a draft intent. Review every field before confirming.":
      "我已将请求整理为意图草案，请确认每个字段。",
    "Intent confirmed. The authorization boundary is now signed.": "意图已确认，授权边界已签署。",
    "I independently proposed a concrete action. MossGuard will not trust my self-assessment.":
      "我已独立生成具体操作；MossGuard 不会信任智能体的自我判断。",
    "Discovering capability → loading contract → building unsigned transaction → simulating on Monad.":
      "发现能力 → 加载合约 → 构建未签名交易 → 在 Monad 上模拟。",
    "Verified against confirmed intent. Eligible for wallet review.":
      "已与确认意图核验一致，可以进入钱包复核。",
    "Live AI request failed. No mock response was substituted.":
      "实时 AI 请求失败，未用模拟响应替代。",
    "Live Moss simulation did not complete. No mock result was substituted.":
      "Moss 实时模拟未完成，未用模拟结果替代。",
    "MossGuard could not obtain enough verified evidence. No wallet handoff is available.":
      "MossGuard 未获得足够的可验证证据，钱包交接不可用。",
    "FIXTURE REPLAY — NOT LIVE CHAIN STATE. This replay was explicitly selected by the user.":
      "夹具回放——并非实时链状态；该回放由用户明确选择。",
  };
  if (exact[message]) return exact[message];
  const blocked = message.match(
    /^Transaction withheld\. (\d+) deterministic mismatch(?:es)? detected\.$/,
  );
  return blocked ? `交易已阻止：检测到 ${blocked[1]} 项确定性不匹配。` : message;
}

function localizeCheckField(field: string, locale: Locale) {
  if (locale === "en") return field;
  const fields: Record<string, string> = {
    Recipient: "收款方",
    Amount: "金额",
    "Outcome recipient": "执行结果收款方",
    "Outcome amount": "执行结果金额",
    "Approval amount": "授权金额",
    "Outcome approval": "执行结果授权金额",
  };
  return fields[field] ?? field;
}

function localizeStage(stage: string, locale: Locale) {
  if (locale === "en") return stage.replaceAll("-", " ");
  const stages: Record<string, string> = {
    idle: "空闲",
    untested: "未测试",
    connecting: "连接中",
    connected: "已连接",
    unavailable: "不可用",
    "ai-parsing-intent": "AI 正在解析意图",
    "draft-intent": "意图草案",
    "confirmed-intent": "已确认意图",
    "action-proposed": "操作已生成",
    "moss-simulate": "Moss 正在模拟",
    verified: "已验证",
    blocked: "已阻止",
  };
  return stages[stage] ?? stage.replaceAll("-", " ");
}
