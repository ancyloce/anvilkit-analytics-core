import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPostHogAdapter } from "../adapters/posthog.js";
import type { PrivacyConfig } from "../types.js";

const mocks = vi.hoisted(() => ({
	init: vi.fn(),
	capture: vi.fn(),
	identify: vi.fn(),
	opt_in_capturing: vi.fn(),
	opt_out_capturing: vi.fn(),
}));

vi.mock("posthog-js", () => ({ default: mocks }));

const privacy: PrivacyConfig = {
	consentGranted: true,
	truncateIpAddress: false,
	retentionDays: 30,
};

beforeEach(() => {
	vi.clearAllMocks();
});

describe("createPostHogAdapter", () => {
	it("inits opted-in when consent is granted and captures sanitized props", () => {
		const a = createPostHogAdapter({
			apiKey: "k",
			host: "https://ph.example.com",
			source: "studio",
			privacy,
		});
		expect(mocks.init).toHaveBeenCalledWith("k", {
			api_host: "https://ph.example.com",
			opt_out_capturing_by_default: false,
		});
		a.track("page_view", { url: "/", bad: { x: 1 } });
		expect(mocks.capture).toHaveBeenCalledWith("page_view", { url: "/" });
	});

	it("inits opted-out and is a no-op without consent", () => {
		const a = createPostHogAdapter({
			apiKey: "k",
			source: "published_site",
			privacy: { ...privacy, consentGranted: false },
		});
		expect(mocks.init).toHaveBeenCalledWith("k", {
			opt_out_capturing_by_default: true,
		});
		a.track("page_view", { url: "/" });
		expect(mocks.capture).not.toHaveBeenCalled();
	});

	it("toggles capture via updatePrivacyStatus", () => {
		const a = createPostHogAdapter({
			apiKey: "k",
			source: "studio",
			privacy: { ...privacy, consentGranted: false },
		});
		a.updatePrivacyStatus(true);
		expect(mocks.opt_in_capturing).toHaveBeenCalledTimes(1);
		a.track("e", {});
		expect(mocks.capture).toHaveBeenCalledTimes(1);
		a.updatePrivacyStatus(false);
		expect(mocks.opt_out_capturing).toHaveBeenCalledTimes(1);
	});

	it("identifies the user with sanitized traits", () => {
		const a = createPostHogAdapter({ apiKey: "k", source: "studio", privacy });
		a.identify("u1", { plan: "pro" });
		expect(mocks.identify).toHaveBeenCalledWith("u1", { plan: "pro" });
	});
});
