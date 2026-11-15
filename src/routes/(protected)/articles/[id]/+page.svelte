<script>
    import { page } from "$app/state";
    import NavSidebar from "$lib/components/NavSidebar.svelte";
    import ArticleEditor from "$lib/components/articles/ArticleEditor.svelte";

    // `/articles/new` creates; `/articles/<id>` edits. A single route (rather
    // than a separate `new/` folder) keeps the editor mounted when the URL
    // switches to the new id after the first save.
</script>

<div class="page">
    <NavSidebar />

    <main class="content">
        <ArticleEditor id={page.params.id ?? "new"} />
    </main>
</div>

<style>
    .page {
        display: flex;
        min-height: 100vh;
        background: var(--color-bg);
    }

    .content {
        flex: 1;
        min-width: 0;
        padding: 36px 82px 0 76px;
        color: var(--color-text);
        font-family: "Agdasima", sans-serif;
    }

    @media (max-width: 900px) {
        .content {
            padding: 24px 24px 0;
        }
    }
</style>
