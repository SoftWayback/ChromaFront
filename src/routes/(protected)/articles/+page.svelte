<script>
    import NavSidebar from "$lib/components/NavSidebar.svelte";
</script>

<div class="page">
    <NavSidebar />
    <main class="content">
        <h1>Articles</h1>
        <p class="todo">
            Écran « Gestion Article » — pas encore maquetté dans Figma (page
            « chroma v2 »). Route en place pour la navigation.
        </p>
    </main>
</div>

<style>
    .page {
        display: flex;
        min-height: 100vh;
    }

    .content {
        flex: 1;
        padding: 55px;
        background: #061c15;
        color: #ffffff;
        font-family: "Agdasima", sans-serif;
    }

    .content h1 {
        font-size: 64px;
        margin-bottom: 16px;
    }

    .todo {
        color: #5fefc1;
        font-size: 20px;
    }
</style>
