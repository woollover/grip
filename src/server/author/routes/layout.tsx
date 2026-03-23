import type { Database } from "bun:sqlite";
import { getColorScheme, getThemeVersion } from "../../../core/themes";

export function authorLayout(
  title: string,
  content: JSX.Element,
  db?: Database,
): JSX.Element {
  const scheme = db ? getColorScheme(db) : "light";
  const themeVersion = db ? getThemeVersion(db) : "default";
  const apEnabled = db
    ? !!(
        db
          .prepare("SELECT value FROM config WHERE key = 'ap_enabled'")
          .get() as { value: string } | null
      )?.value
    : false;
  const page = (
    <html lang="en" data-theme={scheme}>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>GRIP — {title}</title>
        <link rel="stylesheet" href="/static/open-props.min.css" />
        <link rel="stylesheet" href="/static/grip.css" />
        <link rel="stylesheet" href={`/theme.css?v=${themeVersion}`} />
        <script src="/static/htmx.min.js" defer />
      </head>
      <body class="g-author">
        <div class="container">
          <nav class="g-nav">
            <ul>
              <li class="g-nav-brand">
                <strong>
                  <a href="/dashboard">GRIP</a>
                </strong>
              </li>

              <li class="nav-div"></li>
              <li>
                <span class="nav-group-label">Write</span>
              </li>
              <li>
                <a href="/articles">Articles</a>
              </li>
              <li>
                <a href="/micro">Micro</a>
              </li>
              <li>
                <a href="/pages">Pages</a>
              </li>
              <li>
                <a href="/media">Media</a>
              </li>

              <li class="nav-div"></li>
              <li>
                <span class="nav-group-label">Read</span>
              </li>
              <li>
                <a href="/reader">Reader</a>
              </li>

              <li class="nav-div"></li>
              <li>
                <a href="/settings">Settings</a>
              </li>
              <li>
                <a href="/export">Export</a>
              </li>
              <li>
                <a href="/backup">Backup</a>
              </li>
              {apEnabled && (
                <li>
                  <a href="/contacts">Contacts</a>
                </li>
              )}
              {apEnabled && (
                <li>
                  <a href="/replies">Replies</a>
                </li>
              )}

              <li style="margin-left:auto">
                <form method="POST" action="/logout" style="margin:0">
                  <button
                    type="submit"
                    class="outline secondary"
                    style="padding:0.25rem 0.75rem"
                  >
                    Logout
                  </button>
                </form>
              </li>
            </ul>
          </nav>
          <main>{content}</main>
        </div>
      </body>
    </html>
  );
  return ("<!DOCTYPE html>" + page) as unknown as JSX.Element;
}
