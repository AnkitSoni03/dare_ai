# Ticket Explorer

My solution to **Problem Statement 1** of the DareAISearch Front-End Developer assignment: a data explorer over 10,000 support tickets. It stays fast and never shows the wrong results, even when the API is slow and flaky.

- **Live demo:** https://dare-ai-task.vercel.app/ (try a shared view: [open urgent refunds](https://dare-ai-task.vercel.app/?q=refund&status=open&sort=priority&order=desc))
- **Demo video:** _add link here_

## What it does

| Requirement | How it is met |
| --- | --- |
| 10k+ records, server-side search / filter / sort / pagination | A deterministic dataset of 10,000 tickets served from `/api/*` (Vercel functions). Search covers ID, subject, customer and email. Filters: status, priority, category. Sortable columns. |
| Random latency 200 ms–3 s, ~1 in 10 requests fail | `mock/handler.ts` sleeps a random 200–3000 ms and returns a 500 on ~10% of requests. Every endpoint does this, including list, counts and detail. |
| Never show stale results | Search is debounced (300 ms). Each query has its own TanStack Query cache entry, so a late response can only write to its own (old) key. Superseded requests are also aborted through `AbortSignal`. Old rows are never kept on screen while a new query loads. |
| State in the URL | Search, filters, sort, order, page and page size live in the query string. The URL is the only source of truth, so refresh, back/forward and shared links restore the same view. Malformed params fall back to defaults instead of crashing. |
| Fast with large lists | Rows are virtualized with TanStack Virtual, so only the visible rows plus a small overscan are in the DOM. Page size goes up to 1,000 rows. Rows are memoised. |
| Honest states | Distinct loading (skeleton), empty (with "clear filters"), error (with Retry), page-out-of-range and **partial failure** states. Partial failure: the status counts request fails but the list still loads, and an inline warning offers a separate retry. |
| Accessible | Every control works by keyboard and focus is always visible. The table uses ARIA table roles with `aria-sort`, `aria-rowcount` and `aria-rowindex`, plus a roving tabindex: ↑/↓/Home/End/PgUp/PgDn move between rows and Enter opens one. Result counts are announced through a polite live region, and errors use `role="alert"`. |
| Detail view | `/tickets/:id` is a child route shown in a native modal `<dialog>` drawer (focus trap, Esc to close, page behind is inert). It can be deep-linked. The list stays mounted underneath, so closing keeps scroll position and filters, and focus returns to the row that opened it. |

## Run locally

Requires Node 20.19+ or 22.12+ (Vite 8).

```bash
npm install
npm run dev        # http://localhost:5173 — the mock API runs inside the Vite dev server
npm test           # Vitest + Testing Library
npm run build      # type-check + production build
```

To debug without the chaos, start with `MOCK_CHAOS=off npm run dev` (PowerShell: `$env:MOCK_CHAOS='off'; npm run dev`).

**Deploying:** import the repo in Vercel; the framework preset should be detected as Vite. Files in `/api` become serverless functions, and `vercel.json` rewrites all other paths to `index.html` so deep links work.

### Keyboard

| Key | Action |
| --- | --- |
| `/` | Focus the search box from anywhere |
| `Enter` in search | Search now, skipping the debounce |
| `Tab` | Move through status cards, filter chips, sortable column headers, the table and pagination |
| `↑` `↓` `Home` `End` `PgUp` `PgDn` | Move between rows (one row is in the tab order) |
| `Enter` / `Space` on a row | Open the detail drawer |
| `Esc` | Close the drawer; focus goes back to the row |

### Mobile

The layout is responsive. On narrow screens the table keeps all eight columns and scrolls sideways, with header and rows moving together, instead of hiding data. The page itself never scrolls horizontally.

## Architecture

```
shared/tickets.ts     Types, constants, URL <-> query parse/serialize (used by client AND mock API)
mock/                 Dataset (seeded PRNG), query engine, chaos handler (Web Request -> Response)
api/                  Thin Vercel function wrappers around mock/handler.ts
vite.config.ts        Dev/preview middleware that serves the same handler at /api
src/hooks/useTicketQuery.ts   Reads/writes the view state from/to the URL
src/lib/queries.ts    TanStack Query definitions (keys, fetchers, retry policy)
src/pages/ExplorerPage.tsx    Chooses which state to render
src/components/       SearchBox, FilterBar, TicketTable (virtualized), Pagination, TicketDrawer
```

### State management decisions

- **The URL is the single source of truth for view state.** I did not keep a copy in React state or a store, so there is no syncing to get wrong. `useTicketQuery` parses `useSearchParams()` into a typed query (memoised on the string) and writes patches back. Any change other than paging resets to page 1.
- **Server state lives in TanStack Query.** The query object is the cache key. That fixes the "slow old response overwrites new one" race by design: responses are stored per key and the UI only reads the current key. Unobserved in-flight requests are cancelled via the `signal` passed to `fetch`.
- **Only the search box has local state.** Typing updates local state, and the value is committed to the URL after a 300 ms pause (or immediately on Enter). The first commit of a typing session pushes a history entry and the rest replace it, so Back undoes a whole search instead of one letter at a time. External URL changes (Back, "Clear filters") flow back into the input.
- **Same parser on both sides.** `parseTicketQuery` and `serializeTicketQuery` are shared by the client and the mock API, so a URL means the same thing everywhere. Filter values are normalised, so `status=closed,open` and `status=open,closed` hit the same cache entry.
- **The detail view is a nested route, not component state.** That is what makes it deep-linkable and lets the browser's Back button close it. If the drawer was opened from the list, Close does `navigate(-1)`; on a deep link it `replace`s with the list URL, so Close never leaves the app.

