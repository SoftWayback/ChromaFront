<script>
    import { page } from "$app/state";
    import logo from "$lib/assets/logo-time.png";
    import GoogleSignInButton from "$lib/components/GoogleSignInButton.svelte";

    // The API redirects here on a failed login:
    //   /Error?type=<code>&message=<text>
    // (ChromaBack GoogleRouter: 400 bad/expired OAuth state, 401 account not
    // allowed, 500 Google / token failure.)
    const type = $derived(page.url.searchParams.get("type") ?? "unknown");
    const detail = $derived(page.url.searchParams.get("message"));

    /** @type {Record<string, { title: string, text: string, retry: boolean }>} */
    const MESSAGES = {
        "400": {
            title: "La connexion a expiré",
            text: "La demande de connexion n'est plus valide (onglet resté ouvert trop longtemps, ou retour arrière pendant la connexion). Relance simplement la connexion.",
            retry: true
        },
        "401": {
            title: "Compte non autorisé",
            text: "Ce compte Google n'a pas accès à l'administration de Chroma. Connecte-toi avec le compte autorisé (pense à changer de compte dans la fenêtre Google).",
            retry: true
        },
        "403": {
            title: "Accès refusé",
            text: "Ce compte n'a pas les droits nécessaires pour accéder à l'administration.",
            retry: true
        },
        "500": {
            title: "Google n'a pas pu confirmer la connexion",
            text: "Un problème est survenu entre le serveur et Google. Réessaie dans un instant ; si ça persiste, le serveur est peut-être mal configuré.",
            retry: true
        }
    };

    const info = $derived(
        MESSAGES[type] ?? {
            title: "Connexion impossible",
            text: "Une erreur inattendue est survenue pendant la connexion.",
            retry: true
        }
    );
</script>

<svelte:head>
    <title>{info.title} — Chroma</title>
</svelte:head>

<main class="screen">
    <div class="card" role="alert">
        <img src={logo} alt="" class="logo" width="80" height="80" />
        <h1>{info.title}</h1>
        <p class="text">{info.text}</p>

        <div class="actions">
            {#if info.retry}<GoogleSignInButton label="Réessayer la connexion" />{/if}
            <a class="btn outline" href="/">Retour à l'accueil</a>
        </div>

        <details class="details">
            <summary>Détails techniques</summary>
            <p>Code : <code>{type}</code></p>
            {#if detail}<p>Message : <code>{detail}</code></p>{/if}
        </details>
    </div>
</main>

<style>
    .screen {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        min-height: 100dvh;
        padding: 24px 12px;
        background: linear-gradient(180deg, var(--color-surface), var(--color-surface-end));
        color: var(--color-text);
        font-family: "Agdasima", sans-serif;
    }

    .card {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 16px;
        width: 100%;
        max-width: 560px;
        padding: clamp(20px, 5vw, 40px);
        border: 1px solid var(--color-red);
        border-radius: 10px;
        background: var(--color-bg);
        text-align: center;
    }

    .logo {
        width: 80px;
        height: auto;
    }

    h1 {
        color: var(--color-red);
        font-size: clamp(34px, 6vw, 48px);
        font-weight: 400;
        line-height: 1.05;
    }

    .text {
        font-size: 21px;
        line-height: 1.35;
    }

    .actions {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
        width: 100%;
        margin-top: 4px;
    }

    .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 44px;
        padding: 0 22px;
        border-radius: 10px;
        color: var(--color-text);
        font-size: 21px;
        text-decoration: none;
    }

    .btn.outline {
        border: 1px solid var(--color-mint);
    }

    .btn:hover {
        filter: brightness(1.15);
    }

    .details {
        align-self: stretch;
        font-size: 16px;
        text-align: left;
        opacity: 0.75;
    }

    .details summary {
        cursor: pointer;
    }

    .details p {
        margin-top: 4px;
        overflow-wrap: anywhere;
    }

    code {
        color: var(--color-mint);
        font-family: ui-monospace, monospace;
        font-size: 15px;
    }
</style>
