<script>
    import { absoluteTime, formatNumber, relativeTime } from "$lib/stats";

    /** @typedef {import("$lib/dashboard").DashboardOverview} DashboardOverview */

    /** @type {{ overview?: DashboardOverview | null, loading?: boolean, now?: number }} */
    let { overview = null, loading = false, now = Date.now() } = $props();

    const c = $derived(overview?.collection ?? null);
</script>

<section class="kpis" aria-label="Indicateurs du relevé">
    {#if !c}
        {#each Array(5) as _}
            <div class="kpi skeleton" class:pulse={loading}></div>
        {/each}
    {:else}
        <div class="kpi" class:warn={c.late}>
            <span class="label">Dernier relevé</span>
            <span class="value" title={absoluteTime(c.lastPollAt)}>{c.lastPollAt ? relativeTime(c.lastPollAt, now) : "jamais"}</span>
            {#if c.cronDisabled}
                <span class="note warn-text">cron désactivé</span>
            {:else if c.late}
                <span class="note warn-text">en retard (&gt; 35 min)</span>
            {:else}
                <span class="note">toutes les 15 min, 8h–22h45</span>
            {/if}
        </div>

        <div class="kpi">
            <span class="label">Attractions ouvertes</span>
            <span class="value">{c.ridesOpen}<span class="of"> / {c.ridesKnown}</span></span>
            <span class="note">{c.ridesReported} remontées au dernier relevé</span>
        </div>

        <div class="kpi">
            <span class="label">Attente moyenne</span>
            <span class="value">{c.avgWait == null ? "—" : c.avgWait}<span class="of"> min</span></span>
            <span class="note">attractions ouvertes, hors VirtualLine</span>
        </div>

        <div class="kpi">
            <span class="label">Plus longue attente</span>
            {#if c.longest}
                <span class="value hot">{c.longest.wait}<span class="of"> min</span></span>
                {#if c.longest.rideId}
                    <a class="note ride" href="/entities/{c.longest.rideId}">{c.longest.name}</a>
                {:else}
                    <span class="note">{c.longest.name}</span>
                {/if}
            {:else}
                <span class="value">—</span>
                <span class="note">aucune attraction ouverte</span>
            {/if}
        </div>

        <div class="kpi">
            <span class="label">Relevés aujourd'hui</span>
            <span class="value">{formatNumber(c.pollsToday)}</span>
            <span class="note">heure de Berlin</span>
        </div>
    {/if}
</section>

<style>
    .kpis {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
        gap: 12px;
        font-family: "Agdasima", sans-serif;
        color: var(--color-text);
    }

    .kpi {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
        min-height: 104px;
        padding: 12px 16px;
        border: 1px solid var(--color-mint);
        border-radius: 5px;
        background: var(--color-surface);
    }

    .kpi.warn {
        border-color: var(--color-red);
        background: rgba(228, 73, 92, 0.12);
    }

    .label {
        color: var(--color-mint);
        font-size: 18px;
    }

    .kpi.warn .label,
    .warn-text {
        color: var(--color-red);
    }

    .value {
        font-size: 36px;
        line-height: 1.1;
        font-variant-numeric: tabular-nums;
    }

    .value.hot {
        color: var(--color-red);
    }

    .of {
        font-size: 20px;
        opacity: 0.7;
    }

    .note {
        overflow: hidden;
        font-size: 15px;
        text-overflow: ellipsis;
        white-space: nowrap;
        opacity: 0.75;
    }

    .warn-text {
        opacity: 1;
    }

    .ride {
        color: var(--color-text);
        opacity: 1;
    }

    .ride:hover {
        color: var(--color-mint);
    }

    .skeleton {
        border-color: var(--color-line);
        opacity: 0.4;
    }

    .skeleton.pulse {
        animation: pulse 1.2s ease-in-out infinite alternate;
    }

    @keyframes pulse {
        to {
            opacity: 0.15;
        }
    }

    @media (max-width: 400px) {
        .kpis {
            grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .kpi {
            padding: 10px 12px;
        }

        .value {
            font-size: 30px;
        }
    }
</style>
