<script>
    import { page } from "$app/state";
    import { goto } from "$app/navigation";
    import timelogo from "$lib/assets/timelogo.svg";
    import { logout } from "$lib/api";
    import { session, clearSession } from "$lib/session.svelte.js";

    const links = [
        { href: "/dashboard", label: "Dashboard" },
        { href: "/entities", label: "Gestion entité" },
        { href: "/articles", label: "Gestion Article" },
        { href: "/db", label: "Gestion DB" }
    ];

    async function handleLogout() {
        await logout();
        clearSession();
        goto("/");
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
                    class:active={page.url.pathname === link.href}
                    aria-current={page.url.pathname === link.href ? "page" : undefined}
                >
                    <svg
                        class="nav-icon"
                        viewBox="0 0 27 27"
                        fill="currentColor"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                    >
                        <path
                            d="M21.9029 0H5.07898C2.27551 0.00370794 0.00370794 2.27551 0 5.07898V21.9029C0.00370794 24.7164 2.28365 26.9963 5.09711 27H9.28125H17.7188H21.921C24.7246 26.9963 26.9963 24.7245 27 21.921V5.09711C26.9963 2.28365 24.7164 0.00370794 21.9029 0ZM10.125 1.6875H16.875V8.4375H10.125V1.6875ZM8.4375 25.3125H5.09711C3.21484 25.3105 1.68946 23.7852 1.6875 21.9029V18.5625H8.4375V25.3125ZM16.875 25.3125H10.125V18.5625H16.875V25.3125ZM25.3125 21.921C25.3106 23.7933 23.7933 25.3106 21.921 25.3125H18.5625V18.5625H25.3125V21.921ZM25.3125 16.875H1.6875V5.07898C1.68935 3.2067 3.2067 1.68935 5.07898 1.6875H8.4375V9.28125C8.4375 9.28094 8.4375 9.28156 8.4375 9.28125C8.43781 9.747 8.8155 10.1253 9.28125 10.125H17.7188H25.3125V16.875ZM25.3125 8.4375H18.5625V1.6875H21.9029C23.7852 1.68946 25.3105 3.21484 25.3125 5.09711V8.4375Z"
                        />
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
        <button type="button" class="logout" onclick={handleLogout}>Déconnexion</button>
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
