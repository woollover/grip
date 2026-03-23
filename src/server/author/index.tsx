import { Elysia } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import type { Database } from "bun:sqlite";
import { getThemeCss } from "../../core/themes";
import { EventStore } from "../../core/events";
import { renderMd } from "../../core/projections";
import {
  isLockedOut,
  recordFailedAttempt,
  clearAttempts,
  createSession,
  destroySession,
  verifySession,
  verifyPassphrase,
} from "./auth";
import { renderLoginPage } from "./routes/login";
import { renderDashboard } from "./routes/dashboard";
import {
  renderArticlesIndex,
  renderArticleNew,
  handleArticleCreate,
  renderArticleEdit,
  handleArticleRevise,
  handleArticlePublish,
  handleArticleUnpublish,
} from "./routes/articles";
import {
  renderMicroIndex,
  handleMicroCreate,
  handleMicroRetract,
  handleMicroRestore,
} from "./routes/micro";
import {
  renderPagesIndex,
  renderPageNew,
  handlePageCreate,
  renderPageEdit,
  handlePageRevise,
  handlePagePublish,
} from "./routes/pages";
import {
  renderMediaIndex,
  handleMediaUpload,
  handleMediaUploadJson,
} from "./routes/media";
import { serveMedia } from "../public/routes/media";
import {
  renderSettings,
  renderThemeSettings,
  handleSiteConfigUpdate,
  handleThemeChange,
  handlePublicityUpdate,
} from "./routes/settings";
import { renderRepliesIndex, handleReplyToggle, renderContactsIndex } from "./routes/replies";
import { renderExportPage, handleExportDownload } from "./routes/export";
import { renderBackupPage, handleBackupDownload } from "./routes/backup";
import {
  renderReaderHome, renderRssIndex, renderApFollowingIndex,
  handleRssSubscribe, handleRssRefresh, handleRssDelete,
  handleApFollow, handleApRefreshById, handleApUnfollow,
} from "./routes/reader";
import type { ApConfig } from "../../activitypub/config";
import { deliverNewPost } from "../../activitypub/delivery";
import { log } from "../../core/logger";
import { version as currentVersion } from "../../../package.json";
import { execSync } from "child_process";
import path from "path";
import { checkForUpdate, runUpdate } from "../../cli/commands/update";

const SESSION_COOKIE = "grip_session";
const cv = (cookie: Record<string, { value?: string } | undefined>) =>
  cookie[SESSION_COOKIE]?.value as string | undefined;
const parsePage = (q: any) => Math.max(1, parseInt(q?.page ?? '1', 10) || 1);

