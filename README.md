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

## Configuring analytics on `<Studio>`

`<Studio>` accepts an optional `analytics?: AnalyticsAdapter`. When set, the shell
emits the system events itself — you never call `track` for them:

```tsx
import { createHttpAdapter } from "@anvilkit/analytics-core";
import { Studio } from "@anvilkit/core/react";

const analytics = createHttpAdapter({
  endpoint: "/api/analytics/events",
  source: "studio",
  privacy: { consentGranted: true, truncateIpAddress: true, retentionDays: 90 },
});

<Studio puckConfig={config} plugins={plugins} analytics={analytics} />;
```

System events owned by `<Studio>`:

- `page_published` — emitted on a successful publish via the unified publish
  pipeline. It fires for **both** Puck's native publish **and** the AnvilKit
  chrome's "Publish to live" (`onPublishClick`), exactly once per publish, and
  **only** after the host publish resolves. A plugin `onBeforePublish` veto, a
  thrown/rejected host handler, or any abort skips it.
- `draft_saved`, `component_dropped`, `seo_updated` — emitted from the matching
  editor seams.

Omitting `analytics` is a complete no-op. Need per-event context the adapter
config has no slot for (`page_id`, `workspace_id`, `user_id`)? Add an
`AnalyticsProcessor` to `processors` that enriches each envelope with **primitive**
fields read from a ref at emit time — never the page document. The published site
emits `page_view` via `@anvilkit/analytics-react`'s `AnalyticsProvider`.

## Event property restrictions & privacy

- **Primitive-only properties.** Every property value must be
  `string | number | boolean`. `sanitizeProperties` drops anything else before a
  payload is built, so nested objects, arrays, DOM nodes, and full JSON trees can
  never reach the wire.
- **Never sent.** Full Puck `Data`, serialized HTML, DOM nodes, `root` /
  `root.props`. A server ingestion endpoint should independently reject the
  forbidden-field deny-list (`data`, `html`, `dom`, `root`, `rootProps`,
  `puckData`, `serializedHtml`) — the demo's `/api/analytics/events` does.
- **Consent controls.** `privacy.consentGranted` gates `track`/`identify`;
  revoking via `updatePrivacyStatus(false)` purges the queue.
  `truncateIpAddress` / `retentionDays` ride along as batch `meta` so the backend
  can honor them.
