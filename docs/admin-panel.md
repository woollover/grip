# The Author Panel (port 4000)

The author panel is your private writing interface, accessible at `https://author.yourdomain.com`. It requires your passphrase to log in.

---

## Login

Visit `https://author.yourdomain.com` — you'll see the login form.

Enter the passphrase you chose during setup. After 5 failed attempts from the same IP, the account is locked for 15 minutes.

The session lasts 7 days. To log out, click **Logout** in the top navigation.

---

## Navigation

The top bar is always visible:

```
GRIP  |  Articles  |  Micro  |  Pages  |  Media  |  Settings  |  [Logout]
```

If ActivityPub is enabled, **Followers** and **Replies** also appear.

---

## Articles

Long-form writing. Articles live at `/articles/:slug` on the public site when published.

### Creating an article

1. Click **Articles** → **New article**
2. Fill in:
   - **Title** — required
   - **Slug** — the URL path (e.g. `my-first-post`). Leave blank to auto-generate from the title
   - **Tags** — comma-separated (e.g. `writing, tools, personal`)
   - **Body** — Markdown. A live preview updates as you type
3. Click **Save draft** — the article is saved but not visible on the public site yet

### Editing

Click any article title in the list to open the editor. Changes are saved as revisions — the full event history is preserved.

### Publishing / Unpublishing

- In the articles list, click **Publish** next to a draft
- Or use the **Publish** button at the bottom of the editor
- Published articles appear immediately on the public site
- Click **Unpublish** to hide an article without deleting it

### Markdown features

The editor supports standard Markdown:

```markdown
# Heading 1
## Heading 2

**bold**, _italic_, `code`

> blockquote

- list item
- another item

[link text](https://example.com)

![image alt text](/media/01JXXXXXXXXXXXXXXXX)
```

Code blocks with syntax highlighting:

    ```javascript
    const x = 1;
    ```

You can also write raw HTML in the body if needed.

### Inserting images

Click **📎 Insert image** above the editor. A file picker opens. After upload, the Markdown snippet is inserted at the cursor position automatically.

Use the **Left / Center / Right** alignment picker before clicking insert to control image float.

---

## Micro

Short notes — equivalent to a tweet or a toot. Appear on the public `/micro` page and in the Notes section of the home page.

### Creating a note

Type in the text box and click **Post**. Markdown is supported, but notes are typically kept short.

Notes are published immediately — there is no draft state.

### Retracting

Click **Retract** next to any note to remove it from the public site. The note is marked as retracted in the database (the event history is preserved — nothing is ever deleted).

If ActivityPub is enabled, posting a note automatically delivers it to all followers' inboxes.

---

## Pages

Static pages like About, Contact, or Now. They appear in the public site's navigation header when published.

### Creating a page

1. Click **Pages** → **New page**
2. Fill in title, slug, and body (Markdown)
3. Click **Save**

### Publishing

Click **Publish** to make the page visible on the public site. Published pages automatically appear in the navigation.

A **View →** link appears in the editor header when the page is published.

---

## Media

All uploaded files in one place.

### Uploading

Use the upload form at the top of the Media page (or the image button in any editor).

**Allowed file types:** JPG, PNG, GIF, WebP, SVG, PDF, MP4, MP3, plain text.

After upload, the file is accessible at `/media/:id` on both the public and author servers.

### Using media in articles

Copy the URL from the media page and paste it into your Markdown:

```markdown
![A photo of my cat](/media/01JXXXXXXXXXXXXXXXX)
```

Or use the **📎 Insert image** button in the editor to do this automatically.

---

## Settings

### Site identity

- **Site title** — appears in the header and RSS feeds
- **Description** — shown in the sidebar and RSS feed metadata
- **Domain** — your public domain, used in RSS and ActivityPub URLs. Change this here rather than in grip.toml (or update both and restart)

Click **Save** to apply.

### Theme

Click **Customize →** to open the theme editor.

- Choose from six presets: Light, Dark, Coder, Literary, Ink, Cyberpunk
- Customize fonts (body, headings, code), colours (accent, background, text, muted), and colour scheme (light/dark)
- A live preview updates as you make changes
- Click **Save theme** to apply

### ActivityPub

If ActivityPub is enabled in `grip.toml`, this section shows:
- Your federated identity (`@username@domain`)
- Current follower count, with a link to the followers list
- A note that settings are managed via `grip.toml`

If it's not enabled, the section shows a code snippet you can copy into `grip.toml` to activate it.

---

## Followers (ActivityPub only)

A table of everyone who follows you on the fediverse:
- Actor URL (links to their profile)
- Their server's inbox URL
- When they followed

Paginated, 20 per page.

---

## Replies (ActivityPub only)

Fediverse replies to your notes:
- **Post** — the note ID the reply is directed at
- **Author** — display name (links to their profile)
- **Content** — plain text, truncated at 100 characters
- **Date**
- **Status** — `visible` or `hidden`
- **Action** — toggle visibility with Hide/Show

Use **Hide** to suppress a reply from any future public display. The reply is retained in the database — nothing is deleted.

---

## CLI commands

If you have SSH access to the server, you can also use the command line:

```bash
# Post a Markdown file as a draft article
bun run src/cli/index.ts post my-article.md

# Post a quick note
bun run src/cli/index.ts micro "Just had the best espresso"

# Show recent events
bun run src/cli/index.ts status

# Rebuild all projections from scratch (use after a schema update)
bun run src/cli/index.ts rebuild
```

---

## Security notes

- The session cookie is `HttpOnly`, `SameSite=Strict`, valid for 7 days
- All database queries are parameterized
- The author server should only be accessible via HTTPS (Caddy handles this)
- Consider restricting `author.yourdomain.com` to your home IP in the Caddyfile for extra protection
