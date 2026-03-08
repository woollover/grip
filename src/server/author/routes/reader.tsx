import type { Database } from 'bun:sqlite';
import type { ApConfig } from '../../../activitypub/config';
import { authorLayout } from './layout';
import { paginationNav } from '../../../views/shared';
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

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
}

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

const READER_CSS = `
.reader-item {
  padding: 1.1rem 0;
  border-bottom: 1px solid color-mix(in srgb, var(--pico-muted-border-color) 60%, transparent);
}
.reader-item:last-child { border-bottom: none; }
.reader-item-meta {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.72rem;
  color: var(--pico-muted-color);
  margin-bottom: 0.35rem;
  flex-wrap: wrap;
}
.reader-source-badge {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  border: 1px solid var(--pico-muted-border-color);
}
.reader-source-badge.rss  { border-color: #e0562f; color: #e0562f; }
.reader-source-badge.ap   { border-color: var(--pico-primary); color: var(--pico-primary); }
.reader-item-title {
  font-weight: 600;
  font-size: 0.9rem;
  margin-bottom: 0.25rem;
}
.reader-item-title a { color: inherit; text-decoration: none; }
.reader-item-title a:hover { color: var(--pico-primary); }
.reader-item-body {
  font-size: 0.82rem;
  color: var(--pico-muted-color);
  line-height: 1.6;
}
.reader-item-actions {
  margin-top: 0.35rem;
  font-size: 0.72rem;
}
.reader-item-actions a { color: var(--pico-muted-color); text-decoration: none; }
.reader-item-actions a:hover { color: var(--pico-primary); }
.reader-empty { color: var(--pico-muted-color); font-size: 0.85rem; padding: 2rem 0; }
.follow-state {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  border: 1px solid;
}
.follow-state.pending  { border-color: var(--pico-muted-color); color: var(--pico-muted-color); }
.follow-state.accepted { border-color: var(--pico-color-green-500, #2ecc71); color: var(--pico-color-green-500, #2ecc71); }
.follow-state.rejected { border-color: var(--pico-color-red-500, #e74c3c); color: var(--pico-color-red-500, #e74c3c); }
.follow-state.none     { border-color: var(--pico-muted-border-color); color: var(--pico-muted-color); }
`;

// ── Reader home ────────────────────────────────────────────────────────────────

export function renderReaderHome(db: Database, page: number): JSX.Element {
  const offset = (page - 1) * PAGE_SIZE;
  const total = countReaderItems(db);
  const items = getReaderItems(db, { limit: PAGE_SIZE, offset });
  const rssSubs = getRssSubs(db);
  const apSubs = getApFollowing(db);
  const hasAnySub = rssSubs.length > 0 || apSubs.length > 0;

  const content = (
    <div>
      <style>{READER_CSS}</style>
      <div class="page-hd">
        <h2>Reader</h2>
        <div style="display:flex;gap:0.5rem">
          <a href="/reader/rss" role="button" class="outline secondary">RSS Feeds {rssSubs.length > 0 ? `(${rssSubs.length})` : ''}</a>
          <a href="/reader/ap" role="button" class="outline secondary">Following {apSubs.length > 0 ? `(${apSubs.length})` : ''}</a>
        </div>
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

      {items.length > 0 && (
        <>
          <p style="font-size:0.72rem;color:var(--pico-muted-color);margin-bottom:1rem">
            {total} item{total !== 1 ? 's' : ''} · chronological
          </p>
          <div>
            {items.map(item => <ReaderItemCard item={item} />)}
          </div>
          {paginationNav(page, Math.ceil(total / PAGE_SIZE), '/reader')}
        </>
      )}
    </div>
  );
  return authorLayout('Reader', content, db);
}

function ReaderItemCard({ item }: { item: ReaderItem }): JSX.Element {
  const hasTitle = item.title.trim().length > 0;
  const bodyPreview = preview(item.content_html);
  const sourceName = item.source_name ?? (item.source_type === 'rss' ? 'RSS' : 'AP');

  return (
    <div class="reader-item">
      <div class="reader-item-meta">
        <span class={`reader-source-badge ${item.source_type}`}>{item.source_type.toUpperCase()}</span>
        <span safe>{sourceName}</span>
        {item.author && item.author !== sourceName && <span safe>· {item.author}</span>}
        <span>· {fmtRelative(item.published_at)}</span>
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
        <div class="reader-item-body" safe>{bodyPreview}</div>
      )}
      {item.item_url && (
        <div class="reader-item-actions">
          <a href={item.item_url} target="_blank" rel="noopener noreferrer">Read →</a>
        </div>
      )}
    </div>
  );
}

