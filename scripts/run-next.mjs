import "dotenv/config";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const command = process.argv[2];
if (!["dev", "build", "start"].includes(command))
  throw new Error("Expected dev, build or start");
const port = process.env.PORT ?? "3100";
if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535)
  throw new Error("PORT must be between 1 and 65535");
const args = [require.resolve("next/dist/bin/next"), command];
if (command !== "build")
  args.push("--hostname", process.env.HOST ?? "127.0.0.1", "--port", port);
const child = spawn(process.execPath, args, {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: command === "dev" ? "development" : "production",
  },
});
child.on("exit", (code) => process.exit(code ?? 1));
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
