<script>
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import { loadSession } from "$lib/session.svelte.js";
    import logo from "$lib/assets/logo-time.png";

    // Landing spot the API redirects to after a successful Google login.
    // Confirm the session, then send the user into the app (or back to home).
    onMount(async () => {
        const user = await loadSession();
        goto(user ? "/dashboard" : "/", { replaceState: true });
    });
</script>

<svelte:head>
    <title>Connexion… — Chroma</title>
</svelte:head>

<main class="screen" aria-busy="true">
    <img src={logo} alt="" class="logo" width="96" height="96" />
    <p class="status" role="status"><span class="spinner" aria-hidden="true"></span> Connexion en cours…</p>
    <p class="sub">Vérification de la session, redirection vers le tableau de bord.</p>
</main>

<style>
    .screen {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 14px;
        min-height: 100vh;
        min-height: 100dvh;
        padding: 24px 16px;
        background: linear-gradient(180deg, var(--color-surface), var(--color-surface-end));
        color: var(--color-text);
        font-family: "Agdasima", sans-serif;
        text-align: center;
    }

    .logo {
        width: 96px;
        height: auto;
    }

    .status {
        display: flex;
        align-items: center;
        gap: 10px;
        color: var(--color-mint);
        font-size: 28px;
    }

    .sub {
        font-size: 19px;
        opacity: 0.75;
    }

    .spinner {
        display: inline-block;
        width: 20px;
        height: 20px;
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
</style>
