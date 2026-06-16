import { afterEach, describe, expect, it, vi } from "vitest";
import { createGa4Adapter } from "../adapters/ga4.js";
import type { PrivacyConfig } from "../types.js";

const privacy: PrivacyConfig = {
	consentGranted: true,
	truncateIpAddress: false,
	retentionDays: 30,
};

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("createGa4Adapter", () => {
	it("forwards track to gtag('event', …) with send_to and sanitized props", () => {
		const gtag = vi.fn();
		vi.stubGlobal("gtag", gtag);
		const a = createGa4Adapter({
			measurementId: "G-X",
			source: "studio",
			privacy,
		});
		a.track("page_view", { url: "/", n: 1, bad: { x: 1 } });
		const eventCall = gtag.mock.calls.find((c) => c[0] === "event");
		expect(eventCall?.[1]).toBe("page_view");
		expect(eventCall?.[2]).toEqual({ url: "/", n: 1, send_to: "G-X" });
	});

	it("mirrors consent mode and is a no-op until consent is granted", () => {
		const gtag = vi.fn();
		vi.stubGlobal("gtag", gtag);
		const a = createGa4Adapter({
			measurementId: "G-X",
			source: "studio",
			privacy: { ...privacy, consentGranted: false },
		});
		expect(gtag).toHaveBeenCalledWith("consent", "update", {
			analytics_storage: "denied",
		});
		a.track("page_view", { url: "/" });
		expect(gtag.mock.calls.some((c) => c[0] === "event")).toBe(false);
		a.updatePrivacyStatus(true);
		expect(gtag).toHaveBeenCalledWith("consent", "update", {
			analytics_storage: "granted",
		});
		a.track("page_view", { url: "/" });
		expect(gtag.mock.calls.some((c) => c[0] === "event")).toBe(true);
	});

	it("does not throw when gtag is absent", () => {
		const a = createGa4Adapter({
			measurementId: "G-X",
			source: "studio",
			privacy,
		});
		expect(() => a.track("page_view", {})).not.toThrow();
	});
});
