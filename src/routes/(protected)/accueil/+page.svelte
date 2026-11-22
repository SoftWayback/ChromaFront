<script>
    import { onMount } from "svelte";
    import NavSidebar from "$lib/components/NavSidebar.svelte";
    import { downscale } from "$lib/images";
    import { formatDate } from "$lib/articles";
    import {
        ALT_MAX,
        CARD_HEIGHT,
        CARD_WIDTH,
        HOME_CARD_LABELS,
        HOME_CARD_MAX_BYTES,
        HOME_CARD_TYPES,
        deleteHomeCardCover,
        homeCardImageUrl,
        imageSize,
        listHomeCards,
        updateHomeCardAlt,
        uploadHomeCardCover
    } from "$lib/home-cards";

    /** @typedef {import("$lib/home-cards").HomeCard} HomeCard */
    /** @typedef {import("$lib/home-cards").HomeCardSlug} HomeCardSlug */

    /**
     * A card plus its per-panel UI state.
     * @typedef {HomeCard & {
     *   busy: boolean, error: string, warning: string, confirmReset: boolean,
     *   altDraft: string, altSaving: boolean, altSaved: boolean, altError: string
     * }} CardItem
     */

    /** @param {unknown} e @param {string} fallback */
    const message = (e, fallback) => (e instanceof Error && e.message ? e.message : fallback);

    const ORDER = /** @type {HomeCardSlug[]} */ (Object.keys(HOME_CARD_LABELS));

    /** @type {CardItem[]} */
    let items = $state([]);
    let loading = $state(true);
    let loadError = $state("");

    /** Hidden file inputs, one per card. */
    /** @type {Record<string, HTMLInputElement>} */
    const inputs = {};

    /** @param {HomeCard} card @returns {CardItem} */
    function toItem(card) {
        return {
            ...card,
            busy: false,
            error: "",
            warning: "",
            confirmReset: false,
            altDraft: card.alt ?? "",
            altSaving: false,
            altSaved: false,
            altError: ""
        };
    }

    async function load() {
        loading = true;
        loadError = "";
        try {
            const cards = await listHomeCards();
            items = [...cards]
                .sort((a, b) => ORDER.indexOf(a.slug) - ORDER.indexOf(b.slug))
                .map(toItem);
        } catch (e) {
            loadError = message(e, "Impossible de charger les cartes.");
        } finally {
            loading = false;
        }
    }

    /**
     * @param {CardItem} item
     * @param {FileList | null} list
     */
    async function upload(item, list) {
        const file = list?.[0];
        if (!file || item.busy) return;
        item.error = "";
        item.warning = "";
        item.confirmReset = false;
        if (!HOME_CARD_TYPES.includes(file.type)) {
            item.error = "Format non supporté (JPEG, PNG ou WebP).";
            return;
        }
        item.busy = true;
        try {
            const size = await imageSize(file);
            if (size && size.width > size.height) {
                item.warning = "Image en paysage : elle sera fortement recadrée dans la carte (format portrait).";
            } else if (size && size.width < CARD_WIDTH) {
                item.warning = `Image étroite (${size.width} px de large) : elle risque d'être floue sur le site.`;
            }
            const blob = await downscale(file);
            if (blob.size > HOME_CARD_MAX_BYTES) throw new Error("Image trop lourde (8 Mo max).");
            const { coverPath } = await uploadHomeCardCover(item.slug, blob);
            item.coverPath = coverPath;
            item.updatedAt = new Date().toISOString();
        } catch (e) {
            item.error = message(e, "L'envoi a échoué.");
        } finally {
            item.busy = false;
        }
    }

    /** @param {CardItem} item */
    async function resetCover(item) {
        item.confirmReset = false;
        item.busy = true;
        item.error = "";
        item.warning = "";
        try {
            await deleteHomeCardCover(item.slug);
            item.coverPath = null;
            item.updatedAt = new Date().toISOString();
        } catch (e) {
            item.error = message(e, "La suppression a échoué.");
        } finally {
            item.busy = false;
        }
    }

    /** @param {CardItem} item */
    const altDirty = (item) => item.altDraft.trim() !== (item.alt ?? "");

    /** @param {CardItem} item */
    async function saveAlt(item) {
        if (item.altSaving || !altDirty(item) || item.altDraft.length > ALT_MAX) return;
        item.altSaving = true;
        item.altSaved = false;
        item.altError = "";
        try {
            const value = item.altDraft.trim();
            const updated = await updateHomeCardAlt(item.slug, value || null);
            item.alt = updated?.alt ?? (value || null);
            item.altDraft = item.alt ?? "";
            if (updated?.updatedAt) item.updatedAt = updated.updatedAt;
            item.altSaved = true;
        } catch (e) {
            item.altError = message(e, "L'enregistrement a échoué.");
        } finally {
            item.altSaving = false;
        }
    }

    onMount(load);
