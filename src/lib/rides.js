import { API_BASE_URL, PUBLIC_SITE_URL } from "$lib/api";
import { ApiError, authedFetch, readJson } from "$lib/articles";

export { ApiError };

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

/** @param {string | null | undefined} apiId queue-times id → TimeFront ride page */
export function rideSiteUrl(apiId) {
    return apiId ? `${PUBLIC_SITE_URL}/rides/${encodeURIComponent(apiId)}` : null;
}

/**
 * Row of `GET /rides` (wait = latest poll of the last 3 days; null when closed / no data).
 * @typedef {{
 *   id: string, name: string, type: string | null, land: string | null,
 *   hasCover: boolean, wait: number | null, isOpen: boolean | null
 * }} RideRow
 */

/**
 * `GET /rides/:id` (and the PATCH answer).
 * @typedef {{
 *   Id: string, ApiId: string, Name: string, Description: string, Type: string | null,
 *   LandId: string | null, LandName: string | null, CoverId: string | null,
 *   Manufacturer: string | null, OpeningYear: number | null, OpeningDate: string | null,
 *   Height: number | null, Length: number | null, MaxSpeed: number | null, TimeLength: number | null, PPH: number | null,
 *   MinimalAge: number | null, MinimalHeight: number | null, Trains: number | null, Carriages: number | null,
 *   VehicleCapacity: number | null,
 *   types: string[]
 * }} Ride
 */

/** @typedef {{ id: string, name: string }} Land */
/** @typedef {{ id: string, isMain: boolean }} Photo */
/** @typedef {{ CoverId: string | null, photos: Photo[] }} Gallery */

/** Thrown by `updateRide` on a 400 with per-column messages. */
export class RideFieldsError extends ApiError {
    /** @param {Record<string, string>} fields */
    constructor(fields) {
        super("Certains champs sont invalides.", 400);
        this.fields = fields;
    }
}

/** @returns {Promise<RideRow[]>} */
export async function listRides() {
    return readJson(await authedFetch("/rides", { cache: "no-store" }), "Impossible de charger les entités");
}

/** @returns {Promise<Land[]>} */
export async function getLands() {
    return readJson(await authedFetch("/rides/lands"), "Impossible de charger les quartiers");
}

/**
 * @param {string} id
 * @returns {Promise<Ride | null>} null on 404
 */
export async function getRide(id) {
    const res = await authedFetch(`/rides/${encodeURIComponent(id)}`, { cache: "no-store" });
    if (res.status === 404) return null;
    return readJson(res, "Impossible de charger l'entité");
}

/**
 * @param {string} id
 * @param {Record<string, string | number | null>} body any subset of the editable columns
 * @returns {Promise<Ride>} throws RideFieldsError on per-column validation errors
 */
