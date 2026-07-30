import type { MossEvidence } from "../moss/pipeline";

type Record = { evidence: MossEvidence; expiresAt: number };
const records = new Map<string, Record>();

export function putEvidence(id: string, evidence: MossEvidence) {
  const ttl = Number(process.env.MOSS_RAW_EVIDENCE_TTL_MS ?? 1_800_000);
  const max = Number(process.env.MOSS_MAX_EVIDENCE_RECORDS ?? 20);
  records.set(id, { evidence, expiresAt: Date.now() + ttl });
  for (const [key, value] of records) if (value.expiresAt <= Date.now()) records.delete(key);
  while (records.size > max) {
    const oldest = records.keys().next().value;
    if (oldest) records.delete(oldest);
    else break;
  }
}

export function getEvidence(id: string) {
  const record = records.get(id);
  if (!record || record.expiresAt <= Date.now()) {
    records.delete(id);
    return undefined;
  }
  return record.evidence;
}
