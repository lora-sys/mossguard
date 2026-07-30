# MossGuard 黑客松 Demo 视频脚本

## 一句话主线

> Agent 提议，Moss 产生真实链上证据，MossGuard 确定性裁决，最终由用户签名。

建议成片时长：`2:50–3:00`。全程使用中文默认界面、实时 StepFun AI 和 Monad Mainnet；不要展开过多原始 JSON，重点让三层主流程始终留在画面中。

## 录制前检查

1. 打开 `http://127.0.0.1:3000/`，确认顶部显示 `AI READY`、`MOSS READY`、`Monad Mainnet 143`。
2. 使用 1440p 或更高分辨率，浏览器缩放建议 `90%`，确保主流程和右侧 Inspector 同屏。
3. 先私下运行一次实时有限授权和 Kuru Swap，确认 StepFun、Monad RPC、Kuru API 可用。
4. 正式录制时保持中文模式；只有在结尾快速点一次 `EN`，证明双语支持。
5. AI 请求期间不要剪掉等待过程：保留 1–2 秒的流式回复和工具活动，证明它不是固定状态机。

## 三分钟镜头与口播

### 0:00–0:18｜问题与产品定位

**画面**：首页空状态和顶部三层架构。

**口播**：

> 链上 AI Agent 可以理解需求并准备交易，但用户很难确认最终操作是否仍然符合原始授权。MossGuard 是 Agent 与钱包之间的可验证信任层：Agent 只负责提议，Moss 构造并模拟，MossGuard 根据证据裁决，签名权始终属于用户。

### 0:18–0:58｜实时 AI 正常有限授权

**操作**：进入“实时智能体”，输入：

```text
授权 Kuru Router 最多使用 10 USDC，不允许无限授权。
```

英文备用：

```text
Approve the Kuru Router to spend at most 10 USDC. Do not allow unlimited approval.
```

等待 StepFun 流式回复，指向 `AGENT 实时活动`、`propose_intent` 和模型 Tool Call ID。确认 Intent 后，重点停留在 Agent 自主工具调用列表，等待五个真实 Tool Call 完成。

**口播**：

> 这是实时 StepFun Agent，不是预设响应。它先把自然语言转成结构化 Intent，由用户确认 10 USDC 上限；确认后 Agent 独立生成未签名操作，并自主选择 Moss 工具。你可以看到模型依次调用 moss_discover、moss_load、moss_action、moss_simulate，再主动提交 MossGuard 核验。每一个完成状态都对应真实 SDK 返回，不是前端计时动画。最终得到一笔 Approval、一个 Receipt、零 Warning；MossGuard 做十项确定性检查。金额仍是 10 USDC，因此交易可以进入钱包复核，但系统不会替用户签名。

**画面证据**：

- StepFun `step-3.7-flash` 与 Tool Call ID；
- 五次由 Agent 发起的 Moss/MossGuard Tool Call、各自耗时和 Prompt 版本；
- Moss `erc20.approve`；
- `1 TX / 1 RECEIPT / 0 WARNING`；
- `10/10 VERIFIED`；
- `WALLET GATE / REVIEW ELIGIBLE`。

### 0:58–1:35｜同一授权被篡改为无限授权

**操作**：点击“授权操作篡改”，确认 Intent。

**口播**：

> 现在用户确认的仍然是最多 10 USDC。演示引擎只修改 Agent Action，把金额变成 MAX UINT 256，并明确标记为 Demo Injection。后面的 Moss 仍然是真实构造和真实模拟。Moss 的 Receipt 证明最终授权确实是无限额度；MossGuard 发现 Action 金额和 Outcome 金额都越过用户边界，因此在签名前阻止交易。

**画面证据**：

- `≤ 10 USDC → MAX_UINT256`；
- `DEMO INJECTION`；
- Moss 仍显示 `LIVE`、`erc20.approve`、Receipt、Gas；
- MossGuard `8/10 BLOCKED`；
- `Approval amount` 与 `Outcome approval` 两项红色失败；
- `WALLET WITHHELD`。

