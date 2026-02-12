#!/usr/bin/env bun
/**
 * Sandbox runner — entry point for isolated skill execution.
 * Reads handler path + input from argv, runs the handler, writes JSON result to stdout.
 * No access to parent process globals.
 */
export {};

import { resolve, join } from "path";

const [handlerPath, inputJson] = process.argv.slice(2);

if (!handlerPath || !inputJson) {
  console.error("Usage: sandbox-runner.ts <handlerPath> <inputJson>");
  process.exit(1);
}

// Validate handler path is within the user's skills directory
const resolvedHandler = resolve(handlerPath);
const skillsDir = resolve(join(process.env.HOME ?? "", ".zubo", "workspace", "skills"));
if (!resolvedHandler.startsWith(skillsDir + "/")) {
  console.error("Handler path must be within the skills directory");
  process.exit(1);
}

// Set up minimal globalThis.Zubo with secrets from env
(globalThis as any).Zubo = {
  getSecret(name: string): string | undefined {
    return process.env[`ZUBO_SECRET_${name.toUpperCase()}`];
  },
};

try {
  const input = JSON.parse(inputJson);
  const mod = await import(handlerPath);
  const handler = mod.default;

  if (typeof handler !== "function") {
    console.error("Handler must export a default function");
    process.exit(1);
  }

  const result = await handler(input);
  console.log(JSON.stringify(result));
} catch (err: any) {
  console.error(err.message ?? String(err));
  process.exit(1);
}
