import type { Database } from 'bun:sqlite';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { authorLayout } from './layout';
import { runExport } from '../../../cli/commands/export';
import { getDashboardStats } from '../../data/dashboard';

export function renderExportPage(db: Database): JSX.Element {
  const stats = getDashboardStats(db);
  const counts = {
    articles: stats.articleCount,
    micro: stats.microActiveCount,
    pages: stats.pageCount,
    media: stats.mediaCount,
  };
  const total = counts.articles + counts.micro + counts.pages + counts.media;

  const content = (
    <div>
      <div class="page-hd">
        <h2>Export</h2>
      </div>

      <p style="color:var(--g-text-muted);max-width:52ch;margin-bottom:1.75rem;font-size:.88rem">
        Download all your content as portable Markdown files with YAML frontmatter —
        compatible with Hugo, Eleventy, Jekyll, and any static site generator.
        Media files are included as-is.
      </p>

      <div class="stat-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:2rem">
        <div class="stat-card">
          <div class="stat-num">{counts.articles}</div>
          <div class="stat-label">Articles</div>
        </div>
        <div class="stat-card">
          <div class="stat-num">{counts.micro}</div>
          <div class="stat-label">Notes</div>
        </div>
        <div class="stat-card">
          <div class="stat-num">{counts.pages}</div>
          <div class="stat-label">Pages</div>
        </div>
        <div class="stat-card">
          <div class="stat-num">{counts.media}</div>
          <div class="stat-label">Media</div>
        </div>
      </div>

      <form method="POST" action="/export/download" style="margin-bottom:1.75rem">
        <button type="submit" class="btn btn-primary">
          ↓ Download export (.tar.gz)
        </button>
        <span style="font-size:.78rem;color:var(--g-text-muted);margin-left:.85rem">
          {total} item{total !== 1 ? 's' : ''}
        </span>
      </form>

      <div style="border-top:1px solid var(--g-border-faint);padding-top:1.25rem">
        <p style="font-size:.8rem;color:var(--g-text-muted);margin:0">
          You can also export from the CLI: <code>grip export [--out ./my-export]</code>
        </p>
      </div>
    </div>
  );

  return authorLayout('Export', content, db, '/export');
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
    try { rmSync(tmpBase, { recursive: true, force: true }); } catch { /* ignore */ }
    try { if (existsSync(tarPath)) rmSync(tarPath); } catch { /* ignore */ }
  }
}
