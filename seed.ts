/**
 * Seed script — creates 15 articles + 40 micro-posts for UI testing.
 * Run from the project root: bun run seed.ts
 */
import { getDb } from './src/core/db';
import { EventStore } from './src/core/events';
import { applyEvent } from './src/core/projections';
import { ulid } from 'ulidx';

const db = getDb('./data/grip.sqlite');
const store = new EventStore(db);

// Helper: timestamp N days ago
const daysAgo = (n: number) => Date.now() - n * 86_400_000;

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function create(event: Parameters<typeof store.append>[0], ts: number) {
  store.append(event);
  applyEvent(db, event, ts);
}

// ── Articles ─────────────────────────────────────────────────────────────────

const articles: { title: string; tags: string[]; body: string; daysAgo: number }[] = [
  {
    title: 'The terminal is my IDE',
    tags: ['tools', 'workflow'],
    daysAgo: 180,
    body: `I have tried every IDE. VS Code, IntelliJ, Zed, Nova. I keep coming back to the terminal.

This is not a productivity flex. It's a preference I've spent years earning.

## Why it works for me

The terminal composes. Every tool speaks text, pipes flow between them, and you build understanding incrementally. When something breaks you can bisect the pipeline.

\`\`\`bash
# Find the ten largest files in the current tree
du -ah . | sort -rh | head -10
\`\`\`

VS Code is better at many things — autocomplete, refactoring, integrated debugging. But it's a sealed environment. When you need to do something it doesn't support, you're stuck.

## The actual setup

I live in \`tmux\` with three panes: editor (Neovim), a shell for running things, and a shell for git. That's it.

\`\`\`
┌──────────────────┬───────────┐
│                  │  shell    │
│   neovim         ├───────────┤
│                  │   git     │
└──────────────────┴───────────┘
\`\`\`

The key insight: muscle memory for the terminal transfers everywhere. SSH into a server, it's the same. Docker container, same. Decade-old Linux box, same.

## What I miss

Inline type errors and good autocomplete. \`nvim-lsp\` covers most of it but the experience is still not as smooth as a purpose-built IDE. That's the honest trade-off.`,
  },
  {
    title: 'SQLite is underrated',
    tags: ['databases', 'sqlite'],
    daysAgo: 172,
    body: `Most web applications don't need Postgres. They need SQLite.

I know how that sounds. Bear with me.

## The numbers

SQLite handles ~35% of the world's databases by count. It's in your phone, your browser, your desktop apps, aircraft entertainment systems, and many production web services.

\`\`\`sql
-- WAL mode: readers don't block writers
PRAGMA journal_mode=WAL;

-- STRICT tables: actual type enforcement
CREATE TABLE posts (
  id    TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body  TEXT NOT NULL
) STRICT;
\`\`\`

## When it's wrong

Concurrent *writes* at high volume. If you're getting hammered with writes from multiple processes, SQLite will serialize them and you'll see contention. Move to Postgres then.

For everything else — personal tools, small-to-medium SaaS, embedded systems, local-first apps — SQLite is the right default.

## The local-first advantage

A SQLite file is a self-contained artifact. You can copy it, diff it (with \`sqldiff\`), open it in any language, and inspect it with \`sqlite3\`. No server to babysit. No connection pool to tune.

This blog runs on SQLite. So does Notion's mobile app. So does WhatsApp.`,
  },
  {
    title: 'Writing shell scripts that don\'t break',
    tags: ['bash', 'tools'],
    daysAgo: 165,
    body: `Shell scripts age poorly. You write one, it works, you forget about it for two years, and then something in the environment changes and it silently does the wrong thing.

Here's how I write scripts that are at least less likely to betray me.

## The header

Every script starts the same way:

\`\`\`bash
#!/usr/bin/env bash
set -euo pipefail
IFS=$'\\n\\t'
\`\`\`

- \`-e\`: exit on error
- \`-u\`: treat unset variables as errors
- \`-o pipefail\`: pipes fail if any command fails
- \`IFS\`: sane field splitting

Without these, \`rm -rf $DIR/\` becomes \`rm -rf /\` if \`DIR\` is unset.

## Functions over scripts

Prefer functions. They share the caller's environment, they compose, and they're easier to test.

\`\`\`bash
backup_db() {
  local src=\"${1:?usage: backup_db <src>}\"
  local dst="backup_$(date +%Y%m%d_%H%M%S).sqlite"
  cp "$src" "$dst"
  echo "Backed up to $dst"
}
\`\`\`

## Quoting is not optional

\`\`\`bash
# Wrong — breaks on spaces in filenames
for f in $(ls *.md); do

# Right
for f in *.md; do
\`\`\`

Always double-quote variable expansions unless you specifically need word splitting.`,
  },
  {
    title: 'On local-first software',
    tags: ['philosophy', 'software'],
    daysAgo: 158,
    body: `I have lost data to cloud services shutting down three times. Once was a personal wiki, once a list of things I want to read, once a years-long journal. Each time the service gave a month's notice and called it generous.

The problem is that we've accepted "we hold your data for you" as the default contract for software.

## What local-first means

Your data lives on your device first. The network is a convenience, not a requirement. The service can disappear without taking your data with it.

This is not nostalgia for the 90s. SQLite, CRDTs, and good sync protocols make local-first software genuinely practical now.

## The UX cost

Local-first is harder to build. You need to handle sync conflicts, offline states, and migration between formats. Users are used to just opening a URL.

The UX payoff: your software works on a plane. It works when the API is down. It works in ten years when the company has pivoted or folded.

## What I actually do

Everything important lives in files. Notes in Markdown. Data in SQLite. Code in git. These formats will outlive every SaaS tool I'm currently using.`,
  },
  {
    title: 'Git workflows that actually work',
    tags: ['git', 'workflow'],
    daysAgo: 150,
    body: `Most teams use git wrong. Not broken wrong — it works — but wrong in the sense that the history becomes a liability instead of an asset.

## The goal

The git log should tell the story of how the software evolved. It should be readable by someone who wasn't there.

\`\`\`
feat: add pagination to the articles endpoint

Previously the endpoint returned all articles. On large datasets
this caused timeouts. Added cursor-based pagination with a default
limit of 20 items per page.

Fixes #142
\`\`\`

That's a useful commit. Not "wip" or "fix stuff" or "asdfghjkl".

## Trunk-based development

Feature branches should live for hours, not weeks. Long-lived branches diverge and create merge conflicts that nobody wants to untangle.

Merge to main often. Use feature flags for large changes. Keep the main branch deployable at all times.

## Rebase or merge?

Rebase for cleaning up local work before pushing. Merge for integrating team work. Never rebase public history.

\`\`\`bash
# Clean up before pushing
git rebase -i origin/main

# Integrate a feature branch
git merge --no-ff feature/pagination
\`\`\`

The merge commit is useful — it marks the integration point.`,
  },
  {
    title: 'TypeScript's type system is a programming language',
    tags: ['typescript', 'types'],
    daysAgo: 142,
    body: `TypeScript's type system is Turing complete. This is not a theoretical curiosity — it changes how you think about types.

## Types as functions

A generic type is a function over types:

\`\`\`typescript
type Nullable<T> = T | null;
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };
\`\`\`

\`Result\` takes two type parameters and returns a union. You call it like a function: \`Result<User, ApiError>\`.

## Conditional types

\`\`\`typescript
type Unwrap<T> = T extends Promise<infer U> ? U : T;

type A = Unwrap<Promise<string>>;  // string
type B = Unwrap<number>;           // number
\`\`\`

This is pattern matching on types. \`extends\` is roughly "does T match this shape?", \`infer\` captures a sub-type.

## Mapped types

\`\`\`typescript
type Partial<T> = { [K in keyof T]?: T[K] };
type Readonly<T> = { readonly [K in keyof T]: T[K] };
\`\`\`

These transform every property of a type. The standard library is full of them.

## When to stop

The type level is powerful but it has a compile-time cost and a readability cost. Types that take ten lines to express a constraint are usually a signal to step back and simplify the design.`,
  },
  {
    title: 'Debugging like a detective',
    tags: ['debugging', 'craft'],
    daysAgo: 133,
    body: `Good debugging is a skill that compound-interests. Every bug you fix teaches you something about the system.

## The hypothesis loop

1. Observe the symptom
2. Form a hypothesis about the cause
3. Design the cheapest test of that hypothesis
4. Run it
5. Update your model, repeat

The mistake is skipping step 3 and jumping straight to changing code. Changes without hypotheses create noise that makes the bug harder to find.

## Binary search

A bug exists somewhere between a known-good state and the broken state. Bisect.

\`\`\`bash
git bisect start
git bisect bad HEAD
git bisect good v1.2.0
# git runs the binary search; you mark each commit good/bad
git bisect run ./test.sh
\`\`\`

This works for more than git. Any time you have a sequence of states — log lines, configurations, data inputs — you can binary search the failure.

## Rubber duck debugging

Explain the problem out loud, in detail, as if to someone who doesn't know the codebase. The act of articulating the problem forces you to be precise, and precision reveals assumptions.

## The most common bug

Is always the one you were sure wasn't the problem.`,
  },
  {
    title: 'Read the source',
    tags: ['craft', 'learning'],
    daysAgo: 125,
    body: `Documentation lies. Not always, not intentionally, but it drifts. Code doesn't.

When I'm stuck on a library, I now go to the source before I go to Stack Overflow. It takes longer at first. It pays off consistently.

## What you find in the source

The docs say a function accepts an options object. The source shows which options are actually read, which ones have undocumented defaults, and which paths are dead code nobody tests.

You find out that the "stable" API wraps an internal API that's nicer to use directly. You find that the performance problem you're hitting has a one-line workaround in a comment from 2019.

## How to read unfamiliar code

Start from the entry point you know — the function you're calling. Follow calls down, not up. Ignore code you're not executing.

\`\`\`bash
# Jump to definition (with ripgrep)
rg "function handleRequest" --type ts
\`\`\`

## The meta-skill

Reading other people's code makes you better at writing your own. You see patterns, mistakes, and trade-offs that you'd never encounter in your own work.`,
  },
  {
    title: 'The art of the commit message',
    tags: ['git', 'craft'],
    daysAgo: 117,
    body: `A commit message is a letter to your future self and your colleagues. Write it with that in mind.

## The format

\`\`\`
<type>: <short summary in imperative mood>

<body — what and why, not how>

<footer — breaking changes, issue refs>
\`\`\`

The summary line answers: if applied, this commit will ___.

## Types

- \`feat\`: new feature
- \`fix\`: bug fix
- \`refactor\`: no behaviour change
- \`perf\`: performance improvement
- \`docs\`: documentation only
- \`test\`: tests only
- \`chore\`: tooling, dependencies

## The body matters

\`\`\`
fix: prevent race condition in session expiry

Sessions were being read and deleted in two separate transactions.
Under load, a second request could read the session between the
check and the delete, causing both requests to proceed as authenticated.

Wrapped check + delete in a single transaction.
\`\`\`

The "what" is in the diff. The "why" is only in your head unless you write it down.`,
  },
  {
    title: 'Building tools you actually use',
    tags: ['tools', 'philosophy'],
    daysAgo: 108,
    body: `The best tools are the ones that fit your exact workflow. The second best are the ones that almost fit and that you can modify.

## The danger of general tools

General tools optimize for the median use case. Your use case is specific. The mismatch is friction you pay on every interaction.

I've written small scripts that save me thirty seconds a day. A year later that's three hours of tedium I didn't suffer. The compounding is real.

## What's worth building

Build something if:
- You do the task more than a few times a week
- The existing tools are meaningfully bad for your case
- The cost to build is less than the cumulative friction cost

Don't build something if:
- A good tool exists and the configuration cost is low
- You're procrastinating on actual work

## Keep them small

A tool that does one thing well is maintainable. A tool that does ten things is a project.

\`\`\`bash
# Good: focused script
#!/usr/bin/env bash
# pr — open the current branch's PR in the browser
gh pr view --web
\`\`\`

The instinct to generalize is usually wrong on the first iteration.`,
  },
  {
    title: 'Notes on event sourcing',
    tags: ['architecture', 'databases'],
    daysAgo: 99,
    body: `Event sourcing is one of those patterns that sounds complicated and is actually simple. It's also one of those patterns that sounds simple in production and is actually complicated.

## The idea

Instead of storing current state, store the sequence of events that produced that state. Current state is derived by replaying events.

\`\`\`typescript
type Event =
  | { type: 'ArticleCreated'; id: string; title: string; body: string }
  | { type: 'ArticlePublished'; id: string }
  | { type: 'ArticleRetracted'; id: string };

function project(events: Event[]): Article[] {
  // replay all events to build current state
}
\`\`\`

## What you get

- Complete audit history
- Time travel: replay to any point
- New projections: re-read history to build new views
- Bug recovery: correct events, rebuild state

## What it costs

- Storage grows forever (mitigated with snapshots)
- Event schema evolution is hard
- Queries are more complex
- Teams need to learn the pattern

## When it's worth it

When the history *is* the data. Accounting, medical records, collaborative editing, anywhere you need to answer "what happened and why."`,
  },
  {
    title: 'HTTP caching: a practical guide',
    tags: ['web', 'performance'],
    daysAgo: 90,
    body: `HTTP caching is one of the most powerful and most misunderstood tools in web performance. A correctly cached response costs nothing.

## The headers that matter

\`\`\`
Cache-Control: max-age=31536000, immutable
\`\`\`

For static assets with content-addressed URLs (e.g., \`main.a3f8c1.js\`): cache forever. The hash in the filename is the cache-busting mechanism.

\`\`\`
Cache-Control: no-cache
\`\`\`

"No-cache" doesn't mean "don't cache." It means "revalidate before using." The browser stores the response and sends a conditional request. If nothing changed (304), it uses the cached copy.

\`\`\`
Cache-Control: no-store
\`\`\`

This means "don't cache." Use it for truly private, per-user data.

## ETags

\`\`\`
ETag: "abc123"
If-None-Match: "abc123"
\`\`\`

The server generates a fingerprint of the response. The browser sends it back on the next request. If it matches, 304 Not Modified — no body transmitted.

## The common mistake

Not setting cache headers and relying on browser heuristics. The browser *will* cache things, but the heuristics are not what you want. Be explicit.`,
  },
  {
    title: 'Vim motions changed how I edit text',
    tags: ['tools', 'vim'],
    daysAgo: 82,
    body: `I'm not here to tell you to use Vim. I'm here to tell you that the motion model is worth learning regardless of what editor you use.

## Text as structure

Most editors treat a document as a sequence of characters. Vim treats it as structured text: words, sentences, paragraphs, blocks, functions.

\`\`\`
w    — next word
b    — previous word
e    — end of word
}    — next paragraph
%    — matching bracket
\`\`\`

Once you can navigate by structure, character-by-character movement feels like walking with your eyes closed.

## Operators + motions = power

The grammar is: operator + motion = action.

\`\`\`
d + w = delete word       (dw)
c + } = change paragraph  (c})
y + % = copy to bracket   (y%)
\`\`\`

Once you internalize the grammar, you stop memorizing commands and start composing them.

## Text objects

\`\`\`
ci"  — change inside quotes
da(  — delete around parentheses
yi{  — yank inside braces
\`\`\`

"Inside" and "around" paired with any delimiter. Fantastically useful for editing code.

## How to start

Install a Vim plugin for your current editor. Run \`vimtutor\` once. Commit to using motions for one week even when it's slower.`,
  },
  {
    title: 'The unreasonable effectiveness of grep',
    tags: ['tools', 'unix'],
    daysAgo: 73,
    body: `\`grep\` is forty years old and I use it every day. It does one thing — search — and it does it well enough that most specialized tools don't improve on the concept, only the implementation.

## The basics you might not know

\`\`\`bash
# Recursive, show line numbers, with context
grep -rn --context=2 "pattern" .

# Only print filenames
grep -rl "TODO" .

# Invert match
grep -v "^#" config.txt  # strip comments

# Fixed string (no regex)
grep -F "literal.dot.string" file
\`\`\`

## ripgrep

\`rg\` is grep but faster and saner. It respects \`.gitignore\`, handles binary files gracefully, and has better defaults.

\`\`\`bash
rg "handleRequest" --type ts --glob "!*.test.ts"
\`\`\`

## Pipelines

\`\`\`bash
# Count occurrences of each HTTP status in a log
grep -oP '"status":\\d+' access.log \\
  | sort | uniq -c | sort -rn

# Find large files modified in the last day
find . -mtime -1 | xargs du -sh | sort -rh | head -20
\`\`\`

The power isn't \`grep\` alone. It's \`grep\` in a pipeline.`,
  },
  {
    title: 'Performance profiling without guessing',
    tags: ['performance', 'craft'],
    daysAgo: 65,
    body: `Every performance optimization starts with measurement. Not guessing, not intuition — measurement. The code you think is slow is rarely the actual bottleneck.

## Find the hot path

Profile first. On Node/Bun:

\`\`\`bash
bun --smol run --prof server.ts
# or
node --prof app.js && node --prof-process isolate-*.log
\`\`\`

On the browser: Chrome DevTools Performance panel, record, find the wide bars.

## Understand before optimizing

Understand *why* something is slow before you change it. Is it CPU? I/O? Memory? Network? Allocations?

A CPU-bound bottleneck calls for algorithmic improvement. An I/O-bound bottleneck calls for caching or parallelism. Mixing these up wastes time.

## The cheap wins

Before reaching for clever solutions:

1. **Cache the result** — if the computation is repeated
2. **Reduce allocations** — GC pauses are often the issue
3. **Use the right data structure** — \`Map\` vs \`Object\`, \`Set\` vs \`Array.includes\`
4. **Reduce network round-trips** — batch requests, use HTTP/2 push or prefetch

## The measurement loop

Measure. Change one thing. Measure again. If it didn't help, revert. Don't "optimize" multiple things at once — you won't know what actually helped.`,
  },
];

