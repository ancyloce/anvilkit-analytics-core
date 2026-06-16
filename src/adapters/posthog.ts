import posthog from "posthog-js";
import { sanitizeProperties } from "../internal/event.js";
import type {
	AnalyticsAdapter,
	BaseEventData,
	PrivacyConfig,
} from "../types.js";

/** Configuration for {@link createPostHogAdapter}. */
export interface PostHogAdapterConfig {
	apiKey: string;
	host?: string;
	source: BaseEventData["source"];
	privacy: PrivacyConfig;
}

/**
 * Adapter that forwards events to PostHog via the optional `posthog-js` peer.
 * Initializes the SDK opted-out unless consent is already granted, and toggles
 * capture on `updatePrivacyStatus`. Reachable only via
 * `@anvilkit/analytics-core/posthog`; the SDK never lands in the base bundle.
 */
export function createPostHogAdapter(
	config: PostHogAdapterConfig,
): AnalyticsAdapter {
	let consentGranted = config.privacy.consentGranted;
	posthog.init(config.apiKey, {
		...(config.host !== undefined ? { api_host: config.host } : {}),
		opt_out_capturing_by_default: !consentGranted,
	});

	return {
		track(eventName, properties) {
			if (!consentGranted) return;
			posthog.capture(eventName, sanitizeProperties(properties));
		},
		identify(userId, traits) {
			if (!consentGranted) return;
			posthog.identify(
				userId,
				traits === undefined ? undefined : sanitizeProperties(traits),
			);
		},
		flush() {
			return Promise.resolve();
		},
		updatePrivacyStatus(consent) {
			consentGranted = consent;
			if (consent) {
				posthog.opt_in_capturing();
			} else {
				posthog.opt_out_capturing();
			}
		},
	};
}
