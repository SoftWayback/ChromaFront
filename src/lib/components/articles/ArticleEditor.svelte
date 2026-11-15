<script>
    import { untrack } from "svelte";
    import { beforeNavigate, goto } from "$app/navigation";
    import { downscale } from "$lib/images";
    import {
        COVER_TYPES,
        EXCERPT_SUGGESTED,
        STATUS_LABELS,
        ApiError,
        articleCoverUrl,
        createArticle,
        deleteArticle,
        deleteArticleCover,
        formatDate,
        getArticle,
        slugify,
        updateArticle,
        uploadArticleCover
    } from "$lib/articles";

    /** @typedef {import("$lib/articles").AdminArticle} AdminArticle */
    /** @typedef {import("$lib/articles").ArticleInput} ArticleInput */
    /** @typedef {{ title: string, slug: string, excerpt: string, content: string, status: "draft" | "published" }} Form */

    /** `"new"` opens an empty editor; anything else is an article id. */
    /** @type {{ id: string }} */
    let { id } = $props();

    const MAX_COVER_BYTES = 8 * 1024 * 1024;
    const FORM_KEYS = /** @type {const} */ (["title", "slug", "excerpt", "content", "status"]);
    const STATUSES = /** @type {const} */ (["draft", "published"]);

    /** @type {Form} */
    const EMPTY = { title: "", slug: "", excerpt: "", content: "", status: "draft" };

    /** @type {AdminArticle | null} null until the article exists server-side */
    let article = $state(null);
    /** @type {Form} */
    let form = $state({ ...EMPTY });
    /** @type {Form} last saved values, used for the dirty check */
    let baseline = $state({ ...EMPTY });
    /** slug follows the title until the user edits it by hand */
    let slugAuto = $state(true);

    // avoid flashing the empty "new" form before the first load starts
    let loading = $state(untrack(() => id) !== "new");
    let loadError = $state("");
    let saving = $state(false);
    let error = $state("");
    /** @type {{ title?: string, slug?: string }} */
    let fieldErrors = $state({});
    let notice = $state("");
    let confirmDeleteArticle = $state(false);
    let deletingArticle = $state(false);

    let coverBusy = $state(false);
    let coverError = $state("");
    let confirmRemoveCover = $state(false);
    let dragOver = $state(false);
    /** @type {HTMLInputElement | undefined} */
    let coverInput = $state();

    const isNew = $derived(article === null);
    const dirty = $derived(FORM_KEYS.some((k) => form[k] !== baseline[k]));
    // $derived.by: a closure, so TS doesn't narrow `article` to its `null` initializer
    const coverSrc = $derived.by(() => articleCoverUrl(article?.coverPath));
    const excerptLength = $derived(form.excerpt.length);
    const paragraphs = $derived(form.content.split(/\n\s*\n/).filter((p) => p.trim()).length);
    const words = $derived(form.content.trim() ? form.content.trim().split(/\s+/).length : 0);
    const unpublishing = $derived.by(() => article?.status === "published" && form.status === "draft");

    /** @param {AdminArticle} a @returns {Form} */
    function toForm(a) {
        return {
            title: a.title ?? "",
            slug: a.slug ?? "",
            excerpt: a.excerpt ?? "",
            content: a.content ?? "",
            status: a.status === "published" ? "published" : "draft"
        };
    }

    /** @param {AdminArticle | null} a */
    function reset(a) {
        article = a;
        form = a ? toForm(a) : { ...EMPTY };
        baseline = { ...form };
        // don't silently move the URL of an article that's already out
        slugAuto = !a || (a.status === "draft" && a.slug === slugify(a.title));
        error = "";
        fieldErrors = {};
        notice = "";
        coverError = "";
        confirmRemoveCover = false;
        confirmDeleteArticle = false;
    }

    /** @param {string} articleId */
    async function load(articleId) {
        loading = true;
        loadError = "";
        try {
            const a = await getArticle(articleId);
            if (articleId !== id) return; // navigated elsewhere meanwhile
            if (!a) throw new Error("Article introuvable.");
            reset(a);
        } catch (e) {
            loadError = e instanceof Error ? e.message : String(e);
        } finally {
            loading = false;
        }
    }

    // React to the route param only (the page component is reused when it changes).
    $effect(() => {
        const target = id;
        untrack(() => {
            if (target === "new") {
                if (article !== null) reset(null);
            } else if (article?.id !== target) {
                // skipped right after a create: the URL moves to the new id
                // but we already hold the article
                load(target);
            }
        });
    });

    $effect(() => {
        if (slugAuto) form.slug = slugify(form.title);
    });

    function onSlugInput() {
        slugAuto = false;
        fieldErrors.slug = undefined;
    }

    function regenerateSlug() {
        slugAuto = true;
        form.slug = slugify(form.title);
        fieldErrors.slug = undefined;
    }

    /** Only the fields that changed (everything on create). @returns {ArticleInput} */
    function payload() {
        const snapshot = { ...form, title: form.title.trim(), slug: slugify(form.slug) };
        if (isNew) {
            /** @type {ArticleInput} */
            const body = { title: snapshot.title, excerpt: snapshot.excerpt, content: snapshot.content, status: snapshot.status };
            if (snapshot.slug) body.slug = snapshot.slug;
            return body;
        }
        /** @type {Record<string, string>} */
        const body = {};
        for (const k of FORM_KEYS) if (snapshot[k] !== baseline[k]) body[k] = snapshot[k];
        return /** @type {ArticleInput} */ (body);
    }

    async function save(/** @type {Event} */ event) {
        event.preventDefault();
        if (saving || (!dirty && !isNew)) return;
        error = "";
        fieldErrors = {};
        notice = "";
        if (!form.title.trim()) {
            fieldErrors = { title: "Le titre est obligatoire." };
            return;
        }

        saving = true;
        const sent = { ...form };
        try {
            const wasNew = isNew;
            const saved = wasNew ? await createArticle(payload()) : await updateArticle(/** @type {AdminArticle} */ (article).id, payload());
            const keepAuto = slugAuto;
            const typedMeanwhile = FORM_KEYS.some((k) => form[k] !== sent[k]);
            article = saved;
            baseline = toForm(saved);
            // keep anything typed while the request was in flight
            if (!typedMeanwhile) form = { ...baseline };
            // the backend may have adjusted the slug: stop following the title then
            slugAuto = keepAuto && saved.status === "draft" && saved.slug === slugify(saved.title);
            notice = wasNew ? "Article créé — tu peux maintenant ajouter une couverture." : "Modifications enregistrées.";
            if (wasNew) await goto(`/articles/${saved.id}`, { replaceState: true, noScroll: true, keepFocus: true });
        } catch (e) {
            if (e instanceof ApiError && e.status === 409) {
                fieldErrors = { slug: e.message || "Ce slug est déjà utilisé par un autre article." };
            } else {
                error = e instanceof Error ? e.message : "L'enregistrement a échoué.";
            }
        } finally {
            saving = false;
        }
    }

    function discard() {
        form = { ...baseline };
        slugAuto = !article || (article.status === "draft" && article.slug === slugify(article.title));
        error = "";
        fieldErrors = {};
        notice = "";
    }

    async function removeArticle() {
        if (!article) return;
        deletingArticle = true;
        error = "";
        try {
            await deleteArticle(article.id);
            baseline = { ...form }; // no unsaved-changes prompt on the way out
            await goto("/articles");
        } catch (e) {
            error = e instanceof Error ? e.message : "La suppression a échoué.";
            confirmDeleteArticle = false;
        } finally {
            deletingArticle = false;
        }
    }

    /** @param {FileList | File[] | null | undefined} list */
    async function uploadCover(list) {
        const file = [...(list ?? [])][0];
        if (!file || !article || coverBusy) return;
        coverError = "";
        confirmRemoveCover = false;
        if (!COVER_TYPES.includes(file.type)) {
            coverError = "Format non supporté (JPEG, PNG, WebP ou GIF).";
            return;
        }
        coverBusy = true;
        try {
            const blob = await downscale(file);
            if (blob.size > MAX_COVER_BYTES) throw new Error("Image trop lourde (8 Mo max).");
            const { coverPath } = await uploadArticleCover(article.id, blob);
            article.coverPath = coverPath;
        } catch (e) {
            coverError = e instanceof Error ? e.message : "L'envoi a échoué.";
        } finally {
            coverBusy = false;
        }
    }

    async function removeCover() {
        if (!article) return;
        confirmRemoveCover = false;
        coverBusy = true;
        coverError = "";
        try {
            await deleteArticleCover(article.id);
            article.coverPath = null;
        } catch (e) {
            coverError = e instanceof Error ? e.message : "La suppression a échoué.";
        } finally {
            coverBusy = false;
        }
    }

    function onDrop(/** @type {DragEvent} */ e) {
        e.preventDefault();
        dragOver = false;
        uploadCover(e.dataTransfer?.files);
    }

    beforeNavigate((nav) => {
        if (!dirty || deletingArticle) return;
        // tab close / reload / external link: the browser shows its own prompt
        if (nav.type === "leave") {
            nav.cancel();
            return;
        }
        if (!confirm("Des modifications ne sont pas enregistrées. Quitter quand même ?")) nav.cancel();
    });

    function onKeydown(/** @type {KeyboardEvent} */ e) {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
            e.preventDefault();
            if (!loading && !loadError) save(e);
        }
    }
