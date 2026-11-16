<script>
    import sortIcon from "$lib/assets/sort.svg";
    import { typeLabel } from "$lib/rides";
    import { waitLevel, waitSortValue, waitText, waitTrend } from "$lib/dashboard";

    /** @typedef {import("$lib/dashboard").LiveRide} LiveRide */
    /** @typedef {{ key: "name" | "live" | "previous", dir: "asc" | "desc" }} LiveSort */

    /**
     * @type {{
     *   rides?: LiveRide[],
     *   loading?: boolean,
     *   error?: string,
     *   onRetry?: () => void
     * }}
     */
    let { rides = [], loading = false, error = "", onRetry } = $props();

    /** @type {LiveSort} */
    let sort = $state({ key: "live", dir: "desc" });
    let search = $state("");
    let type = $state("all");
    let openOnly = $state(false);

    const TYPE_FILTERS = [
        { key: "all", label: "Tous les types" },
        { key: "coaster", label: "Coasters" },
        { key: "flat", label: "Flat rides" },
        { key: "dark", label: "Parcours scéniques" },
        { key: "water", label: "Aquatiques" },
        { key: "show", label: "Spectacles" },
        { key: "virtualline", label: "VirtualLines" },
        { key: "none", label: "Non catalogués" }
    ];

    /** @type {{ key: LiveSort["key"], label: string, cls: string }[]} */
    const columns = [
        { key: "name", label: "Attraction", cls: "col-name" },
        { key: "live", label: "Live", cls: "col-num" },
        { key: "previous", label: "Précédent", cls: "col-num" }
    ];

    /** @param {string} s */
    const norm = (s) =>
        s
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .toLowerCase();

    const visible = $derived.by(() => {
        const q = norm(search.trim());
        const list = rides.filter((r) => {
            if (type === "none" ? r.type != null : type !== "all" && r.type !== type) return false;
            if (openOnly && !r.live.isOpen) return false;
            if (q && !norm(`${r.name} ${r.land ?? ""}`).includes(q)) return false;
            return true;
        });
        const sign = sort.dir === "asc" ? 1 : -1;
        const byName = (/** @type {LiveRide} */ a, /** @type {LiveRide} */ b) =>
            a.name.localeCompare(b.name, "fr", { numeric: true });
        return list.sort((a, b) => {
            if (sort.key === "name") return sign * byName(a, b);
            const m = sort.key === "live" ? "live" : "previous";
            return sign * (waitSortValue(a[m]) - waitSortValue(b[m])) || byName(a, b);
        });
    });

    /** @param {LiveSort["key"]} key */
    function onSort(key) {
        // Same column toggles; a new column starts with A→Z for names, longest wait first for times.
        if (sort.key === key) sort = { key, dir: sort.dir === "asc" ? "desc" : "asc" };
        else sort = { key, dir: key === "name" ? "asc" : "desc" };
    }

    /** @param {string | null} t */
    const typeClass = (t) => (t ? `type-${t}` : "type-none");
</script>

