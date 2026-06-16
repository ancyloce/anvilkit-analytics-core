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
});
