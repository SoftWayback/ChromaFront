<script>
    import { onMount } from "svelte";
    import NavSidebar from "$lib/components/NavSidebar.svelte";
    import {
        absoluteTime,
        dayLabel,
        formatMs,
        formatNumber,
        formatSize,
        getStatsBundle,
        getStatsPeriods,
        isRecomputable,
        listStatsCache,
        monthLabel,
        periodLabel,
        recomputeStats,
        relativeTime,
        sortCacheEntries,
        weekLabel
    } from "$lib/stats";

    /** @typedef {import("$lib/stats").CacheEntry} CacheEntry */
    /** @typedef {import("$lib/stats").StatsPeriods} StatsPeriods */
    /** @typedef {import("$lib/stats").StatsBundle} StatsBundle */
    /** @typedef {import("$lib/stats").RecomputeResult} RecomputeResult */

    /** @param {unknown} e @param {string} fallback */
    const message = (e, fallback) => (e instanceof Error && e.message ? e.message : fallback);

    // ── cache table ──
    /** @type {CacheEntry[]} */
    let entries = $state([]);
    let cacheLoading = $state(true);
    let cacheError = $state("");
    // GET /stats/cache leaves out the ~5 000 `ride:*` keys by default; if they ever come
    // back (?rides=true / older backend), summarise them instead of rendering every row.
    const rideCount = $derived(entries.filter((e) => e.key.startsWith("ride:")).length);
    const sorted = $derived(sortCacheEntries(rideCount ? entries.filter((e) => !e.key.startsWith("ride:")) : entries));

    // ── period pickers ──
    let periods = $state(/** @type {StatsPeriods | null} */ (null));
    let periodsError = $state("");
    let month = $state("");
    let week = $state("");
    const months = $derived(periods ? [...periods.months].reverse() : []);
    const weeks = $derived(periods ? [...periods.weeks].reverse() : []);

    // ── `all` preview ──
    let bundle = $state(/** @type {StatsBundle | null} */ (null));
    let bundleLoading = $state(true);
    let bundleError = $state("");

    // ── recompute (one at a time: the backend runs them on the same DB) ──
    let busy = $state(/** @type {{ period: string | undefined, label: string, startedAt: number } | null} */ (null));
    let result = $state(/** @type {(RecomputeResult & { label: string }) | null} */ (null));
    let actionError = $state("");

    /** Ticks every second: elapsed counter + relative times stay current. */
    let now = $state(Date.now());
    const elapsed = $derived(busy ? Math.max(0, Math.floor((now - busy.startedAt) / 1000)) : 0);

    async function loadCache() {
        try {
            entries = await listStatsCache();
            cacheError = "";
        } catch (e) {
            cacheError = message(e, "Impossible de charger le cache.");
        } finally {
            cacheLoading = false;
        }
    }

    async function loadPeriods() {
        try {
            periods = await getStatsPeriods();
            periodsError = "";
            if (!months.includes(month)) month = months[0] ?? "";
            if (!weeks.includes(week)) week = weeks[0] ?? "";
        } catch (e) {
            periodsError = message(e, "Impossible de charger les périodes.");
        }
    }

    async function loadBundle() {
        bundleLoading = true;
        try {
            bundle = await getStatsBundle("all");
            bundleError = "";
        } catch (e) {
            bundleError = message(e, "Impossible de charger l'aperçu.");
        } finally {
            bundleLoading = false;
        }
    }

    /** @param {string} [period] omitted = full recompute */
    async function run(period) {
        if (busy) return; // no double-submit
        const label = period ? periodLabel(period) : "tout";
        busy = { period, label, startedAt: Date.now() };
        now = Date.now();
        actionError = "";
        result = null;
        try {
            const res = await recomputeStats(period);
            result = { ...res, label };
        } catch (e) {
            actionError = message(e, "Le recalcul a échoué.");
        } finally {
            busy = null;
        }
        await loadCache();
        if (!period) loadPeriods();
        if (!period || period === "all") loadBundle();
    }

    /** @param {CacheEntry} entry */
    function expiry(entry) {
        if (!entry.expiresAt) return { text: "Figé", cls: "frozen", title: "Immuable (période passée)" };
        const t = new Date(entry.expiresAt).getTime();
        const title = absoluteTime(entry.expiresAt);
        if (t <= now) return { text: "expiré", cls: "expired", title };
        return { text: `expire ${relativeTime(entry.expiresAt, now)}`, cls: "", title };
    }

    /** @param {number | null | undefined} v */
    const fixed1 = (v) => (v == null ? "—" : v.toLocaleString("fr-FR", { maximumFractionDigits: 1 }));

    onMount(() => {
        loadCache();
        loadPeriods();
        loadBundle();
        const timer = setInterval(() => (now = Date.now()), 1000);
        return () => clearInterval(timer);
    });
