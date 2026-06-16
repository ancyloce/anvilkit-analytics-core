import {
	buildTrackEvent,
	createSessionId,
	type EventContext,
} from "../internal/event.js";
import type { AnalyticsAdapter, BaseEventData } from "../types.js";

/** Configuration for {@link createConsoleAdapter}. */
export interface ConsoleAdapterConfig {
	source: BaseEventData["source"];
	/** Gate emission on consent. @default true (dev convenience). */
	consentGranted?: boolean;
	/** Override the sink (defaults to `console`). Useful for tests. */
	logger?: Pick<Console, "log">;
	/** Optional base context merged into every event. */
	userId?: string;
	workspaceId?: string;
	pageId?: string;
}

/**
 * Formatted, consent-aware adapter for local development — logs the built
 * {@link TrackEvent} envelope (sanitized properties included) to the console.
 */
export function createConsoleAdapter(
	config: ConsoleAdapterConfig,
): AnalyticsAdapter {
	let consentGranted = config.consentGranted ?? true;
	const sessionId = createSessionId();
	const sink = config.logger ?? console;
	const context = (): EventContext => ({
		source: config.source,
		sessionId,
		userId: config.userId,
		workspaceId: config.workspaceId,
		pageId: config.pageId,
	});

	return {
		track(eventName, properties) {
			if (!consentGranted) return;
			const event = buildTrackEvent(eventName, properties, context());
			sink.log(`[analytics] ${eventName}`, event);
		},
		identify(userId, traits) {
			if (!consentGranted) return;
			sink.log(`[analytics] identify ${userId}`, traits ?? {});
		},
		flush() {
			return Promise.resolve();
		},
		updatePrivacyStatus(consent) {
			consentGranted = consent;
		},
	};
}
