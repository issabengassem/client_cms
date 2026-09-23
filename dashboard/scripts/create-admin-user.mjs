#!/usr/bin/env node
// Bootstraps the first operator account. There's no public signup route on
// purpose -- this dashboard manages other people's client sites, so account
// creation happens from a trusted terminal, not a web form anyone can hit.
//
// Usage:
//   node scripts/create-admin-user.mjs you@example.com "a strong password"
//   node scripts/create-admin-user.mjs                 (prompts for both)

import { readFile } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";

async function loadEnvLocal() {
  try {
    const text = await readFile(new URL("../.env.local", import.meta.url), "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // No .env.local yet -- fine, maybe env vars are set another way.
  }
}

async function prompt(question, hidden = false) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim();
}

async function main() {
  await loadEnvLocal();

  if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is not set. Add it to .env.local first (see .env.example).");
    process.exit(1);
  }

  let [, , argEmail, argPassword] = process.argv;
  const email = (argEmail || (await prompt("Admin email: "))).trim().toLowerCase();
  const password = argPassword || (await prompt("Admin password: "));

  if (!email || !password || password.length < 8) {
    console.error("Need a non-empty email and a password of at least 8 characters.");
    process.exit(1);
  }

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || "cms_command_center");

  const passwordHash = await bcrypt.hash(password, 10);

  await db.collection("users").updateOne(
    { email },
    { $set: { email, passwordHash, role: "admin" }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true }
  );

  console.log(`Admin account ready for ${email}. Sign in at /login.`);
  await client.close();
}

main().catch((err) => {
  console.error("Failed to create admin user:", err.message);
  process.exit(1);
});
