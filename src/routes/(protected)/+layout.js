// The authed area is client-rendered: the session lives in cross-origin
// cookies on the API (:3000) that SSR cannot read, and the guard in
// +layout.svelte runs in the browser.
export const ssr = false;
