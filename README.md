# @anvilkit/analytics-core

Framework-agnostic, **React-free** analytics primitives for AnvilKit Studio: the
adapter interface set, a fixed system-event catalog, and built-in transport
adapters. Runs isomorphically in Node, Edge, and the browser.

## Exports

- **Interfaces** — `PrivacyConfig`, `BaseEventData`, `TrackEvent`,
  `AnalyticsProcessor`, `AnalyticsAdapter`, `HttpAdapterConfig`.
- **Event catalog** — the six canonical system events (`page_view`,
  `draft_saved`, `page_published`, `component_dropped`, `seo_updated`,
  `plugin_toggled`) + the event-version constant.
- **Adapters** — `createNoopAdapter` (CI/test suppression),
  `createConsoleAdapter` (dev inspection), `createLocalStorageAdapter` (offline
  MVP queue), `createHttpAdapter` (batched, beacon-delivered production
  transport).

### Opt-in third-party adapters (subpaths)

- `@anvilkit/analytics-core/ga4` — `createGa4Adapter` (wraps `window.gtag`).
- `@anvilkit/analytics-core/posthog` — `createPostHogAdapter` (wraps the
  optional `posthog-js` peer).

These live behind subpaths so their footprint never lands in the base bundle.

## Contract

- **No React.** Enforced by the `check:react-free-runtime` gate.
- **Privacy-first.** `track`/`identify` are no-ops until consent is granted; the
  queue is purged on consent revoke.
- **bfcache-safe delivery.** The Http adapter flushes on `visibilitychange →
  hidden` via `navigator.sendBeacon`, never `unload`/`beforeunload`.

The React consumer API (`AnalyticsProvider` / `useTrack`) lives in the separate
`@anvilkit/analytics-react` package so this package stays React-free.