export function createAuthorApp(
  db: Database,
  apCfg?: ApConfig | null,
): Elysia {
  const store = new EventStore(db);

  const app = new Elysia({ name: "author" });

  app.use(staticPlugin({ assets: "public/static", prefix: "/static" }));

  app.get("/theme.css", () => {
    return new Response(getThemeCss(db), {
      headers: {
        "Content-Type": "text/css; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  });

  // ── Auth middleware ──────────────────────────────────────────────────────────
  const requireAuth = (cookie: unknown): Response | null => {
    if (!verifySession(db, cookie as string | undefined)) {
      return new Response(null, {
        status: 302,
        headers: { Location: "/login" },
      });
    }
    return null;
  };

  // ── Login ────────────────────────────────────────────────────────────────────
  app.get("/login", ({ cookie }) => {
    if (
      verifySession(db, cv(cookie))
    ) {
      return Response.redirect("/dashboard", 302);
    }
    return html(renderLoginPage(false, false, db));
  });

  app.post("/login", async ({ body, request }) => {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    const passphrase = (body as { passphrase?: string }).passphrase ?? "";

    if (isLockedOut(db, ip)) {
      return new Response(renderLoginPage(false, true, db), {
        status: 429,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const ok = await verifyPassphrase(db, passphrase);
    store.append({ type: "AuthAttempt", success: ok, ip });

    if (!ok) {
      recordFailedAttempt(db, ip);
      return new Response(renderLoginPage(true, false, db), {
        status: 401,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    clearAttempts(db, ip);
    const token = createSession(db);

    return new Response(null, {
      status: 302,
      headers: {
        Location: "/dashboard",
        "Set-Cookie": `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800`,
      },
    });
  });

  app.post("/logout", ({ cookie }) => {
    if (verifySession(db, cv(cookie))) destroySession(db);
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/login",
        "Set-Cookie": `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`,
      },
    });
  });

  // ── Dashboard ────────────────────────────────────────────────────────────────
  app.get("/dashboard", ({ cookie }) => {
    return (
      requireAuth(cv(cookie)) ?? html(renderDashboard(db))
    );
  });

  app.get("/", () => {
    return new Response(null, {
      status: 302,
      headers: { Location: "/dashboard" },
    });
  });

  // ── Articles ─────────────────────────────────────────────────────────────────
  app.get("/articles", ({ cookie, query }) => {
    const page = parsePage(query);
    return (
      requireAuth(cv(cookie)) ??
      html(renderArticlesIndex(db, page))
    );
  });

  app.get("/articles/new", ({ cookie }) => {
    return (
      requireAuth(cv(cookie)) ?? html(renderArticleNew(db))
    );
  });

  app.post("/articles", ({ body, cookie }) => {
    const guard = requireAuth(cv(cookie));
    if (guard) return guard;
    const id = handleArticleCreate(db, store, body as any);
    return new Response(null, {
      status: 302,
      headers: { Location: `/articles/${id}/edit` },
    });
  });

  app.get("/articles/:id/edit", ({ params, cookie }) => {
    return (
      requireAuth(cv(cookie)) ??
      html(renderArticleEdit(db, params.id))
    );
  });

  app.post("/articles/:id/revise", ({ params, body, cookie }) => {
    const guard = requireAuth(cv(cookie));
    if (guard) return guard;
    handleArticleRevise(db, store, params.id, body as any);
    return new Response(null, {
      status: 302,
      headers: { Location: `/articles/${params.id}/edit` },
    });
  });

  app.post("/articles/:id/publish", ({ params, cookie }) => {
    const guard = requireAuth(cv(cookie));
    if (guard) return guard;
    handleArticlePublish(db, store, params.id);
    return new Response(null, {
      status: 302,
      headers: { Location: "/articles" },
    });
  });

  app.post("/articles/:id/unpublish", ({ params, cookie }) => {
    const guard = requireAuth(cv(cookie));
    if (guard) return guard;
    handleArticleUnpublish(db, store, params.id);
    return new Response(null, {
      status: 302,
      headers: { Location: "/articles" },
    });
  });

  // Preview endpoint (HTMX) — auth required
  app.post("/preview", ({ body, cookie }) => {
    const guard = requireAuth(cv(cookie));
    if (guard) return guard;
    const bodyMd = (body as Record<string, string>)?.body ?? "";
    return new Response(renderMd(bodyMd), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  });

  // ── Micro-posts ───────────────────────────────────────────────────────────────
  app.get("/micro", ({ cookie, query }) => {
    const page = parsePage(query);
    return (
      requireAuth(cv(cookie)) ?? html(renderMicroIndex(db, page))
    );
  });

  app.post("/micro", ({ body, cookie }) => {
    const guard = requireAuth(cv(cookie));
    if (guard) return guard;
    handleMicroCreate(db, store, body as any);

    // Fire-and-forget AP delivery for the newly created post
    if (apCfg) {
      const latest = db
        .prepare(
          "SELECT id, body_html, body_md, created_at FROM micro_posts WHERE status = 'active' ORDER BY created_at DESC LIMIT 1",
        )
        .get() as {
        id: string;
        body_html: string;
        body_md: string;
        created_at: number;
      } | null;
      if (latest) {
        deliverNewPost(db, apCfg, latest).catch((err) => {
          log.error("[activitypub] Delivery error:", err);
        });
      }
    }

    return new Response(null, { status: 302, headers: { Location: "/micro" } });
  });

  app.post("/micro/:id/retract", ({ params, cookie }) => {
    const guard = requireAuth(cv(cookie));
    if (guard) return guard;
    handleMicroRetract(db, store, params.id);
    return new Response(null, { status: 302, headers: { Location: "/micro" } });
  });

  app.post("/micro/:id/restore", ({ params, cookie }) => {
    const guard = requireAuth(cv(cookie));
    if (guard) return guard;
    handleMicroRestore(db, store, params.id);
    return new Response(null, { status: 302, headers: { Location: "/micro" } });
  });

  // ── Pages ─────────────────────────────────────────────────────────────────────
  app.get("/pages", ({ cookie }) => {
    return (
      requireAuth(cv(cookie)) ?? html(renderPagesIndex(db))
    );
  });

  app.get("/pages/new", ({ cookie }) => {
    return requireAuth(cv(cookie)) ?? html(renderPageNew(db));
  });

  app.post("/pages", ({ body, cookie }) => {
    const guard = requireAuth(cv(cookie));
    if (guard) return guard;
    const id = handlePageCreate(db, store, body as any);
    return new Response(null, {
      status: 302,
      headers: { Location: `/pages/${id}/edit` },
    });
  });

  app.get("/pages/:id/edit", ({ params, cookie }) => {
    return (
      requireAuth(cv(cookie)) ??
      html(renderPageEdit(db, params.id))
    );
  });

  app.post("/pages/:id/revise", ({ params, body, cookie }) => {
    const guard = requireAuth(cv(cookie));
    if (guard) return guard;
    handlePageRevise(db, store, params.id, body as any);
    return new Response(null, {
      status: 302,
      headers: { Location: `/pages/${params.id}/edit` },
    });
  });

  app.post("/pages/:id/publish", ({ params, cookie }) => {
    const guard = requireAuth(cv(cookie));
    if (guard) return guard;
    handlePagePublish(db, store, params.id);
    return new Response(null, { status: 302, headers: { Location: "/pages" } });
  });

  // ── Media ─────────────────────────────────────────────────────────────────────
  app.get("/media", ({ cookie }) => {
    return (
      requireAuth(cv(cookie)) ?? html(renderMediaIndex(db))
    );
  });

  app.post("/media/upload", async ({ body, cookie }) => {
    const guard = requireAuth(cv(cookie));
    if (guard) return guard;
    const result = await handleMediaUploadJson(db, store, body as any);
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  });

  app.get("/media/:id", ({ params }) => {
    const response = serveMedia(db, params.id);
    if (!response) return new Response("Not found", { status: 404 });
    return response;
  });

  app.post("/media", async ({ body, cookie }) => {
    const guard = requireAuth(cv(cookie));
    if (guard) return guard;
    await handleMediaUpload(db, store, body as any);
    return new Response(null, { status: 302, headers: { Location: "/media" } });
  });

  // ── Settings ──────────────────────────────────────────────────────────────────
  app.get("/settings", ({ cookie }) => {
    return (
      requireAuth(cv(cookie)) ?? html(renderSettings(db))
    );
  });

  app.get("/settings/theme", ({ cookie }) => {
    return (
      requireAuth(cv(cookie)) ??
      html(renderThemeSettings(db))
    );
  });

  app.post("/settings/site", ({ body, cookie }) => {
    const guard = requireAuth(cv(cookie));
    if (guard) return guard;
    handleSiteConfigUpdate(db, store, body as any);
    return new Response(null, {
      status: 302,
      headers: { Location: "/settings" },
    });
  });

  app.post("/settings/theme", ({ body, cookie }) => {
    const guard = requireAuth(cv(cookie));
    if (guard) return guard;
    handleThemeChange(db, store, body as any);
    return new Response(null, {
      status: 302,
      headers: { Location: "/settings/theme" },
    });
  });

  app.post("/settings/publicity", ({ body, cookie }) => {
    const guard = requireAuth(cv(cookie));
    if (guard) return guard;
    handlePublicityUpdate(db, body as any);
    return new Response(null, {
      status: 302,
      headers: { Location: "/settings" },
    });
  });

  // ── Export ───────────────────────────────────────────────────────────────────
  app.get("/export", ({ cookie }) => {
    return requireAuth(cv(cookie)) ?? html(renderExportPage(db));
  });

  app.post("/export/download", async ({ cookie }) => {
    const guard = requireAuth(cv(cookie));
    if (guard) return guard;
    return handleExportDownload(db);
  });

  // ── Backup ───────────────────────────────────────────────────────────────────
  app.get("/backup", ({ cookie }) => {
    return requireAuth(cv(cookie)) ?? html(renderBackupPage(db));
  });

  app.post("/backup/download", async ({ cookie }) => {
    const guard = requireAuth(cv(cookie));
    if (guard) return guard;
    return handleBackupDownload(db);
  });

  // ── ActivityPub author views ────────────────────────────────────────────────
  if (apCfg) {
    app.get("/contacts", ({ cookie, query }) => {
      const guard = requireAuth(cv(cookie));
      if (guard) return guard;
      const page = parsePage(query);
      return html(renderContactsIndex(db, page));
    });

    app.get("/replies", ({ cookie, query }) => {
      const guard = requireAuth(cv(cookie));
      if (guard) return guard;
      const page = parsePage(query);
      return html(renderRepliesIndex(db, page));
    });

    app.post("/replies/:id/toggle", ({ params, cookie }) => {
      const guard = requireAuth(cv(cookie));
      if (guard) return guard;
      handleReplyToggle(db, params.id);
      return new Response(null, { status: 302, headers: { Location: "/replies" } });
    });
  }

  // ── Self-update ───────────────────────────────────────────────────────────────
  app.post("/update", async ({ cookie }) => {
    const guard = requireAuth(cv(cookie));
    if (guard) return guard;

    const binaryName = path.basename(process.execPath);
    if (binaryName !== "grip") {
      return new Response(
        errorPage("Self-update is only available when running as a compiled binary, not in dev mode."),
        { headers: { "Content-Type": "text/html; charset=utf-8" } },
      );
    }

    try {
      const info = await checkForUpdate();
      if (!info) {
        return new Response(errorPage(`Already on the latest version (v${currentVersion}).`), {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        });
      }

      await runUpdate(info);

      // Restart after the response is sent
      setTimeout(() => {
        try { execSync("sudo systemctl restart grip"); } catch { /* already restarting */ }
      }, 1500);

      return new Response(updatingPage(), {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "X-Frame-Options": "DENY",
        },
      });
    } catch (err) {
      return new Response(errorPage(String(err)), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
  });

  // ── Reader ───────────────────────────────────────────────────────────────────
  app.get("/reader", ({ cookie, query }) => {
    const guard = requireAuth(cv(cookie));
    if (guard) return guard;
    const page = parsePage(query);
    return html(renderReaderHome(db, page));
  });

  // RSS
  app.get("/reader/rss", ({ cookie }) => {
    return requireAuth(cv(cookie)) ?? html(renderRssIndex(db));
  });

  app.post("/reader/rss", async ({ body, cookie }) => {
    const guard = requireAuth(cv(cookie));
    if (guard) return guard;
    const url = ((body as any).url ?? '').trim();
    if (!url) return new Response(null, { status: 302, headers: { Location: '/reader/rss' } });
    try {
      await handleRssSubscribe(db, url);
    } catch (err) {
      log.error('[reader] RSS subscribe failed:', err);
    }
    return new Response(null, { status: 302, headers: { Location: '/reader/rss' } });
  });

  app.post("/reader/rss/:id/refresh", async ({ params, cookie }) => {
    const guard = requireAuth(cv(cookie));
    if (guard) return guard;
    try {
      await handleRssRefresh(db, params.id);
    } catch (err) {
      log.error('[reader] RSS refresh failed:', err);
    }
    return new Response(null, { status: 302, headers: { Location: '/reader/rss' } });
  });

  app.post("/reader/rss/:id/delete", ({ params, cookie }) => {
    const guard = requireAuth(cv(cookie));
    if (guard) return guard;
    handleRssDelete(db, params.id);
    return new Response(null, { status: 302, headers: { Location: '/reader/rss' } });
  });

  // AP Following
  app.get("/reader/ap", ({ cookie }) => {
    return requireAuth(cv(cookie)) ?? html(renderApFollowingIndex(db, apCfg ?? null));
  });

  app.post("/reader/ap", async ({ body, cookie }) => {
    const guard = requireAuth(cv(cookie));
    if (guard) return guard;
    const actor = ((body as any).actor ?? '').trim();
    if (!actor) return new Response(null, { status: 302, headers: { Location: '/reader/ap' } });
    try {
      await handleApFollow(db, actor, apCfg ?? null);
    } catch (err) {
      log.error('[reader] AP follow failed:', err);
    }
    return new Response(null, { status: 302, headers: { Location: '/reader/ap' } });
  });

  app.post("/reader/ap/:id/refresh", async ({ params, cookie }) => {
    const guard = requireAuth(cv(cookie));
    if (guard) return guard;
    try {
      await handleApRefreshById(db, params.id, apCfg ?? null);
    } catch (err) {
      log.error('[reader] AP refresh failed:', err);
    }
    return new Response(null, { status: 302, headers: { Location: '/reader/ap' } });
  });

  app.post("/reader/ap/:id/unfollow", async ({ params, cookie }) => {
    const guard = requireAuth(cv(cookie));
    if (guard) return guard;
    await handleApUnfollow(db, params.id, apCfg ?? null);
    return new Response(null, { status: 302, headers: { Location: '/reader/ap' } });
  });

  // ── Update check ─────────────────────────────────────────────────────────────
  app.get("/update-check", async ({ cookie }) => {
    const guard = requireAuth(cv(cookie));
    if (guard) return guard;

    try {
      const res = await fetch(
        "https://api.github.com/repos/woollover/grip/releases/latest",
        {
          headers: { "User-Agent": "grip-update-check" },
          signal: AbortSignal.timeout(5000),
        },
      );
      if (!res.ok) throw new Error(`GitHub API responded ${res.status}`);
      const data = (await res.json()) as { tag_name: string; html_url: string };
      const latest = data.tag_name.replace(/^v/, "");

      if (latest === currentVersion) {
        return html(<span>v{currentVersion} — up to date ✓</span>);
      }
      return html(
        <span style="color:var(--g-accent)">
          Update available: <strong safe>v{latest}</strong>
          {" "}
          <form method="POST" action="/update" style="display:inline;margin-left:0.25rem">
            <button type="submit" style="padding:0.15rem 0.6rem;font-size:0.75rem;display:inline">
              Update now
            </button>
          </form>
          {" "}
          <a href={data.html_url} target="_blank" rel="noopener noreferrer" style="font-size:0.75rem">
            changelog →
          </a>
        </span>,
      );
    } catch {
      return html(<span>Could not reach GitHub. Check your connection.</span>);
    }
  });

  return app;
}

function html(content: JSX.Element): Response {
  return new Response(content, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
    },
  });
}

function updatingPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Updating GRIP…</title>
  <style>
    body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;
         min-height:100vh;margin:0;background:#13171f;color:#c0c8d0}
    .box{text-align:center;padding:2rem}
    p{opacity:.65;font-size:.9rem;margin-top:.5rem}
  </style>
</head>
<body>
  <div class="box">
    <h2>Updating GRIP…</h2>
    <p>The server is restarting. You will be redirected to login automatically.</p>
  </div>
  <script>
    (function poll() {
      fetch('/login', { method: 'HEAD' })
        .then(function(r) { if (r.ok) location.href = '/login'; else setTimeout(poll, 2000); })
        .catch(function() { setTimeout(poll, 2000); });
    })();
  </script>
</body>
</html>`;
}

function errorPage(message: string): string {
  const safe = message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Update failed</title>
  <style>
    body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;
         min-height:100vh;margin:0;background:#13171f;color:#c0c8d0}
    .box{text-align:center;padding:2rem;max-width:480px}
    pre{text-align:left;background:#1c2030;padding:1rem;border-radius:6px;font-size:.8rem;overflow-x:auto}
    a{color:#58a6ff}
  </style>
</head>
<body>
  <div class="box">
    <h2>Update failed</h2>
    <pre>${safe}</pre>
    <p><a href="/settings">← Back to settings</a></p>
  </div>
</body>
</html>`;
}
