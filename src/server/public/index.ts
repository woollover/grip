import { Elysia } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import type { Database } from "bun:sqlite";
import { getThemeCss } from "../../core/themes";
import { renderHome } from "./routes/home";
import { renderArticlesList, renderArticle } from "./routes/articles";
import { renderMicroList } from "./routes/micro";
import { renderPage } from "./routes/pages";
import { serveMedia } from "./routes/media";
import { mountApRoutes } from "../../activitypub/routes";
import type { ApConfig } from "../../activitypub/config";
import { renderRssAll, renderRssArticles, renderRssMicro } from "./routes/rss";

function getSiteConfig(db: Database): {
  title: string;
  description: string;
  domain: string;
} {
  const get = (key: string, fallback: string) => {
    const row = db
      .prepare("SELECT value FROM config WHERE key = ?")
      .get(key) as { value: string } | null;
    return row?.value ?? fallback;
  };
  return {
    title: get("site_title", "My GRIP"),
    description: get("site_description", "A personal publishing space"),
    domain: get("domain", "localhost:3000"),
  };
}

function getPublicityConfig(db: Database) {
  const get = (key: string, fallback: string) =>
    (db.prepare("SELECT value FROM config WHERE key = ?").get(key) as { value: string } | null)?.value ?? fallback;
  const isPrivate = get("publicity_mode", "public") === "private";
  return {
    showArticles: !isPrivate && get("show_articles", "1") === "1",
    showMicro:    !isPrivate && get("show_micro",    "1") === "1",
    rssEnabled:   !isPrivate && get("rss_enabled",   "1") === "1",
  };
}

const SECURITY_HEADERS = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy": "default-src 'self'; script-src 'none'; style-src 'self' 'unsafe-inline'",
};

function html(content: string): Response {
  return new Response(content, {
    headers: { "Content-Type": "text/html; charset=utf-8", ...SECURITY_HEADERS },
  });
}

function notFound(siteTitle: string): Response {
  return new Response(
    `<!DOCTYPE html><html><head><title>404 — ${siteTitle}</title></head><body><h1>Not found</h1><a href="/">Home</a></body></html>`,
    { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export function createPublicApp(
  db: Database,
  port: number,
  apCfg?: ApConfig | null,
): Elysia {
  const app = new Elysia({ name: "public" });

  // Static files (PicoCSS, HTMX vendored)
  app.use(staticPlugin({ assets: "public/static", prefix: "/static" }));

  app.get("/theme.css", () => {
    return new Response(getThemeCss(db), {
      headers: {
        "Content-Type": "text/css; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  });

  app.get("/", () => {
    const { title, description } = getSiteConfig(db);
    return html(renderHome(db, title, description));
  });

  app.get("/articles", ({ query }) => {
    const { title } = getSiteConfig(db);
    if (!getPublicityConfig(db).showArticles) return notFound(title);
    const tag = query.tag as string | undefined;
    const page = Math.max(1, parseInt(query.page as string) || 1);
    return html(renderArticlesList(db, title, tag, page));
  });

  app.get("/articles/:slug", ({ params }) => {
    const { title } = getSiteConfig(db);
    if (!getPublicityConfig(db).showArticles) return notFound(title);
    const page = renderArticle(db, params.slug, title);
    if (!page) return notFound(title);
    return html(page);
  });

  app.get("/micro", ({ query }) => {
    const { title } = getSiteConfig(db);
    if (!getPublicityConfig(db).showMicro) return notFound(title);
    const page = Math.max(1, parseInt(query.page as string) || 1);
    return html(renderMicroList(db, title, apCfg, page));
  });

  app.get("/pages/:slug", ({ params }) => {
    const { title } = getSiteConfig(db);
    const page = renderPage(db, params.slug, title);
    if (!page) return notFound(title);
    return html(page);
  });

  app.get("/media/:id", ({ params }) => {
    const response = serveMedia(db, params.id);
    if (!response) return notFound("GRIP");
    return response;
  });

  const rssHeaders = { "Content-Type": "application/rss+xml; charset=utf-8" };

  app.get("/rss.xml", () => {
    const { title, description, domain } = getSiteConfig(db);
    if (!getPublicityConfig(db).rssEnabled) return notFound(title);
    return new Response(renderRssAll(db, domain, title, description), { headers: rssHeaders });
  });

  app.get("/articles/rss.xml", () => {
    const { title, description, domain } = getSiteConfig(db);
    const pub = getPublicityConfig(db);
    if (!pub.rssEnabled || !pub.showArticles) return notFound(title);
    return new Response(renderRssArticles(db, domain, title, description), { headers: rssHeaders });
  });

  app.get("/micro/rss.xml", () => {
    const { title, description, domain } = getSiteConfig(db);
    const pub = getPublicityConfig(db);
    if (!pub.rssEnabled || !pub.showMicro) return notFound(title);
    return new Response(renderRssMicro(db, domain, title, description), { headers: rssHeaders });
  });

  if (apCfg) {
    mountApRoutes(app, db, apCfg);
  }

  return app;
}
