import { PUBLIC_API_BASE_URL } from "$env/static/public";

/** Base URL of the ChromaBack API (owns the Google OAuth flow + sessions). */
export const API_BASE_URL = PUBLIC_API_BASE_URL;

/**
 * fetch() against the API with the session cookies always attached.
 * The access_token / refresh_token cookies are SameSite=None; Secure, so
 * `credentials: "include"` is mandatory on every call.
 *
 * @param {string} path absolute path on the API, e.g. "/status/ping"
 * @param {RequestInit} [init]
 * @returns {Promise<Response>}
 */
export function apiFetch(path, init = {}) {
    return fetch(`${API_BASE_URL}${path}`, { credentials: "include", ...init });
}

/**
 * Ask the API to mint a fresh access_token from the refresh_token cookie.
 * @returns {Promise<boolean>} true if a new access_token was set
 */
export async function refreshSession() {
    try {
        const res = await apiFetch("/account/token", { method: "POST" });
        return res.ok;
    } catch {
        return false;
    }
}

/**
 * @typedef {{ sub: string, email: string, name: string | null }} SessionUser
 */

/**
 * The current session identity, or null if the visitor is not logged in.
 * Hits `GET /status/ping`; on 401/403 it attempts one refresh and retries once.
 * Runs client-side only (the cookies are cross-origin to the API).
 *
 * @returns {Promise<SessionUser | null>}
 */
export async function getSession() {
    try {
        let res = await apiFetch("/status/ping");
        if (res.status === 401 || res.status === 403) {
            if (await refreshSession()) {
                res = await apiFetch("/status/ping");
            }
        }
        if (!res.ok) return null;
        const body = await res.json();
        return { sub: body.sub, email: body.email, name: body.name ?? null };
    } catch {
        return null;
    }
}

/**
 * Whether the current visitor has a valid session.
 * @returns {Promise<boolean>}
 */
export async function isAuthenticated() {
    return (await getSession()) !== null;
}

/**
 * End the session server-side: the API deletes the refresh-token row and clears
 * both cookies (204, no body). Best-effort — callers should navigate away
 * regardless of the outcome.
 * @returns {Promise<void>}
 */
export async function logout() {
    try {
        await apiFetch("/logout", { method: "POST" });
    } catch {
        // ignore — the user is leaving the authed area anyway
    }
}
