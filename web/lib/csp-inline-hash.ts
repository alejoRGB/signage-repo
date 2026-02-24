import crypto from "crypto";

export function toCspSha256Hash(scriptBody: string) {
  const hash = crypto.createHash("sha256").update(scriptBody, "utf8").digest("base64");
  return `'sha256-${hash}'`;
}

