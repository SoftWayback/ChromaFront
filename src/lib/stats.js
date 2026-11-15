import { apiFetch } from "$lib/api";
import { ApiError, authedFetch, readJson } from "$lib/articles";

export { ApiError };

/**
 * A row of ChromaBack's `"StatsCache"`, from `GET /stats/cache` (JWT).
 * Keys: `baselines`, `periods`, `all`, `today`, `last3d`, `month:YYYY-MM`, `week:<monday>`.
 * `expiresAt` null = immutable (past month / week). `size` is in bytes.
 * @typedef {{
 *   key: string, computedAt: string, expiresAt: string | null, size: number | string,
 *   inMemory?: boolean, computing?: boolean
 * }} CacheEntry
 */

/**
 * `POST /stats/recompute` response.
 * @typedef {{ timings: Record<string, number>, totalMs: number }} RecomputeResult
 */

/**
 * `GET /public/stats/periods`: months ("YYYY-MM") and weeks (Mondays, "YYYY-MM-DD") with data.
 * @typedef {{ first: string, last: string, months: string[], weeks: string[] }} StatsPeriods
 */

/**
 * `{ n, raw, index }` — see ChromaBack/CLAUDE.md "Bundle shape".
 * @typedef {{ n: number | null, raw: number | null, index: number | null }} Metric
 */

/**
 * The subset of a stats bundle the admin preview reads.
 * @typedef {{
 *   period: { key: string, from: string, to: string, label: string },
 *   computedAt: string, computeMs: number,
 *   coverage: { days: number, operatingDays: number, completeDays: number, samples: number, rows: number, slots: number, polls: number },
 *   params: { queueRideCount: number, completeDayMinSlots: number, medianSlotsPerDay: number, baselinesComputedAt: string | null },
 *   days: { byIndex: { most: (Metric & { date: string }) | null, least: (Metric & { date: string }) | null } },
 *   weekdays: { list: (Metric & { weekday: number, name: string, days: number })[] }
 * }} StatsBundle
 */

/** Cache keys that `POST /stats/recompute { period }` accepts as-is (everything but `periods`). */
export function isRecomputable(/** @type {string} */ key) {
    return key !== "periods";
}

/** @returns {Promise<CacheEntry[]>} */
export async function listStatsCache() {
    return readJson(await authedFetch("/stats/cache"), "Impossible de charger le cache des stats");
}

/**
 * Forces a recomputation. No period = baselines + all + last3d + today + periods (~50 s).
 * Browsers put no timeout on fetch(), so the long request is simply awaited.
 * @param {string} [period] `all` | `today` | `last3d` | `baselines` | `month:YYYY-MM` | `week:YYYY-MM-DD`
 * @returns {Promise<RecomputeResult>}
 */
export async function recomputeStats(period) {
    const res = await authedFetch("/stats/recompute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(period ? { period } : {})
    });
    return readJson(res, "Le recalcul a échoué");
}

/**
 * Public route; `no-store` so a fresh recompute isn't hidden by `max-age=60`.
 * @param {string} path
 * @param {string} fallback
 */
async function publicJson(path, fallback) {
    let res;
    try {
        res = await apiFetch(path, { cache: "no-store" });
    } catch {
        throw new ApiError("Impossible de joindre le serveur.", 0);
    }
    return readJson(res, fallback);
}

/** @returns {Promise<StatsPeriods>} */
export function getStatsPeriods() {
    return publicJson("/public/stats/periods", "Impossible de charger les périodes");
}

/**
 * @param {string} period
 * @returns {Promise<StatsBundle>}
 */
export function getStatsBundle(period) {
    return publicJson(`/public/stats?period=${encodeURIComponent(period)}`, "Impossible de charger les stats");
}

const MONTH_FMT = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
const DAY_FMT = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const DAY_LONG_FMT = new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
});
const ABS_FMT = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "medium" });
const RTF = new Intl.RelativeTimeFormat("fr", { style: "short", numeric: "always" });
const NUM_FMT = new Intl.NumberFormat("fr-FR");

/** @param {string} s */
const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** "2026-07" → "Juillet 2026" */
export function monthLabel(/** @type {string} */ ym) {
    return capitalize(MONTH_FMT.format(new Date(`${ym}-01T00:00:00Z`)));
}

/** "2026-07-13" → "Semaine du 13 juil. 2026" */
export function weekLabel(/** @type {string} */ monday) {
    return `Semaine du ${DAY_FMT.format(new Date(`${monday}T00:00:00Z`))}`;
}

/** "2026-07-13" → "lun. 13 juil. 2026" */
export function dayLabel(/** @type {string} */ date) {
    return DAY_LONG_FMT.format(new Date(`${date}T00:00:00Z`));
}

const FIXED_LABELS = /** @type {Record<string, string>} */ ({
    all: "Depuis le début",
    today: "Aujourd'hui",
    last3d: "3 derniers jours",
    baselines: "Baselines (médianes par attraction)",
    periods: "Liste des périodes"
});

/** French label of a cache key / period value. */
export function periodLabel(/** @type {string} */ key) {
    if (FIXED_LABELS[key]) return FIXED_LABELS[key];
    if (key.startsWith("month:")) return monthLabel(key.slice(6));
    if (key.startsWith("week:")) return weekLabel(key.slice(5));
    return key;
}

/** Sort rank: all, today, last3d, months, weeks, then the technical entries. */
function rank(/** @type {string} */ key) {
    const fixed = ["all", "today", "last3d"].indexOf(key);
    if (fixed >= 0) return fixed;
    if (key.startsWith("month:")) return 3;
    if (key.startsWith("week:")) return 4;
    return 5;
}

/**
 * all, today, last3d, then months / weeks newest first, then baselines / periods.
 * @param {CacheEntry[]} entries
 */
export function sortCacheEntries(entries) {
    return [...entries].sort((a, b) => rank(a.key) - rank(b.key) || b.key.localeCompare(a.key));
}

const UNITS = /** @type {const} */ ([
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60]
]);

/**
 * "il y a 12 min" / "dans 3 h" / "à l'instant".
 * @param {string | null | undefined} iso
 * @param {number} [now]
 */
export function relativeTime(iso, now = Date.now()) {
    if (!iso) return "—";
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return "—";
    const diff = (t - now) / 1000;
    const abs = Math.abs(diff);
    if (abs < 45) return "à l'instant";
    for (const [unit, sec] of UNITS) {
        if (abs >= sec || unit === "minute") return RTF.format(Math.round(diff / sec), unit);
    }
    return "—";
}

/** @param {string | null | undefined} iso */
export function absoluteTime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "" : ABS_FMT.format(d);
}

/** 850 → "850 ms", 33210 → "33,2 s" */
export function formatMs(/** @type {number | null | undefined} */ ms) {
    if (ms == null) return "—";
    return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} s`;
}

/** bytes → "12,3 Ko" */
export function formatSize(/** @type {number | string | null | undefined} */ bytes) {
    const n = Number(bytes);
    if (!Number.isFinite(n)) return "—";
    return `${(n / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} Ko`;
}

/** 1220000 → "1 220 000" */
export function formatNumber(/** @type {number | null | undefined} */ n) {
    return n == null ? "—" : NUM_FMT.format(n);
}
