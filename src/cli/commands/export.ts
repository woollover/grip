import { mkdirSync, copyFileSync, existsSync, readdirSync } from 'fs';
import { join, extname } from 'path';
import { getDb } from '../../core/db';

interface ArticleRow {
  id: string; slug: string; title: string; body_md: string;
  tags: string; status: string; created_at: number; published_at: number | null;
}
interface MicroRow {
  id: string; body_md: string; status: string; created_at: number;
}
interface PageRow {
  id: string; slug: string; title: string; body_md: string;
  status: string; created_at: number; updated_at: number;
}
interface MediaRow {
  id: string; filename: string; mime_type: string; path: string;
}

export interface ExportStats {
  articles: number;
  micro: number;
  pages: number;
  media: number;
  outDir: string;
}

function isoDate(ms: number): string {
  return new Date(ms).toISOString();
}

function frontmatter(fields: Record<string, string | string[] | null | undefined>): string {
  const lines = ['---'];
  for (const [k, v] of Object.entries(fields)) {
    if (v === null || v === undefined) continue;
    if (Array.isArray(v)) {
      lines.push(`${k}: [${v.map(t => `"${t.replace(/"/g, '\\"')}"`).join(', ')}]`);
    } else {
      lines.push(`${k}: ${JSON.stringify(v)}`);
    }
  }
  lines.push('---\n');
  return lines.join('\n');
}

export async function runExport(
  db: ReturnType<typeof getDb>,
  outDir: string,
  mediaDir: string,
): Promise<ExportStats> {
  const articlesDir = join(outDir, 'articles');
  const microDir = join(outDir, 'micro');
  const pagesDir = join(outDir, 'pages');
  const mediaOutDir = join(outDir, 'media');

  mkdirSync(articlesDir, { recursive: true });
  mkdirSync(microDir, { recursive: true });
  mkdirSync(pagesDir, { recursive: true });
  mkdirSync(mediaOutDir, { recursive: true });

  // Articles
  const articles = db.prepare('SELECT * FROM articles ORDER BY created_at ASC').all() as ArticleRow[];
  for (const a of articles) {
    const tags: string[] = JSON.parse(a.tags);
    const fm = frontmatter({
      title: a.title,
      slug: a.slug,
      status: a.status,
      tags: tags.length ? tags : undefined,
      created_at: isoDate(a.created_at),
      published_at: a.published_at ? isoDate(a.published_at) : undefined,
    });
    await Bun.write(join(articlesDir, `${a.slug}.md`), fm + a.body_md);
  }

  // Micro posts
  const micros = db.prepare('SELECT * FROM micro_posts ORDER BY created_at ASC').all() as MicroRow[];
  for (const m of micros) {
    const dt = new Date(m.created_at);
    const name = `${dt.toISOString().replace(/[:.]/g, '-').slice(0, 19)}-${m.id}.md`;
    const fm = frontmatter({
      id: m.id,
      status: m.status,
      created_at: isoDate(m.created_at),
    });
    await Bun.write(join(microDir, name), fm + m.body_md);
  }

  // Pages
  const pages = db.prepare('SELECT * FROM pages ORDER BY created_at ASC').all() as PageRow[];
  for (const p of pages) {
    const fm = frontmatter({
      title: p.title,
      slug: p.slug,
      status: p.status,
      created_at: isoDate(p.created_at),
      updated_at: isoDate(p.updated_at),
    });
    await Bun.write(join(pagesDir, `${p.slug}.md`), fm + p.body_md);
  }

  // Media — copy from media dir by stored path, fall back to scanning by id
  const mediaRows = db.prepare('SELECT * FROM media').all() as MediaRow[];
  let mediaCopied = 0;
  for (const m of mediaRows) {
    const src = existsSync(m.path) ? m.path : join(mediaDir, m.path);
    if (!existsSync(src)) continue;
    const dest = join(mediaOutDir, m.filename);
    copyFileSync(src, dest);
    mediaCopied++;
  }

  // Manifest
  const manifest = {
    exported_at: new Date().toISOString(),
    counts: { articles: articles.length, micro: micros.length, pages: pages.length, media: mediaCopied },
  };
  await Bun.write(join(outDir, 'grip-export.json'), JSON.stringify(manifest, null, 2));

  return { articles: articles.length, micro: micros.length, pages: pages.length, media: mediaCopied, outDir };
}

export async function exportCommand(args: string[]): Promise<void> {
  const outFlagIdx = args.indexOf('--out');
  const outArg = outFlagIdx !== -1 ? args[outFlagIdx + 1] : undefined;
  const dateStr = new Date().toISOString().slice(0, 10);
  const outDir = outArg ?? `./grip-export-${dateStr}`;
  const mediaDir = `${process.cwd()}/media`;

  const db = getDb();
  console.log(`\nExporting GRIP content to ${outDir} …\n`);

  const stats = await runExport(db, outDir, mediaDir);

  console.log(`  ✓  Articles   ${stats.articles}`);
  console.log(`  ✓  Micro      ${stats.micro}`);
  console.log(`  ✓  Pages      ${stats.pages}`);
  console.log(`  ✓  Media      ${stats.media}`);
  console.log(`\nExport complete: ${outDir}\n`);
}