## Tradeoffs

- **Loading state instead of `keepPreviousData`.** Keeping old rows on screen (dimmed) while a new query loads avoids a flash, but those rows don't match the current filters, and the brief says old data must never look current. I chose a skeleton. Pages you have already visited come back instantly from cache (60 s `staleTime`).
- **No automatic retries.** With a ~10% failure rate, silent retries would hide most failures and add hidden waiting. Failures show immediately with a Retry button. In production I would retry idempotent GETs once with backoff.
- **Pagination + virtualization rather than infinite scroll.** Page numbers are easy to restore from the URL and to share ("page 4"), whereas restoring the scroll offset of an infinite list after a refresh is fragile. Virtualization keeps 1,000-row pages smooth.
- **Mock API as Vercel functions instead of MSW.** A real network request shows up in DevTools and reacts to throttling and offline mode, which makes the failure demo honest. The same handler runs inside Vite locally, so no second server is needed.
- **Div-based ARIA table instead of `<table>`.** Absolutely positioned virtual rows don't work with native table layout, so I used `role="table"/"row"/"cell"` and explicit `aria-rowindex` so screen readers still get the real position in the full result set.
- **Vite + React over Next.js.** This is a client-heavy app with no SEO or SSR needs. Next's App Router would add Suspense requirements around `useSearchParams` and server/client boundaries without benefiting these requirements.
- **In-memory dataset.** It is regenerated from a fixed seed on each cold start, which is fine for read-only data and keeps IDs stable for deep links. A real backend would use a database with indexes for search.

## Known limitations

- The URL stores the page, not the scroll offset inside a page. After a refresh you land at the top of the right page. Closing the drawer does keep the scroll offset, because the list never unmounts.
- Rows are focusable inside an ARIA `table` rather than a full `grid`. Cells have no individual focus, which keeps navigation simple (one tab stop, arrow keys between rows).
- Search is a linear scan over 10,000 records in memory. That is fast enough here, but a real backend would use a database index or full-text search.
- The mock API has no auth or rate limiting. It is a demo fixture, not a backend.

## Tests

`npm test` runs targeted tests for the behaviour that is easiest to break:

- **Race condition:** two searches in flight; the newer response lands first and the older one lands after it. The stale result never appears, and the old request's `AbortSignal` is aborted.
- **Debounce:** typing a word sends one request, not one per key.
- **Honest failure:** after a filter change fails, the previous rows are gone, an alert with Retry is shown, and retrying recovers.
- **Partial failure:** status counts fail while the list still renders.
- **URL restore:** a full URL restores the search box, filter chips, sort direction and page size, and requests the same params.
- **Detail view:** opening a row keeps the query string, and closing returns to the same filters without refetching the list.
- Mock API: 10k records, stable pagination with no gaps or overlaps, search combined with filters, facet counts.
- URL parsing: round trip, defaults omitted, malformed input falls back safely.

The tests mock `fetch` with promises the test resolves by hand, so they can control the order in which responses arrive.

## Sources & references

- TanStack Query: [Query cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation), [Query keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys), [Paginated queries](https://tanstack.com/query/latest/docs/framework/react/guides/paginated-queries)
- [TanStack Virtual docs](https://tanstack.com/virtual/latest)
- React Router: [`useSearchParams`](https://reactrouter.com/api/hooks/useSearchParams), nested routes
- WAI-ARIA APG: [Table pattern](https://www.w3.org/WAI/ARIA/apg/patterns/table/), [Dialog (modal) pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/), [Keyboard navigation inside components (roving tabindex)](https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/)
- MDN: [`<dialog>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/dialog), [ARIA live regions](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/ARIA_Live_Regions), [`AbortController`](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
- [Vercel Functions (Node.js runtime)](https://vercel.com/docs/functions/runtimes/node-js)
- Mulberry32 PRNG for the deterministic dataset
- Testing Library: [user-event](https://testing-library.com/docs/user-event/intro)

## AI usage

I used **Claude Code** (Claude Opus) while building this. Claude wrote most of the code, tests and this README. My role was directing and reviewing:

- **Problem and stack.** I picked Problem Statement 1 and Vite + React + TypeScript over Next.js, because the app is client-heavy with no SSR or SEO needs.
- **Review in the browser.** I checked the running app myself rather than trusting the summary. On mobile I found that ticket details were missing: columns were being hidden on small screens and the table didn't scroll. I had it changed to a horizontally scrollable table that keeps every column.
- **UI polish.** I asked for a more professional look (status summary cards, avatars, priority icons, dark mode) on top of the working behaviour.
- **Cross-check against the brief.** I had it go through the assignment and the JD line by line, then fix the gaps it found.
- **Verification.** Before submitting I ran the tests and build, deployed, and tried slow, failing and offline requests myself.

Chat history: [claude-code-chat.md](./claude-code-chat.md), the full Claude Code session from start to finish, with a summary of the key decisions at the top. Personal details are redacted.
