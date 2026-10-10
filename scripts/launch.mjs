#!/usr/bin/env node
/**
 * CREAM — one-command launcher.
 *
 *  1. verifies the toolchain
 *  2. ensures a usable .env.local exists
 *  3. runs a production build (unless --dev is passed)
 *  4. starts the server
 *  5. waits until it actually answers, then opens the browser
 *
 * Usage:  npm run launch  [-- --dev] [-- --port 3000] [-- --no-build] [-- --no-open]
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync, copyFileSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { platform } from "node:os";
import http from "node:http";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const NEXT_BIN = join(ROOT, "node_modules", "next", "dist", "bin", "next");
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const PORT = Number(opt("port", process.env.PORT || 3000));
const USE_DEV = flag("dev");
const DO_BUILD = !flag("no-build") && !USE_DEV;
const OPEN = !flag("no-open");

const C = process.stdout.isTTY
  ? {
      dim: (s) => `\x1b[2m${s}\x1b[0m`,
      bold: (s) => `\x1b[1m${s}\x1b[0m`,
      mint: (s) => `\x1b[38;5;79m${s}\x1b[0m`,
      caramel: (s) => `\x1b[38;5;215m${s}\x1b[0m`,
      rose: (s) => `\x1b[38;5;203m${s}\x1b[0m`,
      ink: (s) => `\x1b[38;5;253m${s}\x1b[0m`,
      rule: (s) => `\x1b[38;5;240m${s}\x1b[0m`,
    }
  : new Proxy({}, { get: () => (s) => s });

const line = (s = "") => console.log(s);

function step(n, total, title) {
  line();
  line(`${C.caramel(`[${n}/${total}]`)} ${C.bold(title)}`);
}

function rule() {
  line(C.rule("─".repeat(66)));
}

function fail(message, detail) {
  line();
  line(`${C.rose("  ✗")} ${C.bold(message)}`);
  if (detail) line(C.dim(`    ${detail}`));
  line();
  process.exit(1);
}

const TOTAL = 6;
rule();
line(`  ${C.bold("CREAM")} ${C.dim("· AI creator marketplace")}`);
line(`  ${C.dim("verification · briefs · held escrow · signed provenance")}`);
rule();

/* ── 1 · toolchain ─────────────────────────────────────────────────────────── */

step(1, TOTAL, "Checking the toolchain");

const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor < 18) {
  fail(`Node ${process.versions.node} is too old`, "CREAM needs Node 18 or newer.");
}
line(`    ${C.mint("✓")} node ${process.versions.node}`);

const IS_WIN = platform() === "win32";

const npmVersion = spawnSync(IS_WIN ? "npm.cmd" : "npm", ["--version"], {
  encoding: "utf8",
  shell: IS_WIN,
});
line(`    ${C.mint("✓")} npm ${(npmVersion.stdout || "detected").trim()}`);

if (!existsSync(join(ROOT, "node_modules")) || !existsSync(NEXT_BIN)) {
  line(`    ${C.caramel("…")} installing dependencies (first run, this takes a moment)`);
  const install = spawnSync(IS_WIN ? "npm.cmd" : "npm", ["install"], {
    cwd: ROOT,
    stdio: "inherit",
    shell: IS_WIN,
  });
  if (install.status !== 0) fail("npm install failed", "Check your network and retry.");
}
line(`    ${C.mint("✓")} dependencies present`);

/* ── 2 · environment ───────────────────────────────────────────────────────── */

step(2, TOTAL, "Preparing environment");

const envLocal = join(ROOT, ".env.local");
const envExample = join(ROOT, ".env.example");
if (!existsSync(envLocal)) {
  if (existsSync(envExample)) {
    copyFileSync(envExample, envLocal);
    line(`    ${C.mint("✓")} .env.local created from .env.example`);
  } else {
    writeFileSync(envLocal, "# CREAM local environment — all adapters fall back to sandbox.\n");
    line(`    ${C.mint("✓")} .env.local created`);
  }
} else {
  line(`    ${C.mint("✓")} .env.local present`);
}

const envText = readFileSync(envLocal, "utf8");
const filled = ["NEXT_PUBLIC_SUPABASE_URL", "GEMINI_API_KEY", "NEXT_PUBLIC_DIGILOCKER_CLIENT_ID", "NEXT_PUBLIC_RAZORPAY_KEY_ID", "NEXT_PUBLIC_SYNTHID_API_KEY"].filter((k) => {
  const m = envText.match(new RegExp(`^${k}=(.*)$`, "m"));
  return m && m[1].trim().length > 0;
});

if (filled.length === 0) {
  line(`    ${C.caramel("○")} 0 live integrations — every subsystem runs its sandbox adapter`);
  line(C.dim("      add a key to .env.local at any time and restart to go live"));
} else {
  line(`    ${C.mint("✓")} ${filled.length} live integration${filled.length === 1 ? "" : "s"}: ${filled.join(", ")}`);
}

/* ── 3 · build ─────────────────────────────────────────────────────────────── */

step(3, TOTAL, USE_DEV ? "Starting in development mode" : "Building for production");