export async function updateRide(id, body) {
    const res = await authedFetch(`/rides/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    if (res.status === 400) {
        /** @type {any} */
        let data = null;
        try {
            data = await res.clone().json();
        } catch {
            // fall through to readJson
        }
        if (data?.errors) throw new RideFieldsError(data.errors);
    }
    return readJson(res, "L'enregistrement a échoué");
}

/**
 * @param {string} rideId
 * @returns {Promise<Gallery>}
 */
export async function getPhotos(rideId) {
    return readJson(
        await authedFetch(`/rides/${encodeURIComponent(rideId)}/photos`, { cache: "no-store" }),
        "Impossible de charger les photos"
    );
}

/**
 * Raw image body (not multipart). The first photo becomes the main one.
 * @param {string} rideId
 * @param {Blob} file
 * @returns {Promise<Gallery>}
 */
export async function uploadPhoto(rideId, file) {
    const res = await authedFetch(`/rides/${encodeURIComponent(rideId)}/photos`, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file
    });
    return readJson(res, "L'envoi a échoué");
}

/**
 * @param {string} rideId
 * @param {string} photoId
 * @returns {Promise<Gallery>}
 */
export async function setMainPhoto(rideId, photoId) {
    const res = await authedFetch(`/rides/${encodeURIComponent(rideId)}/photos/${encodeURIComponent(photoId)}/main`, {
        method: "PUT"
    });
    return readJson(res, "Impossible de changer la photo principale");
}

/**
 * @param {string} rideId
 * @param {string} photoId
 * @returns {Promise<Gallery>} the next photo takes over when the main one is deleted
 */
export async function deletePhoto(rideId, photoId) {
    const res = await authedFetch(`/rides/${encodeURIComponent(rideId)}/photos/${encodeURIComponent(photoId)}`, {
        method: "DELETE"
    });
    return readJson(res, "La suppression a échoué");
}

/** Photo formats accepted by `POST /rides/:id/photos`. */
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
export const PHOTO_MAX_BYTES = 8 * 1024 * 1024;

/**
 * The "fiche incomplète" rule (ChromaBack utils/RideSheet.js, also used by /db):
 * missing description, type, quartier, constructeur or photo; virtual lines excluded.
 */
export const SHEET_FIELDS = /** @type {const} */ (["description", "type", "quartier", "constructeur", "photo"]);

/**
 * Missing sheet fields of a full ride (+ its photo count).
 * @param {Ride} r
 * @param {number} photoCount
 * @returns {string[]}
 */
export function missingFields(r, photoCount) {
    if (r.Type === "virtualline") return [];
    /** @type {string[]} */
    const out = [];
    if (!r.Description?.trim()) out.push("description");
    if (!r.Type) out.push("type");
    if (!r.LandId) out.push("quartier");
    if (!r.Manufacturer?.trim()) out.push("constructeur");
    if (!photoCount) out.push("photo");
    return out;
}

// ── Editable fields and their validation (mirrors RidesRouter's EDITABLE) ──

/**
 * @typedef {{
 *   key: string, label: string, kind: "text" | "int" | "decimal" | "date",
 *   unit?: string, min?: number, max?: number, maxLength?: number, hint?: string
 * }} RideField
 */

/** Identité (besides Name). */
export const IDENTITY_FIELDS = /** @type {RideField[]} */ ([
    { key: "Manufacturer", label: "Constructeur", kind: "text", maxLength: 200 },
    { key: "OpeningYear", label: "Année d'ouverture", kind: "int", min: 1800, max: 2100 },
    { key: "OpeningDate", label: "Date d'ouverture exacte", kind: "date", hint: "Prioritaire sur l'année sur le site." }
]);

/** Caractéristiques techniques. */
export const TECH_FIELDS = /** @type {RideField[]} */ ([
    { key: "Height", label: "Hauteur", unit: "m", kind: "decimal", min: 0, max: 9999, hint: "Une décimale (ex. 13,5)." },
    { key: "Length", label: "Longueur", unit: "m", kind: "int", min: 0, max: 100000 },
    { key: "MaxSpeed", label: "Vitesse max", unit: "km/h", kind: "int", min: 0, max: 300 },
    { key: "TimeLength", label: "Durée", unit: "s", kind: "int", min: 0, max: 36000 },
    { key: "PPH", label: "Débit", unit: "pers./h", kind: "int", min: 0, max: 100000 },
    { key: "MinimalHeight", label: "Taille minimale", unit: "cm", kind: "int", min: 0, max: 250 },
    { key: "MinimalAge", label: "Âge minimal", unit: "ans", kind: "int", min: 0, max: 99 },
    { key: "Trains", label: "Trains / véhicules", kind: "int", min: 0, max: 1000 },
    { key: "Carriages", label: "Wagons par train", kind: "int", min: 0, max: 1000 },
    { key: "VehicleCapacity", label: "Places par train", kind: "int", min: 0, max: 1000 }
]);

export const NAME_MAX = 200;
export const DESCRIPTION_MAX = 5000;

/**
 * Parses a form value for a field: "" → null, numbers accept a decimal comma.
 * Returns `{ value }` or `{ error }` with the backend's wording.
 * @param {RideField} f
 * @param {string} raw
 * @returns {{ value: string | number | null, error?: undefined } | { error: string, value?: undefined }}
 */
export function parseField(f, raw) {
    const v = raw.trim();
    if (v === "") return { value: null };
    if (f.kind === "text") {
        if (f.maxLength && v.length > f.maxLength) return { error: `${f.maxLength} caractères maximum` };
        return { value: v };
    }
    if (f.kind === "date") {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) return { error: "date invalide (AAAA-MM-JJ)" };
        return { value: v };
    }
    const n = Number(v.replace(/\s/g, "").replace(",", "."));
    const min = f.min ?? 0;
    const max = f.max ?? Infinity;
    if (f.kind === "int") {
        if (!Number.isInteger(n) || n < min || n > max) return { error: `doit être un entier entre ${min} et ${max}` };
        return { value: n };
    }
    if (!Number.isFinite(n) || n < min || n > max) return { error: `doit être un nombre entre ${min} et ${max}` };
    return { value: Math.round(n * 10) / 10 };
}

/** "200" s → "3 min 20 s" (for the duration hint). @param {number} s */
export function formatDuration(s) {
    const m = Math.floor(s / 60);
    const r = s % 60;
    if (!m) return `${r} s`;
    return r ? `${m} min ${r} s` : `${m} min`;
}
