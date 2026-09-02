<script>
    import timelogo from "$lib/assets/timelogo.svg";
    import GoogleSignInButton from "$lib/components/GoogleSignInButton.svelte";
</script>

<div class="sidebar" data-col="xs-12 md-4">
    <div class="title">
        <img src={timelogo} alt="Time Logo" class="logo" />
        BACK-END
    </div>
    <div class="sign-in">
        <GoogleSignInButton />
    </div>
    <div class="divider-line"></div>
</div>

<style>
    .sidebar {
        position: relative;
        height: 100vh;
        overflow: hidden;
        background: linear-gradient(180deg, #061c15, #007445);
    }

    .title {
        display: flex;
        align-items: center;
        color: white;
        font-family: "Agdasima", sans-serif;
        font-size: 24px;
    }

    /* Figma: button anchored at x=146, y=513 within the 1920x1080 frame. */
    .sign-in {
        position: absolute;
        top: 47.5%;
        left: 146px;
    }

    .divider-line {
        position: absolute;
        top: 0;
        right: 0;
        width: 10px;
        height: 100%;
        background-color: #5fefc1;
    }
</style>
