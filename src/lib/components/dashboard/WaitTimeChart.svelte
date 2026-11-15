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

    // viewBox geometry, in Figma px (the SVG scales to its container width).
    // Bars are contiguous 45px slots; the y-axis runs one step past `max` so the
    // top tick can read "90+".
    const SLOT = 45;
    const STEP = 5;
    const PAD = { left: 50, right: 10, top: 6, bottom: 26 };
    const PLOT_H = 569;

    const W = $derived(PAD.left + Math.max(data.length, 1) * SLOT + PAD.right);
    const H = PAD.top + PLOT_H + PAD.bottom;
    const baseY = PAD.top + PLOT_H;
    const domain = $derived(max + STEP + 1);
    const ticks = $derived(Array.from({ length: max / STEP + 1 }, (_, i) => (i + 1) * STEP));

    /** @param {number} v */
    function y(v) {
        return baseY - (Math.min(Math.max(v, 0), max + STEP) / domain) * PLOT_H;
    }

    function select(/** @type {string} */ key) {
        onFilter?.(key);
    }
</script>

<section class="wait-chart">
    <h2>Moyenne d'attente</h2>

    <div class="controls">
        <button type="button" class="chip reset" onclick={() => select("park")}>Reset</button>
        <span class="separator" aria-hidden="true"></span>
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

    <div class="plot-wrap">
        <svg class="plot" viewBox="0 0 {W} {H}" role="img" aria-label="Temps d'attente moyen par tranche de 30 minutes">
            <defs>
                <!-- One gradient spanning the whole y-axis (Figma: mint → gold → red). -->
                <linearGradient id="wait-grad" gradientUnits="userSpaceOnUse" x1="0" y1={baseY} x2="0" y2={PAD.top}>
                    <stop offset="0" stop-color="#5fefc1" />
                    <stop offset="0.5" stop-color="#f8c349" />
                    <stop offset="1" stop-color="#e4495c" />
                </linearGradient>
            </defs>

            {#each ticks as t}
                <text class="y-label" x={PAD.left - 10} y={y(t) + 5} text-anchor="end">
                    {t > max ? `${max}+` : t}
                </text>
            {/each}

            {#each data as point, i}
                {#if point.value > 0}
                    <rect
                        class="bar"
                        x={PAD.left + i * SLOT}
                        y={y(point.value)}
                        width={SLOT}
                        height={baseY - y(point.value)}
                    >
                        <title>{point.time} : {point.value} min</title>
                    </rect>
                {/if}
                <text class="x-label" x={PAD.left + i * SLOT + SLOT / 2} y={baseY + 20} text-anchor="middle">
                    {point.time}
                </text>
            {/each}

            <line class="axis" x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={baseY} />
            <line class="axis" x1={PAD.left} y1={baseY} x2={W - PAD.right} y2={baseY} />
        </svg>
    </div>
</section>

<style>
    .wait-chart {
        font-family: "Agdasima", sans-serif;
        color: var(--color-text);
    }

    h2 {
        margin-bottom: 8px;
        font-size: 64px;
        font-weight: 400;
    }

    .controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 20px;
        margin-bottom: 84px;
    }

    .chip {
        width: 85px;
        height: 24px;
        padding: 0;
        border: 1px solid var(--chip-color);
        border-radius: 5px;
        background: var(--chip-bg);
        color: var(--color-text);
        font-family: inherit;
        font-size: 20px;
        line-height: 1;
        opacity: 0.6;
        cursor: pointer;
        transition: opacity 0.12s ease;
    }

    .chip.active,
    .chip:hover {
        opacity: 1;
    }

    .chip.reset {
        border-color: var(--color-gold-border);
        background: var(--color-gold);
        opacity: 1;
    }

    .separator {
        width: 1px;
        height: 34px;
        background: var(--color-text);
    }

    .plot-wrap {
        max-width: 1280px;
    }

    .plot {
        display: block;
        width: 100%;
        height: auto;
    }

    .axis {
        stroke: var(--color-mint);
        stroke-width: 1;
    }

    .bar {
        fill: url(#wait-grad);
        fill-opacity: 0.1;
        stroke: url(#wait-grad);
        stroke-width: 1;
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
</style>
