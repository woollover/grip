import { getDb } from './core/db';
import { EventStore } from './core/events';
import { rebuild } from './core/projections';
import { createAuthorApp } from './server/author/index';
import { createPublicApp } from './server/public/index';
import { loadApConfig } from './activitypub/config';
import { ensureKeyPair } from './activitypub/keys';
import { existsSync } from 'fs';
import { log } from './core/logger';
import type { LogLevel } from './core/logger';

interface GripConfig {
  server: { public_port: number; author_port: number; domain: string };
  data: { db_path: string; media_path: string };
  site: { title: string; description: string };
  activitypub?: { enabled: boolean; username: string; accept_replies: boolean };
  logging?: { level?: LogLevel; log_file?: string };
}

async function loadConfig(): Promise<{ config: GripConfig; rawToml: any }> {
  const tomlPath = `${process.cwd()}/grip.toml`;
  if (!existsSync(tomlPath)) {
    log.warn('grip.toml not found — using defaults. Run: bun run src/cli/index.ts setup');
    return {
      config: {
        server: { public_port: 3000, author_port: 4000, domain: 'localhost' },
        data: { db_path: './data/grip.sqlite', media_path: './media' },
        site: { title: 'My GRIP', description: 'A personal publishing space' },
      },
      rawToml: {},
    };
  }
  const text = await Bun.file(tomlPath).text();
  const toml = (await import('toml')).default.parse(text);
  return {
    config: {
      server: {
        public_port: toml.server?.public_port ?? 3000,
        author_port: toml.server?.author_port ?? 4000,
        domain: toml.server?.domain ?? 'localhost',
      },
      data: {
        db_path: toml.data?.db_path ?? './data/grip.sqlite',
        media_path: toml.data?.media_path ?? './media',
      },
      site: {
        title: toml.site?.title ?? 'My GRIP',
        description: toml.site?.description ?? '',
      },
      logging: toml.logging ?? undefined,
    },
    rawToml: toml,
  };
}

export async function main(): Promise<void> {
  const { config, rawToml } = await loadConfig();

  // Configure logger from grip.toml [logging] section
  if (config.logging?.level) {
    log.setLevel(config.logging.level);
  }
  if (config.logging?.log_file) {
    log.initFile(config.logging.log_file);
  }

  // Init DB and rebuild projections synchronously before binding ports
  const db = getDb(config.data.db_path);
  const store = new EventStore(db);
  const allEvents = store.all();
  log.info(`Replaying ${allEvents.length} events to rebuild projections…`);
  rebuild(db, allEvents);
  log.info('Projections ready.');

  // ActivityPub (opt-in)
  const apCfg = loadApConfig(rawToml, config.server.domain);
  if (apCfg) {
    await ensureKeyPair(db);
    db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run('ap_enabled', '1');
    db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run('ap_username', apCfg.username);
    log.info(`ActivityPub enabled as @${apCfg.username}@${apCfg.domain}`);
  } else {
    db.prepare('DELETE FROM config WHERE key = ?').run('ap_enabled');
  }

  // Start both servers
  const publicApp = createPublicApp(db, config.server.public_port, apCfg);
  const authorApp = createAuthorApp(db, apCfg);

  publicApp.listen(config.server.public_port);
  authorApp.listen(config.server.author_port);

  log.info(`\nGRIP running`);
  log.info(`  Public:  http://localhost:${config.server.public_port}`);
  log.info(`  Author:  http://localhost:${config.server.author_port}`);
}

// Run when invoked directly
main().catch((err) => {
  log.error('Failed to start GRIP:', err);
  process.exit(1);
});
