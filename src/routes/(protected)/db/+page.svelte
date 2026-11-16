<script>
    import { onMount } from "svelte";
    import NavSidebar from "$lib/components/NavSidebar.svelte";
    import { absoluteTime, dayLabel, formatMs, formatNumber, relativeTime } from "$lib/stats";
    import {
        CACHE_KIND_LABELS,
        MISSING_LABELS,
        formatBytes,
        formatPct,
        formatSince,
        getDbOverview,
        runDbAction,
        warmReasonLabel
    } from "$lib/db";

    /** @typedef {import("$lib/db").DbOverview} DbOverview */
    /** @typedef {import("$lib/db").DbAction} DbAction */

    const WARM_POLL_MS = 10 * 1000;

    /** @param {unknown} e @param {string} fallback */
    const message = (e, fallback) => (e instanceof Error && e.message ? e.message : fallback);

    let data = $state(/** @type {DbOverview | null} */ (null));
    let loading = $state(true);
    let error = $state("");

    /** Ticks every 15 s: relative times stay current. */
    let now = $state(Date.now());

    /**
     * @type {{ key: DbAction, label: string, hint: string, confirm?: string }[]}
     */
    const ACTIONS = [
        {
            key: "warm-stats",
            label: "Préchauffer les stats",
            hint: "Calcule en arrière-plan les bundles et stats par attraction manquants ou expirés (aussi lancé après chaque relevé, la nuit, à minuit et au démarrage)."
        },
        {
            key: "sync-holidays",
            label: "Synchroniser les vacances",
            hint: "Jours fériés et vacances FR / DE (openholidaysapi.org) pour l'année en cours et la suivante. Aussi fait chaque lundi à 4 h."
        },
        {
            key: "purge-tokens",
            label: "Purger les jetons expirés",
            hint: "Supprime les refresh tokens expirés de refresh_tokens. Les sessions valides ne sont pas touchées.",
            confirm: "Supprimer définitivement les refresh tokens expirés ?"
        },
        {
            key: "analyze",
            label: "ANALYZE",
            hint: "Rafraîchit les statistiques du planificateur PostgreSQL des tables chargées (WaitingTimes, WeatherSnapshots, StatsCache, RulanticaWaits). Non bloquant."
        }
    ];

    /** @type {Record<string, { running: boolean, ok?: string, error?: string }>} */
    let actions = $state({});
    const anyRunning = $derived(Object.values(actions).some((a) => a.running));

    async function load() {
        try {
            data = await getDbOverview();
            error = "";
        } catch (e) {
            error = message(e, "Impossible de charger l'état de la base.");
        } finally {
            loading = false;
            now = Date.now();
        }
    }

    /** @param {any} res @param {DbAction} key */
    function describe(key, res) {
        switch (key) {
            case "warm-stats":
                return res?.warmup?.running ? "Préchauffage lancé — suivi ci-dessous." : "Préchauffage lancé.";
            case "sync-holidays": {
                const parts = Object.entries(res?.result ?? {}).map(
                    ([k, v]) =>
                        `${k} : ${/** @type {any} */ (v).inserted ?? 0} ajoutés, ${/** @type {any} */ (v).updated ?? 0} mis à jour`
                );
                return `Vacances ${(res?.years ?? []).join("–")} synchronisées. ${parts.join(" · ")}`;
            }
            case "purge-tokens":
                return `${formatNumber(res?.deleted ?? 0)} jeton(s) supprimé(s).`;
            case "analyze":
                return `ANALYZE terminé en ${formatMs(res?.ms)}.`;
        }
    }

    /** @param {typeof ACTIONS[number]} a */
    async function run(a) {
        if (actions[a.key]?.running) return;
        if (a.confirm && !confirm(a.confirm)) return;
        actions[a.key] = { running: true };
        try {
            const res = await runDbAction(a.key);
            actions[a.key] = { running: false, ok: describe(a.key, res) };
        } catch (e) {
            actions[a.key] = { running: false, error: message(e, "L'action a échoué.") };
        }
        await load();
    }

    // While a warm-up pass runs, follow it every 10 s.
    const warming = $derived(!!data?.statsCache.warmup.running);
    $effect(() => {
        if (!warming) return;
        const t = setInterval(() => {
            if (!document.hidden) load();
        }, WARM_POLL_MS);
        return () => clearInterval(t);
    });

    const missingSchema = $derived(data ? data.schema.filter((s) => !s.present) : []);
    const totalRows = $derived(data ? data.tables.reduce((s, t) => s + t.rows, 0) : 0);
    const maxTableBytes = $derived(data ? Math.max(1, ...data.tables.map((t) => t.totalBytes)) : 1);

    onMount(() => {
        load();
        const tick = setInterval(() => (now = Date.now()), 15 * 1000);
        return () => clearInterval(tick);
    });
