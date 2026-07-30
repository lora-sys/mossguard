export type AgentToolName =
  | "moss_discover"
  | "moss_load"
  | "moss_action"
  | "moss_simulate"
  | "submit_for_verification";

export type AgentToolTrace = {
  toolCallId: string;
  tool: AgentToolName;
  sequence: number;
  status: "running" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
  latencyMs?: number;
  artifact?: Record<string, unknown>;
  errorCode?: string;
  error?: string;
};

export type AgentStopReason =
  | "completed"
  | "blocked"
  | "unavailable"
  | "cancelled"
  | "budget_exhausted";

export type AgentRun = {
  runId: string;
  createdAt: string;
  updatedAt: string;
  inputHash: string;
  promptVersion: string;
  provider: string;
  model: string;
  status: "running" | "completed" | "failed";
  toolCalls: AgentToolTrace[];
  attempts: number;
  latencyMs?: number;
  tokenUsage?: { prompt: number; completion: number; total: number };
  stopReason?: AgentStopReason;
  reportId?: string;
  decision?: "verified" | "blocked" | "unavailable";
  errorCode?: string;
  error?: string;
  result?: unknown;
};
