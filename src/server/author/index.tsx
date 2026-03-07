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
} from "./routes/settings";
import { renderRepliesIndex, handleReplyToggle, renderFollowersIndex } from "./routes/replies";
import type { ApConfig } from "../../activitypub/config";
import { deliverNewPost } from "../../activitypub/delivery";

const SESSION_COOKIE = "grip_session";
const cv = (cookie: Record<string, { value?: string } | undefined>) =>
  cookie[SESSION_COOKIE]?.value as string | undefined;

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
    return html(renderLoginPage(false, false));
  });

  app.post("/login", async ({ body, request }) => {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    const passphrase = (body as { passphrase?: string }).passphrase ?? "";

    if (isLockedOut(ip)) {
      return new Response(renderLoginPage(false, true), {
        status: 429,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const ok = await verifyPassphrase(db, passphrase);
    store.append({ type: "AuthAttempt", success: ok, ip });

    if (!ok) {
      recordFailedAttempt(ip);
      return new Response(renderLoginPage(true, false), {
        status: 401,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    clearAttempts(ip);
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
  app.get("/articles", ({ cookie }) => {
    return (
      requireAuth(cv(cookie)) ??
      html(renderArticlesIndex(db))
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
  app.get("/micro", ({ cookie }) => {
    return (
      requireAuth(cv(cookie)) ?? html(renderMicroIndex(db))
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
          console.error("[activitypub] Delivery error:", err);
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

  // ── ActivityPub author views ────────────────────────────────────────────────
  if (apCfg) {
    app.get("/followers", ({ cookie, query }) => {
      const guard = requireAuth(cv(cookie));
      if (guard) return guard;
      const page = Math.max(1, parseInt(query.page as string) || 1);
      return html(renderFollowersIndex(db, page));
    });

    app.get("/replies", ({ cookie, query }) => {
      const guard = requireAuth(cv(cookie));
      if (guard) return guard;
      const page = Math.max(1, parseInt(query.page as string) || 1);
      return html(renderRepliesIndex(db, page));
    });

    app.post("/replies/:id/toggle", ({ params, cookie }) => {
      const guard = requireAuth(cv(cookie));
      if (guard) return guard;
      handleReplyToggle(db, params.id);
      return new Response(null, { status: 302, headers: { Location: "/replies" } });
    });
  }

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
