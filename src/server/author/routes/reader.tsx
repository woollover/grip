import type { ApConfig } from '../../../activitypub/config';
import { authorLayout } from './layout';
import { paginationNav, fmtDate } from '../../../views/shared';
import type { GripDb } from '../../data/index';
import {
  getRssSubs, getRssSubById, getRssSubByUrl,
  addRssSub, updateRssSubMeta, deleteRssSub,
  getApFollowing, getApFollowingById, getApFollowingByActorUrl,
  addApFollowing, deleteApFollowing, updateApFollowingFetched,
  getReaderItems, countReaderItems, upsertReaderItems,
  type RssSub, type ApFollowing, type ReaderItem,
} from '../../../reader/store';
import { fetchFeed, stripHtml } from '../../../reader/rss';
import { resolveActor, fetchActorOutbox, sendFollowActivity, sendUnfollowActivity } from '../../../reader/ap';

const PAGE_SIZE = 20;

// ── Shared helpers ─────────────────────────────────────────────────────────────

function fmtRelative(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30)  return `${days}d ago`;
  return fmtDate(ms);
}

function preview(html: string, max = 280): string {
  const text = stripHtml(html);
  if (text.length <= max) return text;
  return text.slice(0, max) + '…';
}

// ── Reader home ────────────────────────────────────────────────────────────────

export function renderReaderHome(db: GripDb, page: number): JSX.Element {
  const offset = (page - 1) * PAGE_SIZE;
  const total = countReaderItems(db.raw);
  const items = getReaderItems(db.raw, { limit: PAGE_SIZE, offset });
  const rssSubs = getRssSubs(db.raw);
  const apSubs = getApFollowing(db.raw);
  const hasAnySub = rssSubs.length > 0 || apSubs.length > 0;

  const sidebar = (
    <div class="reader-sidebar">
      <div class="reader-sidebar-section">
        <div class="reader-sidebar-label">All</div>
        <a href="/reader" class="reader-sidebar-item active">
          <span>All items</span>
          {total > 0 && <span class="reader-sidebar-count">{total}</span>}
        </a>
      </div>
      <hr style="margin:.25rem .85rem;border:none;border-top:1px solid var(--g-border-faint)" />
      <div class="reader-sidebar-section">
        <div class="reader-sidebar-label">RSS Feeds</div>
        {rssSubs.map(sub => (
          <a href="/reader/rss" class="reader-sidebar-item">
            <span safe>{sub.title || sub.url}</span>
            {(sub.item_count ?? 0) > 0 && <span class="reader-sidebar-count muted">{sub.item_count}</span>}
          </a>
        ))}
        <a href="/reader/rss" class="reader-sidebar-add">+ Add feed</a>
      </div>
      <hr style="margin:.25rem .85rem;border:none;border-top:1px solid var(--g-border-faint)" />
      <div class="reader-sidebar-section">
        <div class="reader-sidebar-label">Following</div>
        {apSubs.map(f => (
          <a href="/reader/ap" class="reader-sidebar-item">
            <span safe>@{f.username}@{f.domain}</span>
            {(f.item_count ?? 0) > 0 && <span class="reader-sidebar-count muted">{f.item_count}</span>}
          </a>
        ))}
        <a href="/reader/ap" class="reader-sidebar-add">+ Follow someone</a>
      </div>
    </div>
  );

  const mainContent = (
    <div class="reader-main">
      <div class="reader-toolbar">
        <span style="color:var(--g-text-muted)">{total} item{total !== 1 ? 's' : ''}</span>
        <span class="spacer"></span>
        <a href="/reader/rss" class="btn btn-ghost btn-sm">Manage feeds</a>
        <span style="color:var(--g-border)">·</span>
        <a href="/reader/ap" class="btn btn-ghost btn-sm">Manage following</a>
      </div>

      {!hasAnySub && (
        <div class="reader-empty">
          <p>No subscriptions yet.</p>
          <p>
            <a href="/reader/rss">Add an RSS feed</a> or{' '}
            <a href="/reader/ap">follow an ActivityPub profile</a> to start reading.
          </p>
        </div>
      )}

      {hasAnySub && items.length === 0 && (
        <div class="reader-empty">
          <p>No items yet. Refresh your subscriptions to fetch new content.</p>
        </div>
      )}

      {items.map(item => <ReaderItemCard item={item} />)}

      {total > PAGE_SIZE && (
        <div style="padding:.85rem 1.25rem">
          {paginationNav(page, total, PAGE_SIZE, '/reader')}
        </div>
      )}
    </div>
  );

  const content = (
    <div class="reader-layout">
      {sidebar}
      {mainContent}
    </div>
  );

  return authorLayout('Reader', content, db, '/reader', true);
}

