import { API_BASE_URL } from "$lib/api";

/** French labels for "Rides"."Type" (values are fixed by the API). */
export const TYPE_LABELS = /** @type {Record<string, string>} */ ({
    coaster: "Coaster",
    flat: "Flat ride",
    water: "Aquatique",
    dark: "Parcours scénique",
    show: "Spectacle",
    virtualline: "VirtualLine"
});

/** @param {string | null | undefined} type */
export function typeLabel(type) {
    return type ? (TYPE_LABELS[type] ?? type) : "—";
}

/**
 * Public URL of a cover image (served by GET /covers/:id).
 * @param {string | null | undefined} coverId
 */
export function coverUrl(coverId) {
    return coverId ? `${API_BASE_URL}/covers/${coverId}` : null;
}
