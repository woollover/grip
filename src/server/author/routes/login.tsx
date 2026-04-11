import { getColorScheme } from "../../../core/themes";
import type { GripDb } from "../../data/index";

export function renderLoginPage(
  badPassword: boolean,
  lockedOut: boolean,
  db?: GripDb,
): string {
  const scheme = db ? getColorScheme(db.raw) : "light";
  const siteTitle = db ? (db.config.get("site_title", "GRIP") ?? "GRIP") : "GRIP";

  const page = (
    <html lang="en" data-theme={scheme}>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{siteTitle} — Login</title>
        <link rel="stylesheet" href="/static/open-props.min.css" />
        <link rel="stylesheet" href="/static/grip.css" />
        <link rel="stylesheet" href="/theme.css?v=login" />
      </head>
      <body>
        <div class="login-wrap">
          <div class="login-card">
            <p class="login-title">{siteTitle}</p>
            {lockedOut && (
              <p role="alert" style="color:var(--g-danger);font-size:0.85rem">
                Too many failed attempts. Try again in 15 minutes.
              </p>
            )}
            {badPassword && (
              <p role="alert" style="color:var(--g-danger);font-size:0.85rem">
                Incorrect passphrase.
              </p>
            )}
            <form method="POST" action="/login">
              <input
                type="password"
                id="passphrase"
                name="passphrase"
                placeholder="Passphrase"
                autofocus
                required
              />
              <button type="submit" style="width:100%">
                Enter
              </button>
            </form>
          </div>
        </div>
      </body>
    </html>
  );
  return "<!DOCTYPE html>" + page;
}
