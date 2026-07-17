import { afterEach, describe, expect, it, vi } from "vitest";
import { createHttpAdapter } from "../adapters/http.js";
import type { PrivacyConfig } from "../types.js";

const privacy: PrivacyConfig = {
	consentGranted: true,
	truncateIpAddress: true,
	retentionDays: 30,
};

interface MockDoc {
	visibilityState: string;
	addEventListener: (type: string, handler: () => void) => void;
	removeEventListener: () => void;
	fire: (type: string) => void;
}

function makeMockDocument(initial = "visible"): MockDoc {
	const handlers = new Map<string, Array<() => void>>();
	return {
		visibilityState: initial,
		addEventListener: (type, handler) => {
			const list = handlers.get(type) ?? [];
			list.push(handler);
			handlers.set(type, list);
		},
		removeEventListener: () => {
			// no-op for the mock
		},
		fire: (type) => {
			for (const handler of handlers.get(type) ?? []) handler();
		},
	};
}

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe("createHttpAdapter — batching", () => {
	it("POSTs one batch once batchSize is reached, with privacy metadata", () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: true });
		vi.stubGlobal("fetch", fetchMock);
		const a = createHttpAdapter({
			endpoint: "/collect",
			source: "studio",
			privacy,
			batchSize: 3,
		});
		a.track("page_view", { url: "/" });
		a.track("page_view", { url: "/a" });
		expect(fetchMock).not.toHaveBeenCalled(); // below batchSize
		a.track("page_view", { url: "/b" }); // hits batchSize → flush (fetch called sync)
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe("/collect");
		expect(init.keepalive).toBe(true);
		const body = JSON.parse(init.body as string);
		expect(body.events).toHaveLength(3);
		expect(body.meta).toMatchObject({
			source: "studio",
			truncate_ip: true,
			retention_days: 30,
		});
	});

	it("drops non-primitive properties before transport (forbidden fields)", () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: true });
		vi.stubGlobal("fetch", fetchMock);
		const a = createHttpAdapter({
			endpoint: "/c",
			source: "studio",
			privacy,
			batchSize: 1,
		});
		a.track("component_dropped", { component_type: "Hero", tree: { a: 1 } });
		const request = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
		if (!request) throw new Error("Expected analytics request");
		const body = JSON.parse(request.body as string);
		expect(body.events[0].properties).toEqual({ component_type: "Hero" });
	});
});

describe("createHttpAdapter — consent", () => {
	it("is a no-op without consent", async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: true });
		vi.stubGlobal("fetch", fetchMock);
		const a = createHttpAdapter({
			endpoint: "/c",
			source: "studio",
			privacy: { ...privacy, consentGranted: false },
			batchSize: 1,
		});
		a.track("page_view", { url: "/" });
		a.identify("u1");
		await a.flush();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("purges the buffer on consent revoke", async () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: true });
		vi.stubGlobal("fetch", fetchMock);
		const a = createHttpAdapter({
			endpoint: "/c",
			source: "studio",
			privacy,
			batchSize: 10,
		});
		a.track("page_view", { url: "/" });
		a.track("page_view", { url: "/a" }); // buffered (< 10)
		a.updatePrivacyStatus(false); // revoke → purge
		await a.flush();
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe("createHttpAdapter — retries", () => {
	it("retries with exponential backoff up to maxRetries", async () => {
		vi.useFakeTimers();
		const fetchMock = vi.fn().mockResolvedValue({ ok: false });
		vi.stubGlobal("fetch", fetchMock);
		const a = createHttpAdapter({
			endpoint: "/c",
			source: "studio",
			privacy,
			batchSize: 1,
			maxRetries: 3,
		});
		a.track("page_view", { url: "/" }); // batchSize 1 → flush; attempt 0 fires sync
		// Advance through the 1s + 2s + 4s backoff schedule.
		await vi.advanceTimersByTimeAsync(1000 + 2000 + 4000 + 10);
		expect(fetchMock).toHaveBeenCalledTimes(4); // attempts 0..3
	});
});

describe("createHttpAdapter — visibilitychange (bfcache-safe)", () => {
	it("flushes via sendBeacon on visibilitychange→hidden", () => {
		const doc = makeMockDocument("visible");
		const sendBeacon = vi.fn(() => true);
		const fetchMock = vi.fn().mockResolvedValue({ ok: true });
		vi.stubGlobal("document", doc);
		vi.stubGlobal("navigator", { sendBeacon });
		vi.stubGlobal("fetch", fetchMock);
		const a = createHttpAdapter({
			endpoint: "/c",
			source: "published_site",
			privacy,
			batchSize: 100,
		});
		a.track("page_view", { url: "/" }); // buffered
		doc.visibilityState = "hidden";
		doc.fire("visibilitychange");
		expect(sendBeacon).toHaveBeenCalledTimes(1);
		expect(fetchMock).not.toHaveBeenCalled(); // beacon succeeded → no fallback
	});

	it("falls back to fetch(keepalive) when sendBeacon refuses", () => {
		const doc = makeMockDocument("visible");
		const sendBeacon = vi.fn(() => false); // beacon refuses
		const fetchMock = vi.fn().mockResolvedValue({ ok: true });
		vi.stubGlobal("document", doc);
		vi.stubGlobal("navigator", { sendBeacon });
		vi.stubGlobal("fetch", fetchMock);
		const a = createHttpAdapter({
			endpoint: "/c",
			source: "published_site",
			privacy,
			batchSize: 100,
		});
		a.track("page_view", { url: "/" });
		doc.visibilityState = "hidden";
		doc.fire("visibilitychange");
		expect(sendBeacon).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		const request = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
		if (!request) throw new Error("Expected analytics request");
		expect(request.keepalive).toBe(true);
	});
});

describe("createHttpAdapter — processors", () => {
	it("drops an event when a processor returns null", () => {
		const fetchMock = vi.fn().mockResolvedValue({ ok: true });
		vi.stubGlobal("fetch", fetchMock);
		const a = createHttpAdapter({
			endpoint: "/c",
			source: "studio",
			privacy,
			batchSize: 1,
			processors: [{ process: (e) => (e.event_name === "secret" ? null : e) }],
		});
		a.track("secret", {}); // dropped → no flush
		expect(fetchMock).not.toHaveBeenCalled();
		a.track("page_view", {}); // passes → batchSize 1 → flush
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
