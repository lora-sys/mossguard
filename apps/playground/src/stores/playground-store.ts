import { create } from "zustand";
import type {
  ConfirmedIntent,
  Intent,
  ProposedAction,
  ScenarioId,
  VerificationReport,
  WalletReviewGate,
} from "../types/domain";

export type InspectorTab = "intent" | "action" | "moss" | "diff" | "evidence" | "status";
export type AgentActivity = {
  id: string;
  label: string;
  status: "running" | "complete" | "failed";
  detail?: string;
};
export type MossStageState = {
  stage: "discover" | "load" | "action" | "simulate" | "normalize";
  status: "running" | "completed" | "failed";
  summary: string;
  timestamp: string;
  artifact?: Record<string, unknown>;
  error?: string;
};
type Message = {
  id: string;
  role: "USER" | "AGENT" | "MOSS" | "MOSSGUARD";
  text: string;
  tone?: "danger" | "success" | "info";
  streaming?: boolean;
  steps?: string[];
  activities?: AgentActivity[];
};
type State = {
  mode: "live" | "scenario" | "fixture";
  scenarioId?: ScenarioId;
  aiStatus: "untested" | "connecting" | "connected" | "unavailable";
  mossStatus: "untested" | "connecting" | "connected" | "unavailable";
  draftIntent?: Intent;
  confirmedIntent?: ConfirmedIntent;
  confirmationToken?: string;
  proposedAction?: ProposedAction;
  capability?: unknown;
  simulation?: {
    results: Array<{
      protocol: string;
      method: string;
      gas: string | null;
      receipt?: { outcome: unknown; text: string };
    }>;
  };
  discoveredCapabilities?: unknown;
  loadedContracts?: unknown;
  lastRunId?: string;
  agentRun?: {
    promptVersion: string;
    toolCalls: unknown[];
    attempts: number;
    tokenUsage?: { prompt: number; completion: number; total: number };
    latencyMs: number;
    stopReason: string;
  };
  verification?: VerificationReport;
  gate?: WalletReviewGate;
  injection: string[];
  stages: MossStageState[];
  messages: Message[];
  executionStage: string;
  activeInspectorTab: InspectorTab;
  error?: string;
  set: (patch: Partial<State>) => void;
  addMessage: (message: Omit<Message, "id">) => string;
  updateMessage: (id: string, patch: Partial<Omit<Message, "id">>) => void;
  upsertActivity: (messageId: string, activity: AgentActivity) => void;
  upsertMossStage: (stage: MossStageState) => void;
  reset: (scenarioId?: ScenarioId) => void;
  invalidateAfterIntentEdit: (intent: Intent) => void;
};

const initial = {
  mode: "live" as const,
  aiStatus: "untested" as const,
  mossStatus: "untested" as const,
  injection: [],
  stages: [],
  messages: [] as Message[],
  executionStage: "idle",
  activeInspectorTab: "status" as InspectorTab,
};
export const usePlayground = create<State>((set) => ({
  ...initial,
  set: (patch) => set(patch),
  addMessage: (message) => {
    const id = crypto.randomUUID();
    set((state) => ({ messages: [...state.messages, { ...message, id }] }));
    return id;
  },
  updateMessage: (id, patch) =>
    set((state) => ({
      messages: state.messages.map((message) =>
        message.id === id ? { ...message, ...patch } : message,
      ),
    })),
  upsertActivity: (messageId, activity) =>
    set((state) => ({
      messages: state.messages.map((message) => {
        if (message.id !== messageId) return message;
        const activities = message.activities ?? [];
        const index = activities.findIndex((item) => item.id === activity.id);
        return {
          ...message,
          activities:
            index === -1
              ? [...activities, activity]
              : activities.map((item, itemIndex) => (itemIndex === index ? activity : item)),
        };
      }),
    })),
  upsertMossStage: (stage) =>
    set((state) => ({
      stages: state.stages.some((item) => item.stage === stage.stage)
        ? state.stages.map((item) => (item.stage === stage.stage ? stage : item))
        : [...state.stages, stage],
    })),
  reset: (scenarioId) =>
    set({
      ...initial,
      mode: scenarioId ? "scenario" : "live",
      scenarioId,
      draftIntent: undefined,
      confirmedIntent: undefined,
      confirmationToken: undefined,
      proposedAction: undefined,
      capability: undefined,
      simulation: undefined,
      discoveredCapabilities: undefined,
      loadedContracts: undefined,
      lastRunId: undefined,
      agentRun: undefined,
      verification: undefined,
      gate: undefined,
      error: undefined,
      messages: [],
    }),
  invalidateAfterIntentEdit: (draftIntent) =>
    set({
      draftIntent,
      confirmedIntent: undefined,
      confirmationToken: undefined,
      proposedAction: undefined,
      capability: undefined,
      simulation: undefined,
      discoveredCapabilities: undefined,
      loadedContracts: undefined,
      lastRunId: undefined,
      agentRun: undefined,
      verification: undefined,
      gate: undefined,
      injection: [],
      stages: [],
      executionStage: "draft-intent",
      activeInspectorTab: "intent",
    }),
}));