function ReaderItemCard({ item }: { item: ReaderItem }): JSX.Element {
  const hasTitle = item.title.trim().length > 0;
  const bodyPreview = preview(item.content_html);
  const sourceName = item.source_name ?? (item.source_type === 'rss' ? 'RSS' : 'AP');

  return (
    <div class="reader-item-card">
      <div class="reader-item-meta-row">
        <span class={`reader-source-badge ${item.source_type}`}>{item.source_type.toUpperCase()}</span>
        <span safe>{sourceName}</span>
        {item.author && item.author !== sourceName && <><span>·</span><span safe>{item.author}</span></>}
        <span>·</span>
        <span>{fmtRelative(item.published_at)}</span>
      </div>
      {hasTitle && (
        <div class="reader-item-title">
          {item.item_url
            ? <a href={item.item_url} target="_blank" rel="noopener noreferrer" safe>{item.title}</a>
            : <span safe>{item.title}</span>
          }
        </div>
      )}
      {bodyPreview && (
        <div class="reader-item-preview" safe>{bodyPreview}</div>
      )}
      <div class="reader-item-actions">
        {item.item_url && (
          <a href={item.item_url} target="_blank" rel="noopener noreferrer">Open original ↗</a>
        )}
      </div>
    </div>
  );
}

// ── RSS Subscriptions ──────────────────────────────────────────────────────────

