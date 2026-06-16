import { describe, expect, it } from "vitest";
import {
	ANALYTICS_QUEUE_KEY,
	createLocalStorageAdapter,
} from "../adapters/local-storage.js";

function makeMockStorage(): Storage {
	const map = new Map<string, string>();
	return {
		getItem: (k) => map.get(k) ?? null,
		setItem: (k, v) => {
			map.set(k, v);
		},
		removeItem: (k) => {
			map.delete(k);
		},
		clear: () => {
			map.clear();
		},
		key: (i) => [...map.keys()][i] ?? null,
		get length() {
			return map.size;
		},
	} as Storage;
}

const read = (storage: Storage): unknown => {
	const raw = storage.getItem(ANALYTICS_QUEUE_KEY);
	return raw === null ? null : JSON.parse(raw);
};

describe("createLocalStorageAdapter", () => {
	it("queues built events under anvilkit_analytics_queue when consented", () => {
		const storage = makeMockStorage();
		const a = createLocalStorageAdapter({
			source: "studio",
			consentGranted: true,
			storage,
		});
		a.track("draft_saved", { component_count: 2 });
		const queued = read(storage) as Array<Record<string, unknown>>;
		expect(queued).toHaveLength(1);
		expect(queued[0]).toMatchObject({
			event_name: "draft_saved",
			properties: { component_count: 2 },
		});
	});

	it("is a no-op without consent", () => {
		const storage = makeMockStorage();
		const a = createLocalStorageAdapter({ source: "studio", storage });
		a.track("page_view", { url: "/" });
		expect(read(storage)).toBeNull();
	});

	it("purges the queue on consent revoke", () => {
		const storage = makeMockStorage();
		const a = createLocalStorageAdapter({
			source: "studio",
			consentGranted: true,
			storage,
		});
		a.track("page_view", { url: "/" });
		expect(read(storage)).not.toBeNull();
		a.updatePrivacyStatus(false);
		expect(read(storage)).toBeNull();
	});

	it("caps the queue at maxQueueSize (drops the oldest)", () => {
		const storage = makeMockStorage();
		const a = createLocalStorageAdapter({
			source: "studio",
			consentGranted: true,
			storage,
			maxQueueSize: 2,
		});
		a.track("e", { n: 1 });
		a.track("e", { n: 2 });
		a.track("e", { n: 3 });
		const q = read(storage) as Array<{ properties: { n: number } }>;
		expect(q).toHaveLength(2);
		expect(q.map((e) => e.properties.n)).toEqual([2, 3]);
	});

	it("resumes queueing after consent is (re)granted", () => {
		const storage = makeMockStorage();
		const a = createLocalStorageAdapter({ source: "studio", storage });
		a.track("page_view", { url: "/" });
		expect(read(storage)).toBeNull();
		a.updatePrivacyStatus(true);
		a.track("page_view", { url: "/" });
		expect(read(storage) as unknown[]).toHaveLength(1);
	});
});
