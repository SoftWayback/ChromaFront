<script>
    import { onMount } from "svelte";
    import { apiFetch } from "$lib/api";
    import { typeLabel } from "$lib/rides";
    import NavSidebar from "$lib/components/NavSidebar.svelte";

    /**
     * @typedef {{
     *   id: string, name: string, type: string | null, land: string | null,
     *   hasCover: boolean, wait: number | null, isOpen: boolean | null
     * }} RideRow
     */

    /** @type {RideRow[]} */
    let rides = $state([]);
    let loading = $state(true);
    let error = $state("");

    /** @type {{ key: "name" | "land" | "type" | "wait", dir: 1 | -1 }} */
    let sort = $state({ key: "name", dir: 1 });

    const sortChips = /** @type {const} */ ([
        { key: "land", label: "Quartier" },
        { key: "type", label: "Type" },
        { key: "wait", label: "Attente" }
    ]);

    const byName = (/** @type {RideRow} */ a, /** @type {RideRow} */ b) =>
        a.name.localeCompare(b.name, "fr", { numeric: true });

    /** @type {Record<string, (a: RideRow, b: RideRow) => number>} */
    const COMPARE = {
        name: byName,
        land: (a, b) => (a.land ?? "").localeCompare(b.land ?? "", "fr"),
        type: (a, b) => typeLabel(a.type).localeCompare(typeLabel(b.type), "fr"),
        // closed / unknown always last
        wait: (a, b) => (a.wait ?? -1) - (b.wait ?? -1)
    };

    const sorted = $derived(
        [...rides].sort((a, b) => sort.dir * COMPARE[sort.key](a, b) || byName(a, b))
    );

    /** @param {"name" | "land" | "type" | "wait"} key */
    function toggleSort(key) {
        if (sort.key === key) sort = { key, dir: sort.dir === 1 ? -1 : 1 };
        // longest wait first by default, alphabetical otherwise
        else sort = { key, dir: key === "wait" ? -1 : 1 };
    }

    /** @param {RideRow} r */
    function waitText(r) {
        if (r.isOpen === null) return "—";
        if (!r.isOpen) return "Fermé";
        return `${r.wait} min`;
    }

    onMount(async () => {
        try {
            const res = await apiFetch("/rides");
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            rides = await res.json();
        } catch (e) {
            error = "Impossible de charger les entités.";
        } finally {
            loading = false;
        }
    });
</script>

<div class="page">
    <NavSidebar />

    <main class="content">
        <header class="head">
            <h1>Entités</h1>

            <div class="sort">
                <span>Tri</span>
                <span class="separator" aria-hidden="true"></span>
                {#each sortChips as chip}
                    <button
                        type="button"
                        class="chip"
                        class:active={sort.key === chip.key}
                        aria-pressed={sort.key === chip.key}
                        onclick={() => toggleSort(chip.key)}
                    >
                        {chip.label}
                        {#if sort.key === chip.key}<span aria-hidden="true">{sort.dir === 1 ? "↑" : "↓"}</span>{/if}
                    </button>
                {/each}
            </div>
        </header>

        <div class="list" role="table" aria-label="Attractions">
            <div class="row head-row" role="row">
                <button type="button" class="col-head" role="columnheader" onclick={() => toggleSort("name")}>Nom</button>
                <button type="button" class="col-head" role="columnheader" onclick={() => toggleSort("land")}>Quartier</button>
                <button type="button" class="col-head" role="columnheader" onclick={() => toggleSort("type")}>Type</button>
                <button type="button" class="col-head num" role="columnheader" onclick={() => toggleSort("wait")}>Attente</button>
            </div>

            {#if loading}
                <p class="state">Chargement…</p>
            {:else if error}
                <p class="state error">{error}</p>
            {:else if !rides.length}
                <p class="state">Aucune entité.</p>
            {:else}
                {#each sorted as ride, i (ride.id)}
                    <a class="row item" class:alt={i % 2 === 1} href="/entities/{ride.id}" role="row">
                        <span role="cell" class="name">{ride.name}</span>
                        <span role="cell">{ride.land ?? "—"}</span>
                        <span role="cell">{typeLabel(ride.type)}</span>
                        <span role="cell" class="num" class:closed={ride.isOpen === false}>{waitText(ride)}</span>
                    </a>
                {/each}
            {/if}
        </div>
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
        margin-bottom: 72px;
    }

    h1 {
        font-size: 64px;
        font-weight: 400;
    }

    .sort {
        display: flex;
        align-items: center;
        gap: 15px;
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
        justify-content: center;
        gap: 4px;
        min-width: 93px;
        height: 30px;
        padding: 0 8px;
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

    .list {
        max-width: 1355px;
    }

    .row {
        display: grid;
        grid-template-columns: minmax(0, 2.2fr) minmax(0, 1fr) minmax(0, 1fr) 120px;
        gap: 16px;
        align-items: center;
    }

    .head-row {
        padding-bottom: 6px;
        margin-bottom: 12px;
        border-bottom: 1px solid var(--color-mint);
    }

    .col-head {
        padding: 0;
        border: none;
        background: none;
        color: var(--color-text);
        font-family: inherit;
        font-size: 24px;
        text-align: left;
        cursor: pointer;
    }

    .item {
        min-height: 62px;
        padding: 0 16px;
        margin: 0 -16px;
        background: linear-gradient(90deg, #007445, var(--color-bg));
        color: var(--color-text);
        font-size: 28px;
        text-decoration: none;
        transition: filter 0.12s ease;
    }

    .item.alt {
        background: linear-gradient(90deg, #004227, var(--color-bg));
    }

    .item:hover,
    .item:focus-visible {
        filter: brightness(1.25);
        outline: none;
    }

    .name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .num {
        text-align: right;
    }

    .closed {
        color: var(--color-red);
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
