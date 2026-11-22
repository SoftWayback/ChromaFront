import { ApiError, articleCoverUrl, authedFetch, readJson } from "$lib/articles";

export { ApiError };

/**
 * Slugs of the 5 "Voir" cards on TimeFront's home page, in display order.
 * @typedef {"parc" | "roller-coasters" | "flat-rides" | "rulantica" | "quartiers"} HomeCardSlug
 */

/**
 * A home card as returned by the JWT-protected `/home-cards` routes.
 * `coverPath` is relative to the API base ("/covers/<uuid>"); null = the site's built-in image.
 * @typedef {{ slug: HomeCardSlug, coverPath: string | null, alt: string | null, updatedAt: string | null }} HomeCard
 */

/** Display labels, in the site's order. */
export const HOME_CARD_LABELS = /** @type {Record<HomeCardSlug, string>} */ ({
    parc: "Tout le parc",
    "roller-coasters": "Roller Coasters",
    "flat-rides": "Flat Rides",
    rulantica: "Rulantica",
    quartiers: "Quartiers"
});

/** Formats accepted by `PUT /home-cards/:slug/cover` (no GIF here). */
export const HOME_CARD_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Backend upload cap (413 above). */
export const HOME_CARD_MAX_BYTES = 8 * 1024 * 1024;

/** Max length of the alt text. */
export const ALT_MAX = 200;

/** The card's frame on the public site, in px (portrait). */
export const CARD_WIDTH = 616;
export const CARD_HEIGHT = 1040;

/** @returns {Promise<HomeCard[]>} */
export async function listHomeCards() {
    return readJson(
        await authedFetch("/home-cards", { cache: "no-store" }),
        "Impossible de charger les cartes"
    );
}

/**
 * Uploads the image as the raw request body (not multipart), like `uploadArticleCover`.
 * @param {HomeCardSlug} slug
 * @param {Blob} file
 * @returns {Promise<{ coverPath: string }>}
 */
export async function uploadHomeCardCover(slug, file) {
    const res = await authedFetch(`/home-cards/${encodeURIComponent(slug)}/cover`, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file
    });
    // 413 / 415 come back with a French `{ error }` from the backend, shown as is.
    if (res.status === 413 && !res.headers.get("content-type")?.includes("json")) {
        throw new ApiError("Image trop lourde (8 Mo max).", 413);
    }
    return readJson(res, "L'envoi de l'image a échoué");
}

/**
 * Back to the site's built-in image.
 * @param {HomeCardSlug} slug
 */
export async function deleteHomeCardCover(slug) {
    const res = await authedFetch(`/home-cards/${encodeURIComponent(slug)}/cover`, { method: "DELETE" });
    if (!res.ok) await readJson(res, "La suppression de l'image a échoué");
}

/**
 * @param {HomeCardSlug} slug
 * @param {string | null} alt
 * @returns {Promise<HomeCard>}
 */
export async function updateHomeCardAlt(slug, alt) {
    const res = await authedFetch(`/home-cards/${encodeURIComponent(slug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alt })
    });
    return readJson(res, "L'enregistrement du texte alternatif a échoué");
}

/** Public URL of a card image (null = built-in image). */
export const homeCardImageUrl = articleCoverUrl;

/**
 * Natural size of an image file, or null when the browser can't decode it.
 * @param {Blob} file
 * @returns {Promise<{ width: number, height: number } | null>}
 */
export async function imageSize(file) {
    try {
        const bitmap = await createImageBitmap(file);
        const size = { width: bitmap.width, height: bitmap.height };
        bitmap.close();
        return size;
    } catch {
        return null;
    }
}