</script>

<svelte:window onkeydown={onKeydown} />

<a class="back" href="/articles">← Articles</a>

{#if loading}
    <p class="state">Chargement…</p>
{:else if loadError}
    <p class="state error">{loadError}</p>
{:else}
    <header class="head">
        <h1>{isNew ? "Nouvel article" : form.title.trim() || "(Sans titre)"}</h1>
        {#if article}
            <span class="badge {article.status}">{STATUS_LABELS[article.status]}</span>
        {/if}
        {#if dirty}<span class="unsaved">● Non enregistré</span>{/if}
    </header>

    <div class="layout">
        <aside class="side">
            <section class="panel">
                <h2>Couverture</h2>
                {#if isNew}
                    <div class="cover locked">
                        <span class="hint">Enregistre l'article une première fois pour pouvoir ajouter une couverture.</span>
                    </div>
                {:else}
                    <div
                        class="cover"
                        class:drag-over={dragOver}
                        role="region"
                        aria-label="Image de couverture"
                        ondragover={(e) => {
                            e.preventDefault();
                            dragOver = true;
                        }}
                        ondragleave={(e) => {
                            if (!e.currentTarget.contains(/** @type {Node | null} */ (e.relatedTarget))) dragOver = false;
                        }}
                        ondrop={onDrop}
                    >
                        {#if coverSrc}
                            <img src={coverSrc} alt="Couverture de l'article" />
                        {:else}
                            <span class="hint">Glisse une image ici<br />ou utilise le bouton ci-dessous</span>
                        {/if}
                        {#if coverBusy}<div class="overlay">Envoi…</div>{/if}
                        {#if dragOver}<div class="overlay">Dépose pour remplacer</div>{/if}
                    </div>

                    <input
                        bind:this={coverInput}
                        type="file"
                        accept={COVER_TYPES.join(",")}
                        hidden
                        onchange={(e) => {
                            uploadCover(e.currentTarget.files);
                            e.currentTarget.value = "";
                        }}
                    />
                    <div class="cover-actions">
                        <button type="button" class="btn ghost" disabled={coverBusy} onclick={() => coverInput?.click()}>
                            {coverSrc ? "Remplacer" : "Choisir une image"}
                        </button>
                        {#if coverSrc}
                            {#if confirmRemoveCover}
                                <span class="confirm">
                                    Retirer ?
                                    <button type="button" class="link danger" onclick={removeCover}>Oui</button>
                                    <button type="button" class="link" onclick={() => (confirmRemoveCover = false)}>Non</button>
                                </span>
                            {:else}
                                <button type="button" class="link danger" disabled={coverBusy} onclick={() => (confirmRemoveCover = true)}>
                                    Retirer
                                </button>
                            {/if}
                        {/if}
                    </div>
                    <p class="small">JPEG, PNG, WebP ou GIF · enregistrée immédiatement · réduite à 1920 px.</p>
                {/if}
                {#if coverError}<p class="field-error" role="alert">{coverError}</p>{/if}
            </section>

            <section class="panel">
                <h2>Statut</h2>
                <div class="toggle" role="radiogroup" aria-label="Statut">
                    {#each STATUSES as s}
                        <button
                            type="button"
                            role="radio"
                            aria-checked={form.status === s}
                            class="toggle-option {s}"
                            class:active={form.status === s}
                            onclick={() => (form.status = s)}
                        >
                            {STATUS_LABELS[s]}
                        </button>
                    {/each}
                </div>
                <p class="small">
                    {#if unpublishing}
                        L'article sera retiré du site public à l'enregistrement.
                    {:else if form.status === "published" && article?.status !== "published"}
                        L'article sera visible sur le site public à l'enregistrement.
                    {:else if form.status === "published"}
                        Visible sur le site public.
                    {:else}
                        Non visible sur le site public.
                    {/if}
                </p>

                {#if article}
                    <dl class="meta">
                        <dt>Créé</dt>
                        <dd>{formatDate(article.createdAt)}</dd>
                        <dt>Modifié</dt>
                        <dd>{formatDate(article.updatedAt)}</dd>
                        <dt>Publié</dt>
                        <dd>{formatDate(article.publishedAt)}</dd>
                    </dl>
                {/if}
            </section>
        </aside>

        <form class="form" onsubmit={save} novalidate>
            <label class="field">
                <span>Titre</span>
                <input
                    type="text"
                    bind:value={form.title}
                    maxlength="200"
                    placeholder="Titre de l'article"
                    oninput={() => (fieldErrors.title = undefined)}
                />
                {#if fieldErrors.title}<small class="field-error">{fieldErrors.title}</small>{/if}
            </label>

            <label class="field">
                <span class="label-row">
                    Slug
                    {#if slugAuto}
                        <em>généré depuis le titre</em>
                    {:else}
                        <button type="button" class="link small-link" onclick={regenerateSlug}>↻ Regénérer depuis le titre</button>
                    {/if}
                </span>
                <input
                    type="text"
                    bind:value={form.slug}
                    maxlength="120"
                    placeholder="mon-article"
                    spellcheck="false"
                    autocomplete="off"
                    oninput={onSlugInput}
                    onblur={() => {
                        if (!slugAuto) form.slug = slugify(form.slug);
                        if (!form.slug) slugAuto = true;
                    }}
                />
                {#if fieldErrors.slug}
                    <small class="field-error">{fieldErrors.slug}</small>
                {:else if article?.status === "published" && form.slug !== baseline.slug}
                    <small class="warn">Changer le slug d'un article publié casse ses anciens liens.</small>
                {/if}
            </label>

            <label class="field">
                <span class="label-row">
                    Chapô
                    <em class:over={excerptLength > EXCERPT_SUGGESTED}>{excerptLength} / {EXCERPT_SUGGESTED}</em>
                </span>
                <textarea bind:value={form.excerpt} rows="3" placeholder="Résumé affiché dans les listes d'articles"></textarea>
                {#if excerptLength > EXCERPT_SUGGESTED}
                    <small class="warn">Au-delà de ~{EXCERPT_SUGGESTED} caractères, le résumé risque d'être tronqué.</small>
                {/if}
            </label>

            <label class="field">
                <span class="label-row">
                    Contenu
                    <em>{paragraphs} paragraphe{paragraphs > 1 ? "s" : ""} · {words} mot{words > 1 ? "s" : ""}</em>
                </span>
                <textarea class="content" bind:value={form.content} rows="22" placeholder="Premier paragraphe…&#10;&#10;Deuxième paragraphe…"></textarea>
                <small class="hint-text">Texte brut : sépare les paragraphes par une ligne vide (deux retours à la ligne).</small>
            </label>

            <div class="actions">
                <button type="submit" class="btn primary" disabled={saving || (!dirty && !isNew)}>
                    {#if saving}
                        Enregistrement…
                    {:else if isNew}
                        {form.status === "published" ? "Créer et publier" : "Créer le brouillon"}
                    {:else}
                        Enregistrer
                    {/if}
                </button>
                {#if !isNew}
                    <button type="button" class="btn ghost" disabled={!dirty || saving} onclick={discard}>Annuler les modifications</button>
                {/if}
                <span class="kbd">Ctrl+S</span>
                {#if error}<p class="notice bad" role="alert">{error}</p>{:else if notice}<p class="notice">{notice}</p>{/if}
            </div>

            {#if article}
                <div class="danger-zone">
                    {#if confirmDeleteArticle}
                        <span class="confirm">
                            Supprimer définitivement cet article ?
                            <button type="button" class="link danger" disabled={deletingArticle} onclick={removeArticle}>
                                {deletingArticle ? "Suppression…" : "Oui, supprimer"}
                            </button>
                            <button type="button" class="link" onclick={() => (confirmDeleteArticle = false)}>Non</button>
                        </span>
                    {:else}
                        <button type="button" class="link danger" onclick={() => (confirmDeleteArticle = true)}>Supprimer l'article</button>
                    {/if}
                </div>
            {/if}
        </form>
    </div>
{/if}

<style>
    .back {
        color: var(--color-mint);
        font-size: 22px;
        text-decoration: none;
    }

    .back:hover {
        text-decoration: underline;
    }

    .head {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 24px;
        margin: 8px 0 32px;
    }

    h1 {
        min-width: 0;
        overflow: hidden;
        font-size: 64px;
        font-weight: 400;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    h2 {
        margin-bottom: 12px;
        padding-bottom: 6px;
        border-bottom: 1px solid var(--color-mint);
        font-size: 32px;
        font-weight: 400;
    }

    .badge {
        padding: 2px 12px;
        border-radius: 5px;
        font-size: 22px;
    }

    .badge.published {
        border: 1px solid var(--color-mint);
        color: var(--color-mint);
    }

    .badge.draft {
        border: 1px solid var(--color-gold-border);
        color: var(--color-gold-border);
    }

    .unsaved {
        color: var(--color-gold-border);
        font-size: 20px;
    }

    .layout {
        display: grid;
        grid-template-columns: minmax(0, 400px) minmax(0, 1fr);
        gap: 48px;
        align-items: start;
        max-width: 1355px;
    }

    @media (max-width: 1100px) {
        .layout {
            grid-template-columns: 1fr;
        }
    }

    .side {
        display: flex;
        flex-direction: column;
        gap: 32px;
    }

    .panel {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .cover {
        position: relative;
        display: grid;
        place-items: center;
        aspect-ratio: 16 / 9;
        overflow: hidden;
        border: 1px solid var(--color-mint);
        border-radius: 5px;
        background: linear-gradient(180deg, var(--color-surface), var(--color-surface-end));
    }

    .cover.locked {
        padding: 24px;
        border-style: dashed;
        opacity: 0.75;
    }

    .cover.drag-over {
        border-style: dashed;
        border-width: 2px;
    }

    .cover img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .hint {
        color: var(--color-mint);
        font-size: 20px;
        text-align: center;
    }

    .overlay {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        background: rgba(3, 36, 28, 0.75);
        color: var(--color-mint);
        font-size: 26px;
    }

    .cover-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 8px 16px;
    }

    .small {
        font-size: 17px;
        opacity: 0.75;
    }

    .toggle {
        display: grid;
        grid-template-columns: 1fr 1fr;
        overflow: hidden;
        border: 1px solid var(--color-line);
        border-radius: 10px;
    }

    .toggle-option {
        height: 42px;
        border: none;
        background: none;
        color: var(--color-text);
        font-family: inherit;
        font-size: 22px;
        cursor: pointer;
        opacity: 0.7;
    }

    .toggle-option:hover {
        opacity: 1;
    }

    .toggle-option.active {
        opacity: 1;
    }

    .toggle-option.draft.active {
        background: var(--color-gold);
    }

    .toggle-option.published.active {
        background: var(--color-surface-end);
        color: var(--color-mint);
    }

    .meta {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 4px 16px;
        margin-top: 8px;
        font-size: 18px;
    }

    .meta dt {
        color: var(--color-mint);
    }

    .form {
        display: flex;
        flex-direction: column;
        gap: 24px;
    }

    .field {
        display: flex;
        flex-direction: column;
        gap: 6px;
        font-size: 22px;
    }

    .label-row {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
    }

    .label-row em {
        font-style: normal;
        font-size: 18px;
        opacity: 0.6;
    }

    .label-row em.over {
        color: var(--color-gold-border);
        opacity: 1;
    }

    input,
    textarea {
        padding: 8px 10px;
        border: 1px solid var(--color-line);
        border-radius: 5px;
        background: var(--color-surface);
        color: var(--color-text);
        font-family: inherit;
        font-size: 22px;
        color-scheme: dark;
    }

    textarea {
        resize: vertical;
        line-height: 1.35;
    }

    textarea.content {
        min-height: 420px;
    }

    input:focus,
    textarea:focus {
        border-color: var(--color-mint);
        outline: none;
    }

    .field-error {
        color: var(--color-red);
        font-size: 18px;
    }

    .warn {
        color: var(--color-gold-border);
        font-size: 18px;
    }

    .hint-text {
        color: var(--color-mint);
        font-size: 18px;
    }

    .actions {
        position: sticky;
        bottom: 0;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 16px;
        padding: 14px 0;
        background: var(--color-bg);
        border-top: 1px solid var(--color-line);
    }

    .kbd {
        font-size: 16px;
        opacity: 0.5;
    }

    .btn {
        height: 40px;
        padding: 0 22px;
        border-radius: 10px;
        color: var(--color-text);
        font-family: inherit;
        font-size: 22px;
        cursor: pointer;
    }

    .btn:disabled {
        opacity: 0.45;
        cursor: default;
    }

    .btn.primary {
        border: 1px solid var(--color-gold-border);
        background: var(--color-gold);
    }

    .btn.ghost {
        border: 1px solid var(--color-mint);
        background: none;
    }

    .link {
        padding: 0;
        border: none;
        background: none;
        color: var(--color-mint);
        font-family: inherit;
        font-size: 20px;
        cursor: pointer;
    }

    .link:hover {
        text-decoration: underline;
    }

    .link:disabled {
        opacity: 0.6;
        cursor: progress;
    }

    .link.danger {
        color: var(--color-red);
    }

    .small-link {
        font-size: 18px;
    }

    .confirm {
        display: inline-flex;
        flex-wrap: wrap;
        gap: 10px;
        font-size: 20px;
    }

    .notice {
        color: var(--color-mint);
        font-size: 20px;
    }

    .notice.bad {
        color: var(--color-red);
    }

    .danger-zone {
        padding-top: 8px;
    }

    .state {
        padding: 16px 0;
        font-size: 24px;
        color: var(--color-mint);
    }

    .state.error {
        color: var(--color-red);
    }
</style>