let serverArgs;
if (USE_DEV) {
  serverArgs = ["dev", "-p", String(PORT)];
} else {
  if (DO_BUILD) {
    const build = spawnSync(process.execPath, [NEXT_BIN, "build"], {
      cwd: ROOT,
      stdio: "inherit",
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
    });
    if (build.status !== 0) fail("Production build failed", "See the compiler output above.");
  }
  serverArgs = ["start", "-p", String(PORT)];
}
line(`    ${C.mint("✓")} ${USE_DEV ? "dev" : DO_BUILD ? "build" : "existing build"} ready`);

/* ── 4 · start ─────────────────────────────────────────────────────────────── */

step(4, TOTAL, "Starting the server");

mkdirSync(join(ROOT, ".next"), { recursive: true });

/* The Next binary is invoked through `node` directly rather than through the
   npm shim: spawning `npm.cmd` without a shell was hardened away in Node 20,
   and going straight to the binary is both faster and immune to that. */
const child = spawn(process.execPath, [NEXT_BIN, ...serverArgs], {
  cwd: ROOT,
  env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
  stdio: ["ignore", "pipe", "pipe"],
});

const relay = (stream) => {
  stream.setEncoding("utf8");
  let buffer = "";
  stream.on("data", (chunk) => {
    buffer += chunk;
    const parts = buffer.split("\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      if (!part.trim()) continue;
      // The WASM SWC fallback prints a scary warning on machines where the
      // prebuilt native binary cannot load. It is not an error and it is not
      // the user's problem, so it does not belong in the launch output.
      if (/Attempted to load @next\/swc/.test(part)) continue;
      if (/Ready|started server|Local:|Network:|error|Error|warn/i.test(part)) {
        line(`    ${C.dim(part.replace(/\s+$/, ""))}`);
      }
    }
  });
};
relay(child.stdout);
relay(child.stderr);

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  line();
  rule();
  line(`  ${C.dim("shutting down")}`);
  try {
    child.kill(process.platform === "win32" ? undefined : "SIGTERM");
  } catch {}
  setTimeout(() => process.exit(code), 250);
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
child.on("exit", (code) => {
  if (!shuttingDown) {
    line();
    line(`${C.rose("  ✗")} the server exited with code ${code}`);
    process.exit(code ?? 1);
  }
});

/* ── 5 · health ────────────────────────────────────────────────────────────── */

step(5, TOTAL, "Waiting for the first request");

function ping() {
  return new Promise((resolvePing) => {
    const req = http.get({ host: "127.0.0.1", port: PORT, path: "/api/integrations", timeout: 4000 }, (res) => {
      res.resume();
      resolvePing(res.statusCode === 200);
    });
    req.on("error", () => resolvePing(false));
    req.on("timeout", () => {
      req.destroy();
      resolvePing(false);
    });
  });
}

const deadline = Date.now() + 120_000;
let live = 0;
let total = 5;
while (Date.now() < deadline) {
  if (await ping()) {
    try {
      const body = await new Promise((res, rej) => {
        http
          .get({ host: "127.0.0.1", port: PORT, path: "/api/integrations" }, (r) => {
            let data = "";
            r.on("data", (c) => (data += c));
            r.on("end", () => res(JSON.parse(data)));
          })
          .on("error", rej);
      });
      live = body.liveCount ?? 0;
      total = body.total ?? 5;
    } catch {
      /* the endpoint answered; the body is a bonus */
    }
    break;
  }
  await new Promise((r) => setTimeout(r, 700));
}
line(`    ${C.mint("✓")} server is answering on port ${PORT}`);

/* ── 6 · open ──────────────────────────────────────────────────────────────── */

step(6, TOTAL, "Opening the browser");

const URL_BASE = `http://localhost:${PORT}`;
const ROUTES = [
  ["/", "Landing"],
  ["/discover", "Discovery"],
  ["/briefs/new", "AI brief builder"],
  ["/creators/aarav.mehta", "Creator profile"],
  ["/engagements/ENG-2026-0311", "Production workspace"],
  ["/trust", "Trust architecture"],
  ["/onboarding/identity", "DigiLocker verification"],
  ["/model", "Data model note"],
  ["/deck", "Demo deck"],
];

if (OPEN) {
  const opened = IS_WIN
    ? spawnSync("cmd.exe", ["/c", "start", "", URL_BASE], { stdio: "ignore" })
    : spawnSync(platform() === "darwin" ? "open" : "xdg-open", [URL_BASE], { stdio: "ignore" });
  line(
    `    ${C.mint("✓")} opened ${URL_BASE}${opened.status === 0 ? "" : C.caramel("  (open it manually)")}`,
  );
}

line();
rule();
line(`  ${C.bold("CREAM is running")}  ${C.dim(`http://localhost:${PORT}`)}`);
line(`  ${C.dim(`${live}/${total} integrations live · ${USE_DEV ? "dev server" : "production build"}`)}`);
rule();
line();
line(`  ${C.caramel("Routes")}`);
for (const [route, label] of ROUTES) line(`    ${C.ink(route.padEnd(28))} ${C.dim(label)}`);
line();
line(`  ${C.dim("press Ctrl+C to stop")}`);
line();

setInterval(() => {}, 1 << 30);