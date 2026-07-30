import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { AgentRun } from "./types";

let writes = Promise.resolve();

function storePath() {
  return resolve(process.env.MOSSGUARD_RUN_STORE_PATH ?? ".mossguard-data/agent-runs.json");
}

async function readRuns(): Promise<AgentRun[]> {
  try {
    return JSON.parse(await readFile(storePath(), "utf8")) as AgentRun[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeRuns(runs: AgentRun[]) {
  const path = storePath();
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(runs, null, 2), { mode: 0o600 });
  await rename(temporary, path);
}

export async function putAgentRun(run: AgentRun) {
  writes = writes
    .catch(() => undefined)
    .then(async () => {
      const max = Math.max(1, Number(process.env.MOSSGUARD_MAX_AGENT_RUNS ?? 50));
      const runs = await readRuns();
      const next = [run, ...runs.filter((item) => item.runId !== run.runId)].slice(0, max);
      await writeRuns(next);
    });
  await writes;
  return run;
}

export async function getAgentRun(runId: string) {
  await writes;
  return (await readRuns()).find((run) => run.runId === runId);
}
