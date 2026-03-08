import { hashSync } from 'bcryptjs';
import { existsSync, writeFileSync, mkdirSync, readSync } from 'fs';
import { execSync } from 'child_process';
import { getDb } from '../core/db';
import { ensureKeyPair } from '../activitypub/keys';

// ── ANSI helpers ──────────────────────────────────────────────────────────────
const c = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  cyan:    '\x1b[36m',
  yellow:  '\x1b[33m',
  green:   '\x1b[32m',
  red:     '\x1b[31m',
};
const style = (s: string, ...codes: string[]) => codes.join('') + s + c.reset;
const p = (s = '') => process.stdout.write(s + '\n');
const hr = () => p(style('  ' + '─'.repeat(48), c.dim));

function stepHeader(n: number, total: number, title: string) {
  p();
  hr();
  p('  ' + style(`Step ${n}/${total}`, c.bold + c.cyan) + style(` — ${title}`, c.bold));
  hr();
  p();
}

// ── Input helpers ─────────────────────────────────────────────────────────────
function readLine(): string {
  const buf = Buffer.alloc(1024);
  const n = readSync(0, buf, 0, buf.length, null);
  return buf.slice(0, n).toString('utf8').trimEnd();
}

function prompt(label: string, defaultValue: string): string {
  process.stdout.write(`  ${label.padEnd(18)} ${style(`[${defaultValue}]`, c.dim)}: `);
  const input = readLine().trim();
  return input || defaultValue;
}

function promptSecret(label: string): string {
  process.stdout.write(`  ${label.padEnd(18)}: `);
  try {
    execSync('stty -echo', { stdio: 'inherit' });
    const buf = Buffer.alloc(1024);
    const n = readSync(0, buf, 0, buf.length, null);
    return buf.slice(0, n).toString('utf8').trimEnd();
  } finally {
    execSync('stty echo', { stdio: 'inherit' });
    process.stdout.write('\n');
  }
}

function confirm(label: string, defaultYes = true): boolean {
  process.stdout.write(`  ${label} ${style(defaultYes ? '[Y/n]' : '[y/N]', c.dim)}: `);
  const input = readLine().trim().toLowerCase();
  if (!input) return defaultYes;
  return input === 'y' || input === 'yes';
}

