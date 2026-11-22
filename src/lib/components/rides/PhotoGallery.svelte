<script>
    import { downscale } from "$lib/images";
    import {
        PHOTO_MAX_BYTES,
        PHOTO_TYPES,
        coverUrl,
        deletePhoto,
        getPhotos,
        setMainPhoto,
        uploadPhoto
    } from "$lib/rides";

    /** @typedef {import("$lib/rides").Photo} Photo */
    /** @typedef {import("$lib/rides").Gallery} Gallery */

    /**
     * @type {{ rideId: string, rideName?: string, onChange?: (photos: Photo[]) => void }}
     */
    let { rideId, rideName = "", onChange } = $props();

    /** @type {Photo[]} */
    let photos = $state([]);
    /** @type {string | null} photo shown in the big viewer */
    let selected = $state(null);
    let loading = $state(true);
    let loadError = $state("");
    /** @type {string[]} */
    let errors = $state([]);
    /** @type {{ done: number, total: number, name: string } | null} */
    let progress = $state(null);
    /** @type {string | null} photo being set as main / deleted */
    let acting = $state(null);
    let dragOver = $state(false);
    /** @type {string | null} photo waiting for delete confirmation */
    let confirmDelete = $state(null);
    /** @type {HTMLInputElement | undefined} */
    let fileInput = $state();

    const busy = $derived(progress !== null || acting !== null);
    const current = $derived(photos.find((p) => p.id === selected) ?? photos.find((p) => p.isMain) ?? photos[0] ?? null);
    const currentIndex = $derived(current ? photos.indexOf(current) + 1 : 0);

    /** @param {Gallery} data */
    function apply(data) {
        photos = data.photos;
        if (!photos.some((p) => p.id === selected)) selected = null;
        onChange?.(photos);
    }

    /** @param {string} id */
    async function load(id) {
        loading = true;
        loadError = "";
        try {
            apply(await getPhotos(id));
        } catch (e) {
            loadError = e instanceof Error ? e.message : "Impossible de charger les photos.";
        } finally {
            loading = false;
        }
    }

    $effect(() => {
        load(rideId);
    });

    /** @param {FileList | File[] | null | undefined} list */
    async function upload(list) {
        const files = [...(list ?? [])];
        if (!files.length || busy) return;
        errors = [];
        confirmDelete = null;

        /** @type {string[]} */
        const failed = files.filter((f) => !PHOTO_TYPES.includes(f.type)).map((f) => `${f.name} : format non supporté`);
        const valid = files.filter((f) => PHOTO_TYPES.includes(f.type));

        for (const [i, file] of valid.entries()) {
            progress = { done: i, total: valid.length, name: file.name };
            try {
                const blob = await downscale(file);
                if (blob.size > PHOTO_MAX_BYTES) throw new Error("image trop lourde (8 Mo max)");
                const data = await uploadPhoto(rideId, blob);
                apply(data);
                selected = data.photos[data.photos.length - 1]?.id ?? selected; // show the newest
            } catch (e) {
                failed.push(`${file.name} : ${e instanceof Error ? e.message : "échec"}`);
            }
        }
        progress = null;
        errors = failed;
    }

    /** @param {string} id */
    async function makeMain(id) {
        acting = id;
        errors = [];
        try {
            apply(await setMainPhoto(rideId, id));
        } catch (e) {
            errors = [e instanceof Error ? e.message : "L'opération a échoué."];
        } finally {
            acting = null;
        }
    }

    /** @param {string} id */
    async function remove(id) {
        confirmDelete = null;
        acting = id;
        errors = [];
        try {
            apply(await deletePhoto(rideId, id));
        } catch (e) {
            errors = [e instanceof Error ? e.message : "La suppression a échoué."];
        } finally {
            acting = null;
        }
    }

    function onDrop(/** @type {DragEvent} */ e) {
        e.preventDefault();
        dragOver = false;
        upload(e.dataTransfer?.files);
    }
