<script>
    import { dayLabel } from "$lib/stats";
    import { WAIT_SCOPES } from "$lib/dashboard";

    /** @typedef {import("$lib/dashboard").WaitTimes} WaitTimes */
    /** @typedef {import("$lib/dashboard").WaitScope} WaitScope */
    /** @typedef {import("$lib/dashboard").Land} Land */
    /** @typedef {{ scope: WaitScope, land: string, date: string }} ChartQuery */

    /**
     * @type {{
     *   data?: WaitTimes | null,
     *   loading?: boolean,
     *   error?: string,
     *   query: ChartQuery,
     *   lands?: Land[],
     *   onChange?: (q: ChartQuery) => void
     * }}
     */
    let { data = null, loading = false, error = "", query, lands = [], onChange } = $props();

    const SCOPE_COLORS = /** @type {Record<WaitScope, string>} */ ({
        park: "var(--color-lime)",
        coaster: "var(--color-purple)",
        flat: "var(--color-mint)",
        dark: "var(--color-gold-border)",
        water: "var(--color-blue)",
        land: "var(--color-red)"
    });

    const points = $derived(data?.points ?? []);
    const max = $derived(data?.max ?? 90);
    const days = $derived(data?.days ?? []);
    const hasValues = $derived(points.some((p) => p.value != null));

    // viewBox geometry (the SVG scales to its container width, min-width keeps labels legible).
    const SLOT = 44;
    const PAD = { left: 46, right: 8, top: 10, bottom: 28 };
    const PLOT_H = 330;
    const STEP = 15;

    const W = $derived(PAD.left + Math.max(points.length, 1) * SLOT + PAD.right);
    const H = PAD.top + PLOT_H + PAD.bottom;
    const baseY = PAD.top + PLOT_H;
    /** Headroom above `max` so a "90+" bar doesn't touch the top. */
    const domain = $derived(max * 1.08);
    const ticks = $derived(Array.from({ length: Math.floor(max / STEP) + 1 }, (_, i) => i * STEP));

    /** @param {number} v */
    const y = (v) => baseY - (Math.min(Math.max(v, 0), max) / domain) * PLOT_H;

    let hovered = $state(/** @type {number | null} */ (null));
    const focus = $derived(hovered != null ? points[hovered] : null);

    /** @param {Partial<ChartQuery>} patch */
    function change(patch) {
        const next = { ...query, ...patch };
        if (next.scope === "land" && !next.land) next.land = lands[0]?.id ?? "";
        hovered = null;
        onChange?.(next);
    }

    const peak = $derived.by(() => {
        /** @type {WaitTimes["points"][number] | null} */
        let best = null;
        for (const p of points) if (p.value != null && (!best || p.value > (best.value ?? 0))) best = p;
        return best;
    });
</script>

