import { authorLayout } from './layout';
import { esc } from '../../../views/shared';
import type { GripDb } from '../../data/index';
import type { EventRow } from '../../data/dashboard';

function fmtRelative(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'yesterday';
  if (days < 14)  return `${days} days ago`;
  if (days < 60)  return 'last week';
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function humanEventType(type: string): string {
  switch (type) {
    case 'ArticlePublished':  return 'PUBLISHED';
    case 'ArticleRevised':    return 'REVISED';
    case 'ArticleCreated':    return 'DRAFT';
    case 'ArticleUnpublished': return 'UNPUBLISHED';
    case 'MicroPostCreated':  return 'NOTE';
    case 'MicroPostRetracted': return 'RETRACTED';
    case 'MicroPostRestored': return 'RESTORED';
    case 'MediaUploaded':     return 'UPLOAD';
    case 'SiteConfigUpdated': return 'CONFIG';
    case 'PagePublished':     return 'PAGE';
    case 'PageCreated':       return 'PAGE';
    case 'PageRevised':       return 'PAGE';
    default: return type.toUpperCase().slice(0, 12);
  }
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning.';
  if (h < 18) return 'Good afternoon.';
  return 'Good evening.';
}

export function renderDashboard(db: GripDb): JSX.Element {
  const stats = db.dashboard.getStats();
  const { articleCount, publishedCount, draftCount, microCount, microActiveCount,
          pageCount, pagePublishedCount, mediaCount, imageCount } = stats;
  const microRetractedCount = microCount - microActiveCount;
  const recentEvents = db.dashboard.getRecentEvents(10);

  function eventDescription(e: EventRow): JSX.Element {
    try {
      const p = JSON.parse(e.payload) as Record<string, unknown>;
      switch (e.type) {
        case 'ArticlePublished':
        case 'ArticleRevised':
        case 'ArticleCreated':
        case 'ArticleUnpublished': {
          const title = (p.title as string | undefined) || '';
          if (title) return <span>"{esc(title)}" <em>— article</em></span>;
          const id = (p.id as string | undefined) || '';
          if (id) {
            const article = db.articles.getById(id);
            if (article?.title) return <span>"{esc(article.title)}" <em>— article</em></span>;
          }
          return <span><em>article</em></span>;
        }
        case 'MicroPostCreated': {
          const body = (p.body as string | undefined) || '';
          const snippet = body.slice(0, 60) + (body.length > 60 ? '…' : '');
          return <span>"{esc(snippet)}" <em>— note</em></span>;
        }
        case 'MicroPostRetracted':
        case 'MicroPostRestored': {
          const id = (p.id as string | undefined) || '';
          const post = id ? db.micro.getById(id) : null;
          const snippet = post?.body_md?.slice(0, 50) || '';
          return snippet ? <span>"{esc(snippet)}…" <em>— note</em></span> : <em>note</em>;
        }
        case 'MediaUploaded': {
          const filename = (p.filename as string | undefined) || (p.id as string | undefined) || 'file';
          const mimeType = (p.mimeType as string | undefined) || '';
          return <span>{esc(filename)}{mimeType ? ` — ${esc(mimeType)}` : ''}</span>;
        }
        case 'SiteConfigUpdated': {
          return <em>site settings changed</em>;
        }
        case 'PagePublished':
        case 'PageCreated':
        case 'PageRevised': {
          const title = (p.title as string | undefined) || '';
          return title ? <span>"{esc(title)}" <em>— page</em></span> : <em>page</em>;
        }
        default:
          return <em>{esc(e.type)}</em>;
      }
    } catch {
      return <em>{esc(e.type)}</em>;
    }
  }

  const content = (
    <div>
      <p class="greeting">{greeting()}</p>

      <div class="stat-grid">
        <div class="stat-card">
          <div>
            <span class="stat-card-big">{articleCount}</span>
            <p class="stat-card-sub">articles · {publishedCount} published · {draftCount} draft{draftCount !== 1 ? 's' : ''}</p>
          </div>
          <div><a href="/articles/new" class="btn btn-outline btn-sm">+ New article</a></div>
        </div>
        <div class="stat-card">
          <div>
            <span class="stat-card-big">{microCount}</span>
            <p class="stat-card-sub">notes · {microActiveCount} active{microRetractedCount > 0 ? ` · ${microRetractedCount} retracted` : ''}</p>
          </div>
          <div><a href="/micro" class="btn btn-outline btn-sm">+ Write a note</a></div>
        </div>
        <div class="stat-card">
          <div>
            <span class="stat-card-big">{pageCount}</span>
            <p class="stat-card-sub">pages · {pagePublishedCount} published</p>
          </div>
          <div><a href="/pages" class="btn btn-ghost btn-sm" style="color:var(--g-text-muted)">Manage pages →</a></div>
        </div>
        <div class="stat-card">
          <div>
            <span class="stat-card-big">{mediaCount}</span>
            <p class="stat-card-sub">media files · {imageCount} image{imageCount !== 1 ? 's' : ''}</p>
          </div>
          <div><a href="/media" class="btn btn-ghost btn-sm" style="color:var(--g-text-muted)">Upload →</a></div>
        </div>
      </div>

      <h3 style="font-size:.72rem;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--g-text-muted);margin-bottom:.75rem">Recent activity</h3>
      {recentEvents.length === 0
        ? <p style="color:var(--g-text-muted);font-size:.85rem">No activity yet.</p>
        : (
          <div class="activity-table">
            {recentEvents.map(e => (
              <div class="activity-row">
                <span class="activity-ev-type">{humanEventType(e.type)}</span>
                <span>{eventDescription(e)}</span>
                <span class="activity-ev-time">{fmtRelative(e.created_at)}</span>
              </div>
            ))}
          </div>
        )
      }
    </div>
  );

  return authorLayout('Dashboard', content, db, '/dashboard');
}