### 1:35–2:18｜真实 Kuru Swap

**操作**：点击“安全 Kuru 兑换”，或在实时 Agent 输入：

```text
在 Kuru 将 1 MON 兑换为 USDC，最大滑点 0.5%。
```

英文备用：

```text
Swap 1 MON to USDC on Kuru with maximum 0.5% slippage.
```

**口播**：

> MossGuard 不只是检查简单转账和授权。这里 Agent 提议一次真实 Kuru Swap，并自主调用 Moss 工具；Moss 动态发现市场、构建 Kuru Capability，并基于 Monad 当前状态模拟。结构化 Outcome 包含协议、输入资产、输出资产、输入数量和真实输出。模型只能提交证据，不能决定安全结果；MossGuard 验证协议、滑点和最终资产流向全部符合 Intent，才允许进入钱包复核。

**画面证据**：

- Moss `kuru.swap`；
- Agent 五次自主工具调用与 `mossguard-agent-2026-07-29.v1`；
- `1 TX / 1 RECEIPT / 0 WARNING`；
- 当前实时 `Gas` 和 `MON → USDC` Outcome；
- MossGuard `15/15 VERIFIED`；
- Wallet Review Envelope 的 Intent、Action、Capability、Simulation digest。

### 2:18–2:42｜快速展示转账漂移

**操作**：点击“转账操作篡改”，快速展示预注入卡和最终 Diff；如果视频必须严格控制在 3 分钟内，可以使用已经完成的案例画面进行跳剪。

**口播**：

> 同样的规则也覆盖转账：用户确认向 Alice 转 5 MON，但 Agent Action 被注入为向 Bob 转 50 MON。Moss 模拟实际提议，MossGuard 同时在 Action 和 Outcome 中发现收款人与金额漂移，交易不会到达钱包。

### 2:42–3:00｜架构与结尾

**画面**：回到三层执行链，短暂切换 `中 / EN`。

**口播**：

> Agent 负责理解和提议；Moss 负责协议能力、未签名交易构造和真实模拟；MossGuard 只相信结构化证据，并与用户确认的 Intent 做确定性比较。我们不让 AI 自动控制资产。Agent proposes. Evidence decides. Human signs.

## 实时 AI 模式测试提示词

### 推荐用于正式视频

```text
授权 Kuru Router 最多使用 10 USDC，不允许无限授权。
```

```text
在 Kuru 将 1 MON 兑换为 USDC，最大滑点 0.5%。
```

```text
向 0x1111111111111111111111111111111111111111 发送 0.002 MON。
```

### 用于证明约束理解

```text
只授权 Kuru Router 使用 2.5 USDC，必须是有限授权，任何更高额度都不允许。
```

```text
在 Kuru 用 0.01 MON 兑换 USDC，最大滑点只能是 0.3%，不要使用其他协议。
```

```text
向 0x2222222222222222222222222222222222222222 发送 0.001 MON，不要修改收款地址或金额。
```

### 英文评委备用

```text
Approve the Kuru Router to spend at most 10 USDC. Unlimited approval is not allowed.
```

```text
Swap exactly 1 MON to USDC on Kuru with maximum 0.5% slippage.
```

```text
Send exactly 0.002 MON to 0x1111111111111111111111111111111111111111.
```

## 录制原则

- 不把私有 Chain of Thought 当作卖点；展示公开计划、流式回复、工具调用和结构化证据。
- 不声称“交易已经发送”或“Agent 已经签名”；Moss 只构建并模拟未签名交易。
- 不把 Scenario Injection 伪装成真实攻击；必须让 `DEMO INJECTION` 标签始终可见。
- 实时价格、Gas 和 Swap 输出每次可能不同，口播只描述“当前实时结果”，不要念死数值。
- 如果 StepFun 或 Monad RPC 最终失败，保留 `UNAVAILABLE / Wallet Withheld` 作为 fail-closed 证据；不要切换成未标记的模拟结果。
