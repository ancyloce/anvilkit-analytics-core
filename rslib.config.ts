import { defineConfig } from "@rslib/core";

export default defineConfig({
	source: {
		entry: {
			index: [
				"./src/**/*.ts",
				"!./src/**/*.{test,spec}.ts",
				"!./src/**/__tests__/**",
			],
		},
	},
	lib: [
		{
			bundle: false,
			dts: {
				autoExtension: true,
			},
			format: "esm",
		},
		{
			bundle: false,
			dts: {
				autoExtension: true,
			},
			format: "cjs",
		},
	],
	output: {
		// Isomorphic: runs in Node / Edge / browser. The Http/LocalStorage
		// adapters reference browser globals (`navigator`, `localStorage`,
		// `document`) at call time, guarded behind `typeof` checks, so a "web"
		// target is safe everywhere. `posthog-js` is the only third-party SDK
		// and is an optional peer reached solely via the `./posthog` subpath —
		// listed here so it is never inlined.
		target: "web",
		externals: ["posthog-js"],
	},
	performance: {
		// rslib defaults performance.buildCache to true, but rspack 2.x's
		// persistent cache storage is not concurrency-safe under Turbo's
		// parallel `^build` fan-out (concurrency: 32) -> SIGABRT or
		// silently missing/corrupted dist output (e.g. missing .d.ts).
		buildCache: false,
	},
});
