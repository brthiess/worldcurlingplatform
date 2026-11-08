import "dotenv/config";
import { readFile, readdir } from "node:fs/promises";
if (process.env.ACCOUNT_EMAIL_ADAPTER !== "local-file" || !process.argv[2])
  throw new Error(
    "Usage: npm run account:mail -- exact-local-recipient@example.invalid",
  );
// Explicit local operator command; these private links must never be pasted into shared evidence.
for (const file of (await readdir(".runtime/mail")).sort()) {
  const message = JSON.parse(await readFile(".runtime/mail/" + file, "utf8"));
  if (message.to === process.argv[2]) console.log(JSON.stringify(message));
}
