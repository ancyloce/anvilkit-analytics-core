/**
 * @file The fixed, flat system-event catalog (PRD 0004 §1.3 / F9). These are
 * the only events the editor/orchestration seams emit; behavioral product
 * events (F12–F15) flow through the same adapters with author-defined names.
 */

/** Bumped when the envelope/property contract changes; stamped on every event. */
export const EVENT_VERSION = "1.0.0";

/** The six canonical system events. */
export const ANALYTICS_EVENTS = {
	PAGE_VIEW: "page_view",
	DRAFT_SAVED: "draft_saved",
	PAGE_PUBLISHED: "page_published",
	COMPONENT_DROPPED: "component_dropped",
	SEO_UPDATED: "seo_updated",
	PLUGIN_TOGGLED: "plugin_toggled",
} as const;

/** Union of the canonical system-event names. */
export type AnalyticsEventName =
	(typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];
