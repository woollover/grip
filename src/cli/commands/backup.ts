import { mkdirSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { getDb } from '../../core/db';
import { version } from '../../../package.json';

export interface BackupStats {
  dbSize: number;
  mediaFiles: number;
  outFile: string;
  createdAt: string;
}

export async function runBackup(
  db: ReturnType<typeof getDb>,
  outFile: string,
  mediaDir: string,
): Promise<BackupStats> {
  const createdAt = new Date().toISOString();
  const dirName = `grip-backup-${createdAt.replace(/[:.]/g, '-').slice(0, 19)}`;
  const tmpBase = `/tmp/${dirName}-${Date.now()}`;
  const backupDir = join(tmpBase, dirName);
  const mediaOut = join(backupDir, 'media');

  mkdirSync(backupDir, { recursive: true });
  mkdirSync(mediaOut, { recursive: true });

  // Hot SQLite snapshot — consistent even under concurrent writes
  const snapshot = db.serialize();
  await Bun.write(join(backupDir, 'grip.sqlite'), snapshot);

  // Copy media files
  let mediaFiles = 0;
  if (existsSync(mediaDir)) {
    const entries = readdirSync(mediaDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const src = Bun.file(join(mediaDir, entry.name));
      await Bun.write(join(mediaOut, entry.name), src);
      mediaFiles++;
    }
  }

  // Manifest
  const info = { created_at: createdAt, grip_version: version, db_size: snapshot.byteLength, media_files: mediaFiles };
  await Bun.write(join(backupDir, 'backup-info.json'), JSON.stringify(info, null, 2));

  // Create tarball
  mkdirSync(dirname(outFile), { recursive: true });
  const proc = Bun.spawn(['tar', '-czf', outFile, '-C', tmpBase, dirName], { stderr: 'inherit' });
  const exitCode = await proc.exited;
  if (exitCode !== 0) throw new Error(`tar exited with code ${exitCode}`);

  // Cleanup temp dir
  const rmProc = Bun.spawn(['rm', '-rf', tmpBase], { stderr: 'inherit' });
  await rmProc.exited;

  return { dbSize: snapshot.byteLength, mediaFiles, outFile, createdAt };
}

export async function backupCommand(args: string[]): Promise<void> {
  const outFlagIdx = args.indexOf('--out');
  const outArg = outFlagIdx !== -1 ? args[outFlagIdx + 1] : undefined;
  const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outFile = outArg ?? `./grip-backup-${dateStr}.tar.gz`;
  const mediaDir = `${process.cwd()}/media`;

  const db = getDb();
  console.log(`\nBacking up GRIP to ${outFile} …\n`);

  const stats = await runBackup(db, outFile, mediaDir);

  const dbMb = (stats.dbSize / 1024 / 1024).toFixed(2);
  console.log(`  ✓  Database    ${dbMb} MB`);
  console.log(`  ✓  Media       ${stats.mediaFiles} files`);
  console.log(`\nBackup complete: ${stats.outFile}\n`);
}
