<script>
    import { onMount } from "svelte";
    import NavSidebar from "$lib/components/NavSidebar.svelte";
    import { TYPE_LABELS, coverUrl, getPhotos, listRides, typeLabel } from "$lib/rides";
    import { getDbOverview, MISSING_LABELS } from "$lib/db";
    import { waitLevel, waitText, waitSortValue } from "$lib/dashboard";

    /** @typedef {import("$lib/rides").RideRow} RideRow */
    /** @typedef {"name" | "land" | "type" | "wait"} SortKey */

    /** @param {unknown} e @param {string} fallback */
    const message = (e, fallback) => (e instanceof Error && e.message ? e.message : fallback);

    /** @type {RideRow[]} */
    let rides = $state([]);
    let loading = $state(true);
    let error = $state("");

    // "fiche incomplète": /rides doesn't carry Description / Manufacturer, so the
    // list comes from /db/overview (same rule as Gestion DB). null = unknown.
    /** @type {Map<string, string[]> | null} */
    let missing = $state(null);
    let missingError = $state("");

    // main photo id per ride (/rides only says hasCover)
    /** @type {Record<string, string>} */
    let thumbs = $state({});

    // ── filters ──
    let search = $state("");
    let typeFilter = $state("");
    let landFilter = $state("");
    let onlyIncomplete = $state(false);
    let grouped = $state(false);
    /** @type {{ key: SortKey, dir: 1 | -1 }} */
    let sort = $state({ key: "name", dir: 1 });

    const SORTS = /** @type {{ key: SortKey, label: string }[]} */ ([
        { key: "name", label: "Nom" },
        { key: "land", label: "Quartier" },
        { key: "type", label: "Type" },
        { key: "wait", label: "Attente" }
    ]);

    const NONE = "__none";
    const lands = $derived(
        [...new Set(rides.map((r) => r.land).filter((l) => l != null))].sort((a, b) => a.localeCompare(b, "fr"))
    );
    const types = $derived(Object.keys(TYPE_LABELS).filter((t) => rides.some((r) => r.type === t)));

    /** @param {string} s */
    const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

    const byName = (/** @type {RideRow} */ a, /** @type {RideRow} */ b) =>
        a.name.localeCompare(b.name, "fr", { numeric: true });

    /** @type {Record<SortKey, (a: RideRow, b: RideRow) => number>} */
    const COMPARE = {
        name: byName,
        land: (a, b) => (a.land ?? "￿").localeCompare(b.land ?? "￿", "fr"),
        type: (a, b) => typeLabel(a.type).localeCompare(typeLabel(b.type), "fr"),
        wait: (a, b) => waitSortValue(a) - waitSortValue(b)
    };

    /** @param {RideRow} r */
    const missingOf = (r) => missing?.get(r.id) ?? [];

    const visible = $derived.by(() => {
        const q = norm(search.trim());
        return rides
            .filter((r) => !q || norm(`${r.name} ${r.land ?? ""}`).includes(q))
            .filter((r) => !typeFilter || (typeFilter === NONE ? !r.type : r.type === typeFilter))
            .filter((r) => !landFilter || (landFilter === NONE ? !r.land : r.land === landFilter))
            .filter((r) => !onlyIncomplete || missingOf(r).length > 0)
            .sort((a, b) => sort.dir * COMPARE[sort.key](a, b) || byName(a, b));
    });

    /** [land, rides][] in the current order of lands (alphabetical, "Sans quartier" last). */
    const groups = $derived.by(() => {
        /** @type {Map<string, RideRow[]>} */
        const map = new Map();
        for (const r of visible) {
            const k = r.land ?? "Sans quartier";
            if (!map.has(k)) map.set(k, []);
            map.get(k)?.push(r);
        }
        return [...map.entries()].sort(([a], [b]) =>
            a === "Sans quartier" ? 1 : b === "Sans quartier" ? -1 : a.localeCompare(b, "fr")
        );
    });

    const incompleteCount = $derived(missing ? rides.filter((r) => missingOf(r).length).length : null);
    const openCount = $derived(rides.filter((r) => r.isOpen).length);
    const filtered = $derived(!!(search.trim() || typeFilter || landFilter || onlyIncomplete));

    /** @param {SortKey} key */
    function setSort(key) {
        if (sort.key === key) sort = { key, dir: sort.dir === 1 ? -1 : 1 };
        else sort = { key, dir: key === "wait" ? -1 : 1 }; // longest wait first
    }

    function resetFilters() {
        search = "";
        typeFilter = "";
        landFilter = "";
        onlyIncomplete = false;
    }

    async function loadRides() {
        loading = true;
        error = "";
        try {
            rides = await listRides();
            loadThumbs();
        } catch (e) {
            error = message(e, "Impossible de charger les entités.");
        } finally {
            loading = false;
        }
    }

    async function loadMissing() {
        missingError = "";
        try {
            const db = await getDbOverview();
            missing = new Map(db.catalogue.incomplete.map((r) => [r.id, r.missing]));
        } catch (e) {
            missingError = message(e, "Complétude des fiches indisponible.");
        }
    }

    /** Main photo of each ride with one, a few requests at a time. */
    async function loadThumbs() {
        const queue = rides.filter((r) => r.hasCover && !thumbs[r.id]).map((r) => r.id);
        const worker = async () => {
            for (let id = queue.shift(); id; id = queue.shift()) {
                try {
                    const g = await getPhotos(id);
                    if (g.CoverId) thumbs[id] = g.CoverId;
                } catch {
                    // thumbnail only: ignore
                }
            }
        };
        await Promise.all(Array.from({ length: 6 }, worker));
    }

    function retry() {
        loadRides();
        if (!missing) loadMissing();
    }

    onMount(() => {
        loadRides();
        loadMissing();
    });