<section class="wait-chart" aria-labelledby="wait-title">
    <div class="head">
        <h2 id="wait-title">Moyenne d'attente</h2>
        <select
            class="day"
            aria-label="Jour"
            value={query.date || days[0] || ""}
            disabled={!days.length}
            onchange={(e) => change({ date: e.currentTarget.value })}
        >
            {#each days as d, i}
                <option value={d}>{i === 0 ? `${dayLabel(d)} (dernier)` : dayLabel(d)}</option>
            {/each}
        </select>
    </div>

    <div class="controls">
        {#each WAIT_SCOPES as s}
            <button
                type="button"
                class="chip"
                class:active={query.scope === s.key}
                style="--chip-color: {SCOPE_COLORS[s.key]};"
                aria-pressed={query.scope === s.key}
                disabled={s.key === "land" && !lands.length}
                onclick={() => change({ scope: s.key })}
            >
                {s.label}
            </button>
        {/each}
        {#if query.scope === "land"}
            <select aria-label="Quartier" value={query.land} onchange={(e) => change({ land: e.currentTarget.value })}>
                {#each lands as l}<option value={l.id}>{l.name}</option>{/each}
            </select>
        {/if}
        {#if loading}<span class="spinner" aria-label="Chargement"></span>{/if}
    </div>

    <p class="readout" aria-live="polite">
        {#if focus}
            <strong>{focus.time}</strong> ·
            {#if focus.value == null}
                pas de donnée
            {:else}
                {focus.value >= max ? `${max}+` : focus.value} min · {focus.rides} attraction{focus.rides > 1 ? "s" : ""}
            {/if}
        {:else if peak}
            Pic à <strong>{peak.time}</strong> : {peak.value} min ({peak.rides} attractions) — survole une barre pour le détail
        {:else}
            &nbsp;
        {/if}
    </p>

    {#if error}
        <p class="state error" role="alert">{error}</p>
    {:else if !data && loading}
        <div class="placeholder">Chargement…</div>
    {:else if !hasValues}
        <div class="placeholder">Aucune attente valide pour ce jour et ce périmètre.</div>
    {:else}
        <div class="plot-wrap">
            <svg
                class="plot"
                class:dim={loading}
                viewBox="0 0 {W} {H}"
                role="img"
                aria-label="Temps d'attente moyen par tranche de 30 minutes"
                onpointerleave={() => (hovered = null)}
            >
                <defs>
                    <!-- One gradient spanning the whole y-axis (Figma: mint → gold → red). -->
                    <linearGradient id="wait-grad" gradientUnits="userSpaceOnUse" x1="0" y1={baseY} x2="0" y2={PAD.top}>
                        <stop offset="0" stop-color="#5fefc1" />
                        <stop offset="0.5" stop-color="#f8c349" />
                        <stop offset="1" stop-color="#e4495c" />
                    </linearGradient>
                </defs>

                {#each ticks as t}
                    <line class="grid-line" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
                    <text class="y-label" x={PAD.left - 8} y={y(t) + 5} text-anchor="end">
                        {t >= max ? `${max}+` : t}
                    </text>
                {/each}

                {#each points as point, i}
                    {@const x = PAD.left + i * SLOT}
                    {#if point.value != null}
                        <rect
                            class="bar"
                            class:active={hovered === i}
                            x={x + 2}
                            y={y(point.value)}
                            width={SLOT - 4}
                            height={Math.max(baseY - y(point.value), 1)}
                        />
                    {/if}
                    {#if point.time.endsWith(":00")}
                        <text class="x-label" x={x + SLOT / 2} y={baseY + 20} text-anchor="middle">
                            {point.time.slice(0, 2)}h
                        </text>
                    {/if}
                    <!-- Full-height hit area: hover / tap shows the readout above. -->
                    <rect
                        class="hit"
                        role="presentation"
                        {x}
                        y={PAD.top}
                        width={SLOT}
                        height={PLOT_H}
                        onpointerenter={() => (hovered = i)}
                        onpointerdown={() => (hovered = i)}
                    >
                        <title>
                            {point.time} : {point.value == null ? "pas de donnée" : `${point.value} min · ${point.rides} attractions`}
                        </title>
                    </rect>
                {/each}

                <line class="axis" x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={baseY} />
                <line class="axis" x1={PAD.left} y1={baseY} x2={W - PAD.right} y2={baseY} />
            </svg>
        </div>
    {/if}
</section>

<style>
    .wait-chart {
        min-width: 0;
        font-family: "Agdasima", sans-serif;
        color: var(--color-text);
    }

    .head {
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

    select {
        height: 34px;
        min-width: 0;
        max-width: 100%;
        padding: 0 10px;
        border: 1px solid var(--color-line);
        border-radius: 5px;
        background: var(--color-surface);
        color: var(--color-text);
        font-family: inherit;
        font-size: 18px;
    }

    .controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
    }

    .chip {
        height: 30px;
        padding: 0 12px;
        border: 1px solid var(--chip-color);
        border-radius: 5px;
        background: color-mix(in srgb, var(--chip-color) 18%, transparent);
        color: var(--color-text);
        font-family: inherit;
        font-size: 18px;
        line-height: 1;
        opacity: 0.55;
        cursor: pointer;
        transition: opacity 0.12s ease;
    }

    .chip.active {
        background: color-mix(in srgb, var(--chip-color) 38%, transparent);
        opacity: 1;
    }

    .chip:hover:not(:disabled) {
        opacity: 1;
    }

    .chip:disabled {
        cursor: not-allowed;
        opacity: 0.3;
    }

    .readout {
        min-height: 24px;
        margin-bottom: 6px;
        font-size: 18px;
        opacity: 0.85;
    }

    .readout strong {
        color: var(--color-mint);
        font-weight: 400;
    }

    .plot-wrap {
        max-width: 1400px;
        overflow-x: auto;
    }

    .plot {
        display: block;
        width: 100%;
        min-width: 620px;
        height: auto;
        transition: opacity 0.15s;
    }

    .plot.dim {
        opacity: 0.6;
    }

    .axis {
        stroke: var(--color-mint);
        stroke-width: 1;
    }

    .grid-line {
        stroke: rgba(255, 255, 255, 0.07);
        stroke-width: 1;
    }

    .bar {
        fill: url(#wait-grad);
        fill-opacity: 0.12;
        stroke: url(#wait-grad);
        stroke-width: 1;
        pointer-events: none;
    }

    .bar.active {
        fill-opacity: 0.4;
    }

    .hit {
        fill: transparent;
        cursor: crosshair;
    }

    .y-label,
    .x-label {
        font-family: "Agdasima", sans-serif;
        font-size: 16px;
    }

    .y-label {
        fill: url(#wait-grad);
    }

    .x-label {
        fill: var(--color-text);
    }

    .placeholder {
        display: grid;
        place-items: center;
        min-height: 220px;
        border: 1px dashed var(--color-line);
        border-radius: 5px;
        font-size: 20px;
        opacity: 0.7;
        text-align: center;
        padding: 16px;
    }

    .state.error {
        padding: 12px 0;
        color: var(--color-red);
        font-size: 20px;
    }

    .spinner {
        display: inline-block;
        width: 16px;
        height: 16px;
        border: 2px solid var(--color-mint);
        border-right-color: transparent;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }
</style>
