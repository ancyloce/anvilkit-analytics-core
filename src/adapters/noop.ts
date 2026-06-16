import type { AnalyticsAdapter } from "../types.js";

/**
 * An adapter that discards everything. Use in CI/tests (or as the safe
 * no-provider fallback in `@anvilkit/analytics-react`) so instrumented code
 * runs without emitting anything.
 */
export function createNoopAdapter(): AnalyticsAdapter {
	return {
		track() {
			// intentional no-op
		},
		identify() {
			// intentional no-op
		},
		flush() {
			return Promise.resolve();
		},
		updatePrivacyStatus() {
			// intentional no-op
		},
	};
}
