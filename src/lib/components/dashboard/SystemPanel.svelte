<script>
    import { absoluteTime, formatNumber, relativeTime } from "$lib/stats";
    import { formatBytes, warmReasonLabel } from "$lib/db";

    /** @typedef {import("$lib/dashboard").DashboardOverview} DashboardOverview */

    /** @type {{ overview?: DashboardOverview | null, error?: string, now?: number }} */
    let { overview = null, error = "", now = Date.now() } = $props();

    /** Rulantica / weather considered stale after 2 h (only meaningful during opening hours). */
    const STALE_MS = 2 * 60 * 60 * 1000;
    /** @param {string | null | undefined} iso */
    const stale = (iso) => !iso || now - new Date(iso).getTime() > STALE_MS;
</script>

<aside class="system" aria-labelledby="system-title">
    <h2 id="system-title">Système</h2>

    {#if error && !overview}
        <p class="state error" role="alert">{error}</p>
    {:else if !overview}
        <p class="state">Chargement…</p>
    {:else}
        {@const o = overview}
        {@const warm = o.statsCache.warmup}
        <div class="card">
            <h3>Base <span class="db-name">{o.db.name}</span></h3>
            <dl>
                <div><dt>Taille</dt><dd>{formatBytes(o.db.sizeBytes)}</dd></div>
                <div><dt>Temps d'attente</dt><dd>{formatNumber(o.db.waitingTimes)} lignes</dd></div>
            </dl>
        </div>

        <div class="card">
            <h3>Contenu</h3>
            <dl>
                <div>
                    <dt>Articles</dt>
                    <dd><a href="/articles">{o.content.articlesPublished} publiés · {o.content.articlesDraft} brouillons</a></dd>
                </div>
                <div><dt>Attractions au catalogue</dt><dd>{o.content.rides}</dd></div>
                <div>
                    <dt>Fiches incomplètes</dt>
                    <dd class:warn={o.content.incomplete > 0}><a href="/entities">{o.content.incomplete}</a></dd>
                </div>
                <div>
                    <dt>Sans photo</dt>
                    <dd class:warn={o.content.no_photo > 0}>{o.content.no_photo}</dd>
                </div>
            </dl>
        </div>

        <div class="card">
            <h3>Cache des stats</h3>
            <dl>
                <div><dt>Entrées</dt><dd>{formatNumber(o.statsCache.entries)}</dd></div>
                <div>
                    <dt>Taille stockée</dt>
                    <dd title="Taille compressée en base (TOAST), pas la taille JSON">{formatBytes(o.statsCache.bytes)}</dd>
                </div>
                <div><dt>dont par attraction</dt><dd>{formatNumber(o.statsCache.rides)}</dd></div>
                <div><dt>Expirées</dt><dd class:warn={o.statsCache.expired > 0}>{formatNumber(o.statsCache.expired)}</dd></div>
                <div>
                    <dt>Préchauffage</dt>
                    {#if warm.running}
                        <dd class="busy" title={absoluteTime(warm.running.startedAt)}>
                            <span class="spinner" aria-hidden="true"></span>
                            en cours ({warmReasonLabel(warm.running.reason)})
                        </dd>
                    {:else if warm.last}
                        <dd title="Terminé {absoluteTime(warm.last.finishedAt)}">
                            {relativeTime(warm.last.finishedAt, now)} · {warm.last.computed} calculés{#if warm.last.failed}<span
                                    class="warn"
                                >, {warm.last.failed} échecs</span
                            >{/if}
                        </dd>
                    {:else}
                        <dd class="muted">pas encore</dd>
                    {/if}
                </div>
            </dl>
        </div>

        <div class="card">
            <h3>Autres collectes</h3>
            <dl>
                <div>
                    <dt>Rulantica</dt>
                    <dd class:muted={stale(o.collection.rulanticaLastPollAt)} title={absoluteTime(o.collection.rulanticaLastPollAt)}>
                        {relativeTime(o.collection.rulanticaLastPollAt, now)}
                    </dd>
                </div>
                <div>
                    <dt>Météo</dt>
                    <dd class:muted={stale(o.collection.weatherLastAt)} title={absoluteTime(o.collection.weatherLastAt)}>
                        {relativeTime(o.collection.weatherLastAt, now)}
                    </dd>
                </div>
            </dl>
        </div>
    {/if}

    <nav class="links" aria-label="Administration">
        <a class="btn outline" href="/stats">Statistiques</a>
        <a class="btn danger" href="/db">Gestion DB</a>
    </nav>
</aside>

<style>
    .system {
        display: flex;
        flex-direction: column;
        gap: 12px;
        min-width: 0;
        font-family: "Agdasima", sans-serif;
        color: var(--color-text);
    }

    h2 {
        font-size: 36px;
        font-weight: 400;
    }

    h3 {
        margin-bottom: 6px;
        color: var(--color-mint);
        font-size: 20px;
        font-weight: 400;
    }

    .db-name {
        color: var(--color-text);
        opacity: 0.6;
        font-size: 16px;
    }

    .card {
        padding: 12px 16px;
        border: 1px solid var(--color-mint);
        border-radius: 5px;
        background: var(--color-surface);
    }

    dl {
        display: flex;
        flex-direction: column;
        gap: 4px;
        font-size: 18px;
    }

    dl div {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 0 12px;
    }

    dt {
        opacity: 0.75;
    }

    dd {
        margin-left: auto;
        text-align: right;
    }

    dd a {
        color: inherit;
    }

    dd a:hover {
        color: var(--color-mint);
    }

    .warn {
        color: var(--color-gold-border);
    }

    .busy {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: var(--color-gold-border);
    }

    .muted {
        opacity: 0.55;
    }

    .spinner {
        display: inline-block;
        width: 12px;
        height: 12px;
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

    .links {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
    }

    .btn {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 42px;
        border-radius: 5px;
        color: var(--color-text);
        font-size: 22px;
        text-decoration: none;
    }

    .btn.outline {
        border: 1px solid var(--color-mint);
    }

    .btn.danger {
        border: 1px solid var(--color-red);
    }

    .btn:hover {
        filter: brightness(1.15);
        background: rgba(255, 255, 255, 0.05);
    }

    .state {
        color: var(--color-mint);
        font-size: 20px;
    }

    .state.error {
        color: var(--color-red);
    }
</style>
