/**
 * @file Public barrel for `@anvilkit/analytics-core`. The GA4/PostHog adapters
 * are intentionally absent here — they are reachable only via the
 * `@anvilkit/analytics-core/ga4` and `/posthog` subpaths so their SDKs never
 * land in the base bundle.
 */

// Built-in adapters
export {
	type ConsoleAdapterConfig,
	createConsoleAdapter,
} from "./adapters/console.js";
export { createHttpAdapter } from "./adapters/http.js";
export {
	ANALYTICS_QUEUE_KEY,
	createLocalStorageAdapter,
	type LocalStorageAdapterConfig,
} from "./adapters/local-storage.js";
export { createNoopAdapter } from "./adapters/noop.js";
// Event catalog (§1.3 / F9)
export {
	ANALYTICS_EVENTS,
	type AnalyticsEventName,
	EVENT_VERSION,
} from "./event-catalog.js";
// Interfaces (§5.3)
export type * from "./types.js";