</script>

<div class="page">
    <NavSidebar />

    <main class="content">
        <header class="head">
            <h1>Page d'accueil</h1>
        </header>

        <p class="hint">
            Images des 5 cartes « Voir » de la page d'accueil du site public. Sans image personnalisée, une carte garde
            l'image intégrée au site. Les changements apparaissent sur le site public en une minute environ (cache public
            de 60 s).
        </p>

        {#if loading}
            <p class="state"><span class="spinner" aria-hidden="true"></span> Chargement…</p>
        {:else if loadError}
            <div class="banner error" role="alert">
                <span>{loadError}</span>
                <button type="button" class="btn outline" onclick={load}>Réessayer</button>
            </div>
        {:else if !items.length}
            <p class="state">Aucune carte renvoyée par le serveur.</p>
        {:else}
            <p class="meta">
                Format portrait conseillé ({CARD_WIDTH} × {CARD_HEIGHT} px ou plus, ratio ≈ 0,59) · JPEG, PNG ou WebP ·
                réduite à 1920 px et enregistrée immédiatement.
            </p>

            <div class="cards">
                {#each items as item (item.slug)}
                    {@const src = homeCardImageUrl(item.coverPath)}
                    {@const label = HOME_CARD_LABELS[item.slug] ?? item.slug}
                    <section class="panel" aria-labelledby="card-{item.slug}">
                        <h2 id="card-{item.slug}">{label}</h2>

                        <div class="preview" class:default={!src}>
                            {#if src}
                                <img {src} alt={item.alt || `Image de la carte ${label}`} />
                            {:else}
                                <span class="default-label">Image par défaut du site</span>
                            {/if}
                            {#if item.busy}
                                <div class="overlay"><span class="spinner" aria-hidden="true"></span> Envoi…</div>
                            {/if}
                        </div>

                        <p class="small">
                            {src ? "Image personnalisée" : "Aucune image personnalisée"}
                            {#if item.updatedAt}· modifiée le {formatDate(item.updatedAt)}{/if}
                        </p>

                        <input
                            bind:this={inputs[item.slug]}
                            type="file"
                            accept={HOME_CARD_TYPES.join(",")}
                            hidden
                            onchange={(e) => {
                                upload(item, e.currentTarget.files);
                                e.currentTarget.value = "";
                            }}
                        />
                        <div class="actions">
                            <button
                                type="button"
                                class="btn primary"
                                disabled={item.busy}
                                onclick={() => inputs[item.slug]?.click()}
                            >
                                Changer l'image
                            </button>
                            {#if src}
                                {#if item.confirmReset}
                                    <span class="confirm">
                                        Revenir à l'image par défaut ?
                                        <button type="button" class="link danger" onclick={() => resetCover(item)}>Oui</button>
                                        <button type="button" class="link" onclick={() => (item.confirmReset = false)}>Non</button>
                                    </span>
                                {:else}
                                    <button
                                        type="button"
                                        class="link danger"
                                        disabled={item.busy}
                                        onclick={() => (item.confirmReset = true)}
                                    >
                                        Revenir à l'image par défaut
                                    </button>
                                {/if}
                            {/if}
                        </div>
                        <div aria-live="polite">
                            {#if item.error}<p class="field-error" role="alert">{item.error}</p>{/if}
                            {#if item.warning}<p class="warn">{item.warning}</p>{/if}
                        </div>

                        <div class="alt">
                            <div class="label-row">
                                <label for="alt-{item.slug}">Texte alternatif</label>
                                <em class:over={item.altDraft.length > ALT_MAX}>{item.altDraft.length} / {ALT_MAX}</em>
                            </div>
                            <textarea
                                id="alt-{item.slug}"
                                rows="3"
                                maxlength={ALT_MAX}
                                placeholder="Ex. : Silver Star au coucher du soleil"
                                bind:value={item.altDraft}
                                oninput={() => {
                                    item.altSaved = false;
                                    item.altError = "";
                                }}
                            ></textarea>
                            <div class="alt-actions">
                                <button
                                    type="button"
                                    class="btn outline"
                                    disabled={item.altSaving || !altDirty(item) || item.altDraft.length > ALT_MAX}
                                    onclick={() => saveAlt(item)}
                                >
                                    {#if item.altSaving}<span class="spinner" aria-hidden="true"></span>{/if}
                                    Enregistrer
                                </button>
                                <span aria-live="polite">
                                    {#if item.altError}
                                        <span class="field-error" role="alert">{item.altError}</span>
                                    {:else if item.altSaved}
                                        <span class="saved">Enregistré</span>
                                    {:else if altDirty(item)}
                                        <span class="small">Non enregistré</span>
                                    {/if}
                                </span>
                            </div>
                        </div>
                    </section>
                {/each}
            </div>

            <p class="meta alt-help">
                Le texte alternatif décrit l'image pour les personnes qui utilisent un lecteur d'écran, et s'affiche si
                l'image ne charge pas ; il aide aussi le référencement. Décris ce que montre la photo en une phrase courte.
                Laissé vide, le site utilise sa description par défaut.
            </p>
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
        max-width: 1355px;
        margin-bottom: 8px;
    }

    h1 {
        font-size: 64px;
        font-weight: 400;
    }

    h2 {
        color: var(--color-mint);
        font-size: 30px;
        font-weight: 400;
    }

    .hint {
        max-width: 1355px;
        margin-bottom: 20px;
        color: var(--color-mint);
        font-size: 18px;
        opacity: 0.8;
    }

    .meta {
        max-width: 1355px;
        margin-bottom: 20px;
        font-size: 18px;
        opacity: 0.85;
    }

    .alt-help {
        margin-top: 24px;
    }

    .cards {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr));
        gap: 20px;
        max-width: 1355px;
    }

    .panel {
        display: flex;
        flex-direction: column;
        gap: 12px;
        min-width: 0;
        padding: 16px;
        border: 1px solid var(--color-mint);
        border-radius: 5px;
        background: var(--color-surface);
    }

    .preview {
        position: relative;
        display: grid;
        place-items: center;
        width: 100%;
        max-width: 320px;
        margin: 0 auto;
        aspect-ratio: 616 / 1040;
        overflow: hidden;
        border: 1px solid var(--color-mint);
        border-radius: 5px;
        background: linear-gradient(180deg, var(--color-surface), var(--color-surface-end));
    }

    .preview.default {
        border-style: dashed;
    }

    .preview img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .default-label {
        padding: 16px;
        color: var(--color-mint);
        font-size: 22px;
        text-align: center;
        opacity: 0.85;
    }

    .overlay {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        background: rgba(3, 36, 28, 0.75);
        color: var(--color-mint);
        font-size: 24px;
    }

    .actions,
    .alt-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 16px;
    }

    .confirm {
        display: inline-flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 12px;
        font-size: 18px;
    }

    .btn {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        height: 40px;
        padding: 0 18px;
        border-radius: 10px;
        color: var(--color-text);
        font-family: inherit;
        font-size: 20px;
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

    .btn:hover:not(:disabled) {
        filter: brightness(1.15);
    }

    .btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
    }

    .link {
        padding: 0;
        border: none;
        background: none;
        color: var(--color-mint);
        font-family: inherit;
        font-size: 18px;
        text-align: left;
        cursor: pointer;
    }

    .link.danger {
        color: var(--color-red);
    }

    .link:hover:not(:disabled) {
        text-decoration: underline;
    }

    .link:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .alt {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-top: 4px;
        padding-top: 12px;
        border-top: 1px solid var(--color-line);
    }

    .label-row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 8px;
        font-size: 20px;
    }

    .label-row em {
        font-size: 16px;
        font-style: normal;
        opacity: 0.7;
    }

    .label-row em.over {
        color: var(--color-gold-border);
        opacity: 1;
    }

    textarea {
        width: 100%;
        padding: 8px 10px;
        border: 1px solid var(--color-line);
        border-radius: 5px;
        background: var(--color-bg);
        color: var(--color-text);
        font-family: inherit;
        font-size: 19px;
        line-height: 1.3;
        resize: vertical;
        color-scheme: dark;
    }

    textarea:focus {
        border-color: var(--color-mint);
        outline: none;
    }

    .small {
        font-size: 16px;
        opacity: 0.75;
    }

    .field-error {
        color: var(--color-red);
        font-size: 18px;
    }

    .warn {
        color: var(--color-gold-border);
        font-size: 18px;
    }

    .saved {
        color: var(--color-mint);
        font-size: 18px;
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

    .banner {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px;
        max-width: 1355px;
        padding: 12px 18px;
        border-radius: 5px;
        font-size: 22px;
    }

    .banner.error {
        border: 1px solid var(--color-red);
        color: var(--color-red);
    }

    .state {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 0;
        color: var(--color-mint);
        font-size: 22px;
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
            font-size: 44px;
        }
    }
</style>