export function renderRssIndex(db: GripDb): JSX.Element {
  const subs = getRssSubs(db.raw);

  const content = (
    <div>
      <div class="page-hd">
        <h2>RSS Feeds</h2>
        <a href="/reader" class="btn btn-ghost btn-sm">← Reader</a>
      </div>

      <div style="margin-bottom:2rem">
        <form method="POST" action="/reader/rss" style="display:flex;gap:.5rem;align-items:flex-end;flex-wrap:wrap">
          <label style="flex:1;min-width:240px;margin:0;font-size:.78rem">
            Feed URL
            <input type="url" name="url" placeholder="https://example.com/rss.xml" required />
          </label>
          <button type="submit" class="btn btn-primary btn-sm">Subscribe</button>
        </form>
      </div>

      {subs.length === 0 && (
        <p style="color:var(--g-text-muted);font-size:.85rem">No feeds yet.</p>
      )}

      <div>
        {subs.map(sub => (
          <div class="article-row">
            <div style="width:8px;height:8px;border-radius:50%;background:#e0562f;flex-shrink:0;margin-top:.3rem"></div>
            <div class="article-info">
              <span class="article-row-title" style="display:block;margin-bottom:.2rem" safe>{sub.title || sub.url}</span>
              <div class="article-row-meta">
                <span safe>{sub.url}</span>
                <span>·</span>
                <span>{sub.item_count ?? 0} item{(sub.item_count ?? 0) !== 1 ? 's' : ''}</span>
                <span>·</span>
                <span>{sub.last_fetched_at ? fmtRelative(sub.last_fetched_at) : 'never fetched'}</span>
              </div>
            </div>
            <div class="article-row-actions">
              <form method="POST" action={`/reader/rss/${sub.id}/refresh`} style="margin:0">
                <button type="submit" class="btn btn-outline btn-sm">Refresh</button>
              </form>
              <form method="POST" action={`/reader/rss/${sub.id}/delete`} style="margin:0"
                onsubmit="return confirm('Remove this feed and all its items?')">
                <button type="submit" class="btn btn-ghost btn-sm">Remove</button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
  return authorLayout('RSS Feeds', content, db, '/reader');
}

// ── AP Following ───────────────────────────────────────────────────────────────

export function renderApFollowingIndex(db: GripDb, apCfg: ApConfig | null): JSX.Element {
  const following = getApFollowing(db.raw);
  const apEnabled = !!apCfg;

  const content = (
    <div>
      <div class="page-hd">
        <h2>Following</h2>
        <a href="/reader" class="btn btn-ghost btn-sm">← Reader</a>
      </div>

      {!apEnabled && (
        <div style="font-size:.78rem;color:var(--g-text-muted);margin-bottom:1.5rem;border-left:2px solid var(--g-border-faint);padding-left:.85rem">
          ActivityPub is not configured. You can still read public streams via outbox polling.
          To enable formal follows, add <code>[activitypub]</code> to <code>grip.toml</code> and restart.
        </div>
      )}

      <div style="margin-bottom:2rem">
        <form method="POST" action="/reader/ap" style="display:flex;gap:.5rem;align-items:flex-end;flex-wrap:wrap">
          <label style="flex:1;min-width:240px;margin:0;font-size:.78rem">
            Actor URL or handle
            <input type="text" name="actor" placeholder="@user@mastodon.social or https://…/actor" required />
          </label>
          <button type="submit" class="btn btn-primary btn-sm">{apEnabled ? 'Follow' : 'Add (read-only)'}</button>
        </form>
      </div>

      {following.length === 0 && (
        <p style="color:var(--g-text-muted);font-size:.85rem">Not following anyone yet.</p>
      )}

      <div>
        {following.map(f => (
          <div class="article-row">
            <div style="width:32px;height:32px;border-radius:50%;background:var(--g-accent-muted);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:.78rem;font-weight:700;color:var(--g-accent)">
              {(f.display_name || f.username).slice(0, 1).toUpperCase()}
            </div>
            <div class="article-info">
              <span class="article-row-title" style="display:block;margin-bottom:.2rem" safe>
                {f.display_name || f.username}
              </span>
              <div class="article-row-meta">
                <span safe>@{f.username}@{f.domain}</span>
                <span>·</span>
                <span class={`follow-state ${f.follow_state}`} safe>{f.follow_state}</span>
                {f.follows_us && <><span>·</span><span style="color:var(--g-success);font-size:.68rem">follows you</span></>}
                <span>·</span>
                <span>{f.item_count ?? 0} item{(f.item_count ?? 0) !== 1 ? 's' : ''}</span>
                <span>·</span>
                <span>{f.last_fetched_at ? fmtRelative(f.last_fetched_at) : 'never fetched'}</span>
              </div>
            </div>
            <div class="article-row-actions">
              <form method="POST" action={`/reader/ap/${f.id}/refresh`} style="margin:0">
                <button type="submit" class="btn btn-outline btn-sm">Refresh</button>
              </form>
              <form method="POST" action={`/reader/ap/${f.id}/unfollow`} style="margin:0"
                onsubmit="return confirm('Unfollow and remove all cached posts?')">
                <button type="submit" class="btn btn-ghost btn-sm">Unfollow</button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
  return authorLayout('Following', content, db, '/reader');
}

// ── Handlers ───────────────────────────────────────────────────────────────────

export async function handleRssSubscribe(db: GripDb, url: string): Promise<void> {
  const existing = getRssSubByUrl(db.raw, url);
  if (existing) return; // already subscribed

  const feed = await fetchFeed(url);
  const id = addRssSub(db.raw, url, feed.meta.title, feed.meta.description, feed.meta.siteUrl);

  upsertReaderItems(db.raw, 'rss', id, feed.items.map(i => ({
    guid: i.guid,
    itemUrl: i.url,
    title: i.title,
    contentHtml: i.contentHtml,
    author: i.author,
    publishedAt: i.publishedAt,
  })));

  updateRssSubMeta(db.raw, id, feed.meta.title, feed.meta.description, feed.meta.siteUrl);
}

export async function handleRssRefresh(db: GripDb, id: string): Promise<void> {
  const sub = getRssSubById(db.raw, id);
  if (!sub) return;

  const feed = await fetchFeed(sub.url);
  upsertReaderItems(db.raw, 'rss', id, feed.items.map(i => ({
    guid: i.guid,
    itemUrl: i.url,
    title: i.title,
    contentHtml: i.contentHtml,
    author: i.author,
    publishedAt: i.publishedAt,
  })));
  updateRssSubMeta(db.raw, id, feed.meta.title, feed.meta.description, feed.meta.siteUrl);
}

export function handleRssDelete(db: GripDb, id: string): void {
  deleteRssSub(db.raw, id);
}

export async function handleApFollow(
  db: GripDb,
  actorInput: string,
  apCfg: ApConfig | null,
): Promise<void> {
  const actor = await resolveActor(actorInput, db.raw, apCfg);

  const existing = getApFollowingByActorUrl(db.raw, actor.actorUrl);
  if (existing) {
    // Already following — just refresh their outbox
    await handleApRefreshById(db, existing.id, apCfg);
    return;
  }

  const followState: ApFollowing['follow_state'] = apCfg ? 'pending' : 'none';
  const id = addApFollowing(
    db.raw,
    actor.actorUrl,
    actor.username,
    actor.displayName,
    actor.domain,
    actor.avatarUrl,
    actor.inboxUrl,
    followState,
  );

  // Send Follow activity if AP is enabled
  if (apCfg && actor.inboxUrl) {
    try {
      await sendFollowActivity(db.raw, apCfg, actor.actorUrl, actor.inboxUrl);
    } catch (err) {
      console.error('[reader] Follow activity delivery failed:', err);
      // Don't abort — we still fetch the outbox
    }
  }

  // Fetch outbox for immediate content
  try {
    const items = await fetchActorOutbox(actor.actorUrl, db.raw, apCfg);
    upsertReaderItems(db.raw, 'ap', id, items);
    updateApFollowingFetched(db.raw, id, Date.now());
  } catch (err) {
    console.error('[reader] Outbox fetch failed:', err);
  }
}

export async function handleApRefreshById(
  db: GripDb,
  id: string,
  apCfg: ApConfig | null,
): Promise<void> {
  const following = getApFollowingById(db.raw, id);
  if (!following) return;

  try {
    const items = await fetchActorOutbox(following.actor_url, db.raw, apCfg);
    upsertReaderItems(db.raw, 'ap', id, items);
    updateApFollowingFetched(db.raw, id, Date.now());
  } catch (err) {
    console.error('[reader] AP refresh failed:', err);
    throw err;
  }
}

export async function handleApUnfollow(
  db: GripDb,
  id: string,
  apCfg: ApConfig | null,
): Promise<void> {
  const following = getApFollowingById(db.raw, id);
  if (!following) return;

  // Send Undo Follow if AP is configured and we actually sent a Follow
  if (apCfg && following.follow_state !== 'none' && following.inbox_url) {
    sendUnfollowActivity(db.raw, apCfg, following.actor_url, following.inbox_url)
      .catch(err => console.error('[reader] Unfollow delivery failed:', err));
  }

  deleteApFollowing(db.raw, id);
}
