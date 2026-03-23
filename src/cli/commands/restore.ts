import { existsSync, renameSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getDb } from '../../core/db';

export async function restoreCommand(args: string[]): Promise<void> {
  const backupFile = args[0];
  if (!backupFile) {
    console.error('\nUsage: grip restore <backup.tar.gz>\n');
    process.exit(1);
  }

  if (!existsSync(backupFile)) {
    console.error(`\nBackup file not found: ${backupFile}\n`);
    process.exit(1);
  }

  const dbPath = `${process.cwd()}/data/grip.sqlite`;
  const mediaDir = `${process.cwd()}/media`;

  // Sanity-check: try opening the DB with WAL checkpoint to detect a locked DB
  // A locked DB means grip is still running
  try {
    const db = getDb(dbPath);
    db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    db.close();
  } catch (err) {
    console.error('\nCould not acquire database lock. Is grip still running?');
    console.error('Stop it first:  systemctl stop grip\n');
    process.exit(1);
  }

  const tmpDir = `/tmp/grip-restore-${Date.now()}`;
  mkdirSync(tmpDir, { recursive: true });

  console.log(`\nRestoring from ${backupFile} …\n`);

  // Extract
  const extract = Bun.spawn(['tar', '-xzf', backupFile, '-C', tmpDir], { stderr: 'inherit' });
  if (await extract.exited !== 0) {
    console.error('Failed to extract backup archive.');
    process.exit(1);
  }

  // Find the inner directory (grip-backup-*)
  const { readdirSync } = await import('fs');
  const entries = readdirSync(tmpDir, { withFileTypes: true }).filter(e => e.isDirectory());
  if (entries.length === 0) {
    console.error('Backup archive appears empty or malformed.');
    process.exit(1);
  }
  const innerDir = join(tmpDir, entries[0].name);

  // Validate backup-info.json is present
  const infoPath = join(innerDir, 'backup-info.json');
  if (!existsSync(infoPath)) {
    console.error('Not a valid GRIP backup — backup-info.json missing.');
    process.exit(1);
  }
  const info = JSON.parse(await Bun.file(infoPath).text());
  console.log(`  Backup created:  ${info.created_at}`);
  console.log(`  GRIP version:    ${info.grip_version}`);
  console.log(`  DB size:         ${(info.db_size / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Media files:     ${info.media_files}`);
  console.log();

  const restoredDb = join(innerDir, 'grip.sqlite');
  const restoredMedia = join(innerDir, 'media');

  if (!existsSync(restoredDb)) {
    console.error('Backup archive is missing grip.sqlite.');
    process.exit(1);
  }

  // Safety net: move existing DB and media aside as .bak
  const timestamp = Date.now();
  if (existsSync(dbPath)) {
    renameSync(dbPath, `${dbPath}.bak-${timestamp}`);
    console.log(`  Moved existing DB    → ${dbPath}.bak-${timestamp}`);
  }
  if (existsSync(mediaDir)) {
    renameSync(mediaDir, `${mediaDir}.bak-${timestamp}`);
    console.log(`  Moved existing media → ${mediaDir}.bak-${timestamp}`);
  }

  // Move restored files into place
  const { mkdirSync: mkdir, copyFileSync, readdirSync: readdir } = await import('fs');
  mkdir(join(dbPath, '..'), { recursive: true });
  copyFileSync(restoredDb, dbPath);
  console.log(`  ✓  Database restored`);

  if (existsSync(restoredMedia)) {
    mkdir(mediaDir, { recursive: true });
    for (const entry of readdir(restoredMedia, { withFileTypes: true })) {
      if (entry.isFile()) {
        copyFileSync(join(restoredMedia, entry.name), join(mediaDir, entry.name));
      }
    }
    console.log(`  ✓  Media restored (${info.media_files} files)`);
  }

  // Cleanup temp dir
  Bun.spawn(['rm', '-rf', tmpDir]);

  console.log(`\nRestore complete. Start grip:  systemctl start grip\n`);
  console.log(`  (Old files kept as .bak-${timestamp} — delete when satisfied)\n`);
}
