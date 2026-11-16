import { authedFetch, readJson } from "$lib/articles";

/**
 * `statsCache.warmup` of `/db/overview` and `/dashboard/overview` (ChromaBack `stats.warmStatus()`).
 * @typedef {{
 *   running: { reason: string, startedAt: string } | null,
 *   last: { reason: string, startedAt: string, finishedAt: string, computed: number, failed: number } | null
 * }} WarmupStatus
 */

/**
 * `GET /db/overview` (JWT).
 * @typedef {{
 *   now: string,
 *   env: "production" | "development",
 *   server: { database: string, version: string, startedAt: string, sizeBytes: number, connections: number },
 *   tables: { name: string, rows: number, totalBytes: number, tableBytes: number, indexBytes: number,
 *             lastVacuum: string | null, lastAnalyze: string | null }[],
 *   schema: { migration: string, name: string, present: boolean }[],
 *   collection: {
 *     days: { date: string, polls: number, rows: number, openRows: number, first: string, last: string,
 *             weather: number, rulantica: number }[],
 *     pollsMissingWeather30d: number | null
 *   },
 *   catalogue: {
 *     rides: number,
 *     uncatalogued: { apiId: string, name: string | null }[],
 *     incomplete: { id: string, apiId: string, name: string, missing: string[] }[]
 *   },
 *   holidays: { country: string, kind: string, n: number, from: string, to: string }[],
 *   tokens: { total: number, expired: number },
 *   statsCache: {
 *     kinds: { kind: "bundle" | "ride" | "technical", entries: number, frozen: number, expired: number,
 *              bytes: number, lastComputedAt: string | null }[],
 *     warmup: WarmupStatus
 *   }
 * }} DbOverview
 */

/** @typedef {"warm-stats" | "sync-holidays" | "purge-tokens" | "analyze"} DbAction */

/** @returns {Promise<DbOverview>} */
export async function getDbOverview() {
    return readJson(await authedFetch("/db/overview", { cache: "no-store" }), "Impossible de charger l'état de la base");
}

/**
 * `POST /db/actions/:action`. Responses:
 * warm-stats `{ started, warmup }` (returns at once), sync-holidays `{ years, result }`,
 * purge-tokens `{ deleted }`, analyze `{ ms }`.
 * @param {DbAction} action
 * @returns {Promise<any>}
 */
export async function runDbAction(action) {
    const res = await authedFetch(`/db/actions/${encodeURIComponent(action)}`, { method: "POST" });
    return readJson(res, "L'action a échoué");
}

/** French labels of the `missing` fields of `catalogue.incomplete`. */
export const MISSING_LABELS = /** @type {Record<string, string>} */ ({
    description: "description",
    type: "type",
    quartier: "quartier",
    constructeur: "constructeur",
    photo: "photo"
});

/** French labels of `statsCache.kinds[].kind`. */
export const CACHE_KIND_LABELS = /** @type {Record<string, string>} */ ({
    bundle: "Bundles de période",
    ride: "Stats par attraction",
    technical: "Technique (baselines, périodes)"
});

/** "WARM-UP reason" → French. */
export function warmReasonLabel(/** @type {string | null | undefined} */ reason) {
    const labels = /** @type {Record<string, string>} */ ({
        poll: "après relevé",
        nightly: "nuit",
        midnight: "minuit",
        startup: "démarrage",
        admin: "manuel",
        manual: "manuel"
    });
    return reason ? (labels[reason] ?? reason) : "—";
}

const SIZE_UNITS = ["o", "Ko", "Mo", "Go", "To"];

/** bytes → "512 o" / "12,3 Ko" / "1,1 Go" (1024-based). */
export function formatBytes(/** @type {number | string | null | undefined} */ bytes) {
    let n = Number(bytes);
    if (bytes == null || !Number.isFinite(n)) return "—";
    let i = 0;
    while (n >= 1024 && i < SIZE_UNITS.length - 1) {
        n /= 1024;
        i++;
    }
    const digits = i === 0 || n >= 100 ? 0 : 1;
    return `${n.toLocaleString("fr-FR", { maximumFractionDigits: digits })} ${SIZE_UNITS[i]}`;
}

/** Elapsed time since `iso`: "3 j 4 h", "5 h 12 min", "8 min". */
export function formatSince(/** @type {string | null | undefined} */ iso, now = Date.now()) {
    if (!iso) return "—";
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return "—";
    const min = Math.max(0, Math.floor((now - t) / 60000));
    const d = Math.floor(min / 1440);
    const h = Math.floor((min % 1440) / 60);
    if (d) return `${d} j ${h} h`;
    if (h) return `${h} h ${min % 60} min`;
    return `${min} min`;
}

/** 0.873 → "87 %" (null-safe). */
export function formatPct(/** @type {number} */ part, /** @type {number} */ total) {
    if (!total) return "—";
    return `${Math.round((part / total) * 100)} %`;
}
