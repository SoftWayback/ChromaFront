<script>
    import { onMount } from "svelte";
    import NavSidebar from "$lib/components/NavSidebar.svelte";
    import {
        STATUS_LABELS,
        articleCoverUrl,
        deleteArticle,
        formatDate,
        listArticles
    } from "$lib/articles";

    /** @typedef {import("$lib/articles").AdminArticle} AdminArticle */

    /** @type {AdminArticle[]} */
    let articles = $state([]);
    let loading = $state(true);
    let error = $state("");
    /** @type {string | null} article waiting for delete confirmation */
    let confirmDelete = $state(null);
    /** @type {string | null} article being deleted */
    let deleting = $state(null);

    /** @type {"all" | "draft" | "published"} */
    let filter = $state("all");

    const filters = /** @type {const} */ ([
        { key: "all", label: "Tous" },
        { key: "draft", label: "Brouillons" },
        { key: "published", label: "Publiés" }
    ]);

    // most recently edited first
    const visible = $derived(
        articles
            .filter((a) => filter === "all" || a.status === filter)
            .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
    );

    /** @param {"all" | "draft" | "published"} key */
    const count = (key) => (key === "all" ? articles.length : articles.filter((a) => a.status === key).length);

    onMount(async () => {
        try {
            articles = await listArticles();
        } catch (e) {
            error = e instanceof Error ? e.message : "Impossible de charger les articles.";
        } finally {
            loading = false;
        }
    });

    /** @param {AdminArticle} article */
    async function remove(article) {
        confirmDelete = null;
        deleting = article.id;
        error = "";
        try {
            await deleteArticle(article.id);
            articles = articles.filter((a) => a.id !== article.id);
        } catch (e) {
            error = e instanceof Error ? e.message : "La suppression a échoué.";
        } finally {
            deleting = null;
        }
    }
</script>

