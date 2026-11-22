<script>
    import { untrack } from "svelte";
    import { page } from "$app/state";
    import { beforeNavigate } from "$app/navigation";
    import NavSidebar from "$lib/components/NavSidebar.svelte";
    import PhotoGallery from "$lib/components/rides/PhotoGallery.svelte";
    import { paragraphs, wordCount } from "$lib/articles";
    import { MISSING_LABELS } from "$lib/db";
    import {
        DESCRIPTION_MAX,
        IDENTITY_FIELDS,
        NAME_MAX,
        RideFieldsError,
        TECH_FIELDS,
        formatDuration,
        getLands,
        getRide,
        missingFields,
        parseField,
        rideSiteUrl,
        typeLabel,
        updateRide
    } from "$lib/rides";

    /** @typedef {import("$lib/rides").Ride} Ride */
    /** @typedef {import("$lib/rides").RideField} RideField */
    /** @typedef {import("$lib/rides").Land} Land */

    const NUMERIC_FIELDS = [...IDENTITY_FIELDS, ...TECH_FIELDS];
    const KEYS = ["Name", "Description", "Type", "LandId", ...NUMERIC_FIELDS.map((f) => f.key)];
    /** @type {Record<string, string>} */
    const LABELS = {
        Name: "Nom",
        Description: "Description",
        Type: "Type",
        LandId: "Quartier",
        ...Object.fromEntries(NUMERIC_FIELDS.map((f) => [f.key, f.label]))
    };

    /** @type {Ride | null} */
    let ride = $state(null);
    /** @type {Record<string, string>} form values, all strings */
    let form = $state({});
    /** @type {Record<string, string>} last saved values */
    let baseline = $state({});
    /** @type {Land[]} */
    let lands = $state([]);
    let photoCount = $state(0);

    let loading = $state(true);
    let loadError = $state("");
    let saving = $state(false);
    let attempted = $state(false);
    /** @type {Record<string, string>} backend messages, cleared when the field is edited */
    let serverErrors = $state({});
    let error = $state("");
    let notice = $state("");

    /** @param {Ride} r @returns {Record<string, string>} */
    function toForm(r) {
        return Object.fromEntries(
            KEYS.map((k) => {
                const v = r[/** @type {keyof Ride} */ (k)];
                return [k, v == null ? "" : String(v)];
            })
        );
    }

    const dirtyKeys = $derived(KEYS.filter((k) => (form[k] ?? "").trim() !== (baseline[k] ?? "").trim()));
    const dirty = $derived(ride !== null && dirtyKeys.length > 0);

    /** Client-side validation, same rules and wording as RidesRouter. */
    const clientErrors = $derived.by(() => {
        /** @type {Record<string, string>} */
        const out = {};
        const name = (form.Name ?? "").trim();
        if (!name) out.Name = "obligatoire";
        else if (name.length > NAME_MAX) out.Name = `${NAME_MAX} caractères maximum`;
        if ((form.Description ?? "").trim().length > DESCRIPTION_MAX) out.Description = `${DESCRIPTION_MAX} caractères maximum`;
        for (const f of NUMERIC_FIELDS) {
            const r = parseField(f, form[f.key] ?? "");
            if (r.error) out[f.key] = r.error;
        }
        return out;
    });

    /** @param {string} key */
    function fieldError(key) {
        if (serverErrors[key]) return serverErrors[key];
        if (!clientErrors[key]) return "";
        // only nag about fields being edited (or after a save attempt)
        return attempted || dirtyKeys.includes(key) ? clientErrors[key] : "";
    }

    const missing = $derived.by(() => (ride ? missingFields(ride, photoCount) : []));
    const siteUrl = $derived.by(() => rideSiteUrl(ride?.ApiId));
    const descParagraphs = $derived(paragraphs(form.Description).length);
    const descWords = $derived(wordCount(form.Description));
    const yearMismatch = $derived(
        /^\d{4}-/.test(form.OpeningDate ?? "") &&
            /^\d{4}$/.test((form.OpeningYear ?? "").trim()) &&
            form.OpeningDate.slice(0, 4) !== form.OpeningYear.trim()
    );

    /** @param {string} id */
    async function load(id) {
        loading = true;
        loadError = "";
        try {
            const [r, l] = await Promise.all([getRide(id), lands.length ? Promise.resolve(lands) : getLands()]);
            if (id !== page.params.id) return;
            if (!r) throw new Error("Entité introuvable.");
            lands = l;
            reset(r);
        } catch (e) {
            loadError = e instanceof Error ? e.message : "Impossible de charger l'entité.";
        } finally {
            loading = false;
        }
    }

    /** @param {Ride} r */
    function reset(r) {
        ride = r;
        form = toForm(r);
        baseline = { ...form };
        serverErrors = {};
        attempted = false;
        error = "";
        notice = "";
    }

    $effect(() => {
        const id = page.params.id ?? "";
        untrack(() => load(id));
    });

    async function save(/** @type {Event} */ event) {
        event.preventDefault();
        if (!ride || !dirty || saving) return;
        attempted = true;
        error = "";
        notice = "";
        const invalid = dirtyKeys.filter((k) => clientErrors[k]);
        if (invalid.length) {
            error = `Corrige ${invalid.length > 1 ? "les champs" : "le champ"} : ${invalid.map((k) => LABELS[k]).join(", ")}.`;
            document.getElementById(`f-${invalid[0]}`)?.focus();
            return;
        }

        /** @type {Record<string, string | number | null>} */
        const body = {};
        for (const k of dirtyKeys) {
            const raw = form[k] ?? "";
            const f = NUMERIC_FIELDS.find((x) => x.key === k);
            if (f) body[k] = /** @type {string | number | null} */ (parseField(f, raw).value);
            else if (k === "Name" || k === "Description") body[k] = raw.trim();
            else body[k] = raw === "" ? null : raw; // Type, LandId
        }

        saving = true;
        const sent = { ...form };
        try {
            const saved = await updateRide(ride.Id, body);
            const typedMeanwhile = KEYS.some((k) => form[k] !== sent[k]);
            ride = saved;
            baseline = toForm(saved);
            if (!typedMeanwhile) form = { ...baseline };
            serverErrors = {};
            attempted = false;
            notice = "Modifications enregistrées.";
        } catch (e) {
            if (e instanceof RideFieldsError) {
                serverErrors = e.fields;
                error = `Refusé par le serveur : ${Object.keys(e.fields).map((k) => LABELS[k] ?? k).join(", ")}.`;
            } else {
                error = e instanceof Error ? e.message : "L'enregistrement a échoué.";
            }
        } finally {
            saving = false;
        }
    }

    function discard() {
        form = { ...baseline };
        serverErrors = {};
        attempted = false;
        error = "";
        notice = "";
    }

    /** @param {string} key */
    function edited(key) {
        if (serverErrors[key]) {
            const { [key]: _, ...rest } = serverErrors;
            serverErrors = rest;
        }
        notice = "";
    }

    beforeNavigate((nav) => {
        if (!dirty) return;
        if (nav.type === "leave") {
            nav.cancel(); // tab close / reload: the browser shows its own prompt
            return;
        }
        if (!confirm("Des modifications ne sont pas enregistrées. Quitter quand même ?")) nav.cancel();
    });

    function onKeydown(/** @type {KeyboardEvent} */ e) {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
            e.preventDefault();
            if (!loading && !loadError) save(e);
        }
    }
