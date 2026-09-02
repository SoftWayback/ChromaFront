import { getSession } from "$lib/api";

/**
 * Shared, reactive session state. Populated by the protected layout guard and
 * read anywhere in the authed area (e.g. NavSidebar) without prop drilling.
 *
 * @type {{ user: import("$lib/api").SessionUser | null, loaded: boolean }}
 */
export const session = $state({ user: null, loaded: false });

/**
 * Fetch the current identity from the API and store it.
 * @returns {Promise<import("$lib/api").SessionUser | null>}
 */
export async function loadSession() {
    session.user = await getSession();
    session.loaded = true;
    return session.user;
}

/** Drop the local copy of the session (after a logout). */
export function clearSession() {
    session.user = null;
    session.loaded = true;
}
