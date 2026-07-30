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
type Message = {
  id: string;
  role: "USER" | "AGENT" | "MOSS" | "MOSSGUARD";
  text: string;
  tone?: "danger" | "success" | "info";
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
  verification?: VerificationReport;
  gate?: WalletReviewGate;
  injection: string[];
  stages: Array<{ stage: string; status: string; summary: string }>;
  messages: Message[];
  executionStage: string;
  activeInspectorTab: InspectorTab;
  error?: string;
  set: (patch: Partial<State>) => void;
  addMessage: (message: Omit<Message, "id">) => void;
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
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, { ...message, id: crypto.randomUUID() }] })),
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
      verification: undefined,
      gate: undefined,
      injection: [],
      stages: [],
      executionStage: "draft-intent",
      activeInspectorTab: "intent",
    }),
}));
