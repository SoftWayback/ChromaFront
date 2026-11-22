<script>
    import { page } from "$app/state";
    import { goto } from "$app/navigation";
    import logo from "$lib/assets/apple-touch-icon.png";
    import { API_BASE_URL, PUBLIC_SITE_URL, logout } from "$lib/api";
    import { session, clearSession } from "$lib/session.svelte.js";

    // Icons: SVG children drawn on a 24×24 stroke grid (Lucide-style, MIT).
    const SECTIONS = [
        {
            title: "Pilotage",
            links: [
                {
                    href: "/dashboard",
                    label: "Dashboard",
                    icon: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>'
                },
                {
                    href: "/stats",
                    label: "Statistiques",
                    icon: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>'
                }
            ]
        },
        {
            title: "Contenu",
            links: [
                {
                    href: "/entities",
                    label: "Entités",
                    icon: '<circle cx="12" cy="12" r="2"/><path d="M12 2v4"/><path d="m6.8 15-3.5 2"/><path d="m20.7 7-3.5 2"/><path d="M6.8 9 3.3 7"/><path d="m20.7 17-3.5-2"/><path d="m9 22 3-8 3 8"/><path d="M8 22h8"/><path d="M18 18.7a9 9 0 1 0-12 0"/>'
                },
                {
                    href: "/articles",
                    label: "Articles",
                    icon: '<path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/>'
                },
                {
                    href: "/accueil",
                    label: "Page d'accueil",
                    icon: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'
                }
            ]
        },
        {
            title: "Système",
            links: [
                {
                    href: "/db",
                    label: "Gestion DB",
                    icon: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>'
                }
            ]
        }
    ];

    const ICON_EXTERNAL = '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>';
    const ICON_LOGOUT = '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>';
    const ICON_COLLAPSE = '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="m16 15-3-3 3-3"/>';
    const ICON_EXPAND = '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/><path d="m14 9 3 3-3 3"/>';

    /** The API URL says which backend (and so which database) this build talks to. */
    const isDev = /localhost|127\.0\.0\.1/.test(API_BASE_URL);

    const STORAGE_KEY = "chroma.nav.collapsed";
    let collapsed = $state(readCollapsed());

    function readCollapsed() {
        try {
            return localStorage.getItem(STORAGE_KEY) === "1";
        } catch {
            return false;
        }
    }

    function toggleCollapsed() {
        collapsed = !collapsed;
        try {
            localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
        } catch {
            // private mode / blocked storage: the choice just isn't remembered
        }
    }

    async function handleLogout() {
        await logout();
        clearSession();
        goto("/");
    }

    /** Active on the section itself and its sub-pages (e.g. /entities/:id). */
    function isActive(/** @type {string} */ href) {
        const path = page.url.pathname;
        return path === href || path.startsWith(`${href}/`);
    }
</script>

