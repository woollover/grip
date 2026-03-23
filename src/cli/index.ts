#!/usr/bin/env bun
import { setup } from './setup';
import { postCommand } from './commands/post';
import { microCommand } from './commands/micro';
import { serveCommand } from './commands/serve';
import { rebuildCommand } from './commands/rebuild';
import { statusCommand } from './commands/status';
import { exportCommand } from './commands/export';
import { backupCommand } from './commands/backup';
import { restoreCommand } from './commands/restore';

const [, , command, ...args] = process.argv;

const commands: Record<string, (args: string[]) => Promise<void> | void> = {
  setup,
  post: postCommand,
  micro: microCommand,
  serve: serveCommand,
  rebuild: rebuildCommand,
  status: statusCommand,
  export: exportCommand,
  backup: backupCommand,
  restore: restoreCommand,
};

if (!command || command === '--help' || command === '-h') {
  console.log(`
GRIP CLI

Usage: bun run src/cli/index.ts <command> [args]

Commands:
  setup              First-run: set passphrase, create grip.toml, init DB
  serve              Start both public and author servers
  post <file.md>     Publish a Markdown file as an article
  micro "text"       Post a micro-note
  rebuild            Replay all events and rebuild projections
  status             Show last 20 events
  export [--out dir] Export all content as portable Markdown + media files
  backup [--out f]   Snapshot DB + media into a .tar.gz backup
  restore <file>     Restore from a backup (server must be stopped first)
`);
  process.exit(0);
}

const handler = commands[command];
if (!handler) {
  console.error(`Unknown command: ${command}`);
  console.error('Run with --help to see available commands.');
  process.exit(1);
}

Promise.resolve(handler(args)).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
