import { sanitizeProperties } from "../internal/event.js";
import type {
	AnalyticsAdapter,
	BaseEventData,
	PrivacyConfig,
} from "../types.js";

/** The `window.gtag` global the host injects via the GA4 script tag. */
type GtagFn = (...args: unknown[]) => void;

/** Configuration for {@link createGa4Adapter}. */
export interface Ga4AdapterConfig {
	measurementId: string;
	source: BaseEventData["source"];
	privacy: PrivacyConfig;
}

function getGtag(): GtagFn | undefined {
	const candidate = (globalThis as { gtag?: unknown }).gtag;
	return typeof candidate === "function" ? (candidate as GtagFn) : undefined;
}

/**
 * Adapter that forwards events to Google Analytics 4 via the script-injected
 * `window.gtag` global — no SDK dependency. Consent is mirrored into GA's
 * Consent Mode (`analytics_storage`); `track`/`identify` are no-ops until
 * consent is granted. Reachable only via `@anvilkit/analytics-core/ga4`.
 */
export function createGa4Adapter(config: Ga4AdapterConfig): AnalyticsAdapter {
	let consentGranted = config.privacy.consentGranted;
	getGtag()?.("consent", "update", {
		analytics_storage: consentGranted ? "granted" : "denied",
	});

	return {
		track(eventName, properties) {
			if (!consentGranted) return;
			getGtag()?.("event", eventName, {
				...sanitizeProperties(properties),
				send_to: config.measurementId,
			});
		},
		identify(userId, traits) {
			if (!consentGranted) return;
			getGtag()?.("set", {
				user_id: userId,
				...sanitizeProperties(traits ?? {}),
			});
		},
		flush() {
			return Promise.resolve();
		},
		updatePrivacyStatus(consent) {
			consentGranted = consent;
			getGtag()?.("consent", "update", {
				analytics_storage: consent ? "granted" : "denied",
			});
		},
	};
}
