import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getAgentRun, putAgentRun } from "./run-store";

let directory: string | undefined;

afterEach(async () => {
  delete process.env.MOSSGUARD_RUN_STORE_PATH;
  if (directory) await rm(directory, { recursive: true, force: true });
  directory = undefined;
});

describe("AgentRun store", () => {
  it("persists a typed run across independent reads without storing raw prompts", async () => {
    directory = await mkdtemp(join(tmpdir(), "mossguard-agent-run-"));
    const path = join(directory, "runs.json");
    process.env.MOSSGUARD_RUN_STORE_PATH = path;
    const run = {
      runId: "run-1",
      createdAt: "2026-07-29T00:00:00.000Z",
      updatedAt: "2026-07-29T00:00:01.000Z",
      inputHash: "digest-only",
      promptVersion: "v1",
      provider: "stepfun",
      model: "step-test",
      status: "completed" as const,
      toolCalls: [],
      attempts: 1,
      stopReason: "completed" as const,
    };
    await putAgentRun(run);

    expect(await getAgentRun("run-1")).toEqual(run);
    expect(await readFile(path, "utf8")).not.toContain("user prompt");
  });
});
