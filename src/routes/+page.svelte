<script>
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import { isAuthenticated } from "$lib/api";
    import Sidebar from "$lib/components/Sidebar.svelte";
    import HeroImage from "$lib/components/HeroImage.svelte";

    // Already signed in (valid or refreshable session): straight to the app.
    let checking = $state(true);

    onMount(async () => {
        if (await isAuthenticated()) goto("/dashboard", { replaceState: true });
        else checking = false;
    });
</script>

<svelte:head>
    <title>Chroma — administration</title>
</svelte:head>

<div class="signin-page">
    <Sidebar {checking} />
    <HeroImage />
</div>

<style>
    .signin-page {
        display: grid;
        grid-template-columns: minmax(0, 5fr) minmax(0, 8fr);
        min-height: 100vh;
        background: var(--color-bg);
    }

    @media (max-width: 1100px) {
        .signin-page {
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        }
    }

    @media (max-width: 767px) {
        .signin-page {
            grid-template-columns: minmax(0, 1fr);
        }
    }
</style>
