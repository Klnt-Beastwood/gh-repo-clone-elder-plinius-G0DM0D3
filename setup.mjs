#!/usr/bin/env node
/**
 * One-command launcher for G0DM0D3.
 *
 * Checks the local model runtime, installs dependencies if needed, starts the
 * dev server and opens the browser — reporting clearly at each step so a
 * failure says which part is wrong instead of just not working.
 *
 *   node setup.mjs        (or: npm run setup, or double-click start.bat)
 */

import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const root = dirname(fileURLToPath(import.meta.url));

const DEFAULT_BASE_URL = 'http://127.0.0.1:1234/v1';
const APP_URL = 'http://localhost:3000';
const APP_PORT = 3000;

const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m) => console.log(`  \x1b[31m✗\x1b[0m ${m}`);
const warn = (m) => console.log(`  \x1b[33m!\x1b[0m ${m}`);
const info = (m) => console.log(`    ${m}`);
const step = (n, m) => console.log(`\n\x1b[1m[${n}]\x1b[0m ${m}`);

/** Read one key from .env.local, then .env. Deliberately minimal — the app
 *  itself uses dotenv; this only needs to report the same value back. */
function envValue(key) {
  for (const file of ['.env.local', '.env']) {
    const path = join(root, file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/i);
      if (m && m[1] === key) {
        return m[2].trim().replace(/^["']|["']$/g, '');
      }
    }
  }
  return undefined;
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      ...opts,
    });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited with code ${code}`)));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url, timeoutMs = 4000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ac.signal });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    return { data: await res.json() };
  } catch (e) {
    return { error: e.name === 'AbortError' ? 'timed out' : e.message };
  } finally {
    clearTimeout(timer);
  }
}

function openBrowser(url) {
  const [cmd, args] =
    process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : process.platform === 'darwin' ? ['open', [url]]
    : ['xdg-open', [url]];
  try {
    const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
    // spawn reports a missing opener asynchronously; without this handler the
    // 'error' event is unhandled and takes the whole launcher down.
    child.on('error', () => {});
    child.unref();
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log('\n\x1b[1m\x1b[32mG0DM0D3 setup\x1b[0m');

  // ---- 1. Node -----------------------------------------------------------
  step(1, 'Checking Node');
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 18) {
    bad(`Node ${process.versions.node} is too old — this needs Node 18 or newer.`);
    info('Install the LTS build from https://nodejs.org and run this again.');
    process.exit(1);
  }
  ok(`Node ${process.versions.node}`);

  // ---- 2. Local model runtime -------------------------------------------
  step(2, 'Checking the local model runtime');
  const baseUrl = (envValue('LOCAL_BASE_URL') || DEFAULT_BASE_URL).replace(/\/+$/, '');
  info(`Endpoint: ${baseUrl}`);

  const { data, error } = await fetchJson(`${baseUrl}/models`);
  let chatModels = [];

  if (error) {
    bad(`Could not reach it (${error}).`);
    info('');
    info('In LM Studio:  Developer tab  ->  load a model  ->  Start Server');
    info('Loading a model in the Chat tab is NOT enough — the server is separate.');
    info('');
    info('The app will still start, but no local models will appear until the');
    info('runtime is up. Restart this script once it is.');
  } else {
    const ids = (data?.data ?? []).map((m) => m?.id).filter(Boolean);
    chatModels = ids.filter((id) => !/(^|[-_/])(embed|embedding)/i.test(id));
    const skipped = ids.length - chatModels.length;

    if (chatModels.length === 0) {
      warn(ids.length === 0
        ? 'Server is up but has no model loaded.'
        : 'Server is up but only embedding models are loaded — those cannot chat.');
      info('Load a chat model in LM Studio, then restart this script.');
    } else {
      ok(`${chatModels.length} chat model${chatModels.length > 1 ? 's' : ''} available`);
      chatModels.forEach((m) => info(`• ${m}`));
      if (skipped > 0) info(`(${skipped} embedding model${skipped > 1 ? 's' : ''} hidden — they cannot chat)`);
    }
  }

  // ---- 3. Dependencies ---------------------------------------------------
  step(3, 'Checking dependencies');
  if (existsSync(join(root, 'node_modules'))) {
    ok('Already installed');
  } else {
    info('Installing — this takes a minute the first time...');
    try {
      await run('npm', ['install', '--no-audit', '--no-fund']);
      ok('Installed');
    } catch (e) {
      bad(`npm install failed: ${e.message}`);
      process.exit(1);
    }
  }

  // ---- 4. Start the app --------------------------------------------------
  step(4, 'Starting G0DM0D3');

  // Port 3000 already taken is the common case of "I left another window
  // running". Say so plainly instead of letting Node print an EADDRINUSE stack.
  const existing = await fetchJson(`http://127.0.0.1:${APP_PORT}/api/local-models`, 2000);
  if (!existing.error || existing.error.startsWith('HTTP')) {
    warn(`Something is already serving port ${APP_PORT}.`);
    info('If that is G0DM0D3 from another window, it is still running — reusing it.');
    info(`Otherwise close that program and run this again.`);
    console.log('');
    ok(`Open \x1b[1m${APP_URL}\x1b[0m`);
    openBrowser(APP_URL);
    return;
  }

  const server = spawn('npm', ['run', 'dev'], {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  server.on('exit', (code) => process.exit(code ?? 0));
  const shutdown = () => { server.kill(); process.exit(0); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Wait for the server to answer before opening a browser at a dead page.
  let up = false;
  for (let i = 0; i < 60; i++) {
    await sleep(1000);
    const probe = await fetchJson(`http://127.0.0.1:${APP_PORT}/api/local-models`, 2000);
    if (!probe.error || probe.error.startsWith('HTTP')) { up = true; break; }
  }

  if (!up) {
    bad(`No response on port ${APP_PORT} after 60s — check the output above.`);
    return;
  }

  console.log('');
  ok(`Running at \x1b[1m${APP_URL}\x1b[0m`);
  if (openBrowser(APP_URL)) info('Opening your browser...');
  else info(`Open ${APP_URL} yourself.`);

  console.log('');
  info('Leave this window open. Press Ctrl+C to stop.');
  console.log('');
}

main().catch((e) => {
  bad(e.message);
  process.exit(1);
});
