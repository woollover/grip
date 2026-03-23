import type { Database } from 'bun:sqlite';
import { authorLayout } from './layout';
import { runBackup } from '../../../cli/commands/backup';
import { version } from '../../../../package.json';

export function renderBackupPage(db: Database): JSX.Element {
  const content = (
    <div>
      <h2>Backup</h2>
      <p style="color:var(--g-text-muted);max-width:42rem">
        Download a complete backup of your GRIP — the database and all media files
        bundled into a single <code>.tar.gz</code>.
        The snapshot is consistent even while the server is running.
      </p>

      <form method="POST" action="/backup/download" style="margin-bottom:1.5rem">
        <button type="submit">Download backup (.tar.gz)</button>
      </form>

      <hr />
      <h3 style="margin-top:1.5rem">Restore</h3>
      <p style="color:var(--g-text-muted);max-width:42rem;font-size:0.9rem">
        Restoring replaces the database and media with a previous backup.
        This must be done from the CLI while the server is stopped:
      </p>
      <pre style="font-size:0.85rem"><code>{`systemctl stop grip
grip restore /path/to/grip-backup.tar.gz
systemctl start grip`}</code></pre>
      <p style="color:var(--g-text-muted);font-size:0.85rem">
        The existing database and media are kept as <code>.bak</code> sidecars until you delete them.
      </p>
    </div>
  );

  return authorLayout('Backup', content, db);
}

export async function handleBackupDownload(db: Database): Promise<Response> {
  const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outFile = `/tmp/grip-backup-${dateStr}-${Date.now()}.tar.gz`;
  const mediaDir = `${process.cwd()}/media`;

  try {
    await runBackup(db, outFile, mediaDir);
    const buf = await Bun.file(outFile).arrayBuffer();
    return new Response(buf, {
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Disposition': `attachment; filename="grip-backup-${dateStr}.tar.gz"`,
      },
    });
  } finally {
    try { Bun.spawn(['rm', '-f', outFile]); } catch { /* ignore */ }
  }
}
