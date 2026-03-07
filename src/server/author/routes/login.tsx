import type { Database } from 'bun:sqlite';
import { getColorScheme } from '../../../core/themes';

export function renderLoginPage(badPassword: boolean, lockedOut: boolean, db?: Database): JSX.Element {
  const scheme = db ? getColorScheme(db) : 'light';
  const siteTitle = db
    ? ((db.prepare("SELECT value FROM config WHERE key = 'site_title'").get() as { value: string } | null)?.value ?? 'GRIP')
    : 'GRIP';

  const page = (
    <html lang="en" data-theme={scheme}>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{siteTitle} — Login</title>
        <link rel="stylesheet" href="/static/pico.min.css" />
        <link rel="stylesheet" href="/theme.css" />
        <style>{`
          .login-wrap {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2rem;
          }
          .login-card {
            width: 100%;
            max-width: 360px;
          }
          .login-title {
            font-size: 0.65rem;
            font-weight: 700;
            letter-spacing: 0.14em;
            text-transform: uppercase;
            color: var(--pico-muted-color);
            margin: 0 0 2rem;
          }
          .login-card input[type=password] {
            margin-bottom: 0.75rem;
          }
        `}</style>
      </head>
      <body>
        <div class="login-wrap">
          <div class="login-card">
            <p class="login-title">{siteTitle}</p>
            {lockedOut && (
              <p role="alert" style="color:var(--pico-color-red-500);font-size:0.85rem">
                Too many failed attempts. Try again in 15 minutes.
              </p>
            )}
            {badPassword && (
              <p role="alert" style="color:var(--pico-color-red-500);font-size:0.85rem">
                Incorrect passphrase.
              </p>
            )}
            <form method="POST" action="/login">
              <input type="password" id="passphrase" name="passphrase"
                placeholder="Passphrase" autofocus required />
              <button type="submit" style="width:100%">Enter</button>
            </form>
          </div>
        </div>
      </body>
    </html>
  );
  return ('<!DOCTYPE html>' + page) as unknown as JSX.Element;
}
