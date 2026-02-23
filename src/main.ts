import { getDb } from './core/db';
import { EventStore } from './core/events';
import { rebuild } from './core/projections';
import { createAuthorApp } from './server/author/index';
import { createPublicApp } from './server/public/index';
import { loadApConfig } from './activitypub/config';
import { ensureKeyPair } from './activitypub/keys';
import { existsSync } from 'fs';

interface GripConfig {
  server: { public_port: number; author_port: number; domain: string };
  data: { db_path: string; media_path: string };
  site: { title: string; description: string };
  activitypub?: { enabled: boolean; username: string; accept_replies: boolean };
}

async function loadConfig(): Promise<{ config: GripConfig; rawToml: any }> {
  const tomlPath = `${process.cwd()}/grip.toml`;
  if (!existsSync(tomlPath)) {
    console.warn('grip.toml not found — using defaults. Run: bun run src/cli/index.ts setup');
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
    },
    rawToml: toml,
  };
}

export async function main(): Promise<void> {
  const { config, rawToml } = await loadConfig();

  // Init DB and rebuild projections synchronously before binding ports
  const db = getDb(config.data.db_path);
  const store = new EventStore(db);
  const allEvents = store.all();
  console.log(`Replaying ${allEvents.length} events to rebuild projections…`);
  rebuild(db, allEvents);
  console.log('Projections ready.');

  // ActivityPub (opt-in)
  const apCfg = loadApConfig(rawToml, config.server.domain);
  if (apCfg) {
    await ensureKeyPair(db);
    console.log(`ActivityPub enabled as @${apCfg.username}@${apCfg.domain}`);
  }

  // Start both servers
  const publicApp = createPublicApp(db, config.server.public_port, apCfg);
  const authorApp = createAuthorApp(db, config.server.author_port, apCfg);

  publicApp.listen(config.server.public_port);
  authorApp.listen(config.server.author_port);

  console.log(`\nGRIP running`);
  console.log(`  Public:  http://localhost:${config.server.public_port}`);
  console.log(`  Author:  http://localhost:${config.server.author_port}`);
}

// Run when invoked directly
main().catch((err) => {
  console.error('Failed to start GRIP:', err);
  process.exit(1);
});
