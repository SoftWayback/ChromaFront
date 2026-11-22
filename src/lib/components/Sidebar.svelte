<script>
    import logo from "$lib/assets/logo-time.png";
    import GoogleSignInButton from "$lib/components/GoogleSignInButton.svelte";

    /** @type {{ checking?: boolean }} true while an existing session is being checked */
    let { checking = false } = $props();
</script>

<section class="sidebar" aria-labelledby="signin-title">
    <div class="inner">
        <img src={logo} alt="Time!" class="logo" width="140" height="140" />
        <h1 id="signin-title">Chroma <span class="dash">—</span> <span class="sub">administration</span></h1>
        <p class="lead">Back office du site Time ! : temps d'attente d'Europa-Park, statistiques, fiches et articles.</p>

        <div class="sign-in">
            <GoogleSignInButton />
            <p class="restricted">
                <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
                Accès réservé au compte autorisé.
            </p>
            <p class="checking" aria-live="polite">
                {#if checking}<span class="spinner" aria-hidden="true"></span> Vérification d'une session existante…{/if}
            </p>
        </div>
    </div>
    <p class="foot">Site public : <a href="https://time.galaxian.dev" rel="noopener">time.galaxian.dev</a></p>
</section>

<style>
    .sidebar {
        position: relative;
        display: flex;
        flex-direction: column;
        justify-content: center;
        min-height: 100vh;
        min-height: 100dvh;
        padding: 48px clamp(20px, 6vw, 96px) 24px;
        border-right: 10px solid var(--color-mint);
        background: linear-gradient(180deg, var(--color-surface), var(--color-surface-end));
        color: var(--color-text);
        font-family: "Agdasima", sans-serif;
    }

    .inner {
        display: flex;
        flex: 1;
        flex-direction: column;
        justify-content: center;
        gap: 18px;
        max-width: 420px;
    }

    .logo {
        width: clamp(96px, 12vw, 140px);
        height: auto;
    }

    h1 {
        font-size: clamp(40px, 5vw, 60px);
        font-weight: 700;
        line-height: 1;
    }

    .dash {
        color: var(--color-mint);
    }

    .sub {
        font-weight: 400;
    }

    .lead {
        font-size: 21px;
        line-height: 1.3;
        opacity: 0.85;
    }

    .sign-in {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-top: 12px;
    }

    .restricted {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--color-mint);
        font-size: 19px;
    }

    .restricted svg {
        width: 20px;
        height: 20px;
        flex-shrink: 0;
    }

    .checking {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 24px;
        font-size: 17px;
        opacity: 0.75;
    }

    .foot {
        margin-top: 32px;
        font-size: 17px;
        opacity: 0.7;
    }

    .foot a {
        color: var(--color-mint);
    }

    .spinner {
        display: inline-block;
        width: 14px;
        height: 14px;
        border: 2px solid currentColor;
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
        .spinner {
            animation-duration: 2.4s;
        }
    }

    @media (max-width: 767px) {
        .sidebar {
            border-right: none;
            border-top: 6px solid var(--color-mint);
        }

        .inner {
            margin: 0 auto;
            align-items: center;
            text-align: center;
        }

        .sign-in {
            align-items: center;
            width: 100%;
        }
    }
</style>
