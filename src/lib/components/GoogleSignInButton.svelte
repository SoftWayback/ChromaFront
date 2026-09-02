<script>
    import { PUBLIC_API_BASE_URL } from "$env/static/public";
    import googleLogo from "$lib/assets/google-logo.svg";

    // Authorization-code flow: the button just sends the user to the back
    // (chromaback), which starts the Google OAuth redirect. See
    // docs/google-oauth-setup.md.
    const loginUrl = `${PUBLIC_API_BASE_URL}/google/login`;
</script>

<a class="google-sign-in" href={loginUrl}>
    <img src={googleLogo} alt="" class="google-logo" />
    <span class="label">Sign In with Google</span>
</a>

<style>
    .google-sign-in {
        display: inline-flex;
        align-items: center;
        gap: 15px;
        width: 345px;
        height: 54px;
        padding: 15px;
        box-sizing: border-box;
        background: #ffffff;
        border-radius: 10px;
        box-shadow:
            0 0 1.5px rgba(0, 0, 0, 0.08),
            0 2px 1.5px rgba(0, 0, 0, 0.17);
        text-decoration: none;
    }

    .google-logo {
        width: 24px;
        height: 24px;
        flex-shrink: 0;
    }

    .label {
        font-family: "Roboto", "Agdasima", sans-serif;
        font-weight: 500;
        font-size: 20px;
        color: rgba(0, 0, 0, 0.54);
        white-space: nowrap;
    }
</style>
