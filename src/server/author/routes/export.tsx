import type { Database } from 'bun:sqlite';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { authorLayout } from './layout';
import { runExport } from '../../../cli/commands/export';

interface CountRow { n: number }

function getCounts(db: Database) {
  const n = (q: string) => (db.prepare(q).get() as CountRow).n;
  return {
    articles: n('SELECT COUNT(*) as n FROM articles'),
    micro: n('SELECT COUNT(*) as n FROM micro_posts WHERE status = \'active\''),
    pages: n('SELECT COUNT(*) as n FROM pages'),
    media: n('SELECT COUNT(*) as n FROM media'),
  };
}

export function renderExportPage(db: Database): JSX.Element {
  const counts = getCounts(db);

  const content = (
    <div>
      <h2>Export</h2>
      <p style="color:var(--g-text-muted);max-width:42rem">
        Download all your content as portable Markdown files with YAML frontmatter —
        compatible with any static site generator (Hugo, 11ty, Jekyll, etc.).
        Your media files are included as-is.
      </p>

      <table style="width:auto;margin-bottom:1.5rem">
        <tbody>
          <tr><td style="padding-right:2rem">Articles</td><td><strong>{counts.articles}</strong></td></tr>
          <tr><td style="padding-right:2rem">Micro posts</td><td><strong>{counts.micro}</strong></td></tr>
          <tr><td style="padding-right:2rem">Pages</td><td><strong>{counts.pages}</strong></td></tr>
          <tr><td style="padding-right:2rem">Media files</td><td><strong>{counts.media}</strong></td></tr>
        </tbody>
      </table>

      <form method="POST" action="/export/download">
        <button type="submit">Download export (.tar.gz)</button>
      </form>

      <hr style="margin-top:2rem" />
      <p style="font-size:0.875rem;color:var(--g-text-muted)">
        You can also export from the CLI:{' '}
        <code>grip export [--out ./my-export]</code>
      </p>
    </div>
  );

  return authorLayout('Export', content, db);
}

export async function handleExportDownload(db: Database): Promise<Response> {
  const dateStr = new Date().toISOString().slice(0, 10);
  const exportDirName = `grip-export-${dateStr}`;
  const tmpBase = `/tmp/${exportDirName}-${Date.now()}`;
  const exportDir = join(tmpBase, exportDirName);
  const tarPath = `${tmpBase}.tar.gz`;
  const mediaDir = `${process.cwd()}/media`;

  try {
    mkdirSync(exportDir, { recursive: true });
    await runExport(db, exportDir, mediaDir);

    // Build the tarball
    const proc = Bun.spawn(['tar', '-czf', tarPath, '-C', tmpBase, exportDirName], {
      stderr: 'inherit',
    });
    const exitCode = await proc.exited;
    if (exitCode !== 0) throw new Error(`tar exited with code ${exitCode}`);

    const tarFile = Bun.file(tarPath);
    const buf = await tarFile.arrayBuffer();

    return new Response(buf, {
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Disposition': `attachment; filename="${exportDirName}.tar.gz"`,
      },
    });
  } finally {
    // Clean up temp files regardless of outcome
    try { rmSync(tmpBase, { recursive: true, force: true }); } catch { /* ignore */ }
    try { if (existsSync(tarPath)) rmSync(tarPath); } catch { /* ignore */ }
  }
}