</script>

{#snippet row(/** @type {RideRow} */ r)}
    {@const miss = missingOf(r)}
    {@const thumb = coverUrl(thumbs[r.id])}
    <li>
        <a class="ride" class:virtual={r.type === "virtualline"} href="/entities/{r.id}">
            <span class="thumb" class:empty={!r.hasCover}>
                {#if thumb}
                    <img src={thumb} alt="" loading="lazy" />
                {:else if !r.hasCover}
                    <span>Pas de photo</span>
                {/if}
            </span>
            <span class="ident">
                <span class="name">{r.name}</span>
                <span class="sub">
                    <span class="badge type-{r.type ?? 'none'}">{r.type ? typeLabel(r.type) : "sans type"}</span>
                    {#if !grouped}<span class="land">{r.land ?? "Sans quartier"}</span>{/if}
                </span>
            </span>
            <span class="sheet">
                {#if r.type === "virtualline"}
                    <span class="muted">hors fiche</span>
                {:else if missing === null}
                    <span class="muted">{missingError ? "—" : "…"}</span>
                {:else if miss.length}
                    {#each miss as m}<span class="chip-missing">{MISSING_LABELS[m] ?? m}</span>{/each}
                {:else}
                    <span class="complete">✓ complète</span>
                {/if}
            </span>
            <span class="wait {waitLevel(r)}">
                {waitText(r)}{#if r.isOpen && r.wait != null}<small> min</small>{/if}
            </span>
        </a>
    </li>
{/snippet}

<div class="page">
    <NavSidebar />

    <main class="content">
        <header class="head">
            <div>
                <h1>Entités</h1>
                {#if rides.length}
                    <p class="counts">
                        {rides.length} attractions
                        {#if incompleteCount !== null}· <span class:warn-text={incompleteCount > 0}>{incompleteCount} incomplète{incompleteCount > 1 ? "s" : ""}</span>{/if}
                        · {openCount} ouverte{openCount > 1 ? "s" : ""}
                    </p>
                {/if}
            </div>
        </header>

        {#if loading && !rides.length}
            <p class="state"><span class="spinner" aria-hidden="true"></span> Chargement…</p>
        {:else if error && !rides.length}
            <div class="banner error" role="alert">
                <span>{error}</span>
                <button type="button" class="btn outline" onclick={retry}>Réessayer</button>
            </div>
        {:else if !rides.length}
            <p class="state">Aucune entité dans le catalogue.</p>
        {:else}
            <div class="toolbar">
                <input
                    type="search"
                    class="search"
                    placeholder="Rechercher (nom, quartier)…"
                    aria-label="Rechercher une attraction"
                    bind:value={search}
                />
                <select bind:value={typeFilter} aria-label="Filtrer par type">
                    <option value="">Tous les types</option>
                    {#each types as t}<option value={t}>{typeLabel(t)}</option>{/each}
                    <option value={NONE}>Sans type</option>
                </select>
                <select bind:value={landFilter} aria-label="Filtrer par quartier">
                    <option value="">Tous les quartiers</option>
                    {#each lands as l}<option value={l}>{l}</option>{/each}
                    <option value={NONE}>Sans quartier</option>
                </select>
                <button
                    type="button"
                    class="chip"
                    class:active={onlyIncomplete}
                    aria-pressed={onlyIncomplete}
                    disabled={missing === null}
                    onclick={() => (onlyIncomplete = !onlyIncomplete)}
                >
                    Fiches incomplètes{#if incompleteCount !== null}&nbsp;<span class="chip-count">{incompleteCount}</span>{/if}
                </button>
                <button type="button" class="chip" class:active={grouped} aria-pressed={grouped} onclick={() => (grouped = !grouped)}>
                    Grouper par quartier
                </button>
            </div>

            <div class="sortbar" role="group" aria-label="Tri">
                <span class="sort-label">Tri</span>
                {#each SORTS as s}
                    <button
                        type="button"
                        class="chip small"
                        class:active={sort.key === s.key}
                        aria-pressed={sort.key === s.key}
                        onclick={() => setSort(s.key)}
                    >
                        {s.label}{#if sort.key === s.key}&nbsp;<span aria-hidden="true">{sort.dir === 1 ? "↑" : "↓"}</span>{/if}
                    </button>
                {/each}
                {#if filtered}
                    <span class="result">{visible.length} / {rides.length}</span>
                    <button type="button" class="link" onclick={resetFilters}>Réinitialiser</button>
                {/if}
            </div>

            {#if missingError}
                <p class="note">Complétude des fiches indisponible ({missingError}). <button type="button" class="link" onclick={loadMissing}>Réessayer</button></p>
            {/if}
            {#if error}<p class="banner error" role="alert">{error}</p>{/if}

            {#if !visible.length}
                <div class="empty">
                    <p>Aucune attraction ne correspond à ces filtres.</p>
                    <button type="button" class="btn outline" onclick={resetFilters}>Réinitialiser les filtres</button>
                </div>
            {:else if grouped}
                {#each groups as [land, list] (land)}
                    <section class="group">
                        <h2>{land} <span class="group-count">{list.length}</span></h2>
                        <ul class="list">
                            {#each list as r (r.id)}{@render row(r)}{/each}
                        </ul>
                    </section>
                {/each}
            {:else}
                <ul class="list">
                    {#each visible as r (r.id)}{@render row(r)}{/each}
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

    .warn-text {
        color: var(--color-gold-border);
    }

    h2 {
        margin: 28px 0 10px;
        padding-bottom: 4px;
        border-bottom: 1px solid var(--color-mint);
        font-size: 30px;
        font-weight: 400;
    }

    .group-count {
        font-size: 20px;
        opacity: 0.6;
    }

    .toolbar,
    .sortbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px 12px;
        max-width: 1355px;
    }

    .toolbar {
        margin-bottom: 12px;
    }

    .sortbar {
        margin-bottom: 20px;
        font-size: 20px;
    }

    .sort-label {
        opacity: 0.7;
    }

    .result {
        margin-left: auto;
        opacity: 0.7;
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

    select {
        flex: 0 1 220px;
        min-width: 0;
    }

    .search:focus,
    select:focus {
        border-color: var(--color-mint);
        outline: none;
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

    .chip.small {
        height: 32px;
        padding: 0 10px;
        font-size: 18px;
    }

    .chip.active {
        border-color: var(--color-mint);
        background: rgba(95, 239, 193, 0.12);
        color: var(--color-mint);
    }

    .chip:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .chip-count {
        opacity: 0.7;
    }

    .list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        max-width: 1355px;
    }

    .ride {
        display: grid;
        grid-template-columns: 96px minmax(0, 1.4fr) minmax(0, 1fr) 90px;
        gap: 16px;
        align-items: center;
        padding: 8px 14px 8px 8px;
        border: 1px solid transparent;
        border-radius: 5px;
        background: linear-gradient(90deg, rgba(0, 116, 69, 0.45), transparent);
        color: var(--color-text);
        text-decoration: none;
    }

    .ride:hover,
    .ride:focus-visible {
        border-color: var(--color-mint);
        outline: none;
    }

    .ride.virtual {
        opacity: 0.6;
    }

    .thumb {
        display: grid;
        place-items: center;
        aspect-ratio: 4 / 3;
        overflow: hidden;
        border: 1px solid var(--color-line);
        border-radius: 5px;
        background: var(--color-surface);
    }

    .thumb.empty {
        border-style: dashed;
        color: var(--color-gold-border);
        font-size: 14px;
        text-align: center;
    }

    .thumb img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .ident {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 0;
    }

    .name {
        overflow: hidden;
        font-size: 26px;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .sub {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 10px;
        font-size: 17px;
    }

    .land {
        opacity: 0.75;
    }

    .badge {
        padding: 0 6px;
        border: 1px solid currentColor;
        border-radius: 4px;
        font-size: 14px;
        line-height: 18px;
    }

    .type-coaster {
        color: var(--color-purple);
    }

    .type-flat {
        color: var(--color-mint);
    }

    .type-dark {
        color: var(--color-gold-border);
    }

    .type-water {
        color: var(--color-blue);
    }

    .type-show {
        color: var(--color-lime);
    }

    .type-virtualline,
    .type-none {
        color: var(--color-line);
    }

    .sheet {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 6px;
        min-width: 0;
    }

    .chip-missing {
        padding: 0 6px;
        border: 1px solid var(--color-gold-border);
        border-radius: 4px;
        color: var(--color-gold-border);
        font-size: 15px;
        line-height: 20px;
    }

    .complete {
        color: var(--color-mint);
        font-size: 17px;
    }

    .muted {
        font-size: 17px;
        opacity: 0.55;
    }

    .wait {
        font-size: 26px;
        font-variant-numeric: tabular-nums;
        text-align: right;
        white-space: nowrap;
    }

    .wait small {
        font-size: 16px;
        opacity: 0.7;
    }

    .wait.low {
        color: var(--color-mint);
    }

    .wait.mid {
        color: var(--color-gold-border);
    }

    .wait.high,
    .wait.closed {
        color: var(--color-red);
    }

    .wait.closed {
        font-size: 20px;
    }

    .wait.none {
        opacity: 0.5;
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
        font-size: inherit;
        cursor: pointer;
    }

    .link:hover {
        text-decoration: underline;
    }

    .note {
        margin-bottom: 14px;
        color: var(--color-gold-border);
        font-size: 18px;
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
        padding: 28px;
        border: 1px dashed var(--color-mint);
        border-radius: 10px;
        font-size: 22px;
    }

    .state {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 0;
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
    }

    @media (max-width: 900px) {
        .content {
            padding: 24px;
        }

        .ride {
            grid-template-columns: 80px minmax(0, 1fr) auto;
            grid-template-areas:
                "thumb ident wait"
                "thumb sheet sheet";
            gap: 6px 12px;
        }

        .thumb {
            grid-area: thumb;
        }

        .ident {
            grid-area: ident;
        }

        .sheet {
            grid-area: sheet;
        }

        .wait {
            grid-area: wait;
        }
    }

    @media (max-width: 575px) {
        .content {
            padding: 16px 12px 40px;
        }

        h1 {
            font-size: 48px;
        }

        .ride {
            grid-template-columns: 64px minmax(0, 1fr) auto;
        }

        .name {
            font-size: 22px;
        }

        .wait {
            font-size: 22px;
        }

        select {
            flex: 1 1 140px;
        }
    }
</style>