</script>

<div
    class="gallery"
    class:drag-over={dragOver}
    role="region"
    aria-label="Photos de {rideName}"
    ondragover={(e) => {
        e.preventDefault();
        dragOver = true;
    }}
    ondragleave={(e) => {
        // ignore leaves into child elements
        if (!e.currentTarget.contains(/** @type {Node | null} */ (e.relatedTarget))) dragOver = false;
    }}
    ondrop={onDrop}
>
    <div class="viewer" class:empty={!current}>
        {#if loading}
            <span class="hint"><span class="spinner" aria-hidden="true"></span> Chargement…</span>
        {:else if loadError}
            <span class="hint error">{loadError}</span>
        {:else if current}
            <img src={coverUrl(current.id)} alt="Photo de {rideName}" />
            {#if current.isMain}
                <span class="badge main">★ Photo principale</span>
            {:else}
                <span class="badge">Photo {currentIndex} / {photos.length}</span>
            {/if}
        {:else}
            <span class="hint">Aucune photo — la fiche est incomplète.<br />Glisse des images ici ou utilise le bouton.</span>
        {/if}
        {#if dragOver}<div class="overlay">Dépose pour ajouter</div>{/if}
        {#if progress}
            <div class="overlay">
                <span><span class="spinner" aria-hidden="true"></span> Envoi {progress.done + 1} / {progress.total}</span>
                <span class="file">{progress.name}</span>
                <span class="bar" aria-hidden="true"><span style="width: {(progress.done / progress.total) * 100}%"></span></span>
            </div>
        {/if}
    </div>

    {#if current}
        <div class="photo-actions">
            {#if current.isMain}
                <span class="main-note">Affichée en couverture sur le site public.</span>
            {:else}
                <button type="button" class="btn outline small" disabled={busy} onclick={() => makeMain(current.id)}>
                    {#if acting === current.id}<span class="spinner" aria-hidden="true"></span>{/if}
                    ★ Définir comme principale
                </button>
            {/if}
            {#if confirmDelete === current.id}
                <span class="confirm">
                    Supprimer cette photo ?
                    <button type="button" class="link danger" onclick={() => remove(current.id)}>Oui</button>
                    <button type="button" class="link" onclick={() => (confirmDelete = null)}>Non</button>
                </span>
            {:else}
                <button type="button" class="link danger" disabled={busy} onclick={() => (confirmDelete = current.id)}>
                    Supprimer
                </button>
            {/if}
        </div>
        {#if current.isMain && photos.length > 1}
            <p class="small">Supprimer la photo principale fait passer la suivante en principale.</p>
        {/if}
    {/if}

    {#if photos.length > 1}
        <ul class="thumbs">
            {#each photos as photo (photo.id)}
                <li>
                    <button
                        type="button"
                        class="thumb"
                        class:active={photo.id === current?.id}
                        class:is-main={photo.isMain}
                        aria-label={photo.isMain ? "Photo principale" : "Afficher cette photo"}
                        aria-pressed={photo.id === current?.id}
                        onclick={() => {
                            selected = photo.id;
                            confirmDelete = null;
                        }}
                    >
                        <img src={coverUrl(photo.id)} alt="" loading="lazy" />
                        {#if photo.isMain}<span class="star" aria-hidden="true">★</span>{/if}
                    </button>
                </li>
            {/each}
        </ul>
    {/if}

    <input
        bind:this={fileInput}
        type="file"
        accept={PHOTO_TYPES.join(",")}
        multiple
        hidden
        onchange={(e) => {
            upload(e.currentTarget.files);
            e.currentTarget.value = "";
        }}
    />
    <div class="add-row">
        <button type="button" class="btn primary" disabled={busy || loading} onclick={() => fileInput?.click()}>
            {#if progress}<span class="spinner" aria-hidden="true"></span>{/if}
            Ajouter des photos
        </button>
        <span class="small">{photos.length} photo{photos.length > 1 ? "s" : ""}</span>
    </div>
    <p class="small">
        JPEG, PNG, WebP, GIF ou AVIF · plusieurs à la fois · réduites à 1920 px · enregistrées immédiatement. L'ordre
        suit l'ordre d'envoi (pas de réorganisation).
    </p>
    {#if errors.length}
        <div class="errors" role="alert">
            <p>Non envoyé{errors.length > 1 ? "s" : ""} :</p>
            <ul>
                {#each errors as err}<li>{err}</li>{/each}
            </ul>
        </div>
    {/if}
</div>

<style>
    .gallery {
        display: flex;
        flex-direction: column;
        gap: 12px;
        color: var(--color-text);
        font-family: "Agdasima", sans-serif;
    }

    .viewer {
        position: relative;
        display: grid;
        place-items: center;
        aspect-ratio: 4 / 3;
        overflow: hidden;
        border: 1px solid var(--color-mint);
        border-radius: 5px;
        background: linear-gradient(180deg, var(--color-surface), var(--color-surface-end));
    }

    .viewer.empty {
        border-style: dashed;
        border-color: var(--color-gold-border);
    }

    .drag-over .viewer {
        border-style: dashed;
        border-width: 2px;
    }

    .viewer img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .hint {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 16px;
        color: var(--color-mint);
        font-size: 20px;
        text-align: center;
    }

    .hint.error {
        color: var(--color-red);
    }

    .overlay {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 16px;
        background: rgba(3, 36, 28, 0.82);
        color: var(--color-mint);
        font-size: 24px;
    }

    .file {
        max-width: 100%;
        overflow: hidden;
        font-size: 16px;
        opacity: 0.8;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .bar {
        width: min(240px, 80%);
        height: 6px;
        overflow: hidden;
        border-radius: 3px;
        background: var(--color-line);
    }

    .bar span {
        display: block;
        height: 100%;
        background: var(--color-mint);
        transition: width 0.2s;
    }

    .badge {
        position: absolute;
        top: 10px;
        left: 10px;
        padding: 2px 10px;
        border: 1px solid var(--color-line);
        border-radius: 5px;
        background: rgba(3, 36, 28, 0.8);
        font-size: 17px;
    }

    .badge.main {
        border-color: var(--color-gold-border);
        background: var(--color-gold);
    }

    .photo-actions,
    .add-row {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 8px 16px;
    }

    .main-note {
        color: var(--color-gold-border);
        font-size: 18px;
    }

    .confirm {
        display: inline-flex;
        flex-wrap: wrap;
        gap: 10px;
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

    .btn.small {
        height: 34px;
        padding: 0 12px;
        font-size: 18px;
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
        cursor: pointer;
    }

    .link:hover:not(:disabled) {
        text-decoration: underline;
    }

    .link:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .link.danger {
        color: var(--color-red);
    }

    .thumbs {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(76px, 1fr));
        gap: 8px;
    }

    .thumb {
        position: relative;
        display: block;
        width: 100%;
        aspect-ratio: 1;
        padding: 0;
        overflow: hidden;
        border: 2px solid transparent;
        border-radius: 5px;
        background: var(--color-surface);
        cursor: pointer;
    }

    .thumb.is-main {
        border-color: var(--color-gold-border);
    }

    .thumb.active {
        border-color: var(--color-mint);
    }

    .thumb img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .star {
        position: absolute;
        top: 2px;
        right: 4px;
        color: var(--color-gold-border);
        font-size: 18px;
        text-shadow: 0 0 3px #000;
    }

    .small {
        font-size: 16px;
        opacity: 0.75;
    }

    .errors {
        padding: 10px 14px;
        border: 1px solid var(--color-red);
        border-radius: 5px;
        color: var(--color-red);
        font-size: 17px;
        overflow-wrap: anywhere;
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

        .bar span {
            transition: none;
        }
    }
</style>
