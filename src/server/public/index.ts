import { Elysia } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import type { Database } from "bun:sqlite";
import { getThemeCss } from "../../core/themes";
import { renderHome } from "./routes/home";
import { renderArticlesList, renderArticle } from "./routes/articles";
import { renderMicroList, renderMicroPost } from "./routes/micro";
import { renderPage } from "./routes/pages";
import { serveMedia } from "./routes/media";
import { mountApRoutes } from "../../activitypub/routes";
import type { ApConfig } from "../../activitypub/config";
import { renderRssAll, renderRssArticles, renderRssMicro } from "./routes/rss";
import { render404 } from "../../views/layout";
import { getSiteConfig } from "../data/config";

const SECURITY_HEADERS = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Content-Security-Policy": "default-src 'self'; script-src 'none'; style-src 'self' 'unsafe-inline'",
};

function html(content: JSX.Element | string): Response {
  return new Response(content as string, {
    headers: { "Content-Type": "text/html; charset=utf-8", ...SECURITY_HEADERS },
  });
}

function notFound(db: Database): Response {
  return new Response(render404(db), {
    status: 404,
    headers: { "Content-Type": "text/html; charset=utf-8", ...SECURITY_HEADERS },
  });
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
    const cfg = getSiteConfig(db);
    if (!cfg.showArticles) return notFound(db);
    const tag = query.tag as string | undefined;
    const page = Math.max(1, parseInt(query.page as string) || 1);
    return html(renderArticlesList(db, cfg.title, tag, page));
  });

  app.get("/articles/:slug", ({ params }) => {
    const cfg = getSiteConfig(db);
    if (!cfg.showArticles) return notFound(db);
    const page = renderArticle(db, params.slug, cfg.title);
    if (!page) return notFound(db);
    return html(page);
  });

  app.get("/micro", ({ query }) => {
    const cfg = getSiteConfig(db);
    if (!cfg.showMicro) return notFound(db);
    const page = Math.max(1, parseInt(query.page as string) || 1);
    return html(renderMicroList(db, cfg.title, apCfg, page));
  });

  app.get("/micro/:id", ({ params }) => {
    const cfg = getSiteConfig(db);
    if (!cfg.showMicro) return notFound(db);
    const page = renderMicroPost(db, params.id, cfg.title, apCfg);
    if (!page) return notFound(db);
    return html(page);
  });

  app.get("/pages/:slug", ({ params }) => {
    const page = renderPage(db, params.slug, getSiteConfig(db).title);
    if (!page) return notFound(db);
    return html(page);
  });

  app.get("/media/:id", ({ params }) => {
    const response = serveMedia(db, params.id);
    if (!response) return notFound(db);
    return response;
  });

  const rssHeaders = { "Content-Type": "application/rss+xml; charset=utf-8" };

  app.get("/rss.xml", () => {
    const cfg = getSiteConfig(db);
    if (!cfg.rssEnabled) return notFound(db);
    return new Response(renderRssAll(db, cfg.domain, cfg.title, cfg.description), { headers: rssHeaders });
  });

  app.get("/articles/rss.xml", () => {
    const cfg = getSiteConfig(db);
    if (!cfg.rssEnabled || !cfg.showArticles) return notFound(db);
    return new Response(renderRssArticles(db, cfg.domain, cfg.title, cfg.description), { headers: rssHeaders });
  });

  app.get("/micro/rss.xml", () => {
    const cfg = getSiteConfig(db);
    if (!cfg.rssEnabled || !cfg.showMicro) return notFound(db);
    return new Response(renderRssMicro(db, cfg.domain, cfg.title, cfg.description), { headers: rssHeaders });
  });

  if (apCfg) {
    mountApRoutes(app, db, apCfg);
  }

  return app;
}
