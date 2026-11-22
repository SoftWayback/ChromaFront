<script>
    import landing from "$lib/assets/eurosatlanding.svg";
</script>

<!-- decorative: hidden below 768 px, where the sign-in panel takes the whole screen -->
<div class="hero" aria-hidden="true">
    <img src={landing} alt="" class="hero-image" />
</div>

<style>
    .hero {
        min-width: 0;
        overflow: hidden;
        background: var(--color-surface);
    }

    .hero-image {
        display: block;
        width: 100%;
        height: 100vh;
        object-fit: cover;
    }

    @media (max-width: 767px) {
        .hero {
            display: none;
        }
    }
</style>
