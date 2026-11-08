import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { db } from "./db";
import * as schema from "./db/schema";
if (
  !process.env.BETTER_AUTH_SECRET ||
  process.env.BETTER_AUTH_SECRET.length < 32
)
  throw new Error("BETTER_AUTH_SECRET must have at least 32 characters");
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    requireEmailVerification: true,
  },
  session: { expiresIn: 60 * 60 * 8, cookieCache: { enabled: false } },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 30,
    customRules: { "/sign-in/email": { window: 60, max: 10 } },
  },
});
