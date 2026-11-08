import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
// Operator-only local transport. Never served by an HTTP route or placed in public/.
export async function deliverAccountEmail(
  kind: "verification" | "recovery",
  to: string,
  url: string,
) {
  const origin = new URL(process.env.BETTER_AUTH_URL!);
  if (
    process.env.ACCOUNT_EMAIL_ADAPTER !== "local-file" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname)
  )
    throw new Error("Account email delivery is not configured for this host.");
  const directory = resolve(".runtime/mail");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(
    resolve(directory, Date.now() + "-" + randomUUID() + ".json"),
    JSON.stringify({ kind, to, url, createdAt: new Date().toISOString() }) +
      "\n",
    { flag: "wx", mode: 0o600 },
  );
}
