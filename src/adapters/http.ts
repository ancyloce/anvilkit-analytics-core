import {
	buildTrackEvent,
	createSessionId,
	type EventContext,
} from "../internal/event.js";
import type {
	AnalyticsAdapter,
	HttpAdapterConfig,
	TrackEvent,
} from "../types.js";

/** Base of the exponential backoff schedule (1s → 2s → 4s …). */
const RETRY_BASE_MS = 1000;

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

/**
 * Production transport: debounced batching, exponential-backoff retries, and
 * bfcache-safe delivery.
 *
 * - Buffers events and POSTs a batch once `batchSize` is reached or
 *   `flushIntervalMs` elapses.
 * - On failure retries with `1s · 2s · 4s …` backoff up to `maxRetries`; a
 *   batch that never lands is re-queued.
 * - On `visibilitychange → hidden` flushes synchronously via
 *   `navigator.sendBeacon`, falling back to `fetch(keepalive:true)` — never
 *   `unload`/`beforeunload`, so bfcache is preserved.
 * - `track`/`identify` are no-ops without consent; the buffer is purged on
 *   consent revoke. `truncateIpAddress`/`retentionDays` ride along as payload
 *   metadata.
 */
export function createHttpAdapter(config: HttpAdapterConfig): AnalyticsAdapter {
	const batchSize = config.batchSize ?? 10;
	const flushIntervalMs = config.flushIntervalMs ?? 5000;
	const maxRetries = config.maxRetries ?? 3;
	const processors = config.processors ?? [];
	let consentGranted = config.privacy.consentGranted;
	let buffer: TrackEvent[] = [];
	let timer: ReturnType<typeof setTimeout> | undefined;
	const sessionId = createSessionId();

	const context = (): EventContext => ({
		source: config.source,
		sessionId,
	});

	function clearTimer(): void {
		if (timer !== undefined) {
			clearTimeout(timer);
			timer = undefined;
		}
	}

	function scheduleFlush(): void {
		if (timer !== undefined) return;
		timer = setTimeout(() => {
			timer = undefined;
			void flush();
		}, flushIntervalMs);
	}

	function buildPayload(events: readonly TrackEvent[]): string {
		return JSON.stringify({
			events,
			meta: {
				source: config.source,
				truncate_ip: config.privacy.truncateIpAddress,
				retention_days: config.privacy.retentionDays,
			},
		});
	}

	async function postBatch(events: readonly TrackEvent[]): Promise<boolean> {
		const body = buildPayload(events);
		for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
			try {
				const response = await fetch(config.endpoint, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body,
					keepalive: true,
				});
				if (response.ok) return true;
			} catch {
				// network error — fall through to backoff
			}
			if (attempt < maxRetries) {
				await delay(RETRY_BASE_MS * 2 ** attempt); // 1s, 2s, 4s, …
			}
		}
		return false;
	}

	async function flush(): Promise<void> {
		clearTimer();
		if (buffer.length === 0) return;
		const batch = buffer;
		buffer = [];
		const delivered = await postBatch(batch);
		if (!delivered) {
			// Re-queue the failed batch ahead of anything buffered while in flight.
			buffer = [...batch, ...buffer];
		}
	}

	function flushViaBeacon(): void {
		if (buffer.length === 0) return;
		const batch = buffer;
		buffer = [];
		clearTimer();
		const body = buildPayload(batch);
		if (
			typeof navigator !== "undefined" &&
			typeof navigator.sendBeacon === "function"
		) {
			const blob = new Blob([body], { type: "application/json" });
			if (navigator.sendBeacon(config.endpoint, blob)) return;
		}
		if (typeof fetch === "function") {
			void fetch(config.endpoint, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body,
				keepalive: true,
			}).catch(() => {
				// best-effort on the unload path
			});
		}
	}

	function handleVisibilityChange(): void {
		if (
			typeof document !== "undefined" &&
			document.visibilityState === "hidden"
		) {
			flushViaBeacon();
		}
	}

	// bfcache-safe: flush on visibilitychange→hidden, never unload/beforeunload.
	if (
		typeof document !== "undefined" &&
		typeof document.addEventListener === "function"
	) {
		document.addEventListener("visibilitychange", handleVisibilityChange);
	}

	function enqueue(
		eventName: string,
		properties: Record<string, unknown>,
	): void {
		if (!consentGranted) return;
		let event = buildTrackEvent(eventName, properties, context());
		for (const processor of processors) {
			const next = processor.process(event);
			if (next === null) return;
			event = next;
		}
		buffer.push(event);
		if (buffer.length >= batchSize) {
			void flush();
		} else {
			scheduleFlush();
		}
	}

	return {
		track(eventName, properties) {
			enqueue(eventName, properties);
		},
		identify(userId, traits) {
			enqueue("$identify", { ...traits, user_id: userId });
		},
		flush,
		updatePrivacyStatus(consent) {
			consentGranted = consent;
			if (!consent) {
				buffer = [];
				clearTimer();
			}
		},
	};
}
