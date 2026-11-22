<script>
    import { PUBLIC_API_BASE_URL } from "$env/static/public";
    import googleLogo from "$lib/assets/google-logo.svg";

    // Authorization-code flow: the button just sends the user to the back
    // (chromaback), which starts the Google OAuth redirect. See
    // docs/google-oauth-setup.md. It stays a plain <a>: the click only adds a
    // loading state, the navigation itself is the browser's.
    const loginUrl = `${PUBLIC_API_BASE_URL}/google/login`;

    /** @type {{ label?: string }} */
    let { label = "Se connecter avec Google" } = $props();

    let pending = $state(false);

    /** @param {MouseEvent} e */
    function onclick(e) {
        // new tab / window: the current page doesn't navigate
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) return;
        pending = true;
    }
</script>

<!-- back/forward cache: coming back from Google must not leave the spinner on -->
<svelte:window onpageshow={() => (pending = false)} />

<a class="google-sign-in" class:pending href={loginUrl} {onclick} aria-busy={pending}>
    {#if pending}
        <span class="spinner" aria-hidden="true"></span>
        <span class="label">Redirection vers Google…</span>
    {:else}
        <img src={googleLogo} alt="" class="google-logo" />
        <span class="label">{label}</span>
    {/if}
</a>

<style>
    .google-sign-in {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 14px;
        width: 100%;
        max-width: 345px;
        min-height: 54px;
        padding: 12px 18px;
        border-radius: 10px;
        background: #ffffff;
        box-shadow:
            0 0 1.5px rgba(0, 0, 0, 0.08),
            0 2px 1.5px rgba(0, 0, 0, 0.17);
        text-decoration: none;
        transition: box-shadow 0.15s, transform 0.15s;
    }

    .google-sign-in:hover {
        box-shadow: 0 0 0 3px var(--color-mint);
    }

    .google-sign-in:focus-visible {
        outline: 3px solid var(--color-mint);
        outline-offset: 3px;
    }

    .google-sign-in:active {
        transform: translateY(1px);
    }

    .google-sign-in.pending {
        pointer-events: none;
        opacity: 0.85;
    }

    .google-logo {
        width: 24px;
        height: 24px;
        flex-shrink: 0;
    }

    .label {
        color: rgba(0, 0, 0, 0.7);
        font-family: "Roboto", "Agdasima", sans-serif;
        font-size: 19px;
        font-weight: 500;
    }

    .spinner {
        width: 20px;
        height: 20px;
        flex-shrink: 0;
        border: 2px solid #007445;
        border-right-color: transparent;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .google-sign-in {
            transition: none;
        }

        .google-sign-in:active {
            transform: none;
        }

        .spinner {
            animation-duration: 2.4s;
        }
    }
</style>
