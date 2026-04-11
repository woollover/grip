import { publicLayout } from '../../../views/layout';
import type { GripDb } from '../../data/index';

export function renderPage(db: GripDb, slug: string, siteTitle: string): JSX.Element | null {
  const page = db.pages.get(slug);
  if (!page) return null;

  const content = (
    <article>
      <h1 style="margin-top:0;margin-bottom:2rem">{page.title}</h1>
      <div class="prose">{page.body_html}</div>
    </article>
  );

  return publicLayout({ title: page.title, siteTitle, db }, content);
}
