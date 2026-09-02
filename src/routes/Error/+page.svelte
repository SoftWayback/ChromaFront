<script>
    import { page } from "$app/state";

    // The API redirects here on a failed login:
    //   /Error?type=<code>&message=<text>
    const type = $derived(page.url.searchParams.get("type") ?? "unknown");
    const message = $derived(
        page.url.searchParams.get("message") ??
            "Une erreur est survenue pendant la connexion."
    );
</script>

<main class="error">
    <h1>Connexion impossible</h1>
    <p class="message">{message}</p>
    <p class="code">Code&nbsp;: {type}</p>
    <a class="retry" href="/">Retour à l'accueil</a>
</main>

<style>
    .error {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        padding: 40px;
        text-align: center;
        background: #061c15;
        color: #ffffff;
        font-family: "Agdasima", sans-serif;
    }

    .error h1 {
        font-size: 48px;
    }

    .message {
        font-size: 22px;
        max-width: 40ch;
    }

    .code {
        color: #e4495c;
        font-size: 18px;
    }

    .retry {
        margin-top: 8px;
        padding: 12px 24px;
        border-radius: 10px;
        background: #5fefc1;
        color: #061c15;
        font-size: 18px;
        text-decoration: none;
    }
</style>
