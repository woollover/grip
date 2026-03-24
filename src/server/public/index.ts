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
import { readPublicity } from "../../views/shared";
import { render404 } from "../../views/layout";

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
    const { title } = getSiteConfig(db);
    if (!readPublicity(db).showArticles) return notFound(db);
    const tag = query.tag as string | undefined;
    const page = Math.max(1, parseInt(query.page as string) || 1);
    return html(renderArticlesList(db, title, tag, page));
  });

  app.get("/articles/:slug", ({ params }) => {
    const { title } = getSiteConfig(db);
    if (!readPublicity(db).showArticles) return notFound(db);
    const page = renderArticle(db, params.slug, title);
    if (!page) return notFound(db);
    return html(page);
  });

  app.get("/micro", ({ query }) => {
    const { title } = getSiteConfig(db);
    if (!readPublicity(db).showMicro) return notFound(db);
    const page = Math.max(1, parseInt(query.page as string) || 1);
    return html(renderMicroList(db, title, apCfg, page));
  });

  app.get("/micro/:id", ({ params }) => {
    const { title } = getSiteConfig(db);
    if (!readPublicity(db).showMicro) return notFound(db);
    const page = renderMicroPost(db, params.id, title, apCfg);
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
    const { title, description, domain } = getSiteConfig(db);
    if (!readPublicity(db).rssEnabled) return notFound(db);
    return new Response(renderRssAll(db, domain, title, description), { headers: rssHeaders });
  });

  app.get("/articles/rss.xml", () => {
    const { title, description, domain } = getSiteConfig(db);
    const pub = readPublicity(db);
    if (!pub.rssEnabled || !pub.showArticles) return notFound(db);
    return new Response(renderRssArticles(db, domain, title, description), { headers: rssHeaders });
  });

  app.get("/micro/rss.xml", () => {
    const { title, description, domain } = getSiteConfig(db);
    const pub = readPublicity(db);
    if (!pub.rssEnabled || !pub.showMicro) return notFound(db);
    return new Response(renderRssMicro(db, domain, title, description), { headers: rssHeaders });
  });

  if (apCfg) {
    mountApRoutes(app, db, apCfg);
  }

  return app;
}
