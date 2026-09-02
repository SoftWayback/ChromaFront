<script>
    import { onMount } from "svelte";
    import { apiFetch } from "$lib/api";
    import NavSidebar from "$lib/components/NavSidebar.svelte";
    import LiveTable from "$lib/components/dashboard/LiveTable.svelte";
    import StatsPanel from "$lib/components/dashboard/StatsPanel.svelte";
    import WaitTimeChart from "$lib/components/dashboard/WaitTimeChart.svelte";

    const LIVE_LIMIT = 25;

    const HOURS = Array.from({ length: 27 }, (_, i) => {
        const total = 9 * 60 + i * 30;
        return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
    });

    // Placeholder values from the Figma "chroma v2" dashboard, shown until the
    // API responds (or if an endpoint isn't up yet).
    const FALLBACK = {
        rows: Array.from({ length: 6 }, (_, i) => ({
            id: i + 1,
            name: "01 - Silver-Star",
            live: "90+",
            previous: "15"
        })),
        stats: [
            { label: "Dernière update", value: "15 minutes" },
            { label: "Taille de DB", value: "1.1 GO" },
            { label: "Nombre d'élements", value: "1 000 000" },
            { label: "Status du site", value: "Online" },
            { label: "Nombre d'article", value: "12" },
            { label: "Nombre visite", value: "100" }
        ],
        wait: [18, 42, 61, 55, 72, 66, 57, 57, 52, 52, 77, 77, 83, 67, 61, 60, 58, 52, 45, 35, 20]
            .concat(Array(6).fill(0))
            .map((value, i) => ({ time: HOURS[i], value }))
    };

    let liveRows = $state(FALLBACK.rows);
    let liveHasMore = $state(true);
    let liveLoaded = $state(0);
    let liveLoading = $state(false);

    let stats = $state(FALLBACK.stats);

    let waitPoints = $state(FALLBACK.wait);
    let waitMax = $state(90);
    let waitFilter = $state("park");

    /** @param {string} path */
    async function loadJSON(path) {
        try {
            const res = await apiFetch(path);
            return res.ok ? await res.json() : null;
        } catch {
            return null;
        }
    }

    /** @param {{ append?: boolean }} [opts] */
    async function loadLive({ append = false } = {}) {
        if (liveLoading) return;
        liveLoading = true;
        const offset = append ? liveLoaded : 0;
        const data = await loadJSON(`/dashboard/live?limit=${LIVE_LIMIT}&offset=${offset}`);
        if (data?.rows) {
            liveRows = append ? [...liveRows, ...data.rows] : data.rows;
            liveLoaded = offset + data.rows.length;
            liveHasMore = Boolean(data.hasMore);
        }
        liveLoading = false;
    }

    async function loadStats() {
        const data = await loadJSON("/dashboard/stats");
        if (Array.isArray(data)) stats = data;
        else if (data?.items) stats = data.items;
    }

    /** @param {string} scope */
    async function loadWait(scope) {
        const data = await loadJSON(`/dashboard/wait-times?scope=${scope}`);
        if (data?.points) {
            waitPoints = data.points;
            if (typeof data.max === "number") waitMax = data.max;
        }
    }

    /** @param {string} key */
    function onFilter(key) {
        waitFilter = key;
        loadWait(key);
    }

    onMount(() => {
        loadLive();
        loadStats();
        loadWait(waitFilter);
    });
</script>

<div class="page">
    <NavSidebar />

    <main class="content">
        <h1>Live</h1>

        <div class="top">
            <LiveTable
                rows={liveRows}
                hasMore={liveHasMore}
                onMore={() => loadLive({ append: true })}
            />
            <StatsPanel items={stats} />
        </div>

        <WaitTimeChart data={waitPoints} max={waitMax} activeFilter={waitFilter} {onFilter} />
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
        padding: 48px 56px;
        color: var(--color-text);
        font-family: "Agdasima", sans-serif;
    }

    h1 {
        margin-bottom: 32px;
        font-size: 4rem;
        font-weight: 400;
    }

    .top {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 420px;
        gap: 24px 64px;
        align-items: start;
        margin-bottom: 56px;
    }

    @media (max-width: 1100px) {
        .top {
            grid-template-columns: 1fr;
        }
    }
</style>
