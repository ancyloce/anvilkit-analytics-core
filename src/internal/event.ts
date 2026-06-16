/**
 * @file Internal helpers shared by the transport adapters: session-id minting,
 * property sanitization (the forbidden-fields rule), and event-envelope
 * construction. Not part of the public barrel.
 */

import { EVENT_VERSION } from "../event-catalog.js";
import type { BaseEventData, TrackEvent } from "../types.js";

/** Per-instance session identifier; prefers `crypto.randomUUID` when available. */
export function createSessionId(): string {
	if (
		typeof globalThis.crypto !== "undefined" &&
		typeof globalThis.crypto.randomUUID === "function"
	) {
		return globalThis.crypto.randomUUID();
	}
	return `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Base context merged into every event built by {@link buildTrackEvent}. */
export interface EventContext {
	source: BaseEventData["source"];
	sessionId: string;
	version?: string;
	userId?: string;
	workspaceId?: string;
	pageId?: string;
	experimentId?: string;
}

/**
 * Drop any non-primitive property value. Enforces the forbidden-fields rule —
 * no full JSON trees, serialized HTML, DOM nodes, or nested objects ever reach
 * a payload; only `string | number | boolean` survive.
 */
export function sanitizeProperties(
	properties: Record<string, unknown>,
): Record<string, string | number | boolean> {
	const out: Record<string, string | number | boolean> = {};
	for (const [key, value] of Object.entries(properties)) {
		if (
			typeof value === "string" ||
			typeof value === "number" ||
			typeof value === "boolean"
		) {
			out[key] = value;
		}
	}
	return out;
}

/** Build a complete {@link TrackEvent} envelope from a name + raw properties. */
export function buildTrackEvent(
	eventName: string,
	properties: Record<string, unknown>,
	ctx: EventContext,
): TrackEvent {
	return {
		event_name: eventName,
		version: ctx.version ?? EVENT_VERSION,
		timestamp: Date.now(),
		session_id: ctx.sessionId,
		source: ctx.source,
		...(ctx.userId !== undefined ? { user_id: ctx.userId } : {}),
		...(ctx.workspaceId !== undefined ? { workspace_id: ctx.workspaceId } : {}),
		...(ctx.pageId !== undefined ? { page_id: ctx.pageId } : {}),
		...(ctx.experimentId !== undefined
			? { experiment_id: ctx.experimentId }
			: {}),
		properties: sanitizeProperties(properties),
	};
}
