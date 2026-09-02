<script>
    /** @typedef {{ time: string, value: number }} WaitPoint */

    /**
     * @type {{
     *   data?: WaitPoint[],
     *   max?: number,
     *   activeFilter?: string,
     *   onFilter?: (key: string) => void
     * }}
     */
    let { data = [], max = 90, activeFilter = "park", onFilter } = $props();

    const filters = [
        { key: "park", label: "Parc entier", color: "var(--color-lime)", bg: "rgba(141, 239, 95, 0.38)" },
        { key: "coasters", label: "Coasters", color: "var(--color-purple)", bg: "rgba(198, 95, 239, 0.38)" },
        { key: "flat", label: "Flat rides", color: "var(--color-mint)", bg: "rgba(95, 239, 193, 0.38)" },
        { key: "quartier", label: "Quartier", color: "var(--color-red)", bg: "rgba(228, 73, 92, 0.38)" }
    ];

    const ticks = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90];

    // viewBox geometry (unitless — the SVG scales to its container width)
    const W = 1040;
    const H = 440;
    const PAD = { left: 44, right: 8, top: 12, bottom: 30 };
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const baseY = PAD.top + plotH;

    const slot = $derived(data.length ? plotW / data.length : plotW);
    const barW = $derived(slot * 0.62);

    /** @param {number} v */
    function y(v) {
        return baseY - (Math.min(Math.max(v, 0), max) / max) * plotH;
    }

    function select(/** @type {string} */ key) {
        onFilter?.(key);
    }
</script>

<section class="wait-chart">
    <h2>Moyenne d'attente</h2>

    <div class="controls">
        <button type="button" class="reset" onclick={() => select("park")}>Reset</button>
        <div class="filters">
            {#each filters as f}
                <button
                    type="button"
                    class="chip"
                    class:active={activeFilter === f.key}
                    style="--chip-color: {f.color}; --chip-bg: {f.bg};"
                    aria-pressed={activeFilter === f.key}
                    onclick={() => select(f.key)}
                >
                    {f.label}
                </button>
            {/each}
        </div>
    </div>

    <svg class="plot" viewBox="0 0 {W} {H}" role="img" aria-label="Temps d'attente moyen par tranche de 30 minutes">
        <defs>
            <linearGradient id="wait-grad" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stop-color="#5fefc1" />
                <stop offset="60%" stop-color="#8def5f" />
                <stop offset="100%" stop-color="#f8c349" />
            </linearGradient>
        </defs>

        {#each ticks as t}
            <line class="grid" x1={PAD.left} y1={y(t)} x2={W - PAD.right} y2={y(t)} />
            <text class="y-label" x={PAD.left - 10} y={y(t) + 4} text-anchor="end">
                {t === max ? `${max}+` : t}
            </text>
        {/each}

        <line class="axis" x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={baseY} />
        <line class="axis" x1={PAD.left} y1={baseY} x2={W - PAD.right} y2={baseY} />

        {#each data as point, i}
            {#if point.value > 0}
                <rect
                    class="bar"
                    x={PAD.left + i * slot + (slot - barW) / 2}
                    y={y(point.value)}
                    width={barW}
                    height={baseY - y(point.value)}
                />
            {/if}
            {#if i % 2 === 0}
                <text class="x-label" x={PAD.left + i * slot + slot / 2} y={baseY + 20} text-anchor="middle">
                    {point.time}
                </text>
            {/if}
        {/each}
    </svg>
</section>

<style>
    .wait-chart {
        font-family: "Agdasima", sans-serif;
        color: var(--color-text);
    }

    h2 {
        margin-bottom: 16px;
        font-size: 2.5rem;
        font-weight: 400;
    }

    .controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px;
        margin-bottom: 20px;
    }

    .reset {
        padding: 3px 14px;
        border: 1px solid var(--color-gold-border);
        border-radius: 5px;
        background: var(--color-gold);
        color: var(--color-text);
        font-family: inherit;
        font-size: 0.9rem;
        cursor: pointer;
    }

    .filters {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-left: 20px;
    }

    .chip {
        padding: 3px 14px;
        border: 1px solid var(--chip-color);
        border-radius: 5px;
        background: var(--chip-bg);
        color: var(--color-text);
        font-family: inherit;
        font-size: 0.9rem;
        opacity: 0.55;
        cursor: pointer;
        transition: opacity 0.12s ease;
    }

    .chip.active {
        opacity: 1;
        box-shadow: 0 0 0 1px var(--chip-color);
    }

    .plot {
        display: block;
        width: 100%;
        height: auto;
    }

    .grid {
        stroke: rgba(255, 255, 255, 0.12);
        stroke-width: 1;
    }

    .axis {
        stroke: var(--color-line);
        stroke-width: 1;
    }

    .bar {
        fill: url(#wait-grad);
        stroke: rgba(255, 255, 255, 0.25);
        stroke-width: 0.75;
    }

    .y-label,
    .x-label {
        fill: var(--color-mint);
        font-family: "Agdasima", sans-serif;
        font-size: 14px;
    }

    .x-label {
        fill: var(--color-text);
    }
</style>
