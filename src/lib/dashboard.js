import { authedFetch, readJson } from "$lib/articles";

/** @typedef {import("$lib/db").WarmupStatus} WarmupStatus */

/**
 * `GET /dashboard/overview` (JWT).
 * @typedef {{
 *   now: string,
 *   collection: {
 *     lastPollAt: string | null, late: boolean, pollsToday: number, ridesReported: number,
 *     ridesOpen: number, ridesKnown: number, avgWait: number | null,
 *     longest: { name: string, wait: number, rideId: string | null } | null,
 *     rulanticaLastPollAt: string | null, weatherLastAt: string | null, cronDisabled: boolean
 *   },
 *   db: { name: string, sizeBytes: number, waitingTimes: number },
 *   content: { articlesPublished: number, articlesDraft: number, rides: number, incomplete: number, no_photo: number },
 *   statsCache: { entries: number, expired: number, rides: number, bytes: number, warmup: WarmupStatus }
 * }} DashboardOverview
 */

/**
 * One ride of `GET /dashboard/live`. `isOpen` null = no measurement.
 * @typedef {{
 *   apiId: string, rideId: string | null, name: string, type: string | null,
 *   landId: string | null, land: string | null,
 *   live: { wait: number | null, isOpen: boolean | null, at: string | null },
 *   previous: { wait: number | null, isOpen: boolean | null }
 * }} LiveRide
 */

/** @typedef {{ updatedAt: string | null, rides: LiveRide[] }} LiveData */

/** @typedef {"park" | "coaster" | "flat" | "dark" | "water" | "land"} WaitScope */

/**
 * `GET /dashboard/wait-times`. `value` null = no valid wait in that 30-min slot.
 * @typedef {{
 *   date: string | null, days: string[], scope: WaitScope, max: number,
 *   points: { time: string, value: number | null, rides: number }[]
 * }} WaitTimes
 */

/** @typedef {{ id: string, name: string }} Land */

/** @returns {Promise<DashboardOverview>} */
export async function getOverview() {
    return readJson(await authedFetch("/dashboard/overview", { cache: "no-store" }), "Impossible de charger l'aperçu");
}

/** @returns {Promise<LiveData>} */
export async function getLive() {
    return readJson(await authedFetch("/dashboard/live", { cache: "no-store" }), "Impossible de charger le live");
}

/**
 * @param {{ scope: WaitScope, land?: string | null, date?: string | null }} q
 * @returns {Promise<WaitTimes>}
 */
export async function getWaitTimes({ scope, land, date }) {
    const params = new URLSearchParams({ scope });
    if (scope === "land" && land) params.set("land", land);
    if (date) params.set("date", date);
    return readJson(
        await authedFetch(`/dashboard/wait-times?${params}`, { cache: "no-store" }),
        "Impossible de charger les temps d'attente"
    );
}

/** @returns {Promise<Land[]>} */
export async function getLands() {
    return readJson(await authedFetch("/rides/lands"), "Impossible de charger les quartiers");
}

/**
 * Colour level of a live wait: "low" ≤ 15, "mid" ≤ 45, "high" > 45,
 * "closed" (reported closed), "none" (no measurement).
 * @param {{ wait: number | null, isOpen: boolean | null }} m
 * @returns {"low" | "mid" | "high" | "closed" | "none"}
 */
export function waitLevel(m) {
    if (m.isOpen == null) return "none";
    if (!m.isOpen) return "closed";
    if (m.wait == null) return "none";
    if (m.wait <= 15) return "low";
    if (m.wait <= 45) return "mid";
    return "high";
}

/**
 * Display text of a measurement: "35", "Fermé", "—".
 * @param {{ wait: number | null, isOpen: boolean | null }} m
 */
export function waitText(m) {
    if (m.isOpen == null) return "—";
    if (!m.isOpen) return "Fermé";
    return m.wait == null ? "—" : String(m.wait);
}

/**
 * Sort value: open waits first (by minutes), then closed, then no data.
 * @param {{ wait: number | null, isOpen: boolean | null }} m
 */
export function waitSortValue(m) {
    if (m.isOpen == null) return -2;
    if (!m.isOpen) return -1;
    return m.wait ?? -1;
}

/**
 * Trend between previous and live poll, only when both are open with a wait.
 * @param {LiveRide} r
 * @returns {{ dir: "up" | "down" | "flat", delta: number } | null}
 */
export function waitTrend(r) {
    const a = r.previous;
    const b = r.live;
    if (!a.isOpen || !b.isOpen || a.wait == null || b.wait == null) return null;
    const delta = b.wait - a.wait;
    return { dir: delta > 0 ? "up" : delta < 0 ? "down" : "flat", delta };
}

/** Chart scopes, in chip order. */
export const WAIT_SCOPES = /** @type {{ key: WaitScope, label: string }[]} */ ([
    { key: "park", label: "Parc entier" },
    { key: "coaster", label: "Coasters" },
    { key: "flat", label: "Flat rides" },
    { key: "dark", label: "Dark rides" },
    { key: "water", label: "Water rides" },
    { key: "land", label: "Quartier" }
]);