</script>

<svelte:window onkeydown={onKeydown} />

{#snippet field(/** @type {RideField} */ f)}
    {@const err = fieldError(f.key)}
    <div class="field">
        <label for="f-{f.key}">
            {f.label}{#if f.unit}<em> ({f.unit})</em>{/if}
        </label>
        {#if f.kind === "date"}
            <input id="f-{f.key}" type="date" bind:value={form[f.key]} class:invalid={err} oninput={() => edited(f.key)} />
        {:else if f.kind === "text"}
            <input
                id="f-{f.key}"
                type="text"
                maxlength={f.maxLength}
                bind:value={form[f.key]}
                class:invalid={err}
                oninput={() => edited(f.key)}
            />
        {:else}
            <span class="with-unit">
                <input
                    id="f-{f.key}"
                    type="text"
                    inputmode={f.kind === "int" ? "numeric" : "decimal"}
                    autocomplete="off"
                    bind:value={form[f.key]}
                    class:invalid={err}
                    aria-invalid={!!err}
                    aria-describedby="h-{f.key}"
                    oninput={() => edited(f.key)}
                />
                {#if f.unit}<span class="unit" aria-hidden="true">{f.unit}</span>{/if}
            </span>
        {/if}
        <small id="h-{f.key}" class:field-error={err} class:help={!err}>
            {#if err}
                {err}
            {:else if f.key === "TimeLength" && /^\d+$/.test((form.TimeLength ?? "").trim())}
                = {formatDuration(Number(form.TimeLength))}
            {:else if f.key === "OpeningYear" && yearMismatch}
                <span class="warn">Différente de l'année de la date exacte.</span>
            {:else if f.hint}
                {f.hint}
            {:else if f.min != null && f.max != null}
                {f.min} – {f.max.toLocaleString("fr-FR")}
            {/if}
        </small>
    </div>
{/snippet}

<div class="page">
    <NavSidebar />

    <main class="content">
        <a class="back" href="/entities">← Entités</a>

        {#if loading && !ride}
            <p class="state"><span class="spinner" aria-hidden="true"></span> Chargement…</p>
        {:else if loadError || !ride}
            <div class="banner error" role="alert">
                <span>{loadError || "Entité introuvable."}</span>
                <button type="button" class="btn outline" onclick={() => load(page.params.id ?? "")}>Réessayer</button>
            </div>
        {:else}
            <header class="head">
                <h1>{form.Name?.trim() || ride.Name}</h1>
                <div class="meta">
                    <span class="badge type-{ride.Type ?? 'none'}">{ride.Type ? typeLabel(ride.Type) : "sans type"}</span>
                    <span>{ride.LandName ?? "Sans quartier"}</span>
                    <span class="muted">ID queue-times {ride.ApiId}</span>
                    {#if siteUrl}
                        <a class="ext" href={siteUrl} target="_blank" rel="noopener noreferrer">Voir sur le site public ↗</a>
                    {/if}
                </div>
                <div class="sheet-state">
                    {#if ride.Type === "virtualline"}
                        <span class="muted">VirtualLine : hors contrôle de complétude.</span>
                    {:else if missing.length}
                        <span class="warn">Fiche incomplète — manque :</span>
                        {#each missing as m}<span class="chip-missing">{MISSING_LABELS[m] ?? m}</span>{/each}
                    {:else}
                        <span class="complete">✓ Fiche complète</span>
                    {/if}
                </div>
            </header>

            <div class="layout">
                <form class="form" onsubmit={save} novalidate>
                    <section class="panel">
                        <h2>Identité</h2>
                        <div class="fields">
                            <div class="field wide">
                                <label for="f-Name">Nom</label>
                                <input
                                    id="f-Name"
                                    type="text"
                                    maxlength={NAME_MAX}
                                    bind:value={form.Name}
                                    class:invalid={fieldError("Name")}
                                    oninput={() => edited("Name")}
                                />
                                {#if fieldError("Name")}<small class="field-error">{fieldError("Name")}</small>{/if}
                            </div>
                            {#each IDENTITY_FIELDS as f (f.key)}{@render field(f)}{/each}
                        </div>
                    </section>

                    <section class="panel">
                        <h2>Classement</h2>
                        <div class="fields">
                            <div class="field">
                                <label for="f-Type">Type</label>
                                <select id="f-Type" bind:value={form.Type} class:invalid={fieldError("Type")} onchange={() => edited("Type")}>
                                    <option value="">— Non renseigné —</option>
                                    {#each ride.types as t}<option value={t}>{typeLabel(t)}</option>{/each}
                                </select>
                                {#if fieldError("Type")}<small class="field-error">{fieldError("Type")}</small>{/if}
                            </div>
                            <div class="field">
                                <label for="f-LandId">Quartier</label>
                                <select id="f-LandId" bind:value={form.LandId} class:invalid={fieldError("LandId")} onchange={() => edited("LandId")}>
                                    <option value="">— Non renseigné —</option>
                                    {#each lands as land}<option value={land.id}>{land.name}</option>{/each}
                                </select>
                                {#if fieldError("LandId")}<small class="field-error">{fieldError("LandId")}</small>{/if}
                            </div>
                        </div>
                    </section>

                    <section class="panel">
                        <h2>Caractéristiques techniques</h2>
                        <p class="help">Laisse vide ce qui est inconnu : le site n'affiche que les valeurs renseignées (0 est masqué).</p>
                        <div class="fields">
                            {#each TECH_FIELDS as f (f.key)}{@render field(f)}{/each}
                        </div>
                    </section>

                    <section class="panel">
                        <h2>Description</h2>
                        <div class="field">
                            <span class="label-row">
                                <label for="f-Description">Texte affiché sur la fiche publique</label>
                                <em class:over={(form.Description ?? "").length > DESCRIPTION_MAX}>
                                    {(form.Description ?? "").length.toLocaleString("fr-FR")} / {DESCRIPTION_MAX.toLocaleString("fr-FR")}
                                </em>
                            </span>
                            <textarea
                                id="f-Description"
                                rows="8"
                                maxlength={DESCRIPTION_MAX}
                                bind:value={form.Description}
                                class:invalid={fieldError("Description")}
                                oninput={() => edited("Description")}
                                placeholder="Premier paragraphe…&#10;&#10;Deuxième paragraphe…"
                            ></textarea>
                            <small class="help">
                                Texte brut : sépare les paragraphes par une ligne vide. Le premier paragraphe sert aussi de
                                résumé pour les moteurs de recherche. · {descParagraphs} paragraphe{descParagraphs > 1 ? "s" : ""}
                                · {descWords} mot{descWords > 1 ? "s" : ""}
                            </small>
                            {#if fieldError("Description")}<small class="field-error">{fieldError("Description")}</small>{/if}
                        </div>
                    </section>

                    <div class="actions">
                        <button type="submit" class="btn primary" disabled={!dirty || saving}>
                            {#if saving}<span class="spinner" aria-hidden="true"></span>{/if}
                            Enregistrer
                        </button>
                        <button type="button" class="btn outline" disabled={!dirty || saving} onclick={discard}>
                            Annuler les modifications
                        </button>
                        <span class="kbd">Ctrl+S</span>
                        <span class="status" aria-live="polite">
                            {#if error}
                                <span class="field-error" role="alert">{error}</span>
                            {:else if dirty}
                                <span class="warn">● {dirtyKeys.length} modification{dirtyKeys.length > 1 ? "s" : ""} non enregistrée{dirtyKeys.length > 1 ? "s" : ""}</span>
                            {:else if notice}
                                <span class="ok">{notice}</span>
                            {/if}
                        </span>
                    </div>
                </form>

                <aside class="side">
                    <section class="panel">
                        <h2>Photos</h2>
                        <PhotoGallery rideId={ride.Id} rideName={ride.Name} onChange={(p) => (photoCount = p.length)} />
                    </section>
                </aside>
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
        padding: 36px 82px 0 76px;
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
        flex-direction: column;
        gap: 8px;
        max-width: 1355px;
        margin: 8px 0 28px;
    }

    h1 {
        overflow-wrap: anywhere;
        font-size: 64px;
        font-weight: 400;
        line-height: 1;
    }

    h2 {
        margin-bottom: 14px;
        padding-bottom: 6px;
        border-bottom: 1px solid var(--color-mint);
        font-size: 30px;
        font-weight: 400;
    }

    .meta,
    .sheet-state {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 6px 14px;
        font-size: 20px;
    }

    .sheet-state {
        gap: 6px 8px;
    }

    .muted {
        opacity: 0.6;
    }

    .ext {
        color: var(--color-mint);
    }

    .badge {
        padding: 0 8px;
        border: 1px solid currentColor;
        border-radius: 4px;
        font-size: 16px;
        line-height: 22px;
    }

    .type-coaster {
        color: var(--color-purple);
    }

    .type-flat {
        color: var(--color-mint);
    }

    .type-dark {
        color: var(--color-gold-border);
    }

    .type-water {
        color: var(--color-blue);
    }

    .type-show {
        color: var(--color-lime);
    }

    .type-virtualline,
    .type-none {
        color: var(--color-line);
    }

    .chip-missing {
        padding: 0 6px;
        border: 1px solid var(--color-gold-border);
        border-radius: 4px;
        color: var(--color-gold-border);
        font-size: 16px;
        line-height: 22px;
    }

    .complete,
    .ok {
        color: var(--color-mint);
    }

    .warn {
        color: var(--color-gold-border);
    }

    .layout {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 440px);
        gap: 40px;
        align-items: start;
        max-width: 1355px;
    }

    .side {
        position: sticky;
        top: 24px;
    }

    .form {
        display: flex;
        flex-direction: column;
        gap: 32px;
    }

    .panel {
        min-width: 0;
    }

    .fields {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 210px), 1fr));
        gap: 16px 20px;
    }

    .field {
        display: flex;
        flex-direction: column;
        gap: 5px;
        min-width: 0;
        font-size: 20px;
    }

    .field.wide {
        grid-column: 1 / -1;
    }

    .field em,
    .label-row em {
        font-style: normal;
        opacity: 0.6;
    }

    .label-row {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 6px;
    }

    .label-row em {
        font-size: 17px;
    }

    .label-row em.over {
        color: var(--color-gold-border);
        opacity: 1;
    }

    .with-unit {
        position: relative;
        display: flex;
    }

    .with-unit input {
        flex: 1;
        min-width: 0;
        padding-right: 64px;
    }

    .unit {
        position: absolute;
        top: 50%;
        right: 10px;
        font-size: 17px;
        opacity: 0.6;
        transform: translateY(-50%);
        pointer-events: none;
    }

    input,
    select,
    textarea {
        width: 100%;
        min-width: 0;
        padding: 8px 10px;
        border: 1px solid var(--color-line);
        border-radius: 5px;
        background: var(--color-surface);
        color: var(--color-text);
        font-family: inherit;
        font-size: 21px;
        color-scheme: dark;
    }

    textarea {
        min-height: 200px;
        line-height: 1.35;
        resize: vertical;
    }

    input:focus,
    select:focus,
    textarea:focus {
        border-color: var(--color-mint);
        outline: none;
    }

    .invalid {
        border-color: var(--color-red);
    }

    .help {
        font-size: 16px;
        opacity: 0.7;
    }

    p.help {
        margin: -6px 0 12px;
    }

    .field-error {
        color: var(--color-red);
        font-size: 17px;
    }

    .actions {
        position: sticky;
        bottom: 0;
        z-index: 2;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 10px 16px;
        padding: 14px 0;
        border-top: 1px solid var(--color-line);
        background: var(--color-bg);
    }

    .kbd {
        font-size: 16px;
        opacity: 0.5;
    }

    .status {
        font-size: 19px;
    }

    .btn {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        height: 40px;
        padding: 0 20px;
        border-radius: 10px;
        color: var(--color-text);
        font-family: inherit;
        font-size: 21px;
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
        opacity: 0.5;
        cursor: not-allowed;
    }

    .banner {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px;
        max-width: 1355px;
        margin-top: 16px;
        padding: 12px 18px;
        border-radius: 5px;
        font-size: 22px;
    }

    .banner.error {
        border: 1px solid var(--color-red);
        color: var(--color-red);
    }

    .state {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 16px 0;
        color: var(--color-mint);
        font-size: 22px;
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

    @media (prefers-reduced-motion: reduce) {
        .spinner {
            animation-duration: 2.4s;
        }
    }

    @media (max-width: 1100px) {
        .layout {
            grid-template-columns: minmax(0, 1fr);
        }

        .side {
            position: static;
        }
    }

    @media (max-width: 900px) {
        .content {
            padding: 24px 24px 0;
        }
    }

    @media (max-width: 575px) {
        .content {
            padding: 16px 12px 0;
        }

        h1 {
            font-size: 44px;
        }
    }
</style>
