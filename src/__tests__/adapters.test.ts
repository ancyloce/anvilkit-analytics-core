import { describe, expect, it, vi } from "vitest";
import { createConsoleAdapter } from "../adapters/console.js";
import { createNoopAdapter } from "../adapters/noop.js";
import { ANALYTICS_EVENTS, EVENT_VERSION } from "../event-catalog.js";

describe("event catalog", () => {
	it("exposes the six canonical system events", () => {
		expect(Object.values(ANALYTICS_EVENTS).sort()).toEqual(
			[
				"component_dropped",
				"draft_saved",
				"page_published",
				"page_view",
				"plugin_toggled",
				"seo_updated",
			].sort(),
		);
	});

	it("declares an event version", () => {
		expect(typeof EVENT_VERSION).toBe("string");
	});
});

describe("createNoopAdapter", () => {
	it("implements AnalyticsAdapter and never throws", async () => {
		const a = createNoopAdapter();
		expect(() => a.track("page_view", { url: "/" })).not.toThrow();
		expect(() => a.identify("u1", { plan: "pro" })).not.toThrow();
		expect(() => a.updatePrivacyStatus(true)).not.toThrow();
		await expect(a.flush()).resolves.toBeUndefined();
	});
});

describe("createConsoleAdapter", () => {
	it("builds and logs a well-formed event envelope", () => {
		const log = vi.fn();
		const a = createConsoleAdapter({ source: "studio", logger: { log } });
		a.track("draft_saved", { component_count: 3, duration_ms: 42 });
		expect(log).toHaveBeenCalledTimes(1);
		const event = log.mock.calls[0]?.[1];
		expect(event).toMatchObject({
			event_name: "draft_saved",
			version: EVENT_VERSION,
			source: "studio",
			properties: { component_count: 3, duration_ms: 42 },
		});
		expect(typeof event.session_id).toBe("string");
		expect(typeof event.timestamp).toBe("number");
	});

	it("strips non-primitive properties (forbidden-fields rule)", () => {
		const log = vi.fn();
		const a = createConsoleAdapter({ source: "studio", logger: { log } });
		a.track("component_dropped", {
			component_type: "Hero",
			zone: "root",
			// forbidden — must be dropped:
			tree: { a: 1 },
			node: [1, 2, 3],
			fn: () => 1,
		});
		const event = log.mock.calls[0]?.[1];
		expect(event.properties).toEqual({ component_type: "Hero", zone: "root" });
	});

	it("is a no-op without consent, and resumes after consent is granted", () => {
		const log = vi.fn();
		const a = createConsoleAdapter({
			source: "published_site",
			consentGranted: false,
			logger: { log },
		});
		a.track("page_view", { url: "/" });
		a.identify("u1");
		expect(log).not.toHaveBeenCalled();
		a.updatePrivacyStatus(true);
		a.track("page_view", { url: "/" });
		expect(log).toHaveBeenCalledTimes(1);
	});

	it("merges optional base context (workspace_id/user_id) into events", () => {
		const log = vi.fn();
		const a = createConsoleAdapter({
			source: "studio",
			logger: { log },
			userId: "u9",
			workspaceId: "w7",
		});
		a.track("seo_updated", { modified_fields: "title" });
		const event = log.mock.calls[0]?.[1];
		expect(event).toMatchObject({ user_id: "u9", workspace_id: "w7" });
	});
});
