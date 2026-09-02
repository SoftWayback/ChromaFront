<script>
    /** @typedef {{ label: string, value: string }} StatItem */

    /** @type {{ items?: StatItem[], onAdministration?: () => void }} */
    let { items = [], onAdministration } = $props();
</script>

<section class="stats-panel">
    <dl class="card">
        {#each items as item}
            <div class="row">
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
            </div>
        {/each}
    </dl>

    <button type="button" class="admin" onclick={() => onAdministration?.()}>Administration</button>
</section>

<style>
    .stats-panel {
        display: flex;
        flex-direction: column;
        gap: 12px;
        font-family: "Agdasima", sans-serif;
        color: var(--color-text);
    }

    .card {
        display: flex;
        flex-direction: column;
        gap: 14px;
        padding: 18px 22px;
        border: 1px solid var(--color-mint);
        border-radius: 5px;
    }

    .row {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 16px;
        font-size: 1.35rem;
    }

    dd {
        text-align: right;
    }

    .admin {
        padding: 10px;
        border: 1px solid var(--color-red);
        border-radius: 5px;
        background: none;
        color: var(--color-text);
        font-family: inherit;
        font-size: 1.35rem;
        text-align: center;
        cursor: pointer;
    }
</style>
