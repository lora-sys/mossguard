import { createHash, createHmac, timingSafeEqual } from "node:crypto";

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}

export function digest(value: unknown) {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

export function signClaims(claims: object, secret: string) {
  const payload = Buffer.from(canonical(claims)).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyClaims<T>(token: string, secret: string): T {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) throw new Error("Malformed confirmation token");
  const expected = createHmac("sha256", secret).update(payload).digest();
  const actual = Buffer.from(signature, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new Error("Invalid confirmation signature");
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T;
}