// ── Micro-posts ────────────────────────────────────────────────────────────────

const microBodies: string[] = [
  'TIL that SQLite has a `RETURNING` clause. `INSERT INTO t (x) VALUES (1) RETURNING id;` — no more select-after-insert.',
  'The best code review comment is a question, not a correction.',
  'Spent an hour debugging a race condition that turned out to be a missing `await`. The compiler can\'t save you from everything.',
  'Reading _A Philosophy of Software Design_ for the second time. The chapter on deep modules keeps getting more true.',
  'Hot take: most "microservices" are just monoliths with extra network calls and no shared memory.',
  '`git bisect run ./test.sh` is one of the most underused git features. It will find your bug commit automatically.',
  'The terminal trick I use most often: `Ctrl+R` to search history. Faster than any alias.',
  'Good error messages are a feature. "Something went wrong" is a bug.',
  'Reminder to self: the problem is almost never where you first look for it.',
  'Just switched from Prettier to `dprint` for formatting. The speed difference is noticeable on large codebases.',
  'Every abstraction has a cost. The trick is finding the ones where the benefit outweighs it.',
  'Three months with Bun in production. One crash, which turned out to be my code. Solid so far.',
  '`rg --type ts "TODO"` and suddenly the backlog is visible.',
  'The worst kind of technical debt is the kind you don\'t know about.',
  'Found a 5-year-old comment in the codebase: "// This is temporary." Reader, it was not temporary.',
  'Documentation is a first-class feature. Undocumented behavior is undefined behavior.',
  'You don\'t understand something until you can explain it simply. Writing is thinking.',
  'The correct number of tabs open during debugging is always n+1.',
  'Typed SQL > string interpolation. Always.',
  '`curl -I` will tell you more about a server than most dashboards.',
  'Complexity is additive going in and multiplicative coming out.',
  'The real 10x developer is the one who asks "do we need this at all?"',
  'Just read the SQLite source code for the WAL implementation. Whoever wrote this is operating at a different level.',
  'Code that is never wrong because it never does anything: not a virtue.',
  'TIL: `ssh -L 5432:localhost:5432 user@server` proxies the remote Postgres to your local port. Works for any service.',
  'The most important thing in a code review is to understand the intent before evaluating the implementation.',
  'Four hours debugging, one-line fix. The ratio is always embarrassing in retrospect.',
  'Running a personal blog on a single SQLite file and a Bun process. 0 ops overhead, all the data in one place.',
  '"Simple" is not the same as "easy." Simple things are hard to build.',
  'Regex tip: when you find yourself writing a complex regex, write a function instead. Future you will be grateful.',
  'Every team should do a blameless postmortem on their own assumptions, not just their incidents.',
  'The correct response to "this is how we\'ve always done it" is curiosity, not acceptance.',
  'Watching a junior dev discover `jq` for the first time is genuinely joyful.',
  'Feature flag systems are the best and worst part of working on large codebases.',
  '`man` pages are underrated. `man bash` is a whole book.',
  'The thing that will bite you in production is the case you didn\'t handle in the test.',
  'Type inference in TypeScript is magic right up until it isn\'t.',
  'Local-first is not a niche. It\'s a return to something we should never have abandoned.',
  'You ship your org chart. If the architecture looks like your team, check whether that\'s on purpose.',
  'Naming things is hard because naming requires understanding. If you can\'t name it, you don\'t understand it yet.',
];

// ── Seed ──────────────────────────────────────────────────────────────────────

console.log('Seeding articles…');
for (const a of articles) {
  const id = ulid();
  const ts = daysAgo(a.daysAgo);

  const created = { type: 'ArticleCreated' as const, id, title: a.title, slug: slugify(a.title), body: a.body, tags: a.tags };
  create(created, ts);

  const published = { type: 'ArticlePublished' as const, id };
  create(published, ts + 3_600_000); // published 1h after creation
  console.log(`  ✓ ${a.title}`);
}

console.log('\nSeeding micro-posts…');
for (let i = 0; i < microBodies.length; i++) {
  const id = ulid();
  // Spread over the past ~170 days
  const ts = daysAgo(Math.round((170 / microBodies.length) * (microBodies.length - i)));
  const event = { type: 'MicroPostCreated' as const, id, body: microBodies[i] };
  create(event, ts);
  console.log(`  ✓ micro ${i + 1}/${microBodies.length}`);
}

console.log('\nDone. Restart the server to reflect the new data.');
