<script>
    import { page } from "$app/state";
    import { goto } from "$app/navigation";
    import timelogo from "$lib/assets/timelogo.svg";
    import { logout } from "$lib/api";
    import { session, clearSession } from "$lib/session.svelte.js";

    // Icons: SVG children drawn on a 24×24 stroke grid (Lucide-style, MIT).
    const links = [
        {
            href: "/dashboard",
            label: "Dashboard",
            icon: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>'
        },
        {
            href: "/entities",
            label: "Gestion entité",
            icon: '<circle cx="12" cy="12" r="2"/><path d="M12 2v4"/><path d="m6.8 15-3.5 2"/><path d="m20.7 7-3.5 2"/><path d="M6.8 9 3.3 7"/><path d="m20.7 17-3.5-2"/><path d="m9 22 3-8 3 8"/><path d="M8 22h8"/><path d="M18 18.7a9 9 0 1 0-12 0"/>'
        },
        {
            href: "/articles",
            label: "Gestion Article",
            icon: '<path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/>'
        },
        {
            href: "/stats",
            label: "Statistiques",
            icon: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>'
        },
        {
            href: "/db",
            label: "Gestion DB",
            icon: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>'
        }
    ];

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

<nav class="nav-sidebar">
    <img src={timelogo} alt="Time Logo" class="nav-logo" />

    <ul class="nav-links">
        {#each links as link}
            <li>
                <a
                    href={link.href}
                    class="nav-link"
                    class:active={isActive(link.href)}
                    aria-current={page.url.pathname === link.href ? "page" : undefined}
                >
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
                        {@html link.icon}
                    </svg>
                    {link.label}
                </a>
            </li>
        {/each}
    </ul>

    <div class="footer">
        {#if session.user}
            <p class="user" title={session.user.email}>
                {session.user.name ?? session.user.email}
            </p>
        {/if}
        <button type="button" class="logout" onclick={handleLogout}>
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
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Déconnexion
        </button>
    </div>
</nav>

<style>
    .nav-sidebar {
        display: flex;
        flex-direction: column;
        width: 281px;
        min-height: 100vh;
        padding: 24px 0 24px 20px;
        background: linear-gradient(180deg, #061c15, #007445);
        font-family: "Agdasima", sans-serif;
    }

    .nav-logo {
        width: 148px;
        height: 148px;
        align-self: center;
        margin-bottom: 40px;
    }

    .nav-links {
        display: flex;
        flex-direction: column;
        gap: 20px;
    }

    .nav-link {
        display: flex;
        align-items: center;
        gap: 12px;
        color: #ffffff;
        font-size: 24px;
        text-decoration: none;
    }

    .nav-link.active {
        color: #5fefc1;
    }

    .nav-icon {
        width: 27px;
        height: 27px;
        flex-shrink: 0;
    }

    .footer {
        margin-top: auto;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .user {
        max-width: 240px;
        overflow: hidden;
        color: #5fefc1;
        font-size: 16px;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .logout {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 0;
        border: none;
        background: none;
        color: #e4495c;
        font-family: inherit;
        font-size: 24px;
        text-align: left;
        cursor: pointer;
    }
</style>