<div class="page">
    <NavSidebar />

    <main class="content">
        <header class="head">
            <h1>Articles</h1>
            <a class="btn primary" href="/articles/new">+ Nouvel article</a>
        </header>

        {#if !loading && articles.length}
            <div class="filters">
                <span>Filtre</span>
                <span class="separator" aria-hidden="true"></span>
                {#each filters as f}
                    <button
                        type="button"
                        class="chip"
                        class:active={filter === f.key}
                        aria-pressed={filter === f.key}
                        onclick={() => (filter = f.key)}
                    >
                        {f.label} <span class="chip-count">{count(f.key)}</span>
                    </button>
                {/each}
            </div>
        {/if}

        {#if error}<p class="state error" role="alert">{error}</p>{/if}

        {#if loading}
            <p class="state">Chargement…</p>
        {:else if !articles.length && !error}
            <div class="empty">
                <p>Aucun article pour l'instant.</p>
                <p class="empty-hint">Les articles publiés apparaissent sur le site public (TimeFront).</p>
                <a class="btn primary" href="/articles/new">Écrire le premier article</a>
            </div>
        {:else if articles.length && !visible.length}
            <p class="state">Aucun article dans ce filtre.</p>
        {:else if visible.length}
            <ul class="list">
                {#each visible as article, i (article.id)}
                    {@const cover = articleCoverUrl(article.coverPath)}
                    <li class="item" class:alt={i % 2 === 1}>
                        <a class="thumb" href="/articles/{article.id}" tabindex="-1" aria-hidden="true">
                            {#if cover}
                                <img src={cover} alt="" loading="lazy" />
                            {:else}
                                <span class="no-cover">Pas de couverture</span>
                            {/if}
                        </a>

                        <div class="main">
                            <a class="title" href="/articles/{article.id}">{article.title || "(Sans titre)"}</a>
                            <span class="slug">/{article.slug}</span>
                            <span class="dates">
                                {#if article.status === "published"}
                                    Publié le {formatDate(article.publishedAt)} ·
                                {/if}
                                Modifié le {formatDate(article.updatedAt)} · Créé le {formatDate(article.createdAt)}
                            </span>
                        </div>

                        <span class="badge {article.status}">{STATUS_LABELS[article.status] ?? article.status}</span>

                        <div class="actions">
                            {#if confirmDelete === article.id}
                                <span class="confirm">
                                    Supprimer définitivement ?
                                    <button type="button" class="link danger" onclick={() => remove(article)}>Oui</button>
                                    <button type="button" class="link" onclick={() => (confirmDelete = null)}>Non</button>
                                </span>
                            {:else}
                                <a class="link" href="/articles/{article.id}">Modifier</a>
                                <button
                                    type="button"
                                    class="link danger"
                                    disabled={deleting === article.id}
                                    onclick={() => (confirmDelete = article.id)}
                                >
                                    {deleting === article.id ? "Suppression…" : "Supprimer"}
                                </button>
                            {/if}
                        </div>
                    </li>
                {/each}
            </ul>
        {/if}
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
        padding: 36px 82px 64px 76px;
        color: var(--color-text);
        font-family: "Agdasima", sans-serif;
    }

    .head {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        max-width: 1355px;
        margin-bottom: 40px;
    }

    h1 {
        font-size: 64px;
        font-weight: 400;
    }

    .btn {
        display: inline-flex;
        align-items: center;
        height: 40px;
        padding: 0 22px;
        border-radius: 10px;
        color: var(--color-text);
        font-family: inherit;
        font-size: 22px;
        text-decoration: none;
        cursor: pointer;
    }

    .btn.primary {
        border: 1px solid var(--color-gold-border);
        background: var(--color-gold);
    }

    .btn.primary:hover {
        filter: brightness(1.15);
    }

    .filters {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 15px;
        margin-bottom: 32px;
        font-size: 24px;
    }

    .separator {
        width: 1px;
        height: 45px;
        background: var(--color-red);
    }

    .chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 30px;
        padding: 0 10px;
        border: 2px solid var(--color-text);
        border-radius: 5px;
        background: none;
        color: var(--color-text);
        font-family: inherit;
        font-size: 24px;
        line-height: 1;
        cursor: pointer;
    }

    .chip.active {
        border-color: var(--color-mint);
        color: var(--color-mint);
    }

    .chip-count {
        opacity: 0.6;
        font-size: 20px;
    }

    .list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-width: 1355px;
    }

    .item {
        display: grid;
        grid-template-columns: 160px minmax(0, 1fr) auto auto;
        gap: 24px;
        align-items: center;
        padding: 10px 16px;
        margin: 0 -16px;
        background: linear-gradient(90deg, #007445, var(--color-bg));
    }

    .item.alt {
        background: linear-gradient(90deg, #004227, var(--color-bg));
    }

    .thumb {
        display: grid;
        place-items: center;
        aspect-ratio: 16 / 9;
        overflow: hidden;
        border: 1px solid var(--color-line);
        border-radius: 5px;
        background: var(--color-surface);
    }

    .thumb img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .no-cover {
        color: var(--color-mint);
        font-size: 16px;
        opacity: 0.7;
    }

    .main {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
    }

    .title {
        overflow: hidden;
        color: var(--color-text);
        font-size: 30px;
        text-decoration: none;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .title:hover {
        color: var(--color-mint);
    }

    .slug {
        overflow: hidden;
        color: var(--color-mint);
        font-size: 18px;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .dates {
        font-size: 17px;
        opacity: 0.7;
    }

    .badge {
        padding: 2px 12px;
        border-radius: 5px;
        font-size: 20px;
        white-space: nowrap;
    }

    .badge.published {
        border: 1px solid var(--color-mint);
        color: var(--color-mint);
    }

    .badge.draft {
        border: 1px solid var(--color-gold-border);
        color: var(--color-gold-border);
    }

    .actions {
        display: flex;
        align-items: center;
        gap: 18px;
        min-width: 170px;
        justify-content: flex-end;
    }

    .confirm {
        display: inline-flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 10px;
        font-size: 20px;
    }

    .link {
        padding: 0;
        border: none;
        background: none;
        color: var(--color-mint);
        font-family: inherit;
        font-size: 22px;
        text-decoration: none;
        cursor: pointer;
    }

    .link:hover {
        text-decoration: underline;
    }

    .link.danger {
        color: var(--color-red);
    }

    .link:disabled {
        opacity: 0.6;
        cursor: progress;
    }

    .empty {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
        max-width: 1355px;
        padding: 40px;
        border: 1px dashed var(--color-mint);
        border-radius: 10px;
        font-size: 28px;
    }

    .empty-hint {
        color: var(--color-mint);
        font-size: 20px;
        margin-bottom: 8px;
    }

    .state {
        padding: 16px 0;
        font-size: 24px;
        color: var(--color-mint);
    }

    .state.error {
        color: var(--color-red);
    }

    @media (max-width: 900px) {
        .content {
            padding: 24px;
        }

        .item {
            grid-template-columns: 110px minmax(0, 1fr);
        }

        .badge,
        .actions {
            justify-self: start;
        }

        .actions {
            min-width: 0;
        }
    }
</style>
