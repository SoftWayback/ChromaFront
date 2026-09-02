<script>
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import { loadSession } from "$lib/session.svelte.js";

    // Landing spot the API redirects to after a successful Google login.
    // Confirm the session, then send the user into the app (or back to home).
    onMount(async () => {
        const user = await loadSession();
        goto(user ? "/dashboard" : "/", { replaceState: true });
    });
</script>

<p class="redirecting">Connexion…</p>

<style>
    .redirecting {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #061c15;
        color: #5fefc1;
        font-family: "Agdasima", sans-serif;
        font-size: 20px;
    }
</style>