</script>

<div class="page">
    <NavSidebar />

    <main class="content">
        <header class="head">
            <h1>Statistiques</h1>
            <button type="button" class="btn primary" disabled={!!busy} onclick={() => run()}>
                {#if busy && !busy.period}<span class="spinner" aria-hidden="true"></span>{/if}
                Tout recalculer
            </button>
        </header>

        <p class="hint">
            Le cache est pré-calculé automatiquement (préchauffage après chaque relevé, la nuit, à minuit et au
            démarrage) : le site public lit ces bundles sans attendre. « Tout recalculer » (baselines + depuis le début
            + 3 derniers jours + aujourd'hui + liste des périodes, ≈ 50 s) ne sert qu'à forcer un recalcul.
        </p>

        <div class="feedback" aria-live="polite">
            {#if busy}
                <p class="banner busy">
                    <span class="spinner" aria-hidden="true"></span>
                    Recalcul ({busy.label}) en cours… {elapsed} s
                </p>
            {:else if actionError}
                <p class="banner error" role="alert">{actionError}</p>
            {:else if result}
                <div class="banner done">
                    <p>Recalcul ({result.label}) terminé en {formatMs(result.totalMs)}</p>
                    <ul class="timings">
                        {#each Object.entries(result.timings ?? {}) as [key, ms]}
                            <li><span>{periodLabel(key)}</span> {formatMs(ms)}</li>
                        {/each}
                    </ul>
                </div>
            {/if}
        </div>

        <section class="block">
            <h2>Calculer une période</h2>
            {#if periodsError}<p class="state error" role="alert">{periodsError}</p>{/if}
            <div class="pickers">
                <div class="quick">
                    {#each ["today", "last3d", "all", "baselines"] as p}
                        <button type="button" class="btn outline" disabled={!!busy} onclick={() => run(p)}>
                            {#if busy?.period === p}<span class="spinner" aria-hidden="true"></span>{/if}
                            {periodLabel(p)}
                        </button>
                    {/each}
                </div>

                <div class="pick">
                    <label for="month">Mois</label>
                    <select id="month" bind:value={month} disabled={!months.length}>
                        {#each months as m}<option value={m}>{monthLabel(m)}</option>{/each}
                    </select>
                    <button
                        type="button"
                        class="btn outline"
                        disabled={!!busy || !month}
                        onclick={() => run(`month:${month}`)}
                    >
                        {#if busy?.period === `month:${month}`}<span class="spinner" aria-hidden="true"></span>{/if}
                        Calculer
                    </button>
                </div>

                <div class="pick">
                    <label for="week">Semaine</label>
                    <select id="week" bind:value={week} disabled={!weeks.length}>
                        {#each weeks as w}<option value={w}>{weekLabel(w)}</option>{/each}
                    </select>
                    <button
                        type="button"
                        class="btn outline"
                        disabled={!!busy || !week}
                        onclick={() => run(`week:${week}`)}
                    >
                        {#if busy?.period === `week:${week}`}<span class="spinner" aria-hidden="true"></span>{/if}
                        Calculer
                    </button>
                </div>
            </div>
        </section>

        <section class="block">
            <h2>Cache</h2>
            {#if cacheError}<p class="state error" role="alert">{cacheError}</p>{/if}
            {#if cacheLoading}
                <p class="state">Chargement…</p>
            {:else if !entries.length && !cacheError}
                <p class="state">Cache vide — rien n'a encore été calculé.</p>
            {:else if entries.length}
                <div class="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Période</th>
                                <th>Calculé</th>
                                <th>Expiration</th>
                                <th class="num" title="Taille compressée en base (TOAST), pas la taille JSON">Taille stockée</th>
                                <th><span class="sr-only">Action</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each sorted as entry (entry.key)}
                                {@const exp = expiry(entry)}
                                <tr>
                                    <td>
                                        <span class="label">{periodLabel(entry.key)}</span>
                                        <span class="key">{entry.key}</span>
                                        {#if entry.computing}<span class="tag busy">calcul…</span>{/if}
                                        {#if entry.inMemory}<span class="tag">mémoire</span>{/if}
                                    </td>
                                    <td title={absoluteTime(entry.computedAt)}>{relativeTime(entry.computedAt, now)}</td>
                                    <td class={exp.cls} title={exp.title}>{exp.text}</td>
                                    <td class="num">{formatSize(entry.size)}</td>
                                    <td class="action">
                                        {#if isRecomputable(entry.key)}
                                            <button
                                                type="button"
                                                class="link"
                                                disabled={!!busy}
                                                onclick={() => run(entry.key)}
                                            >
                                                {busy?.period === entry.key ? "Calcul…" : "Recalculer"}
                                            </button>
                                        {:else}
                                            <span class="muted" title="Recalculé avec « Tout recalculer »">—</span>
                                        {/if}
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
            {/if}
            {#if rideCount}
                <p class="meta rides-note">
                    + {formatNumber(rideCount)} entrées par attraction — voir <a href="/db">Gestion DB</a>
                </p>
            {:else if !cacheLoading && !cacheError}
                <p class="meta rides-note">Les entrées par attraction (ride:*) sont comptées dans <a href="/db">Gestion DB</a>.</p>
            {/if}
        </section>

        <section class="block">
            <h2>Aperçu « depuis le début »</h2>
            {#if bundleError}<p class="state error" role="alert">{bundleError}</p>{/if}
            {#if bundleLoading && !bundle}
                <p class="state">Chargement… (un bundle froid peut prendre ~30 s)</p>
            {:else if bundle}
                <p class="meta">
                    {bundle.period?.label} ({bundle.period?.from} → {bundle.period?.to}) · calculé
                    <span title={absoluteTime(bundle.computedAt)}>{relativeTime(bundle.computedAt, now)}</span>
                    en {formatMs(bundle.computeMs)}
                    {#if bundleLoading}· actualisation…{/if}
                </p>

                <div class="cards">
                    <div class="card">
                        <h3>Couverture</h3>
                        <dl>
                            <div><dt>Jours</dt><dd>{formatNumber(bundle.coverage?.days)}</dd></div>
                            <div><dt>Jours d'ouverture</dt><dd>{formatNumber(bundle.coverage?.operatingDays)}</dd></div>
                            <div><dt>Jours complets</dt><dd>{formatNumber(bundle.coverage?.completeDays)}</dd></div>
                            <div><dt>Échantillons</dt><dd>{formatNumber(bundle.coverage?.samples)}</dd></div>
                            <div><dt>Lignes</dt><dd>{formatNumber(bundle.coverage?.rows)}</dd></div>
                            <div><dt>Polls</dt><dd>{formatNumber(bundle.coverage?.polls)}</dd></div>
                        </dl>
                    </div>

                    {#each [{ title: "Jour le plus chargé", d: bundle.days?.byIndex?.most }, { title: "Jour le plus calme", d: bundle.days?.byIndex?.least }] as c}
                        <div class="card">
                            <h3>{c.title}</h3>
                            {#if c.d}
                                <p class="big">{dayLabel(c.d.date)}</p>
                                <dl>
                                    <div><dt>Index</dt><dd>{fixed1(c.d.index)}</dd></div>
                                    <div><dt>Médiane</dt><dd>{fixed1(c.d.raw)} min</dd></div>
                                    <div><dt>n</dt><dd>{formatNumber(c.d.n)}</dd></div>
                                </dl>
                            {:else}
                                <p class="muted">Aucun jour complet.</p>
                            {/if}
                        </div>
                    {/each}

                    <div class="card">
                        <h3>Paramètres</h3>
                        <dl>
                            <div><dt>Attractions à file</dt><dd>{formatNumber(bundle.params?.queueRideCount)}</dd></div>
                            <div><dt>Slots / jour (médiane)</dt><dd>{formatNumber(bundle.params?.medianSlotsPerDay)}</dd></div>
                            <div><dt>Seuil jour complet</dt><dd>{formatNumber(bundle.params?.completeDayMinSlots)}</dd></div>
                            <div>
                                <dt>Baselines</dt>
                                <dd title={absoluteTime(bundle.params?.baselinesComputedAt)}>
                                    {relativeTime(bundle.params?.baselinesComputedAt, now)}
                                </dd>
                            </div>
                        </dl>
                    </div>
                </div>

                <div class="card weekdays">
                    <h3>Index par jour de semaine</h3>
                    <ol>
                        {#each bundle.weekdays?.list ?? [] as w (w.weekday)}
                            <li title="{w.days} jours · médiane {fixed1(w.raw)} min · n {formatNumber(w.n)}">
                                <span class="wd">{w.name.slice(0, 3)}</span>
                                <span class="wi" class:hot={(w.index ?? 0) > 110} class:cold={(w.index ?? 100) < 90}>
                                    {fixed1(w.index)}
                                </span>
                            </li>
                        {/each}
                    </ol>
                </div>
            {/if}
        </section>
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
        margin-bottom: 8px;
    }

    h1 {
        font-size: 64px;
        font-weight: 400;
    }

    h2 {
        margin-bottom: 16px;
        font-size: 36px;
        font-weight: 400;
    }

    h3 {
        margin-bottom: 10px;
        color: var(--color-mint);
        font-size: 24px;
        font-weight: 400;
    }

    .hint {
        max-width: 1355px;
        margin-bottom: 20px;
        color: var(--color-mint);
        font-size: 18px;
        opacity: 0.8;
    }

    .block {
        max-width: 1355px;
        margin-top: 40px;
    }

    .btn {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        height: 40px;
        padding: 0 22px;
        border-radius: 10px;
        color: var(--color-text);
        font-family: inherit;
        font-size: 22px;
        cursor: pointer;
    }

    .btn.primary {
        border: 1px solid var(--color-gold-border);
        background: var(--color-gold);
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

    .feedback {
        max-width: 1355px;
    }

    .banner {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px;
        padding: 12px 18px;
        border-radius: 5px;
        font-size: 22px;
    }

    .banner.busy {
        border: 1px solid var(--color-gold-border);
        color: var(--color-gold-border);
    }

    .banner.error {
        border: 1px solid var(--color-red);
        color: var(--color-red);
    }

    .banner.done {
        flex-direction: column;
        align-items: flex-start;
        border: 1px solid var(--color-mint);
    }

    .timings {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 20px;
        font-size: 18px;
    }

    .timings span {
        color: var(--color-mint);
    }

    .pickers {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .quick,
    .pick {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px;
    }

    .pick label {
        min-width: 90px;
        font-size: 22px;
    }

    select {
        height: 40px;
        min-width: 260px;
        padding: 0 10px;
        border: 1px solid var(--color-line);
        border-radius: 5px;
        background: var(--color-surface);
        color: var(--color-text);
        font-family: inherit;
        font-size: 20px;
    }

    .table-wrap {
        overflow-x: auto;
    }

    table {
        width: 100%;
        border-collapse: collapse;
        font-size: 20px;
    }

    th {
        padding: 8px 12px;
        border-bottom: 1px solid var(--color-mint);
        color: var(--color-mint);
        font-weight: 400;
        text-align: left;
        white-space: nowrap;
    }

    td {
        padding: 8px 12px;
        border-bottom: 1px solid var(--color-line);
        vertical-align: middle;
        white-space: nowrap;
    }

    tbody tr:nth-child(odd) {
        background: linear-gradient(90deg, rgba(0, 116, 69, 0.45), transparent);
    }

    .num {
        text-align: right;
    }

    .label {
        margin-right: 8px;
        font-size: 22px;
    }

    .key {
        color: var(--color-mint);
        font-size: 16px;
        opacity: 0.7;
    }

    .tag {
        margin-left: 6px;
        padding: 0 6px;
        border: 1px solid var(--color-line);
        border-radius: 4px;
        font-size: 14px;
        opacity: 0.8;
    }

    .tag.busy {
        border-color: var(--color-gold-border);
        color: var(--color-gold-border);
    }

    .frozen {
        color: var(--color-purple);
    }

    .expired {
        color: var(--color-red);
    }

    .action {
        text-align: right;
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

    .link:hover:not(:disabled) {
        text-decoration: underline;
    }

    .link:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .muted {
        opacity: 0.6;
    }

    .meta {
        margin-bottom: 16px;
        font-size: 18px;
        opacity: 0.85;
    }

    .rides-note {
        margin: 10px 0 0;
    }

    .rides-note a {
        color: var(--color-mint);
    }

    .cards {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 16px;
        margin-bottom: 16px;
    }

    .card {
        padding: 14px 18px;
        border: 1px solid var(--color-mint);
        border-radius: 5px;
        background: var(--color-surface);
    }

    .card dl {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 19px;
    }

    .card dl div {
        display: flex;
        justify-content: space-between;
        gap: 12px;
    }

    .card dt {
        opacity: 0.75;
    }

    .big {
        margin-bottom: 6px;
        font-size: 26px;
    }

    .weekdays ol {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
        gap: 8px;
    }

    .weekdays li {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        padding: 6px 0;
        border: 1px solid var(--color-line);
        border-radius: 5px;
    }

    .wd {
        font-size: 18px;
        opacity: 0.75;
    }

    .wi {
        font-size: 24px;
    }

    .wi.hot {
        color: var(--color-red);
    }

    .wi.cold {
        color: var(--color-lime);
    }

    .state {
        padding: 12px 0;
        font-size: 22px;
        color: var(--color-mint);
    }

    .state.error {
        color: var(--color-red);
    }

    .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
    }

    @media (max-width: 900px) {
        .content {
            padding: 24px;
        }

        select {
            min-width: 0;
            flex: 1;
        }
    }
</style>
