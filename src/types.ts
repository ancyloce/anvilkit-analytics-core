/**
 * @file The analytics adapter interface set (PRD 0004 §5.3). React-free and
 * isomorphic — no DOM/Node-only types leak into the public contract.
 */

/** Consent + retention controls honored by every transport adapter. */
export interface PrivacyConfig {
	/** When `false`, `track`/`identify` are no-ops and the queue is purged. */
	consentGranted: boolean;
	/** Forwarded as payload metadata so the backend can truncate the client IP. */
	truncateIpAddress: boolean;
	/** Forwarded as payload metadata; data retention window in days. */
	retentionDays: number;
}

/** The envelope fields stamped onto every emitted event. */
export interface BaseEventData {
	event_name: string;
	version: string;
	timestamp: number;
	session_id: string;
	user_id?: string;
	workspace_id?: string;
	page_id?: string;
	source: "studio" | "published_site";
	/** Reserved A/B-testing extension hook. */
	experiment_id?: string;
}

/** A fully-formed event ready for transport. Properties are primitives only. */
export interface TrackEvent extends BaseEventData {
	properties: Record<string, string | number | boolean>;
}

/** A pluggable transform run before delivery; returning `null` drops the event. */
export interface AnalyticsProcessor {
	process(event: TrackEvent): TrackEvent | null;
}

/** The uniform surface every adapter (Noop/Console/LocalStorage/Http/GA4/PostHog) implements. */
export interface AnalyticsAdapter {
	track(eventName: string, properties: Record<string, unknown>): void;
	identify(userId: string, traits?: Record<string, unknown>): void;
	flush(): Promise<void>;
	updatePrivacyStatus(consent: boolean): void;
}

/** Configuration for the batched, beacon-delivered production transport. */
export interface HttpAdapterConfig {
	endpoint: string;
	/** @default 10 */
	batchSize?: number;
	/** @default 5000 */
	flushIntervalMs?: number;
	/** @default 3 */
	maxRetries?: number;
	source: "studio" | "published_site";
	privacy: PrivacyConfig;
	processors?: AnalyticsProcessor[];
}
