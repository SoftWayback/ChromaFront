<script>
    import { onMount } from "svelte";
    import NavSidebar from "$lib/components/NavSidebar.svelte";
    import KpiRow from "$lib/components/dashboard/KpiRow.svelte";
    import LiveTable from "$lib/components/dashboard/LiveTable.svelte";
    import SystemPanel from "$lib/components/dashboard/SystemPanel.svelte";
    import WaitTimeChart from "$lib/components/dashboard/WaitTimeChart.svelte";
    import { getLands, getLive, getOverview, getWaitTimes } from "$lib/dashboard";
    import { absoluteTime, relativeTime } from "$lib/stats";

    /** @typedef {import("$lib/dashboard").DashboardOverview} DashboardOverview */
    /** @typedef {import("$lib/dashboard").LiveData} LiveData */
    /** @typedef {import("$lib/dashboard").WaitTimes} WaitTimes */
    /** @typedef {import("$lib/dashboard").Land} Land */
    /** @typedef {import("$lib/dashboard").WaitScope} WaitScope */

    const REFRESH_MS = 60 * 1000;

    /** @param {unknown} e @param {string} fallback */
    const message = (e, fallback) => (e instanceof Error && e.message ? e.message : fallback);

    let overview = $state(/** @type {DashboardOverview | null} */ (null));
    let overviewError = $state("");
    let live = $state(/** @type {LiveData | null} */ (null));
    let liveError = $state("");
    let refreshing = $state(false);
    let lastRefresh = $state(0);

    let wait = $state(/** @type {WaitTimes | null} */ (null));
    let waitLoading = $state(true);
    let waitError = $state("");
    /** date "" = latest day */
    let waitQuery = $state(/** @type {{ scope: WaitScope, land: string, date: string }} */ ({ scope: "park", land: "", date: "" }));
    let lands = $state(/** @type {Land[]} */ ([]));

    /** Ticks every 15 s so relative times stay current. */
    let now = $state(Date.now());

    async function refresh() {
        if (refreshing) return;
        refreshing = true;
        const [o, l] = await Promise.allSettled([getOverview(), getLive()]);
        if (o.status === "fulfilled") {
            overview = o.value;
            overviewError = "";
        } else overviewError = message(o.reason, "Impossible de charger l'aperçu.");
        if (l.status === "fulfilled") {
            live = l.value;
            liveError = "";
        } else liveError = message(l.reason, "Impossible de charger le live.");
        // The latest day's chart moves with each poll; a past day doesn't.
        // (skipped on the first pass: onMount already loads it)
        if (!waitQuery.date && lastRefresh) loadWait(true);
        lastRefresh = Date.now();
        now = lastRefresh;
        refreshing = false;
    }

    let waitSeq = 0;
    /** @param {boolean} [quiet] background refresh: keep the current chart while loading */
    async function loadWait(quiet = false) {
        const seq = ++waitSeq;
        if (!quiet) waitLoading = true;
        try {
            const data = await getWaitTimes(waitQuery);
            if (seq !== waitSeq) return; // a newer query superseded this one
            wait = data;
            waitError = "";
        } catch (e) {
            if (seq === waitSeq) waitError = message(e, "Impossible de charger les temps d'attente.");
        } finally {
            if (seq === waitSeq) waitLoading = false;
        }
    }

    /** @param {{ scope: WaitScope, land: string, date: string }} q */
    function onChartChange(q) {
        // Picking the newest day = follow the latest day (auto-refreshed).
        const latest = wait?.days?.[0];
        waitQuery = { ...q, date: q.date && q.date !== latest ? q.date : "" };
        loadWait();
    }

    const updatedAt = $derived(live?.updatedAt ?? overview?.collection.lastPollAt ?? null);

    onMount(() => {
        refresh();
        loadWait();
        getLands()
            .then((l) => (lands = l))
            .catch(() => (lands = []));

        const poll = setInterval(() => {
            if (!document.hidden) refresh();
        }, REFRESH_MS);
        const tick = setInterval(() => (now = Date.now()), 15 * 1000);
        const onVisible = () => {
            if (!document.hidden && Date.now() - lastRefresh >= REFRESH_MS) refresh();
        };
        document.addEventListener("visibilitychange", onVisible);
        return () => {
            clearInterval(poll);
            clearInterval(tick);
            document.removeEventListener("visibilitychange", onVisible);
        };
    });
</script>

<div class="page">
    <NavSidebar />

    <main class="content">
        <header class="head">
            <h1>Live</h1>
            <div class="refresh">
                <span class="updated" title={absoluteTime(updatedAt)}>
                    {#if updatedAt}Relevé {relativeTime(updatedAt, now)}{/if}
                    {#if lastRefresh}<span class="sep">·</span> actualisé {relativeTime(new Date(lastRefresh).toISOString(), now)}{/if}
                </span>
                <button type="button" class="btn outline" disabled={refreshing} onclick={() => refresh()}>
                    {#if refreshing}<span class="spinner" aria-hidden="true"></span>{/if}
                    Actualiser
                </button>
            </div>
        </header>

        {#if overviewError && overview}
            <p class="banner error" role="alert">Actualisation impossible : {overviewError}</p>
        {/if}

        <KpiRow {overview} loading={!overview && !overviewError} {now} />
        {#if overviewError && !overview}
            <p class="banner error" role="alert">{overviewError}</p>
        {/if}

        <div class="top">
            <LiveTable rides={live?.rides ?? []} loading={!live && !liveError} error={liveError} onRetry={refresh} />
            <SystemPanel {overview} error={overviewError} {now} />
        </div>

        <WaitTimeChart
            data={wait}
            loading={waitLoading}
            error={waitError}
            query={waitQuery}
            {lands}
            onChange={onChartChange}
        />
    </main>
</div>

<style>
    .page {
        display: flex;
        min-height: 100vh;
        background: var(--color-bg);
    }

    .content {
        display: flex;
        flex-direction: column;
        gap: 28px;
        flex: 1;
        min-width: 0;
        max-width: 1560px;
        padding: 32px 48px 64px;
        color: var(--color-text);
        font-family: "Agdasima", sans-serif;
    }

    .head {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 8px 16px;
        margin-bottom: -12px;
    }

    h1 {
        font-size: 64px;
        font-weight: 400;
        line-height: 1;
    }

    .refresh {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 14px;
    }

    .updated {
        font-size: 18px;
        opacity: 0.75;
    }

    .sep {
        margin: 0 4px;
    }

    .btn {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        height: 36px;
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

    .btn:hover:not(:disabled) {
        filter: brightness(1.15);
    }

    .btn:disabled {
        opacity: 0.55;
        cursor: not-allowed;
    }

    .spinner {
        display: inline-block;
        width: 14px;
        height: 14px;
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
        padding: 10px 16px;
        border-radius: 5px;
        font-size: 20px;
    }

    .banner.error {
        border: 1px solid var(--color-red);
        color: var(--color-red);
    }

    .top {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(300px, 380px);
        gap: 28px 40px;
        align-items: start;
    }

    @media (max-width: 1100px) {
        .top {
            grid-template-columns: minmax(0, 1fr);
        }
    }

    @media (max-width: 900px) {
        .content {
            padding: 24px;
        }
    }

    @media (max-width: 575px) {
        .content {
            gap: 22px;
            padding: 16px 12px 40px;
        }

        h1 {
            font-size: 48px;
        }
    }
</style>