// ── RSS Subscriptions ──────────────────────────────────────────────────────────

export function renderRssIndex(db: Database): JSX.Element {
  const subs = getRssSubs(db);

  const content = (
    <div>
      <style>{READER_CSS}</style>
      <div class="page-hd">
        <h2>RSS Feeds</h2>
        <a href="/reader" role="button" class="outline secondary">← Reader</a>
      </div>

      <section style="margin-bottom:2rem">
        <h3>Add feed</h3>
        <form method="POST" action="/reader/rss" style="display:flex;gap:0.5rem;align-items:flex-end;flex-wrap:wrap">
          <label style="flex:1;min-width:280px;margin:0">
            Feed URL
            <input type="url" name="url" placeholder="https://example.com/rss.xml" required />
          </label>
          <button type="submit">Subscribe</button>
        </form>
      </section>

      {subs.length === 0 && (
        <p style="color:var(--pico-muted-color);font-size:0.85rem">No feeds yet.</p>
      )}

      {subs.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Feed</th>
              <th>Items</th>
              <th>Last fetched</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {subs.map(sub => (
              <tr>
                <td>
                  <div style="font-weight:500" safe>{sub.title || sub.url}</div>
                  <div style="font-size:0.72rem;color:var(--pico-muted-color)" safe>{sub.url}</div>
                </td>
                <td>{sub.item_count ?? 0}</td>
                <td style="font-size:0.78rem;color:var(--pico-muted-color)">
                  {sub.last_fetched_at ? fmtRelative(sub.last_fetched_at) : '—'}
                </td>
                <td style="white-space:nowrap">
                  <form method="POST" action={`/reader/rss/${sub.id}/refresh`} style="display:inline">
                    <button type="submit" class="outline secondary" style="margin-right:0.35rem">Refresh</button>
                  </form>
                  <form method="POST" action={`/reader/rss/${sub.id}/delete`} style="display:inline"
                    onsubmit="return confirm('Remove this feed and all its items?')">
                    <button type="submit" class="outline secondary">Remove</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
  return authorLayout('RSS Feeds', content, db);
}

// ── AP Following ───────────────────────────────────────────────────────────────

export function renderApFollowingIndex(db: Database, apCfg: ApConfig | null): JSX.Element {
  const following = getApFollowing(db);
  const apEnabled = !!apCfg;

  const content = (
    <div>
      <style>{READER_CSS}</style>
      <div class="page-hd">
        <h2>Following</h2>
        <a href="/reader" role="button" class="outline secondary">← Reader</a>
      </div>

      {!apEnabled && (
        <p style="font-size:0.78rem;color:var(--pico-muted-color);margin-bottom:1.5rem;border-left:2px solid var(--pico-muted-border-color);padding-left:0.75rem">
          ActivityPub is not configured. You can still read public streams via outbox polling.
          To send formal Follow requests and receive posts via push delivery, enable ActivityPub in <code>grip.toml</code>.
        </p>
      )}

      <section style="margin-bottom:2rem">
        <h3>Follow a profile</h3>
        <form method="POST" action="/reader/ap" style="display:flex;gap:0.5rem;align-items:flex-end;flex-wrap:wrap">
          <label style="flex:1;min-width:280px;margin:0">
            Actor URL or handle
            <input type="text" name="actor" placeholder="@user@mastodon.social or https://…/actor" required />
          </label>
          <button type="submit">{apEnabled ? 'Follow' : 'Add (read-only)'}</button>
        </form>
      </section>

      {following.length === 0 && (
        <p style="color:var(--pico-muted-color);font-size:0.85rem">Not following anyone yet.</p>
      )}

      {following.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Profile</th>
              <th>Status</th>
              <th>Follows you</th>
              <th>Items</th>
              <th>Last fetched</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {following.map(f => (
              <tr>
                <td>
                  <div style="font-weight:500" safe>{f.display_name || f.username}</div>
                  <div style="font-size:0.72rem;color:var(--pico-muted-color)" safe>@{f.username}@{f.domain}</div>
                </td>
                <td>
                  <span class={`follow-state ${f.follow_state}`} safe>{f.follow_state}</span>
                </td>
                <td style="text-align:center">
                  {f.follows_us ? '✓' : '—'}
                </td>
                <td>{f.item_count ?? 0}</td>
                <td style="font-size:0.78rem;color:var(--pico-muted-color)">
                  {f.last_fetched_at ? fmtRelative(f.last_fetched_at) : '—'}
                </td>
                <td style="white-space:nowrap">
                  <form method="POST" action={`/reader/ap/${f.id}/refresh`} style="display:inline">
                    <button type="submit" class="outline secondary" style="margin-right:0.35rem">Refresh</button>
                  </form>
                  <form method="POST" action={`/reader/ap/${f.id}/unfollow`} style="display:inline"
                    onsubmit="return confirm('Unfollow and remove all cached posts?')">
                    <button type="submit" class="outline secondary">Unfollow</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
  return authorLayout('Following', content, db);
}

// ── Handlers ───────────────────────────────────────────────────────────────────

export async function handleRssSubscribe(db: Database, url: string): Promise<void> {
  const existing = getRssSubByUrl(db, url);
  if (existing) return; // already subscribed

  const feed = await fetchFeed(url);
  const id = addRssSub(db, url, feed.meta.title, feed.meta.description, feed.meta.siteUrl);

  upsertReaderItems(db, 'rss', id, feed.items.map(i => ({
    guid: i.guid,
    itemUrl: i.url,
    title: i.title,
    contentHtml: i.contentHtml,
    author: i.author,
    publishedAt: i.publishedAt,
  })));

  updateRssSubMeta(db, id, feed.meta.title, feed.meta.description, feed.meta.siteUrl);
}

export async function handleRssRefresh(db: Database, id: string): Promise<void> {
  const sub = getRssSubById(db, id);
  if (!sub) return;

  const feed = await fetchFeed(sub.url);
  upsertReaderItems(db, 'rss', id, feed.items.map(i => ({
    guid: i.guid,
    itemUrl: i.url,
    title: i.title,
    contentHtml: i.contentHtml,
    author: i.author,
    publishedAt: i.publishedAt,
  })));
  updateRssSubMeta(db, id, feed.meta.title, feed.meta.description, feed.meta.siteUrl);
}

export function handleRssDelete(db: Database, id: string): void {
  deleteRssSub(db, id);
}

export async function handleApFollow(
  db: Database,
  actorInput: string,
  apCfg: ApConfig | null,
): Promise<void> {
  const actor = await resolveActor(actorInput, db, apCfg);

  const existing = getApFollowingByActorUrl(db, actor.actorUrl);
  if (existing) {
    // Already following — just refresh their outbox
    await handleApRefreshById(db, existing.id, apCfg);
    return;
  }

  const followState: ApFollowing['follow_state'] = apCfg ? 'pending' : 'none';
  const id = addApFollowing(
    db,
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
      await sendFollowActivity(db, apCfg, actor.actorUrl, actor.inboxUrl);
    } catch (err) {
      console.error('[reader] Follow activity delivery failed:', err);
      // Don't abort — we still fetch the outbox
    }
  }

  // Fetch outbox for immediate content
  try {
    const items = await fetchActorOutbox(actor.actorUrl, db, apCfg);
    upsertReaderItems(db, 'ap', id, items);
    updateApFollowingFetched(db, id, Date.now());
  } catch (err) {
    console.error('[reader] Outbox fetch failed:', err);
  }
}

export async function handleApRefreshById(
  db: Database,
  id: string,
  apCfg: ApConfig | null,
): Promise<void> {
  const following = getApFollowingById(db, id);
  if (!following) return;

  try {
    const items = await fetchActorOutbox(following.actor_url, db, apCfg);
    upsertReaderItems(db, 'ap', id, items);
    updateApFollowingFetched(db, id, Date.now());
  } catch (err) {
    console.error('[reader] AP refresh failed:', err);
    throw err;
  }
}

export async function handleApUnfollow(
  db: Database,
  id: string,
  apCfg: ApConfig | null,
): Promise<void> {
  const following = getApFollowingById(db, id);
  if (!following) return;

  // Send Undo Follow if AP is configured and we actually sent a Follow
  if (apCfg && following.follow_state !== 'none' && following.inbox_url) {
    sendUnfollowActivity(db, apCfg, following.actor_url, following.inbox_url)
      .catch(err => console.error('[reader] Unfollow delivery failed:', err));
  }

  deleteApFollowing(db, id);
}
