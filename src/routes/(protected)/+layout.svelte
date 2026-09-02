<script>
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import { loadSession } from "$lib/session.svelte.js";

    let { children } = $props();

    /** @type {"checking" | "ok"} */
    let state = $state("checking");

    onMount(async () => {
        if (await loadSession()) {
            state = "ok";
        } else {
            goto("/", { replaceState: true });
        }
    });
</script>

{#if state === "ok"}
    {@render children()}
{:else}
    <p class="auth-checking">Vérification de la session…</p>
{/if}

<style>
    .auth-checking {
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
