import { Elysia } from 'elysia';
import { staticPlugin } from '@elysiajs/static';
import type { Database } from 'bun:sqlite';
import { getThemeCss } from '../../core/themes';
import { EventStore } from '../../core/events';
import { applyEvent, renderMd } from '../../core/projections';
import {
  isLockedOut, recordFailedAttempt, clearAttempts,
  createSession, destroySession, verifySession, verifyPassphrase,
} from './auth';
import { renderDashboard } from './routes/dashboard';
import { renderArticlesIndex, renderArticleNew, handleArticleCreate, renderArticleEdit, handleArticleRevise, handleArticlePublish, handleArticleUnpublish } from './routes/articles';
import { renderMicroIndex, handleMicroCreate } from './routes/micro';
import { renderPagesIndex, renderPageNew, handlePageCreate, renderPageEdit, handlePageRevise, handlePagePublish } from './routes/pages';
import { renderMediaIndex, handleMediaUpload } from './routes/media';
import { renderSettings, handleSiteConfigUpdate, handleThemeChange } from './routes/settings';

const SESSION_COOKIE = 'grip_session';

export function createAuthorApp(db: Database, port: number): Elysia {
  const store = new EventStore(db);

  const app = new Elysia({ name: 'author' });

  app.use(staticPlugin({ assets: 'public/static', prefix: '/static' }));

  app.get('/theme.css', () => {
    return new Response(getThemeCss(db), {
      headers: { 'Content-Type': 'text/css; charset=utf-8', 'Cache-Control': 'no-cache' },
    });
  });

  // ── Auth middleware ──────────────────────────────────────────────────────────
  const requireAuth = (cookie: string | undefined): Response | null => {
    if (!verifySession(db, cookie)) {
      return new Response(null, { status: 302, headers: { Location: '/login' } });
    }
    return null;
  };

  // ── Login ────────────────────────────────────────────────────────────────────
  app.get('/login', ({ cookie }) => {
    if (verifySession(db, cookie[SESSION_COOKIE]?.value)) {
      return Response.redirect('/dashboard', 302);
    }
    return new Response(renderLoginPage(false, false), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  });

  app.post('/login', async ({ body, cookie, set, request }) => {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
    const passphrase = (body as { passphrase?: string }).passphrase ?? '';

    if (isLockedOut(ip)) {
      return new Response(renderLoginPage(false, true), {
        status: 429,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    const ok = await verifyPassphrase(db, passphrase);
    store.append({ type: 'AuthAttempt', success: ok, ip });

    if (!ok) {
      recordFailedAttempt(ip);
      return new Response(renderLoginPage(true, false), {
        status: 401,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    clearAttempts(ip);
    const token = createSession(db);

    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/dashboard',
        'Set-Cookie': `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800`,
      },
    });
  });

  app.post('/logout', ({ cookie }) => {
    destroySession(db);
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/login',
        'Set-Cookie': `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`,
      },
    });
  });

  // ── Dashboard ────────────────────────────────────────────────────────────────
  app.get('/dashboard', ({ cookie }) => {
    return requireAuth(cookie[SESSION_COOKIE]?.value) ?? html(renderDashboard(db));
  });

  app.get('/', () => {
    return new Response(null, { status: 302, headers: { Location: '/dashboard' } });
  });

  // ── Articles ─────────────────────────────────────────────────────────────────
  app.get('/articles', ({ cookie }) => {
    return requireAuth(cookie[SESSION_COOKIE]?.value) ?? html(renderArticlesIndex(db));
  });

  app.get('/articles/new', ({ cookie }) => {
    return requireAuth(cookie[SESSION_COOKIE]?.value) ?? html(renderArticleNew());
  });

  app.post('/articles', ({ body, cookie }) => {
    const guard = requireAuth(cookie[SESSION_COOKIE]?.value);
    if (guard) return guard;
    const id = handleArticleCreate(db, store, body as any);
    return new Response(null, { status: 302, headers: { Location: `/articles/${id}/edit` } });
  });

  app.get('/articles/:id/edit', ({ params, cookie }) => {
    return requireAuth(cookie[SESSION_COOKIE]?.value) ?? html(renderArticleEdit(db, params.id));
  });

  app.post('/articles/:id/revise', ({ params, body, cookie }) => {
    const guard = requireAuth(cookie[SESSION_COOKIE]?.value);
    if (guard) return guard;
    handleArticleRevise(db, store, params.id, body as any);
    return new Response(null, { status: 302, headers: { Location: `/articles/${params.id}/edit` } });
  });

  app.post('/articles/:id/publish', ({ params, cookie }) => {
    const guard = requireAuth(cookie[SESSION_COOKIE]?.value);
    if (guard) return guard;
    handleArticlePublish(db, store, params.id);
    return new Response(null, { status: 302, headers: { Location: '/articles' } });
  });

  app.post('/articles/:id/unpublish', ({ params, cookie }) => {
    const guard = requireAuth(cookie[SESSION_COOKIE]?.value);
    if (guard) return guard;
    handleArticleUnpublish(db, store, params.id);
    return new Response(null, { status: 302, headers: { Location: '/articles' } });
  });

  // Preview endpoint (HTMX)
  app.post('/preview', ({ body }) => {
    const bodyMd = (body as Record<string, string>)?.body ?? '';
    return new Response(renderMd(bodyMd), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  });

  // ── Micro-posts ───────────────────────────────────────────────────────────────
  app.get('/micro', ({ cookie }) => {
    return requireAuth(cookie[SESSION_COOKIE]?.value) ?? html(renderMicroIndex(db));
  });

  app.post('/micro', ({ body, cookie }) => {
    const guard = requireAuth(cookie[SESSION_COOKIE]?.value);
    if (guard) return guard;
    handleMicroCreate(db, store, body as any);
    return new Response(null, { status: 302, headers: { Location: '/micro' } });
  });

  // ── Pages ─────────────────────────────────────────────────────────────────────
  app.get('/pages', ({ cookie }) => {
    return requireAuth(cookie[SESSION_COOKIE]?.value) ?? html(renderPagesIndex(db));
  });

  app.get('/pages/new', ({ cookie }) => {
    return requireAuth(cookie[SESSION_COOKIE]?.value) ?? html(renderPageNew());
  });

  app.post('/pages', ({ body, cookie }) => {
    const guard = requireAuth(cookie[SESSION_COOKIE]?.value);
    if (guard) return guard;
    const id = handlePageCreate(db, store, body as any);
    return new Response(null, { status: 302, headers: { Location: `/pages/${id}/edit` } });
  });

  app.get('/pages/:id/edit', ({ params, cookie }) => {
    return requireAuth(cookie[SESSION_COOKIE]?.value) ?? html(renderPageEdit(db, params.id));
  });

  app.post('/pages/:id/revise', ({ params, body, cookie }) => {
    const guard = requireAuth(cookie[SESSION_COOKIE]?.value);
    if (guard) return guard;
    handlePageRevise(db, store, params.id, body as any);
    return new Response(null, { status: 302, headers: { Location: `/pages/${params.id}/edit` } });
  });

  app.post('/pages/:id/publish', ({ params, cookie }) => {
    const guard = requireAuth(cookie[SESSION_COOKIE]?.value);
    if (guard) return guard;
    handlePagePublish(db, store, params.id);
    return new Response(null, { status: 302, headers: { Location: '/pages' } });
  });

  // ── Media ─────────────────────────────────────────────────────────────────────
  app.get('/media', ({ cookie }) => {
    return requireAuth(cookie[SESSION_COOKIE]?.value) ?? html(renderMediaIndex(db));
  });

  app.post('/media', async ({ body, cookie }) => {
    const guard = requireAuth(cookie[SESSION_COOKIE]?.value);
    if (guard) return guard;
    await handleMediaUpload(db, store, body as any);
    return new Response(null, { status: 302, headers: { Location: '/media' } });
  });

  // ── Settings ──────────────────────────────────────────────────────────────────
  app.get('/settings', ({ cookie }) => {
    return requireAuth(cookie[SESSION_COOKIE]?.value) ?? html(renderSettings(db));
  });

  app.post('/settings/site', ({ body, cookie }) => {
    const guard = requireAuth(cookie[SESSION_COOKIE]?.value);
    if (guard) return guard;
    handleSiteConfigUpdate(db, store, body as any);
    return new Response(null, { status: 302, headers: { Location: '/settings' } });
  });

  app.post('/settings/theme', ({ body, cookie }) => {
    const guard = requireAuth(cookie[SESSION_COOKIE]?.value);
    if (guard) return guard;
    handleThemeChange(db, store, body as any);
    return new Response(null, { status: 302, headers: { Location: '/settings' } });
  });

  return app;
}

function html(content: string): Response {
  return new Response(content, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function renderLoginPage(badPassword: boolean, lockedOut: boolean): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>GRIP — Login</title>
  <link rel="stylesheet" href="/static/pico.min.css">
  <link rel="stylesheet" href="/theme.css">
</head>
<body>
  <main class="container" style="max-width:400px;margin-top:4rem">
    <h1>GRIP</h1>
    ${lockedOut ? '<p role="alert" style="color:var(--pico-color-red-500)">Too many failed attempts. Try again in 15 minutes.</p>' : ''}
    ${badPassword ? '<p role="alert" style="color:var(--pico-color-red-500)">Incorrect passphrase.</p>' : ''}
    <form method="POST" action="/login">
      <label for="passphrase">Passphrase</label>
      <input type="password" id="passphrase" name="passphrase" autofocus required>
      <button type="submit">Enter</button>
    </form>
  </main>
</body>
</html>`;
}