// ── Setup ─────────────────────────────────────────────────────────────────────
export async function setup(_args: string[]): Promise<void> {
  const tomlPath = `${process.cwd()}/grip.toml`;

  // Welcome
  p();
  p(style('  ✨  GRIP Setup  ✨', c.bold + c.yellow));
  p(style('  Your sovereign personal web space.', c.dim));
  p();

  // Load existing config as defaults if grip.toml already exists
  let existing: any = {};
  if (existsSync(tomlPath)) {
    try {
      const text = await Bun.file(tomlPath).text();
      existing = (await import('toml')).default.parse(text);
      p(style('  ↺  Existing grip.toml found — pre-filling defaults.', c.dim));
    } catch {}
  }

  const defaults = {
    title:           existing.site?.title                    ?? 'My GRIP',
    description:     existing.site?.description              ?? 'A personal publishing space',
    domain:          existing.server?.domain                 ?? 'localhost',
    publicPort:      String(existing.server?.public_port     ?? 3000),
    authorPort:      String(existing.server?.author_port     ?? 4000),
    publicityMode:   existing.publicity?.mode                ?? 'public',
    showArticles:    existing.publicity?.show_articles       ?? true,
    showMicro:       existing.publicity?.show_micro          ?? true,
    rssEnabled:      existing.publicity?.rss_enabled         ?? true,
    apEnabled:       existing.activitypub?.enabled           ?? false,
    apUsername:      existing.activitypub?.username          ?? 'me',
    apAcceptReplies: existing.activitypub?.accept_replies    ?? false,
  };

  // ── Step 1: Site identity ─────────────────────────────────────────────────
  stepHeader(1, 6, 'Site identity');
  const title       = prompt('Site title',       defaults.title);
  const description = prompt('Description',      defaults.description);
  const domain      = prompt('Domain',           defaults.domain);

  // ── Step 2: Server ports ─────────────────────────────────────────────────
  stepHeader(2, 6, 'Server ports');
  p(style('  Public port  — your visitor-facing site.', c.dim));
  p(style('  Author port  — your private writing interface.', c.dim));
  p();
  const publicPort = parseInt(prompt('Public port', defaults.publicPort), 10) || 3000;
  const authorPort = parseInt(prompt('Author port', defaults.authorPort), 10) || 4000;

  // ── Step 3: Passphrase ────────────────────────────────────────────────────
  stepHeader(3, 6, 'Passphrase');
  p(style('  Protects the author interface. Min 8 characters.', c.dim));
  p();

  let passphrase = '';
  while (true) {
    passphrase = promptSecret('Passphrase');
    if (passphrase.length < 8) {
      p('  ' + style('✗  Must be at least 8 characters. Try again.', c.red));
      p();
      continue;
    }
    const again = promptSecret('Confirm');
    if (passphrase !== again) {
      p('  ' + style('✗  Passphrases do not match. Try again.', c.red));
      p();
      continue;
    }
    p('  ' + style('✓  Passphrase set.', c.green));
    break;
  }

  // ── Step 4: Publicity ─────────────────────────────────────────────────────
  stepHeader(4, 6, 'Publicity');
  p(style('  Control what visitors can see on your public site.', c.dim));
  p();

  const isPrivate = !confirm('Make site public?', defaults.publicityMode !== 'private');
  let showArticles = defaults.showArticles as boolean;
  let showMicro    = defaults.showMicro    as boolean;
  let rssEnabled   = defaults.rssEnabled   as boolean;

  if (!isPrivate) {
    p();
    showArticles = confirm('Show articles?',    showArticles);
    showMicro    = confirm('Show micro posts?', showMicro);
    rssEnabled   = confirm('Enable RSS feeds?', rssEnabled);
  } else {
    p(style('  Only published pages will be visible to visitors.', c.dim));
    showArticles = false;
    showMicro    = false;
    rssEnabled   = false;
  }

  // ── Step 5: ActivityPub ───────────────────────────────────────────────────
  stepHeader(5, 6, 'ActivityPub (fediverse)');
  p(style('  Make your micro-posts followable from Mastodon and the fediverse.', c.dim));
  p(style('  You can enable this later by editing grip.toml.', c.dim));
  p();

  const apEnabled = confirm('Enable ActivityPub?', defaults.apEnabled);

  let apUsername = defaults.apUsername;
  let apAcceptReplies = defaults.apAcceptReplies;

  if (apEnabled) {
    p();
    apUsername = prompt('Username', defaults.apUsername);
    p(style(`  → Your fediverse handle will be @${apUsername}@${domain}`, c.cyan));
    p();
    apAcceptReplies = confirm('Accept replies as comments?', defaults.apAcceptReplies);
    if (apAcceptReplies) {
      p(style('  Replies will appear on /micro. Moderate them in the author panel.', c.dim));
    }
  }

  // ── Step 6: Review & confirm ─────────────────────────────────────────────
  stepHeader(6, 6, 'Review & confirm');
  p(`  ${style('Site title ', c.dim)}   ${style(title, c.bold)}`);
  p(`  ${style('Description', c.dim)}   ${description}`);
  p(`  ${style('Domain     ', c.dim)}   ${domain}`);
  p(`  ${style('Public port', c.dim)}   :${publicPort}`);
  p(`  ${style('Author port', c.dim)}   :${authorPort}`);
  p(`  ${style('Publicity  ', c.dim)}   ${isPrivate ? 'Private (pages only)' : `Public${showArticles ? ', articles' : ''}${showMicro ? ', micro' : ''}${rssEnabled ? ', RSS' : ''}`}`);
  if (apEnabled) {
    p(`  ${style('ActivityPub', c.dim)}   @${apUsername}@${domain}${apAcceptReplies ? ' (replies on)' : ''}`);
  }
  p();

  if (!confirm('Write config and initialise database?')) {
    p(style('  Cancelled.', c.dim));
    process.exit(0);
  }

  // ── Write everything ──────────────────────────────────────────────────────
  p();

  const apSection = apEnabled ? `
[activitypub]
enabled        = true
username       = "${apUsername}"
accept_replies = ${apAcceptReplies}
` : '';

  const tomlContent = `[server]
public_port  = ${publicPort}
author_port  = ${authorPort}
domain       = "${domain}"

[data]
db_path      = "./data/grip.sqlite"
media_path   = "./media"

[site]
title        = "${title}"
description  = "${description}"
${apSection}`;
  writeFileSync(tomlPath, tomlContent, 'utf8');
  p('  ' + style('✓', c.green) + '  grip.toml written');

  const db = getDb();
  p('  ' + style('✓', c.green) + '  Database initialised');

  const hash = hashSync(passphrase, 12);
  const set = (k: string, v: string) =>
    db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(k, v);
  set('passphrase_hash',  hash);
  set('site_title',       title);
  set('site_description', description);
  set('domain',           domain);
  set('publicity_mode',   isPrivate ? 'private' : 'public');
  set('show_articles',    showArticles ? '1' : '0');
  set('show_micro',       showMicro    ? '1' : '0');
  set('rss_enabled',      rssEnabled   ? '1' : '0');
  p('  ' + style('✓', c.green) + '  Config saved');

  if (apEnabled) {
    await ensureKeyPair(db);
    p('  ' + style('✓', c.green) + '  ActivityPub key pair generated');
  }

  mkdirSync('./media', { recursive: true });
  p('  ' + style('✓', c.green) + '  Media directory ready');

  // ── Done ──────────────────────────────────────────────────────────────────
  p();
  hr();
  p(style('  ✨  Setup complete!', c.bold + c.green));
  hr();
  p();
  p(`  ${style('Public site', c.dim)}   http://localhost:${publicPort}`);
  p(`  ${style('Author UI  ', c.dim)}   http://localhost:${authorPort}`);
  if (apEnabled) {
    p(`  ${style('Fediverse  ', c.dim)}   @${apUsername}@${domain}`);
  }
  p();
  p('  ' + style('bun run src/main.ts', c.cyan + c.bold));
  p();
}
