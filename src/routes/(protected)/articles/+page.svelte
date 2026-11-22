<script>
    import { onMount } from "svelte";
    import NavSidebar from "$lib/components/NavSidebar.svelte";
    import {
        STATUS_LABELS,
        articleCoverUrl,
        articleSiteUrl,
        deleteArticle,
        formatDate,
        listArticles
    } from "$lib/articles";

    /** @typedef {import("$lib/articles").AdminArticle} AdminArticle */
    /** @typedef {"updated" | "created" | "published" | "title"} SortKey */

    /** @type {AdminArticle[]} */
    let articles = $state([]);
    let loading = $state(true);
    let loadError = $state("");
    let error = $state("");
    /** @type {string | null} article waiting for delete confirmation */
    let confirmDelete = $state(null);
    /** @type {string | null} article being deleted */
    let deleting = $state(null);

    /** @type {"all" | "draft" | "published"} */
    let filter = $state("all");
    let search = $state("");
    /** @type {SortKey} */
    let sortKey = $state("updated");

    const FILTERS = /** @type {const} */ ([
        { key: "all", label: "Tous" },
        { key: "draft", label: "Brouillons" },
        { key: "published", label: "Publiés" }
    ]);

    const SORTS = /** @type {{ key: SortKey, label: string }[]} */ ([
        { key: "updated", label: "Dernière modification" },
        { key: "created", label: "Date de création" },
        { key: "published", label: "Date de publication" },
        { key: "title", label: "Titre (A → Z)" }
    ]);

    /** @param {string} s */
    const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

    /** @type {Record<SortKey, (a: AdminArticle, b: AdminArticle) => number>} */
    const COMPARE = {
        updated: (a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
        created: (a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
        // drafts (no publishedAt) last
        published: (a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""),
        title: (a, b) => (a.title || "").localeCompare(b.title || "", "fr", { numeric: true })
    };

    const visible = $derived.by(() => {
        const q = norm(search.trim());
        return articles
            .filter((a) => filter === "all" || a.status === filter)
            .filter((a) => !q || norm(`${a.title} ${a.slug}`).includes(q))
            .sort((a, b) => COMPARE[sortKey](a, b) || COMPARE.updated(a, b));
    });

    /** @param {"all" | "draft" | "published"} key */
    const count = (key) => (key === "all" ? articles.length : articles.filter((a) => a.status === key).length);

    async function load() {
        loading = true;
        loadError = "";
        try {
            articles = await listArticles();
        } catch (e) {
            loadError = e instanceof Error ? e.message : "Impossible de charger les articles.";
        } finally {
            loading = false;
        }
    }

    onMount(load);

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

    function resetFilters() {
        search = "";
        filter = "all";
    }
</script>

<div class="page">
    <NavSidebar />

    <main class="content">
        <header class="head">
            <div>
                <h1>Articles</h1>
                {#if articles.length}
                    <p class="counts">
                        {count("published")} publié{count("published") > 1 ? "s" : ""} · {count("draft")} brouillon{count("draft") > 1 ? "s" : ""}
                    </p>
                {/if}
            </div>
            <a class="btn primary" href="/articles/new">+ Nouvel article</a>
        </header>

        {#if loading}
            <p class="state"><span class="spinner" aria-hidden="true"></span> Chargement…</p>
        {:else if loadError}
            <div class="banner error" role="alert">
                <span>{loadError}</span>
                <button type="button" class="btn outline" onclick={load}>Réessayer</button>
            </div>
        {:else if !articles.length}
            <div class="empty">
                <p>Aucun article pour l'instant.</p>
                <p class="empty-hint">Les articles publiés apparaissent sur le site public (rubrique Articles).</p>
                <a class="btn primary" href="/articles/new">Écrire le premier article</a>
            </div>
        {:else}
            <div class="toolbar">
                <input
                    type="search"
                    class="search"
                    placeholder="Rechercher un titre ou un slug…"
                    aria-label="Rechercher un article"
                    bind:value={search}
                />
                <div class="filters" role="group" aria-label="Statut">
                    {#each FILTERS as f}
                        <button
                            type="button"
                            class="chip"
                            class:active={filter === f.key}
                            aria-pressed={filter === f.key}
                            onclick={() => (filter = f.key)}
                        >
                            {f.label}&nbsp;<span class="chip-count">{count(f.key)}</span>
                        </button>
                    {/each}
                </div>
                <label class="sort">
                    <span>Tri</span>
                    <select bind:value={sortKey}>
                        {#each SORTS as s}<option value={s.key}>{s.label}</option>{/each}
                    </select>
                </label>
            </div>

            {#if error}<p class="banner error" role="alert">{error}</p>{/if}

            {#if !visible.length}
                <div class="empty">
                    <p>Aucun article ne correspond.</p>
                    <button type="button" class="btn outline" onclick={resetFilters}>Réinitialiser les filtres</button>
                </div>
            {:else}
                <ul class="cards">
                    {#each visible as article (article.id)}
                        {@const cover = articleCoverUrl(article.coverPath)}
                        {@const site = article.status === "published" ? articleSiteUrl(article.slug) : null}
                        <li class="card" class:busy={deleting === article.id}>
                            <a class="thumb" href="/articles/{article.id}" tabindex="-1" aria-hidden="true">
                                {#if cover}
                                    <img src={cover} alt="" loading="lazy" />
                                {:else}
                                    <span class="no-cover">Pas de couverture</span>
                                {/if}
                                <span class="badge {article.status}">{STATUS_LABELS[article.status] ?? article.status}</span>
                            </a>

                            <div class="body">
                                <a class="title" href="/articles/{article.id}">{article.title || "(Sans titre)"}</a>
                                <span class="slug">/{article.slug}</span>
                                {#if article.excerpt}<p class="excerpt">{article.excerpt}</p>{/if}
                                <dl class="dates">
                                    {#if article.status === "published"}
                                        <div><dt>Publié</dt><dd>{formatDate(article.publishedAt)}</dd></div>
                                    {/if}
                                    <div><dt>Modifié</dt><dd>{formatDate(article.updatedAt)}</dd></div>
                                    <div><dt>Créé</dt><dd>{formatDate(article.createdAt)}</dd></div>
                                </dl>
                            </div>

                            <div class="actions">
                                {#if confirmDelete === article.id}
                                    <span class="confirm">
                                        Supprimer définitivement ?
                                        <button type="button" class="link danger" onclick={() => remove(article)}>Oui</button>
                                        <button type="button" class="link" onclick={() => (confirmDelete = null)}>Non</button>
                                    </span>
                                {:else}
                                    <a class="link" href="/articles/{article.id}">Modifier</a>
                                    {#if site}
                                        <a class="link" href={site} target="_blank" rel="noopener noreferrer">Voir ↗</a>
                                    {/if}
                                    <button
                                        type="button"
                                        class="link danger push"
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
        margin-bottom: 24px;
    }

    h1 {
        font-size: 64px;
        font-weight: 400;
    }

    .counts {
        color: var(--color-mint);
        font-size: 22px;
    }

    .toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px 14px;
        max-width: 1355px;
        margin-bottom: 20px;
    }

    .search,
    select {
        height: 40px;
        padding: 0 10px;
        border: 1px solid var(--color-line);
        border-radius: 5px;
        background: var(--color-surface);
        color: var(--color-text);
        font-family: inherit;
        font-size: 20px;
        color-scheme: dark;
    }

    .search {
        flex: 1 1 260px;
        min-width: 0;
    }

    .search:focus,
    select:focus {
        border-color: var(--color-mint);
        outline: none;
    }

    .filters {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .sort {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        font-size: 20px;
    }

    .sort select {
        min-width: 0;
    }

    .chip {
        display: inline-flex;
        align-items: center;
        height: 40px;
        padding: 0 14px;
        border: 1px solid var(--color-line);
        border-radius: 10px;
        background: none;
        color: var(--color-text);
        font-family: inherit;
        font-size: 20px;
        cursor: pointer;
    }

    .chip.active {
        border-color: var(--color-mint);
        background: rgba(95, 239, 193, 0.12);
        color: var(--color-mint);
    }

    .chip-count {
        opacity: 0.7;
    }

    .cards {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
        gap: 20px;
        max-width: 1355px;
    }

    .card {
        display: flex;
        flex-direction: column;
        min-width: 0;
        overflow: hidden;
        border: 1px solid var(--color-line);
        border-radius: 5px;
        background: var(--color-surface);
        transition: border-color 0.12s;
    }

    .card:hover,
    .card:focus-within {
        border-color: var(--color-mint);
    }

    .card.busy {
        opacity: 0.6;
    }

    .thumb {
        position: relative;
        display: grid;
        place-items: center;
        aspect-ratio: 16 / 9;
        overflow: hidden;
        background: linear-gradient(180deg, var(--color-surface), var(--color-surface-end));
    }

    .thumb img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .no-cover {
        color: var(--color-mint);
        font-size: 18px;
        opacity: 0.7;
    }

    .badge {
        position: absolute;
        top: 10px;
        left: 10px;
        padding: 1px 10px;
        border-radius: 5px;
        background: rgba(3, 36, 28, 0.85);
        font-size: 18px;
    }

    .badge.published {
        border: 1px solid var(--color-mint);
        color: var(--color-mint);
    }

    .badge.draft {
        border: 1px solid var(--color-gold-border);
        color: var(--color-gold-border);
    }

    .body {
        display: flex;
        flex: 1;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
        padding: 12px 16px 4px;
    }

    .title {
        color: var(--color-text);
        font-size: 28px;
        line-height: 1.1;
        text-decoration: none;
        overflow-wrap: anywhere;
    }

    .title:hover {
        color: var(--color-mint);
    }

    .slug {
        overflow: hidden;
        color: var(--color-mint);
        font-size: 16px;
        text-overflow: ellipsis;
        white-space: nowrap;
        opacity: 0.8;
    }

    .excerpt {
        display: -webkit-box;
        overflow: hidden;
        margin-top: 4px;
        font-size: 18px;
        line-height: 1.3;
        opacity: 0.85;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 3;
        line-clamp: 3;
    }

    .dates {
        display: flex;
        flex-wrap: wrap;
        gap: 2px 14px;
        margin-top: auto;
        padding-top: 8px;
        font-size: 16px;
    }

    .dates div {
        display: flex;
        gap: 4px;
    }

    .dates dt {
        color: var(--color-mint);
    }

    .dates dd {
        opacity: 0.8;
    }

    .actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 18px;
        padding: 10px 16px 14px;
    }

    .push {
        margin-left: auto;
    }

    .confirm {
        display: inline-flex;
        flex-wrap: wrap;
        gap: 10px;
        font-size: 19px;
    }

    .btn {
        display: inline-flex;
        align-items: center;
        gap: 10px;
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

    .btn.outline {
        border: 1px solid var(--color-mint);
        background: none;
    }

    .btn:hover {
        filter: brightness(1.15);
    }

    .link {
        padding: 0;
        border: none;
        background: none;
        color: var(--color-mint);
        font-family: inherit;
        font-size: 20px;
        text-decoration: none;
        cursor: pointer;
    }

    .link:hover:not(:disabled) {
        text-decoration: underline;
    }

    .link.danger {
        color: var(--color-red);
    }

    .link:disabled {
        opacity: 0.6;
        cursor: progress;
    }

    .banner {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px;
        max-width: 1355px;
        margin-bottom: 16px;
        padding: 12px 18px;
        border-radius: 5px;
        font-size: 22px;
    }

    .banner.error {
        border: 1px solid var(--color-red);
        color: var(--color-red);
    }

    .empty {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 12px;
        max-width: 1355px;
        padding: 32px;
        border: 1px dashed var(--color-mint);
        border-radius: 10px;
        font-size: 26px;
    }

    .empty-hint {
        margin-bottom: 8px;
        color: var(--color-mint);
        font-size: 20px;
    }

    .state {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 16px 0;
        color: var(--color-mint);
        font-size: 22px;
    }

    .spinner {
        display: inline-block;
        width: 16px;
        height: 16px;
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

        .card {
            transition: none;
        }
    }

    @media (max-width: 900px) {
        .content {
            padding: 24px;
        }
    }

    @media (max-width: 575px) {
        .content {
            padding: 16px 12px 40px;
        }

        h1 {
            font-size: 48px;
        }

        .empty {
            padding: 20px;
        }
    }
</style>