<section class="live-table" aria-labelledby="live-title">
    <div class="bar">
        <h2 id="live-title">Attractions</h2>
        <div class="filters">
            <input
                type="search"
                class="search"
                placeholder="Rechercher…"
                aria-label="Rechercher une attraction ou un quartier"
                bind:value={search}
            />
            <select bind:value={type} aria-label="Filtrer par type">
                {#each TYPE_FILTERS as f}<option value={f.key}>{f.label}</option>{/each}
            </select>
            <label class="toggle">
                <input type="checkbox" bind:checked={openOnly} />
                Ouvertes
            </label>
        </div>
    </div>

    {#if error}
        <p class="state error" role="alert">
            {error}
            {#if onRetry}<button type="button" class="link" onclick={() => onRetry?.()}>Réessayer</button>{/if}
        </p>
    {/if}

    {#if loading && !rides.length}
        <ul class="skeleton" aria-label="Chargement">
            {#each Array(8) as _}<li></li>{/each}
        </ul>
    {:else if !rides.length && !error}
        <p class="state">Aucun relevé sur les 3 derniers jours.</p>
    {:else if rides.length}
        <div class="table-wrap">
            <table>
                <thead>
                    <tr>
                        {#each columns as col}
                            <th
                                class={col.cls}
                                aria-sort={sort.key === col.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                            >
                                <button
                                    type="button"
                                    class="sort-btn"
                                    class:active={sort.key === col.key}
                                    onclick={() => onSort(col.key)}
                                >
                                    {col.label}
                                    <img src={sortIcon} alt="" class="sort-icon" width="11" height="13" />
                                </button>
                            </th>
                        {/each}
                    </tr>
                </thead>
                <tbody>
                    {#each visible as r (r.apiId)}
                        {@const trend = waitTrend(r)}
                        <tr class:virtual={r.type === "virtualline"}>
                            <td class="col-name">
                                {#if r.rideId}
                                    <a class="name" href="/entities/{r.rideId}">{r.name}</a>
                                {:else}
                                    <span class="name" title="Absente du catalogue (ApiID {r.apiId})">{r.name}</span>
                                {/if}
                                <span class="sub">
                                    <span class="badge {typeClass(r.type)}">{r.type ? typeLabel(r.type) : "non catalogué"}</span>
                                    {#if r.land}<span class="land">{r.land}</span>{/if}
                                </span>
                            </td>
                            <td class="col-num">
                                <span class="wait {waitLevel(r.live)}">{waitText(r.live)}</span>
                                {#if trend && trend.dir !== "flat"}
                                    <span
                                        class="trend {trend.dir}"
                                        title="{trend.delta > 0 ? '+' : ''}{trend.delta} min depuis le relevé précédent"
                                    >
                                        {trend.dir === "up" ? "▲" : "▼"}
                                    </span>
                                {/if}
                            </td>
                            <td class="col-num">
                                <span class="wait prev {waitLevel(r.previous)}">{waitText(r.previous)}</span>
                            </td>
                        </tr>
                    {:else}
                        <tr>
                            <td colspan="3" class="empty">Aucune attraction ne correspond aux filtres.</td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
        <p class="count">{visible.length} / {rides.length} attractions · minutes d'attente</p>
    {/if}
</section>

<style>
    .live-table {
        min-width: 0;
        font-family: "Agdasima", sans-serif;
        color: var(--color-text);
    }

    .bar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 10px 16px;
        margin-bottom: 10px;
    }

    h2 {
        font-size: 36px;
        font-weight: 400;
    }

    .filters {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
    }

    .search,
    select {
        height: 34px;
        min-width: 0;
        padding: 0 10px;
        border: 1px solid var(--color-line);
        border-radius: 5px;
        background: var(--color-surface);
        color: var(--color-text);
        font-family: inherit;
        font-size: 18px;
    }

    .search {
        width: 180px;
    }

    .search:focus,
    select:focus {
        outline: none;
        border-color: var(--color-mint);
    }

    .toggle {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 18px;
        cursor: pointer;
    }

    .toggle input {
        accent-color: var(--color-mint);
    }

    .table-wrap {
        max-height: 640px;
        overflow-y: auto;
        border-bottom: 1px solid var(--color-line);
    }

    table {
        width: 100%;
        border-collapse: collapse;
    }

    thead th {
        position: sticky;
        top: 0;
        z-index: 1;
        padding: 6px 8px;
        background: var(--color-bg);
        border-bottom: 1px solid var(--color-mint);
        font-size: 20px;
        font-weight: 400;
        text-align: left;
        white-space: nowrap;
    }

    .sort-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 0;
        border: none;
        background: none;
        color: inherit;
        font: inherit;
        cursor: pointer;
    }

    .sort-btn.active {
        color: var(--color-mint);
    }

    td {
        padding: 6px 8px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        vertical-align: middle;
    }

    tbody tr:hover {
        background: rgba(95, 239, 193, 0.06);
    }

    .col-name {
        width: 100%;
    }

    .col-num {
        white-space: nowrap;
        text-align: right;
    }

    th.col-num {
        text-align: right;
    }

    .name {
        display: block;
        color: var(--color-text);
        font-size: 22px;
        line-height: 1.15;
        text-decoration: none;
        overflow-wrap: anywhere;
    }

    a.name:hover {
        color: var(--color-mint);
        text-decoration: underline;
    }

    .sub {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 8px;
        margin-top: 2px;
        font-size: 15px;
    }

    .land {
        opacity: 0.7;
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

    .wait {
        display: inline-block;
        min-width: 2ch;
        font-size: 26px;
        font-variant-numeric: tabular-nums;
    }

    .wait.prev {
        font-size: 20px;
        opacity: 0.8;
    }

    .wait.low {
        color: var(--color-mint);
    }

    .wait.mid {
        color: var(--color-gold-border);
    }

    .wait.high {
        color: var(--color-red);
    }

    .wait.closed {
        font-size: 18px;
        opacity: 0.55;
    }

    .wait.none {
        opacity: 0.4;
    }

    .trend {
        margin-left: 2px;
        font-size: 13px;
        vertical-align: middle;
    }

    .trend.up {
        color: var(--color-red);
    }

    .trend.down {
        color: var(--color-mint);
    }

    tr.virtual {
        opacity: 0.5;
    }

    tr.virtual .name {
        font-size: 18px;
    }

    .empty {
        padding: 20px 8px;
        font-size: 20px;
        text-align: center;
        opacity: 0.7;
    }

    .count {
        margin-top: 8px;
        font-size: 16px;
        opacity: 0.65;
    }

    .state {
        padding: 12px 0;
        color: var(--color-mint);
        font-size: 20px;
    }

    .state.error {
        color: var(--color-red);
    }

    .link {
        margin-left: 10px;
        padding: 0;
        border: none;
        background: none;
        color: var(--color-mint);
        font: inherit;
        text-decoration: underline;
        cursor: pointer;
    }

    .skeleton {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .skeleton li {
        height: 46px;
        border-radius: 5px;
        background: linear-gradient(90deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.04));
        background-size: 200% 100%;
        animation: shimmer 1.4s linear infinite;
    }

    @keyframes shimmer {
        to {
            background-position: -200% 0;
        }
    }

    @media (max-width: 575px) {
        .filters {
            width: 100%;
        }

        .search {
            flex: 1 1 140px;
            width: auto;
        }

        select {
            flex: 1 1 120px;
        }

        .name {
            font-size: 19px;
        }

        .wait {
            font-size: 22px;
        }

        thead th {
            font-size: 17px;
        }

        td,
        thead th {
            padding: 6px 4px;
        }
    }
</style>
