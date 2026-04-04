<script lang="ts">
    import landing from "$lib/assets/eurosatlanding.svg";
    import timelogo from "$lib/assets/timelogo.svg";
</script>

<div class="grid">
    <div class="backgroundGradient" data-col="xs-12 md-4">
        <div class="DividerDiv">
            <div class="TitleAndLogo">
                <img src={timelogo} alt="Time Logo" class="timelogo" />
                Back-end
            </div>
            <div class="RightVerticalDivider"></div>
        </div>
    </div>
    <div data-col="xs-12 md-8">
        <img src={landing} alt="Landing Page" class="landingImage" />
    </div>
</div>

<style lang="scss">
    .backgroundGradient {
        height: 100vh;
        background: linear-gradient(180deg, #051c15, #007445);
    }
    .landingImage {
        width: 100%;
        max-height: 100vh;
        object-fit: cover;
        display: block;
    }
    .RightVerticalDivider {
        width: 10px;
        background-color: #5fefc1;
        height: 100vh;
        right: 0;
    }
    .DividerDiv {
        display: flex;
        justify-content: space-between;
        height: auto;
    }

    .TitleAndLogo {
        height: fit-content;
        display: flex;
        align-items: center;
        color: white;
        font-family: "agdasima", sans-serif;
        font-size: 24px;
    }
</style>
