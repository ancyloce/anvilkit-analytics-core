#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PACKAGE_ROOT = resolve(__dirname, "..");
const PACKAGE_JSON = resolve(PACKAGE_ROOT, "package.json");

// `@anvilkit/analytics-core` declares NO required peers — it is isomorphic and
// self-contained. `posthog-js` is an OPTIONAL peer (the `./posthog` subpath
// adapter wraps it). Required peers must be `optional:false`; optional peers
// must be `optional:true`; every peer must be mirrored in devDependencies.
const REQUIRED_PEERS = [];

async function main() {
	const pkg = JSON.parse(await readFile(PACKAGE_JSON, "utf8"));
	const dependencies = pkg.dependencies ?? {};
	const devDependencies = pkg.devDependencies ?? {};
	const peerDependencies = pkg.peerDependencies ?? {};
	const peerDependenciesMeta = pkg.peerDependenciesMeta ?? {};

	const missingRequiredPeers = REQUIRED_PEERS.filter(
		(name) => !(name in peerDependencies),
	);
	const missingFromDevDependencies = Object.keys(peerDependencies).filter(
		(name) => !(name in devDependencies),
	);
	const missingPeerMeta = Object.keys(peerDependencies).filter((name) => {
		const meta = peerDependenciesMeta[name];
		if (!meta || typeof meta.optional !== "boolean") return true;
		// Required peers must be non-optional; everything else must be optional.
		return REQUIRED_PEERS.includes(name)
			? meta.optional !== false
			: meta.optional !== true;
	});
	const leakedToDependencies = REQUIRED_PEERS.filter(
		(name) => name in dependencies,
	);

	if (
		missingRequiredPeers.length === 0 &&
		missingFromDevDependencies.length === 0 &&
		missingPeerMeta.length === 0 &&
		leakedToDependencies.length === 0
	) {
		console.log(
			"check-peer-deps: OK — peer deps are mirrored in devDependencies with correct optionality.",
		);
		return;
	}

	console.error("check-peer-deps: FAIL");
	console.error("");

	if (missingRequiredPeers.length > 0) {
		console.error(
			`  Missing required peerDependencies: ${missingRequiredPeers.join(", ")}`,
		);
		console.error('  Add them under "peerDependencies" in package.json.');
		console.error("");
	}

	if (missingFromDevDependencies.length > 0) {
		console.error(
			`  Missing from devDependencies: ${missingFromDevDependencies.join(", ")}`,
		);
		console.error(
			'  Mirror every peer dependency in "devDependencies" so local builds resolve.',
		);
		console.error("");
	}

	if (missingPeerMeta.length > 0) {
		console.error(
			`  Missing or invalid peerDependenciesMeta: ${missingPeerMeta.join(", ")}`,
		);
		console.error(
			'  Required peers need { "optional": false }; optional peers need { "optional": true }.',
		);
		console.error("");
	}

	if (leakedToDependencies.length > 0) {
		console.error(
			`  Leaked into dependencies: ${leakedToDependencies.join(", ")}`,
		);
		console.error(
			'  Remove required peers from "dependencies" so consumers do not install duplicate runtime copies.',
		);
		console.error("");
	}

	process.exit(1);
}

main().catch((error) => {
	console.error("check-peer-deps: crashed unexpectedly");
	console.error(error);
	process.exit(2);
});
