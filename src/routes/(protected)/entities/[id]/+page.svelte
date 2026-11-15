<script>
    import { page } from "$app/state";
    import { apiFetch } from "$lib/api";
    import { TYPE_LABELS } from "$lib/rides";
    import NavSidebar from "$lib/components/NavSidebar.svelte";
    import PhotoGallery from "$lib/components/rides/PhotoGallery.svelte";

    /**
     * @typedef {{
     *   Id: string, ApiId: string, Name: string, Description: string, Type: string | null,
     *   LandId: string | null, LandName: string | null, CoverId: string | null,
     *   Manufacturer: string | null, OpeningYear: number | null, OpeningDate: string | null,
     *   Height: number | null, Length: number | null, MaxSpeed: number | null, TimeLength: number | null, PPH: number | null,
     *   MinimalAge: number | null, MinimalHeight: number | null, Trains: number | null, Carriages: number | null,
     *   VehicleCapacity: number | null,
     *   types: string[]
     * }} Ride
     */

    // Editable fields, in display order. `kind` drives the input and how the
    // value is sent back (numbers or null, text as string).
    const FIELDS = /** @type {const} */ ([
        { key: "Manufacturer", label: "Constructeur", kind: "text" },
        { key: "OpeningYear", label: "Année d'ouverture", kind: "int" },
        { key: "OpeningDate", label: "Date d'ouverture exacte", kind: "date" },
        { key: "Height", label: "Hauteur", unit: "m", kind: "decimal" },
        { key: "Length", label: "Longueur", unit: "m", kind: "int" },
        { key: "MaxSpeed", label: "Vitesse max", unit: "km/h", kind: "int" },
        { key: "TimeLength", label: "Durée", unit: "s", kind: "int" },
        { key: "PPH", label: "Débit", unit: "pers./h", kind: "int" },
        { key: "MinimalHeight", label: "Taille minimale", unit: "cm", kind: "int" },
        { key: "MinimalAge", label: "Âge minimal", unit: "ans", kind: "int" },
        { key: "Trains", label: "Trains / véhicules", kind: "int" },
        { key: "Carriages", label: "Wagons par train", kind: "int" },
        { key: "VehicleCapacity", label: "Places par train", kind: "int" }
    ]);
    const KEYS = ["Name", "Description", "Type", "LandId", ...FIELDS.map((f) => f.key)];

    /** @type {Ride | null} */
    let ride = $state(null);
    /** @type {Record<string, string>} form values, all as strings for the inputs */
    let form = $state({});
    /** @type {{ id: string, name: string }[]} */
    let lands = $state([]);

    let loading = $state(true);
    let loadError = $state("");
    let saving = $state(false);
    /** @type {Record<string, string>} */
    let errors = $state({});
    let notice = $state("");

    /** @param {Ride} r */
    function toForm(r) {
        return Object.fromEntries(KEYS.map((k) => [k, r[/** @type {keyof Ride} */ (k)] == null ? "" : String(r[/** @type {keyof Ride} */ (k)])]));
    }

    // bind:value on type="number" yields a number (or null when emptied), so
    // compare/send everything through its string form.
    const val = (/** @type {string} */ k) => (form[k] == null ? "" : String(form[k]).trim());

    const dirty = $derived(ride !== null && KEYS.some((k) => val(k) !== toForm(/** @type {Ride} */ (ride))[k]));

    async function load(/** @type {string} */ id) {
        loading = true;
        loadError = "";
        try {
            const [r, l] = await Promise.all([apiFetch(`/rides/${id}`), apiFetch("/rides/lands")]);
            if (r.status === 404) throw new Error("Entité introuvable.");
            if (!r.ok || !l.ok) throw new Error("Impossible de charger l'entité.");
            ride = await r.json();
            lands = await l.json();
            form = toForm(/** @type {Ride} */ (ride));
        } catch (e) {
            loadError = e instanceof Error ? e.message : String(e);
        } finally {
            loading = false;
        }
    }

    $effect(() => {
        load(page.params.id ?? "");
    });

    async function save(/** @type {SubmitEvent} */ event) {
        event.preventDefault();
        if (!ride || !dirty) return;
        saving = true;
        errors = {};
        notice = "";

        // Only send what changed; empty inputs clear the column (except Name/Description).
        const original = toForm(ride);
        /** @type {Record<string, string | number | null>} */
        const body = {};
        for (const k of KEYS) {
            const v = val(k);
            if (v === original[k]) continue;
            const isNum = FIELDS.some((f) => f.key === k && (f.kind === "int" || f.kind === "decimal"));
            body[k] = k === "Name" || k === "Description" ? v : v === "" ? null : isNum ? Number(v) : v;
        }

        try {
            const res = await apiFetch(`/rides/${ride.Id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (res.status === 400 && data.errors) {
                errors = data.errors;
                notice = "Certains champs sont invalides.";
            } else if (!res.ok) {
                notice = "L'enregistrement a échoué.";
            } else {
                ride = data;
                form = toForm(data);
                notice = "Modifications enregistrées.";
            }
        } catch {
            notice = "L'enregistrement a échoué.";
        } finally {
            saving = false;
        }
    }

    function cancel() {
        if (ride) form = toForm(ride);
        errors = {};
        notice = "";
    }
</script>

<div class="page">
    <NavSidebar />

    <main class="content">
        <a class="back" href="/entities">← Entités</a>

        {#if loading}
            <p class="state">Chargement…</p>
        {:else if loadError || !ride}
            <p class="state error">{loadError}</p>
        {:else}
            <header class="head">
                <h1>{ride.Name}</h1>
                <span class="meta">{ride.LandName ?? "Sans quartier"} · ID queue-times {ride.ApiId}</span>
            </header>

            <div class="layout">
                <PhotoGallery rideId={ride.Id} rideName={ride.Name} />

                <form class="form" onsubmit={save}>
                    <fieldset>
                        <legend>Général</legend>

                        <label class="field wide">
                            <span>Nom</span>
                            <input type="text" bind:value={form.Name} required maxlength="200" />
                            {#if errors.Name}<small class="field-error">{errors.Name}</small>{/if}
                        </label>

                        <label class="field">
                            <span>Quartier</span>
                            <select bind:value={form.LandId}>
                                <option value="">—</option>
                                {#each lands as land}
                                    <option value={land.id}>{land.name}</option>
                                {/each}
                            </select>
                            {#if errors.LandId}<small class="field-error">{errors.LandId}</small>{/if}
                        </label>

                        <label class="field">
                            <span>Type</span>
                            <select bind:value={form.Type}>
                                <option value="">—</option>
                                {#each ride.types as t}
                                    <option value={t}>{TYPE_LABELS[t] ?? t}</option>
                                {/each}
                            </select>
                            {#if errors.Type}<small class="field-error">{errors.Type}</small>{/if}
                        </label>

                        <label class="field wide">
                            <span>Description</span>
                            <textarea bind:value={form.Description} rows="4" maxlength="5000"></textarea>
                        </label>
                    </fieldset>

                    <fieldset>
                        <legend>Caractéristiques</legend>
                        {#each FIELDS as f}
                            <label class="field">
                                <span>{f.label}{#if "unit" in f}<em> ({f.unit})</em>{/if}</span>
                                {#if f.kind === "int"}
                                    <input type="number" min="0" step="1" inputmode="numeric" bind:value={form[f.key]} />
                                {:else if f.kind === "decimal"}
                                    <input type="number" min="0" step="0.1" inputmode="decimal" bind:value={form[f.key]} />
                                {:else}
                                    <input type={f.kind} bind:value={form[f.key]} />
                                {/if}
                                {#if errors[f.key]}<small class="field-error">{errors[f.key]}</small>{/if}
                            </label>
                        {/each}
                    </fieldset>

                    <div class="actions">
                        <button type="submit" class="btn primary" disabled={!dirty || saving}>
                            {saving ? "Enregistrement…" : "Enregistrer"}
                        </button>
                        <button type="button" class="btn ghost" disabled={!dirty || saving} onclick={cancel}>Annuler</button>
                        {#if notice}<p class="notice" class:bad={Object.keys(errors).length}>{notice}</p>{/if}
                    </div>
                </form>
            </div>
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
        padding: 36px 82px 64px 76px;
        color: var(--color-text);
        font-family: "Agdasima", sans-serif;
    }

    .back {
        color: var(--color-mint);
        font-size: 22px;
        text-decoration: none;
    }

    .back:hover {
        text-decoration: underline;
    }

    .head {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 8px 24px;
        margin: 8px 0 32px;
    }

    h1 {
        font-size: 64px;
        font-weight: 400;
    }

    .meta {
        color: var(--color-mint);
        font-size: 22px;
    }

    .layout {
        display: grid;
        grid-template-columns: minmax(0, 473px) minmax(0, 1fr);
        gap: 48px;
        align-items: start;
        max-width: 1355px;
    }

    @media (max-width: 1100px) {
        .layout {
            grid-template-columns: 1fr;
        }
    }

    .form {
        display: flex;
        flex-direction: column;
        gap: 32px;
    }

    fieldset {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 18px 24px;
        padding: 0;
        border: none;
    }

    legend {
        margin-bottom: 14px;
        padding-bottom: 6px;
        width: 100%;
        border-bottom: 1px solid var(--color-mint);
        font-size: 32px;
    }

    .field {
        display: flex;
        flex-direction: column;
        gap: 6px;
        font-size: 20px;
    }

    .field.wide {
        grid-column: 1 / -1;
    }

    .field em {
        font-style: normal;
        opacity: 0.6;
    }

    input,
    select,
    textarea {
        padding: 8px 10px;
        border: 1px solid var(--color-line);
        border-radius: 5px;
        background: var(--color-surface);
        color: var(--color-text);
        font-family: inherit;
        font-size: 22px;
        color-scheme: dark;
    }

    textarea {
        resize: vertical;
    }

    input:focus,
    select:focus,
    textarea:focus {
        border-color: var(--color-mint);
        outline: none;
    }

    .field-error {
        color: var(--color-red);
        font-size: 18px;
    }

    .actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 16px;
    }

    .btn {
        height: 40px;
        padding: 0 22px;
        border-radius: 10px;
        color: var(--color-text);
        font-family: inherit;
        font-size: 22px;
        cursor: pointer;
    }

    .btn:disabled {
        opacity: 0.45;
        cursor: default;
    }

    .btn.primary {
        border: 1px solid var(--color-gold-border);
        background: var(--color-gold);
    }

    .btn.ghost {
        border: 1px solid var(--color-mint);
        background: none;
    }

    .notice {
        color: var(--color-mint);
        font-size: 20px;
    }

    .notice.bad {
        color: var(--color-red);
    }

    .state {
        padding: 16px 0;
        font-size: 24px;
        color: var(--color-mint);
    }

    .state.error {
        color: var(--color-red);
    }
</style>
