import {
	buildTrackEvent,
	createSessionId,
	type EventContext,
} from "../internal/event.js";
import type { AnalyticsAdapter, BaseEventData, TrackEvent } from "../types.js";

/** The localStorage key the offline queue is persisted under. */
export const ANALYTICS_QUEUE_KEY = "anvilkit_analytics_queue";

/** Configuration for {@link createLocalStorageAdapter}. */
export interface LocalStorageAdapterConfig {
	source: BaseEventData["source"];
	/** Gate emission on consent. @default false (privacy-first). */
	consentGranted?: boolean;
	/** @default {@link ANALYTICS_QUEUE_KEY} */
	storageKey?: string;
	/** Drop the oldest events past this many. @default 500 */
	maxQueueSize?: number;
	/** Inject a `Storage` (tests / SSR). Defaults to `globalThis.localStorage`. */
	storage?: Storage;
	userId?: string;
	workspaceId?: string;
	pageId?: string;
}

/**
 * Offline MVP queue: appends built events to `localStorage` (key
 * {@link ANALYTICS_QUEUE_KEY}). `track`/`identify` are consent-gated; the
 * queue is purged on consent revoke. `flush` is a no-op — a real transport
 * (the Http adapter) drains the queue separately.
 */
export function createLocalStorageAdapter(
	config: LocalStorageAdapterConfig,
): AnalyticsAdapter {
	let consentGranted = config.consentGranted ?? false;
	const storageKey = config.storageKey ?? ANALYTICS_QUEUE_KEY;
	const maxQueueSize = config.maxQueueSize ?? 500;
	const storage: Storage | undefined =
		config.storage ??
		(typeof localStorage !== "undefined" ? localStorage : undefined);
	const sessionId = createSessionId();
	const context = (): EventContext => ({
		source: config.source,
		sessionId,
		userId: config.userId,
		workspaceId: config.workspaceId,
		pageId: config.pageId,
	});

	function readQueue(): TrackEvent[] {
		if (storage === undefined) return [];
		try {
			const raw = storage.getItem(storageKey);
			if (raw === null) return [];
			const parsed: unknown = JSON.parse(raw);
			return Array.isArray(parsed) ? (parsed as TrackEvent[]) : [];
		} catch {
			return [];
		}
	}

	function enqueue(event: TrackEvent): void {
		if (storage === undefined) return;
		const queue = readQueue();
		queue.push(event);
		while (queue.length > maxQueueSize) queue.shift();
		try {
			storage.setItem(storageKey, JSON.stringify(queue));
		} catch {
			// storage full / unavailable — drop silently (MVP)
		}
	}

	return {
		track(eventName, properties) {
			if (!consentGranted) return;
			enqueue(buildTrackEvent(eventName, properties, context()));
		},
		identify(userId, traits) {
			if (!consentGranted) return;
			enqueue(
				buildTrackEvent("$identify", { ...traits, user_id: userId }, context()),
			);
		},
		flush() {
			return Promise.resolve();
		},
		updatePrivacyStatus(consent) {
			consentGranted = consent;
			if (!consent && storage !== undefined) {
				try {
					storage.removeItem(storageKey);
				} catch {
					// ignore
				}
			}
		},
	};
}
