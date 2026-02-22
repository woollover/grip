import { existsSync, readFileSync } from 'fs';
import { getDb } from '../../core/db';
import { EventStore } from '../../core/events';
import { applyEvent } from '../../core/projections';
import { ulid } from 'ulidx';

export function postCommand(args: string[]): void {
  const file = args[0];
  if (!file) {
    console.error('Usage: grip post <file.md>');
    process.exit(1);
  }

  if (!existsSync(file)) {
    console.error(`File not found: ${file}`);
    process.exit(1);
  }

  const content = readFileSync(file, 'utf8');

  // Parse front matter (simple --- delimited YAML-ish)
  let title = '';
  let slug = '';
  let tags: string[] = [];
  let body = content;

  if (content.startsWith('---')) {
    const end = content.indexOf('---', 3);
    if (end !== -1) {
      const frontMatter = content.slice(3, end).trim();
      body = content.slice(end + 3).trim();

      for (const line of frontMatter.split('\n')) {
        const [key, ...rest] = line.split(':');
        const value = rest.join(':').trim();
        if (key.trim() === 'title') title = value.replace(/^["']|["']$/g, '');
        if (key.trim() === 'slug') slug = value.replace(/^["']|["']$/g, '');
        if (key.trim() === 'tags') tags = value.split(',').map(t => t.trim()).filter(Boolean);
      }
    }
  }

  if (!title) {
    // Use filename as title
    title = file.replace(/\.md$/, '').split('/').pop()!;
  }
  if (!slug) {
    slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  const db = getDb();
  const store = new EventStore(db);

  const id = ulid();
  const event = { type: 'ArticleCreated' as const, id, title, slug, body, tags };
  store.append(event);
  applyEvent(db, event, Date.now());

  console.log(`Article created: ${id}`);
  console.log(`  Title: ${title}`);
  console.log(`  Slug:  ${slug}`);
  console.log(`  Tags:  ${tags.join(', ') || '(none)'}`);
  console.log(`  Status: draft`);
  console.log(`\nTo publish: open the author UI at http://localhost:4000/articles/${id}/edit`);
}
