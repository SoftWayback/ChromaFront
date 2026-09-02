<script>
    import NavSidebar from "$lib/components/NavSidebar.svelte";
</script>

<div class="page">
    <NavSidebar />
    <main class="content">
        <h1>Entités</h1>
        <p class="todo">
            Écran à implémenter d'après Figma — page « chroma v2 », frame
            <code>Gestion entité</code> (node 483:14).
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