</script>

<div class="page">
    <NavSidebar />

    <main class="content">
        <header class="head">
            <div class="title">
                <h1>Gestion DB</h1>
                {#if data}
                    <span class="env {data.env}">{data.env === "production" ? "Production" : "Développement"}</span>
                    <span class="db-name">{data.server.database}</span>
                {/if}
            </div>
            <button type="button" class="btn outline" disabled={loading} onclick={() => ((loading = true), load())}>
                {#if loading}<span class="spinner" aria-hidden="true"></span>{/if}
                Actualiser
            </button>
        </header>

        <p class="hint">
            Lecture seule par défaut : aucune requête SQL libre, aucune action destructive sur les données collectées.
            {#if data}Données du {absoluteTime(data.now)}.{/if}
        </p>

        {#if error}<p class="banner error" role="alert">{error}</p>{/if}

        {#if loading && !data}
            <p class="state">Chargement…</p>
        {:else if data}
            {@const d = data}
            {@const warm = d.statsCache.warmup}

            <!-- ── maintenance ── -->
            <section class="block">
                <h2>Maintenance</h2>
                <div class="actions">
                    {#each ACTIONS as a (a.key)}
                        {@const st = actions[a.key]}
                        <div class="action-card">
                            <button
                                type="button"
                                class="btn"
                                class:primary={a.key !== "purge-tokens"}
                                class:danger={a.key === "purge-tokens"}
                                disabled={anyRunning || (a.key === "warm-stats" && warming)}
                                onclick={() => run(a)}
                            >
                                {#if st?.running || (a.key === "warm-stats" && warming)}<span class="spinner" aria-hidden="true"></span>{/if}
                                {a.label}
                            </button>
                            <p class="action-hint">{a.hint}</p>
                            <div aria-live="polite">
                                {#if st?.error}
                                    <p class="result error" role="alert">{st.error}</p>
                                {:else if st?.ok}
                                    <p class="result ok">{st.ok}</p>
                                {/if}
                            </div>
                        </div>
                    {/each}
                </div>
                {#if warm.running}
                    <p class="banner busy">
                        <span class="spinner" aria-hidden="true"></span>
                        Préchauffage en cours ({warmReasonLabel(warm.running.reason)}) depuis
                        {formatSince(warm.running.startedAt, now)} — actualisation toutes les 10 s.
                    </p>
                {/if}
            </section>

            <!-- ── server + schema ── -->
            <section class="block">
                <h2>Serveur</h2>
                <div class="cards">
                    <div class="card">
                        <h3>PostgreSQL</h3>
                        <dl>
                            <div><dt>Version</dt><dd>{d.server.version}</dd></div>
                            <div>
                                <dt>Démarré</dt>
                                <dd title={absoluteTime(d.server.startedAt)}>il y a {formatSince(d.server.startedAt, now)}</dd>
                            </div>
                            <div><dt>Taille de la base</dt><dd>{formatBytes(d.server.sizeBytes)}</dd></div>
                            <div><dt>Connexions</dt><dd>{d.server.connections}</dd></div>
                        </dl>
                    </div>

                    <div class="card" class:alert={missingSchema.length > 0}>
                        <h3>Schéma</h3>
                        {#if missingSchema.length}
                            <p class="warn">{missingSchema.length} table(s) manquante(s) — migration à appliquer.</p>
                        {:else}
                            <p class="ok-text">Toutes les tables attendues sont présentes.</p>
                        {/if}
                        <ul class="schema">
                            {#each d.schema as s (s.name)}
                                <li class:missing={!s.present} title={s.present ? "présente" : "absente"}>
                                    <span class="mark" aria-hidden="true">{s.present ? "✓" : "✗"}</span>
                                    <span class="mig">{s.migration}</span>
                                    {s.name}
                                </li>
                            {/each}
                        </ul>
                    </div>

                    <div class="card">
                        <h3>Refresh tokens</h3>
                        <dl>
                            <div><dt>Total</dt><dd>{formatNumber(d.tokens.total)}</dd></div>
                            <div>
                                <dt>Expirés</dt>
                                <dd class:warn={d.tokens.expired > 0}>{formatNumber(d.tokens.expired)}</dd>
                            </div>
                        </dl>
                    </div>

                    <div class="card">
                        <h3>Vacances & fériés</h3>
                        {#if d.holidays.length}
                            <dl>
                                {#each d.holidays as h}
                                    <div>
                                        <dt>{h.country} · {h.kind === "public" ? "fériés" : "scolaires"}</dt>
                                        <dd title="{h.from} → {h.to}">{h.n} · {h.from.slice(0, 4)}–{h.to.slice(0, 4)}</dd>
                                    </div>
                                {/each}
                            </dl>
                        {:else}
                            <p class="warn">Table vide — lancer « Synchroniser les vacances ».</p>
                        {/if}
                    </div>
                </div>
            </section>

            <!-- ── tables ── -->
            <section class="block">
                <h2>Tables</h2>
                <div class="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Table</th>
                                <th class="num">Lignes ≈</th>
                                <th class="num">Total</th>
                                <th class="num">Données</th>
                                <th class="num">Index</th>
                                <th>Vacuum</th>
                                <th>Analyze</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each d.tables as t (t.name)}
                                <tr>
                                    <td>
                                        <span class="tname">{t.name}</span>
                                        <span class="size-bar" style="--w: {(t.totalBytes / maxTableBytes) * 100}%"></span>
                                    </td>
                                    <td class="num">{formatNumber(t.rows)}</td>
                                    <td class="num">{formatBytes(t.totalBytes)}</td>
                                    <td class="num muted">{formatBytes(t.tableBytes)}</td>
                                    <td class="num muted">{formatBytes(t.indexBytes)}</td>
                                    <td title={absoluteTime(t.lastVacuum)} class:muted={!t.lastVacuum}>
                                        {t.lastVacuum ? relativeTime(t.lastVacuum, now) : "jamais"}
                                    </td>
                                    <td title={absoluteTime(t.lastAnalyze)} class:muted={!t.lastAnalyze}>
                                        {t.lastAnalyze ? relativeTime(t.lastAnalyze, now) : "jamais"}
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td>{d.tables.length} tables</td>
                                <td class="num">{formatNumber(totalRows)}</td>
                                <td class="num">{formatBytes(d.server.sizeBytes)}</td>
                                <td colspan="4" class="muted">taille de la base entière</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <p class="note">Lignes = estimation PostgreSQL (n_live_tup), pas un comptage exact.</p>
            </section>

            <!-- ── collection ── -->
            <section class="block">
                <h2>Collecte (14 derniers jours)</h2>
                {#if d.collection.pollsMissingWeather30d}
                    <p class="banner warn-banner">
                        {formatNumber(d.collection.pollsMissingWeather30d)} relevé(s) des 30 derniers jours sans instantané météo
                        (relancer <code>DB/seeds/002_weather_backfill.js</code> côté backend).
                    </p>
                {/if}
                {#if d.collection.days.length}
                    <div class="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Jour</th>
                                    <th class="num">Relevés</th>
                                    <th>Plage</th>
                                    <th class="num">Lignes</th>
                                    <th class="num">Ouvertes</th>
                                    <th class="num">Météo</th>
                                    <th class="num">Rulantica</th>
                                </tr>
                            </thead>
                            <tbody>
                                {#each d.collection.days as day (day.date)}
                                    <tr class:gap={day.weather < day.polls}>
                                        <td>{dayLabel(day.date)}</td>
                                        <td class="num">{day.polls}</td>
                                        <td>{day.first} → {day.last}</td>
                                        <td class="num">{formatNumber(day.rows)}</td>
                                        <td class="num">{formatPct(day.openRows, day.rows)}</td>
                                        <td
                                            class="num"
                                            class:warn={day.weather < day.polls}
                                            title={day.weather < day.polls ? `${day.polls - day.weather} relevé(s) sans météo` : ""}
                                        >
                                            {day.weather} / {day.polls}
                                        </td>
                                        <td class="num" class:muted={!day.rulantica}>{day.rulantica}</td>
                                    </tr>
                                {/each}
                            </tbody>
                        </table>
                    </div>
                {:else}
                    <p class="state">Aucun relevé sur la période.</p>
                {/if}
            </section>

            <!-- ── catalogue ── -->
            <section class="block">
                <h2>Catalogue</h2>
                <p class="meta">
                    {d.catalogue.rides} attractions au catalogue · {d.catalogue.uncatalogued.length} non cataloguée(s) ·
                    {d.catalogue.incomplete.length} fiche(s) incomplète(s)
                </p>
                <div class="cards wide">
                    <div class="card" class:alert={d.catalogue.uncatalogued.length > 0}>
                        <h3>Relevées mais absentes du catalogue (30 j)</h3>
                        {#if d.catalogue.uncatalogued.length}
                            <ul class="plain">
                                {#each d.catalogue.uncatalogued as u (u.apiId)}
                                    <li><span class="mig">{u.apiId}</span> {u.name ?? "nom inconnu"}</li>
                                {/each}
                            </ul>
                        {:else}
                            <p class="ok-text">Toutes les attractions relevées sont cataloguées.</p>
                        {/if}
                    </div>

                    <div class="card">
                        <h3>Fiches incomplètes</h3>
                        {#if d.catalogue.incomplete.length}
                            <ul class="plain incomplete">
                                {#each d.catalogue.incomplete as r (r.id)}
                                    <li>
                                        <a href="/entities/{r.id}">{r.name}</a>
                                        <span class="chips">
                                            {#each r.missing as m}<span class="chip">{MISSING_LABELS[m] ?? m}</span>{/each}
                                        </span>
                                    </li>
                                {/each}
                            </ul>
                        {:else}
                            <p class="ok-text">Toutes les fiches sont complètes.</p>
                        {/if}
                    </div>
                </div>
            </section>

            <!-- ── stats cache ── -->
            <section class="block">
                <h2>Cache des stats</h2>
                <p class="meta">
                    Préchauffage :
                    {#if warm.running}
                        <span class="busy-text">en cours ({warmReasonLabel(warm.running.reason)})</span>
                    {:else if warm.last}
                        dernier passage <span title={absoluteTime(warm.last.finishedAt)}>{relativeTime(warm.last.finishedAt, now)}</span>
                        ({warmReasonLabel(warm.last.reason)}) · {formatNumber(warm.last.computed)} calculés
                        {#if warm.last.failed}<span class="warn">· {warm.last.failed} échecs</span>{/if}
                        · {formatSince(warm.last.startedAt, new Date(warm.last.finishedAt).getTime())}
                    {:else}
                        aucun passage depuis le démarrage du serveur
                    {/if}
                    · <a href="/stats">Statistiques</a>
                </p>
                {#if d.statsCache.kinds.length}
                    <div class="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Type</th>
                                    <th class="num">Entrées</th>
                                    <th class="num">Figées</th>
                                    <th class="num">Expirées</th>
                                    <th class="num" title="Taille stockée (compressée TOAST), pas la taille JSON">Taille stockée</th>
                                    <th>Dernier calcul</th>
                                </tr>
                            </thead>
                            <tbody>
                                {#each d.statsCache.kinds as k (k.kind)}
                                    <tr>
                                        <td>{CACHE_KIND_LABELS[k.kind] ?? k.kind}</td>
                                        <td class="num">{formatNumber(k.entries)}</td>
                                        <td class="num frozen">{formatNumber(k.frozen)}</td>
                                        <td class="num" class:expired={k.expired > 0}>{formatNumber(k.expired)}</td>
                                        <td class="num">{formatBytes(k.bytes)}</td>
                                        <td title={absoluteTime(k.lastComputedAt)}>{relativeTime(k.lastComputedAt, now)}</td>
                                    </tr>
                                {/each}
                            </tbody>
                        </table>
                    </div>
                {:else}
                    <p class="state">Cache vide — lancer « Préchauffer les stats ».</p>
                {/if}
            </section>
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
        padding: 36px 48px 64px;
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

    .title {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px 16px;
    }

    h1 {
        font-size: 64px;
        font-weight: 400;
    }

    h2 {
        margin-bottom: 14px;
        font-size: 36px;
        font-weight: 400;
    }

    h3 {
        margin-bottom: 10px;
        color: var(--color-mint);
        font-size: 22px;
        font-weight: 400;
    }

    .env {
        padding: 2px 12px;
        border: 1px solid currentColor;
        border-radius: 5px;
        font-size: 22px;
    }

    .env.production {
        border-color: var(--color-red);
        background: rgba(228, 73, 92, 0.18);
        color: var(--color-gold-border);
    }

    .env.development {
        color: var(--color-mint);
        background: rgba(95, 239, 193, 0.1);
    }

    .db-name {
        font-size: 22px;
        opacity: 0.7;
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

    .btn.danger {
        border: 1px solid var(--color-red);
        background: rgba(228, 73, 92, 0.18);
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
        flex-shrink: 0;
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

    .banner {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px;
        max-width: 1355px;
        margin-bottom: 14px;
        padding: 12px 18px;
        border-radius: 5px;
        font-size: 20px;
    }

    .banner.busy {
        margin-top: 14px;
        border: 1px solid var(--color-gold-border);
        color: var(--color-gold-border);
    }

    .banner.error {
        border: 1px solid var(--color-red);
        color: var(--color-red);
    }

    .banner.warn-banner {
        border: 1px solid var(--color-gold-border);
    }

    code {
        font-family: Consolas, monospace;
        font-size: 16px;
    }

    .actions {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: 16px;
    }

    .action-card {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        padding: 14px 18px;
        border: 1px solid var(--color-line);
        border-radius: 5px;
        background: var(--color-surface);
    }

    .action-hint {
        font-size: 16px;
        opacity: 0.75;
    }

    .result {
        font-size: 17px;
    }

    .result.ok {
        color: var(--color-mint);
    }

    .result.error {
        color: var(--color-red);
    }

    .cards {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
        gap: 16px;
    }

    .cards.wide {
        grid-template-columns: repeat(auto-fit, minmax(min(100%, 400px), 1fr));
    }

    .card {
        min-width: 0;
        padding: 14px 18px;
        border: 1px solid var(--color-mint);
        border-radius: 5px;
        background: var(--color-surface);
    }

    .card.alert {
        border-color: var(--color-gold-border);
    }

    .card dl {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 19px;
    }

    .card dl div {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 0 12px;
    }

    .card dt {
        opacity: 0.75;
    }

    .card dd {
        margin-left: auto;
        text-align: right;
        overflow-wrap: anywhere;
    }

    .schema {
        display: flex;
        flex-direction: column;
        gap: 2px;
        margin-top: 8px;
        font-size: 17px;
    }

    .schema .mark {
        display: inline-block;
        width: 16px;
        color: var(--color-mint);
    }

    .schema .missing {
        color: var(--color-red);
    }

    .schema .missing .mark {
        color: var(--color-red);
    }

    .mig {
        display: inline-block;
        min-width: 38px;
        margin-right: 6px;
        color: var(--color-mint);
        font-size: 14px;
        opacity: 0.7;
    }

    .plain {
        display: flex;
        flex-direction: column;
        gap: 6px;
        font-size: 18px;
    }

    .incomplete {
        max-height: 360px;
        overflow-y: auto;
    }

    .incomplete li {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 4px 10px;
    }

    .incomplete a {
        color: var(--color-text);
    }

    .incomplete a:hover {
        color: var(--color-mint);
    }

    .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
    }

    .chip {
        padding: 0 6px;
        border: 1px solid var(--color-gold-border);
        border-radius: 4px;
        color: var(--color-gold-border);
        font-size: 14px;
    }

    .table-wrap {
        overflow-x: auto;
    }

    table {
        width: 100%;
        border-collapse: collapse;
        font-size: 19px;
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
        padding: 7px 12px;
        border-bottom: 1px solid var(--color-line);
        vertical-align: middle;
        white-space: nowrap;
    }

    tbody tr:nth-child(odd) {
        background: linear-gradient(90deg, rgba(0, 116, 69, 0.45), transparent);
    }

    tbody tr.gap td:first-child {
        box-shadow: inset 3px 0 0 var(--color-gold-border);
    }

    tfoot td {
        border-bottom: none;
        color: var(--color-mint);
    }

    .tname {
        display: block;
    }

    .size-bar {
        display: block;
        width: var(--w);
        min-width: 2px;
        height: 3px;
        margin-top: 3px;
        border-radius: 2px;
        background: var(--color-mint);
        opacity: 0.55;
    }

    .num {
        text-align: right;
        font-variant-numeric: tabular-nums;
    }

    .muted {
        opacity: 0.6;
    }

    .warn {
        color: var(--color-gold-border);
    }

    .ok-text {
        color: var(--color-mint);
        font-size: 18px;
    }

    .busy-text {
        color: var(--color-gold-border);
    }

    .frozen {
        color: var(--color-purple);
    }

    .expired {
        color: var(--color-red);
    }

    .meta,
    .note {
        margin-bottom: 12px;
        font-size: 18px;
        opacity: 0.85;
    }

    .note {
        margin: 8px 0 0;
        font-size: 16px;
        opacity: 0.6;
    }

    .meta a {
        color: var(--color-mint);
    }

    .state {
        padding: 12px 0;
        font-size: 22px;
        color: var(--color-mint);
    }

    @media (max-width: 900px) {
        .content {
            padding: 24px;
        }
    }

    @media (max-width: 575px) {
        .content {
            padding: 16px 12px 40px;
        }

        h1 {
            font-size: 48px;
        }

        h2 {
            font-size: 30px;
        }

        .actions,
        .cards {
            grid-template-columns: minmax(0, 1fr);
        }

        .btn {
            height: auto;
            min-height: 40px;
            padding: 6px 16px;
            white-space: normal;
            text-align: left;
        }
    }
</style>