{#snippet icon(/** @type {string} */ paths)}
    <svg
        class="nav-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
    >
        {@html paths}
    </svg>
{/snippet}

<nav class="nav-sidebar" class:collapsed aria-label="Navigation principale">
    <a class="brand" href="/dashboard" title="Chroma — tableau de bord">
        <img src={logo} alt="" class="brand-logo" width="44" height="44" />
        <span class="brand-text">
            <span class="brand-name">Chroma</span>
            <span class="env" class:dev={isDev} title={API_BASE_URL}>{isDev ? "Dev" : "Prod"}</span>
        </span>
    </a>

    <div class="sections">
        {#each SECTIONS as section}
            <div class="section">
                <p class="section-title">{section.title}</p>
                <ul class="nav-links">
                    {#each section.links as link}
                        {@const active = isActive(link.href)}
                        <li>
                            <a
                                href={link.href}
                                class="nav-link"
                                class:active
                                title={link.label}
                                aria-current={page.url.pathname === link.href ? "page" : active ? "true" : undefined}
                            >
                                {@render icon(link.icon)}
                                <span class="nav-label">{link.label}</span>
                            </a>
                        </li>
                    {/each}
                </ul>
            </div>
        {/each}
    </div>

    <div class="footer">
        <a class="nav-link subtle" href={PUBLIC_SITE_URL} target="_blank" rel="noopener noreferrer" title="Voir le site public">
            {@render icon(ICON_EXTERNAL)}
            <span class="nav-label">Voir le site public</span>
        </a>

        {#if session.user}
            <p class="user" title={session.user.email}>
                <span class="avatar" aria-hidden="true">{(session.user.name ?? session.user.email ?? "?").slice(0, 1).toUpperCase()}</span>
                <span class="user-text">
                    <span class="user-name">{session.user.name ?? session.user.email}</span>
                    {#if session.user.name}<span class="user-mail">{session.user.email}</span>{/if}
                </span>
            </p>
        {/if}

        <button type="button" class="nav-link logout" onclick={handleLogout} title="Déconnexion">
            {@render icon(ICON_LOGOUT)}
            <span class="nav-label">Déconnexion</span>
        </button>

        <button
            type="button"
            class="nav-link collapse"
            onclick={toggleCollapsed}
            aria-pressed={collapsed}
            title={collapsed ? "Déplier le menu" : "Replier le menu"}
        >
            {@render icon(collapsed ? ICON_EXPAND : ICON_COLLAPSE)}
            <span class="nav-label">{collapsed ? "Déplier" : "Replier le menu"}</span>
        </button>
    </div>
</nav>

<style>
    .nav-sidebar {
        position: sticky;
        top: 0;
        z-index: 5;
        display: flex;
        flex-direction: column;
        flex-shrink: 0;
        align-self: flex-start;
        width: 260px;
        height: 100vh;
        height: 100dvh;
        overflow-y: auto;
        padding: 20px 12px 16px;
        border-right: 1px solid rgba(95, 239, 193, 0.25);
        background: linear-gradient(180deg, var(--color-surface), var(--color-surface-end));
        color: var(--color-text);
        font-family: "Agdasima", sans-serif;
        transition: width 0.18s ease;
    }

    /* ── brand ── */
    .brand {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 4px 8px;
        margin-bottom: 24px;
        border-radius: 10px;
        color: var(--color-text);
        text-decoration: none;
    }

    .brand-logo {
        width: 44px;
        height: 44px;
        flex-shrink: 0;
    }

    .brand-text {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
    }

    .brand-name {
        font-size: 34px;
        font-weight: 700;
        line-height: 1;
    }

    .env {
        padding: 0 7px;
        border: 1px solid var(--color-red);
        border-radius: 4px;
        color: var(--color-red);
        font-size: 14px;
        line-height: 20px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .env.dev {
        border-color: var(--color-mint);
        color: var(--color-mint);
    }

    /* ── sections ── */
    .sections {
        display: flex;
        flex-direction: column;
        gap: 18px;
    }

    .section-title {
        margin: 0 10px 6px;
        color: var(--color-mint);
        font-size: 14px;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        opacity: 0.7;
    }

    .nav-links {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .nav-link {
        position: relative;
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        min-height: 44px;
        padding: 6px 10px;
        border: none;
        border-radius: 8px;
        background: none;
        color: var(--color-text);
        font-family: inherit;
        font-size: 22px;
        text-align: left;
        text-decoration: none;
        cursor: pointer;
    }

    .nav-link:hover {
        background: rgba(255, 255, 255, 0.07);
    }

    .nav-link:focus-visible,
    .brand:focus-visible {
        outline: 2px solid var(--color-mint);
        outline-offset: 1px;
    }

    .nav-link.active {
        background: rgba(95, 239, 193, 0.14);
        color: var(--color-mint);
    }

    .nav-link.active::before {
        content: "";
        position: absolute;
        top: 8px;
        bottom: 8px;
        left: -12px;
        width: 4px;
        border-radius: 0 3px 3px 0;
        background: var(--color-mint);
    }

    .nav-icon {
        width: 24px;
        height: 24px;
        flex-shrink: 0;
    }

    .nav-label {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    /* ── footer ── */
    .footer {
        display: flex;
        flex-direction: column;
        gap: 2px;
        margin-top: auto;
        padding-top: 16px;
        border-top: 1px solid rgba(255, 255, 255, 0.12);
    }

    .subtle {
        font-size: 19px;
        opacity: 0.85;
    }

    .user {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
        padding: 8px 10px;
    }

    .avatar {
        display: grid;
        flex-shrink: 0;
        place-items: center;
        width: 30px;
        height: 30px;
        border: 1px solid var(--color-mint);
        border-radius: 50%;
        color: var(--color-mint);
        font-size: 17px;
    }

    .user-text {
        display: flex;
        flex-direction: column;
        min-width: 0;
    }

    .user-name,
    .user-mail {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .user-name {
        font-size: 18px;
    }

    .user-mail {
        font-size: 14px;
        opacity: 0.6;
    }

    .logout {
        color: var(--color-red);
        font-size: 19px;
    }

    .collapse {
        font-size: 17px;
        opacity: 0.7;
    }

    .collapse:hover {
        opacity: 1;
    }

    /* ── collapsed rail (desktop choice) ── */
    .collapsed {
        width: 72px;
        padding: 20px 10px 16px;
    }

    .collapsed .brand {
        justify-content: center;
        padding: 4px 0;
    }

    .collapsed .brand-text,
    .collapsed .user-text {
        display: none;
    }

    .collapsed .section-title {
        height: 1px;
        margin: 0 8px 8px;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.15);
        color: transparent;
    }

    .collapsed .nav-link {
        justify-content: center;
        padding: 6px 0;
    }

    .collapsed .nav-link.active::before {
        left: -10px;
    }

    .collapsed .user {
        justify-content: center;
        padding: 8px 0;
    }

    .collapsed .nav-label {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
    }

    /* Narrow screens: always an icon rail, so pages keep their width (no horizontal scroll). */
    @media (max-width: 767px) {
        .nav-sidebar,
        .nav-sidebar.collapsed {
            width: 52px;
            padding: 12px 4px;
        }

        .brand {
            justify-content: center;
            padding: 0;
            margin-bottom: 16px;
        }

        .brand-logo {
            width: 38px;
            height: 38px;
        }

        .brand-text,
        .user-text,
        .user,
        .collapse {
            display: none;
        }

        .section-title {
            height: 1px;
            margin: 0 6px 6px;
            overflow: hidden;
            background: rgba(255, 255, 255, 0.15);
            color: transparent;
        }

        .sections {
            gap: 10px;
        }

        .nav-link {
            justify-content: center;
            min-height: 42px;
            padding: 6px 0;
        }

        .nav-link.active::before {
            left: -4px;
            width: 3px;
        }

        .nav-label {
            position: absolute;
            width: 1px;
            height: 1px;
            overflow: hidden;
            clip: rect(0 0 0 0);
            white-space: nowrap;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .nav-sidebar {
            transition: none;
        }
    }
</style>
