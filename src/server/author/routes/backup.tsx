import { authorLayout } from './layout';
import { runBackup } from '../../../cli/commands/backup';
import type { GripDb } from '../../data/index';

export function renderBackupPage(db: GripDb): JSX.Element {
  const content = (
    <div style="max-width:640px">
      <div class="page-hd">
        <h2>Backup</h2>
      </div>

      <p style="color:var(--g-text-muted);font-size:.88rem;margin-bottom:2rem">
        Download a complete snapshot of your GRIP — the SQLite database and all media files,
        bundled into a single <code>.tar.gz</code>. The snapshot is consistent even while the
        server is running.
      </p>

      <form method="POST" action="/backup/download" style="margin-bottom:2.5rem">
        <button type="submit" class="btn btn-primary" style="font-size:.9rem;padding:.5rem 1.25rem">
          ↓ Download backup (.tar.gz)
        </button>
      </form>

      <div style="border-top:1px solid var(--g-border);padding-top:1.5rem">
        <h3 style="margin-bottom:.75rem;font-size:1rem">Restore</h3>
        <p style="color:var(--g-text-muted);font-size:.85rem;margin-bottom:1rem">
          Restoring replaces your database and media with a previous backup.
          Must be done from the CLI while the server is stopped:
        </p>
        <pre style="font-size:.8rem;margin-bottom:1rem"><code>{`systemctl stop grip
grip restore /path/to/grip-backup.tar.gz
systemctl start grip`}</code></pre>
        <p style="color:var(--g-text-muted);font-size:.78rem;margin:0">
          The existing database and media are kept as <code>.bak</code> sidecars until you delete them.
        </p>
      </div>
    </div>
  );

  return authorLayout('Backup', content, db, '/backup');
}

export async function handleBackupDownload(db: GripDb): Promise<Response> {
  const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outFile = `/tmp/grip-backup-${dateStr}-${Date.now()}.tar.gz`;
  const mediaDir = `${process.cwd()}/media`;

  try {
    await runBackup(db.raw, outFile, mediaDir);
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
