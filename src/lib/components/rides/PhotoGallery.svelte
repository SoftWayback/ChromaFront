<script>
    import { apiFetch } from "$lib/api";
    import { coverUrl } from "$lib/rides";
    import { downscale } from "$lib/images";

    /** @typedef {{ id: string, isMain: boolean }} Photo */

    /** @type {{ rideId: string, rideName?: string }} */
    let { rideId, rideName = "" } = $props();

    const MAX_BYTES = 8 * 1024 * 1024;
    const ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

    /** @type {Photo[]} */
    let photos = $state([]);
    /** @type {string | null} photo shown in the big viewer */
    let selected = $state(null);
    let loading = $state(true);
    let error = $state("");
    let progress = $state({ done: 0, total: 0 });
    let dragOver = $state(false);
    /** @type {string | null} photo waiting for delete confirmation */
    let confirmDelete = $state(null);
    /** @type {HTMLInputElement | undefined} */
    let fileInput = $state();

    const uploading = $derived(progress.total > 0);
    const current = $derived(photos.find((p) => p.id === selected) ?? photos.find((p) => p.isMain) ?? photos[0] ?? null);

    /** @param {{ photos: Photo[] }} data */
    function apply(data) {
        photos = data.photos;
        if (!photos.some((p) => p.id === selected)) selected = null;
    }

    async function load(/** @type {string} */ id) {
        loading = true;
        error = "";
        try {
            const res = await apiFetch(`/rides/${id}/photos`);
            if (!res.ok) throw new Error();
            apply(await res.json());
        } catch {
            error = "Impossible de charger les photos.";
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
        if (!files.length || uploading) return;
        error = "";

        const rejected = files.filter((f) => !ACCEPT.includes(f.type));
        const valid = files.filter((f) => ACCEPT.includes(f.type));
        const failed = rejected.map((f) => `${f.name} (format non supporté)`);

        progress = { done: 0, total: valid.length };
        for (const file of valid) {
            try {
                const blob = await downscale(file);
                if (blob.size > MAX_BYTES) throw new Error("trop lourde");
                const res = await apiFetch(`/rides/${rideId}/photos`, {
                    method: "POST",
                    headers: { "Content-Type": blob.type || file.type },
                    body: blob
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
                apply(data);
                // show the newest upload
                selected = data.photos[data.photos.length - 1]?.id ?? selected;
            } catch (e) {
                failed.push(`${file.name} (${e instanceof Error ? e.message : "échec"})`);
            }
            progress.done++;
        }
        progress = { done: 0, total: 0 };
        if (failed.length) error = `Non envoyées : ${failed.join(", ")}`;
    }

    /**
     * @param {string} path
     * @param {string} method
     */
    async function act(path, method) {
        error = "";
        try {
            const res = await apiFetch(`/rides/${rideId}/photos/${path}`, { method });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            apply(data);
        } catch (e) {
            error = e instanceof Error && e.message ? e.message : "L'opération a échoué.";
        }
    }

    const setMain = (/** @type {string} */ id) => act(`${id}/main`, "PUT");

    async function remove(/** @type {string} */ id) {
        confirmDelete = null;
        await act(id, "DELETE");
    }

    function onDrop(/** @type {DragEvent} */ e) {
        e.preventDefault();
        dragOver = false;
        upload(e.dataTransfer?.files);
    }
</script>

<section
    class="gallery"
    class:drag-over={dragOver}
    aria-label="Photos"
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
    <div class="viewer">
        {#if loading}
            <span class="hint">Chargement…</span>
        {:else if current}
            <img src={coverUrl(current.id)} alt="Photo de {rideName}" />
            {#if current.isMain}<span class="badge">Photo principale</span>{/if}
        {:else}
            <span class="hint">Glisse tes photos ici<br />ou utilise le bouton ci-dessous</span>
        {/if}
        {#if dragOver}<div class="drop-hint">Dépose pour ajouter</div>{/if}
    </div>

    {#if current}
        <div class="photo-actions">
            {#if !current.isMain}
                <button type="button" class="link" onclick={() => setMain(current.id)}>★ Définir comme principale</button>
            {/if}
            {#if confirmDelete === current.id}
                <span class="confirm">
                    Supprimer cette photo ?
                    <button type="button" class="link danger" onclick={() => remove(current.id)}>Oui</button>
                    <button type="button" class="link" onclick={() => (confirmDelete = null)}>Non</button>
                </span>
            {:else}
                <button type="button" class="link danger" onclick={() => (confirmDelete = current.id)}>Supprimer</button>
            {/if}
        </div>
    {/if}

    {#if photos.length > 1}
        <ul class="thumbs">
            {#each photos as photo (photo.id)}
                <li>
                    <button
                        type="button"
                        class="thumb"
                        class:active={photo.id === current?.id}
                        aria-label={photo.isMain ? "Photo principale" : "Afficher cette photo"}
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
        accept={ACCEPT.join(",")}
        multiple
        hidden
        onchange={(e) => {
            upload(e.currentTarget.files);
            e.currentTarget.value = "";
        }}
    />
    <button type="button" class="add" disabled={uploading} onclick={() => fileInput?.click()}>
        {uploading ? `Envoi ${progress.done + 1}/${progress.total}…` : "Ajouter des photos"}
    </button>
    <p class="count">{photos.length} photo{photos.length > 1 ? "s" : ""}</p>
    {#if error}<p class="error">{error}</p>{/if}
</section>

<style>
    .gallery {
        display: flex;
        flex-direction: column;
        gap: 12px;
        font-family: "Agdasima", sans-serif;
        color: var(--color-text);
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
        color: var(--color-mint);
        font-size: 22px;
        text-align: center;
        opacity: 0.85;
    }

    .drop-hint {
        position: absolute;
        inset: 0;
        display: grid;
        place-items: center;
        background: rgba(3, 36, 28, 0.75);
        color: var(--color-mint);
        font-size: 28px;
    }

    .badge {
        position: absolute;
        top: 10px;
        left: 10px;
        padding: 2px 10px;
        border: 1px solid var(--color-gold-border);
        border-radius: 5px;
        background: var(--color-gold);
        font-size: 18px;
    }

    .photo-actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 8px 16px;
        font-size: 20px;
    }

    .confirm {
        display: inline-flex;
        gap: 10px;
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

    .link.danger {
        color: var(--color-red);
    }

    .thumbs {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
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

    .add {
        height: 40px;
        border: 1px solid var(--color-mint);
        border-radius: 10px;
        background: none;
        color: var(--color-text);
        font-family: inherit;
        font-size: 22px;
        cursor: pointer;
    }

    .add:disabled {
        opacity: 0.6;
        cursor: progress;
    }

    .count {
        font-size: 18px;
        opacity: 0.7;
    }

    .error {
        color: var(--color-red);
        font-size: 18px;
    }
</style>
