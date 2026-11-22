import { API_BASE_URL, PUBLIC_SITE_URL, apiFetch, refreshSession } from "$lib/api";

/**
 * @typedef {"draft" | "published"} ArticleStatus
 */

/**
 * An article as returned by the JWT-protected `/articles` admin routes.
 * `content` is plain text, paragraphs separated by a blank line.
 * `coverPath` is relative to the API base ("/covers/<uuid>").
 * @typedef {{
 *   id: string, slug: string, title: string, excerpt: string, content: string,
 *   coverPath: string | null, status: ArticleStatus, publishedAt: string | null,
 *   createdAt: string, updatedAt: string
 * }} AdminArticle
 */

/**
 * Body accepted by POST / PUT `/articles` (PUT accepts any subset).
 * @typedef {{ title?: string, slug?: string, excerpt?: string, content?: string, status?: ArticleStatus }} ArticleInput
 */

/** French labels for `AdminArticle.status`. */
export const STATUS_LABELS = /** @type {Record<ArticleStatus, string>} */ ({
    draft: "Brouillon",
    published: "Publié"
});

/** Cover formats accepted by `PUT /articles/:id/cover`. */
export const COVER_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/** Suggested excerpt length (soft limit, shown as a counter). */
export const EXCERPT_SUGGESTED = 300;

/** Error thrown by the helpers below; `status` is the HTTP status (0 = network). */
export class ApiError extends Error {
    /**
     * @param {string} message
     * @param {number} status
     */
    constructor(message, status) {
        super(message);
        this.status = status;
    }
}

/**
 * apiFetch() that retries once after a refresh on 401/403, so a save after a
 * long editing session (access_token lives 15 min) doesn't lose the work.
 * Also used by `$lib/stats`.
 * @param {string} path
 * @param {RequestInit} [init]
 */
export async function authedFetch(path, init) {
    let res;
    try {
        res = await apiFetch(path, init);
        if ((res.status === 401 || res.status === 403) && (await refreshSession())) {
            res = await apiFetch(path, init);
        }
    } catch {
        throw new ApiError("Impossible de joindre le serveur.", 0);
    }
    if (res.status === 401 || res.status === 403) {
        throw new ApiError("Session expirée, reconnecte-toi.", res.status);
    }
    return res;
}

/**
 * Parses a JSON body, throwing an ApiError with the backend `{ error }` message
 * (or `fallback`) when the response isn't ok.
 * @param {Response} res
 * @param {string} fallback
 */
export async function readJson(res, fallback) {
    /** @type {any} */
    let data = null;
    try {
        data = await res.json();
    } catch {
        // empty / non-JSON body
    }
    if (!res.ok) throw new ApiError(data?.error || `${fallback} (HTTP ${res.status})`, res.status);
    return data;
}

/**
 * @param {string} method
 * @param {ArticleInput} input
 * @returns {RequestInit}
 */
function jsonInit(method, input) {
    return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) };
}

/** @returns {Promise<AdminArticle[]>} */
export async function listArticles() {
    return readJson(await authedFetch("/articles"), "Impossible de charger les articles");
}

/**
 * @param {string} id
 * @returns {Promise<AdminArticle | null>} null when the article doesn't exist
 */
export async function getArticle(id) {
    const res = await authedFetch(`/articles/${encodeURIComponent(id)}`);
    if (res.status === 404) return null;
    return readJson(res, "Impossible de charger l'article");
}

/**
 * @param {ArticleInput} input
 * @returns {Promise<AdminArticle>}
 */
export async function createArticle(input) {
    return readJson(await authedFetch("/articles", jsonInit("POST", input)), "La création a échoué");
}

/**
 * @param {string} id
 * @param {ArticleInput} input
 * @returns {Promise<AdminArticle>} throws ApiError 409 on slug conflict, 400 on validation
 */
export async function updateArticle(id, input) {
    return readJson(
        await authedFetch(`/articles/${encodeURIComponent(id)}`, jsonInit("PUT", input)),
        "L'enregistrement a échoué"
    );
}

/** @param {string} id */
export async function deleteArticle(id) {
    const res = await authedFetch(`/articles/${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok && res.status !== 404) await readJson(res, "La suppression a échoué");
}

/**
 * Uploads the image as the raw request body (not multipart).
 * @param {string} id
 * @param {Blob} file
 * @returns {Promise<{ coverPath: string }>}
 */
export async function uploadArticleCover(id, file) {
    const res = await authedFetch(`/articles/${encodeURIComponent(id)}/cover`, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file
    });
    return readJson(res, "L'envoi de la couverture a échoué");
}

/** @param {string} id */
export async function deleteArticleCover(id) {
    const res = await authedFetch(`/articles/${encodeURIComponent(id)}/cover`, { method: "DELETE" });
    if (!res.ok && res.status !== 404) await readJson(res, "La suppression de la couverture a échoué");
}

/**
 * Public URL of an article cover.
 * @param {string | null | undefined} coverPath
 */
export function articleCoverUrl(coverPath) {
    return coverPath ? `${API_BASE_URL}${coverPath}` : null;
}

/**
 * URL-safe slug from a title: "Été à l'Aventure !" → "ete-a-l-aventure".
 * @param {string} text
 */
export function slugify(text) {
    return text
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 120)
        .replace(/-+$/, "");
}

/**
 * Plain text → paragraphs, split on blank lines exactly like TimeFront renders
 * article content and ride descriptions (single line breaks stay inside a paragraph).
 * @param {string | null | undefined} text
 */
export function paragraphs(text) {
    return (text ?? "")
        .replace(/\r\n?/g, "\n")
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter(Boolean);
}

/** @param {string | null | undefined} text */
export function wordCount(text) {
    const t = (text ?? "").trim();
    return t ? t.split(/\s+/).length : 0;
}

/** @param {string | null | undefined} slug published article → TimeFront page */
export function articleSiteUrl(slug) {
    return slug ? `${PUBLIC_SITE_URL}/articles/${encodeURIComponent(slug)}` : null;
}

const DATE_FMT =new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" });

/** @param {string | null | undefined} iso */
export function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "—" : DATE_FMT.format(d);
}
