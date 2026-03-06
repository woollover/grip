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
import { renderRssAll } from "./routes/rss";

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

function html(content: string): Response {
  return new Response(content, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
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

  app.get("/articles", () => {
    const { title } = getSiteConfig(db);
    return html(renderArticlesList(db, title));
  });

  app.get("/articles/:slug", ({ params }) => {
    const { title } = getSiteConfig(db);
    const page = renderArticle(db, params.slug, title);
    if (!page) return notFound(title);
    return html(page);
  });

  app.get("/micro", () => {
    const { title } = getSiteConfig(db);
    return html(renderMicroList(db, title, apCfg));
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

  app.get("/rss.xml", () => {
    const { title, description, domain } = getSiteConfig(db);
    return new Response(renderRssAll(db, domain, title, description), {
      headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
    });
  });

  if (apCfg) {
    mountApRoutes(app, db, apCfg);
  }

  return app;
}
