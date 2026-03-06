export function renderLoginPage(badPassword: boolean, lockedOut: boolean): JSX.Element {
  const page = (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>GRIP — Login</title>
        <link rel="stylesheet" href="/static/pico.min.css" />
        <link rel="stylesheet" href="/theme.css" />
      </head>
      <body>
        <main class="container" style="max-width:400px;margin-top:4rem">
          <h1>GRIP</h1>
          {lockedOut && (
            <p role="alert" style="color:var(--pico-color-red-500)">
              Too many failed attempts. Try again in 15 minutes.
            </p>
          )}
          {badPassword && (
            <p role="alert" style="color:var(--pico-color-red-500)">
              Incorrect passphrase.
            </p>
          )}
          <form method="POST" action="/login">
            <label for="passphrase">Passphrase</label>
            <input type="password" id="passphrase" name="passphrase" autofocus required />
            <button type="submit">Enter</button>
          </form>
        </main>
      </body>
    </html>
  );
  return ('<!DOCTYPE html>' + page) as unknown as JSX.Element;
}
