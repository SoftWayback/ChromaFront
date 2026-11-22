<script>
	import favicon from "$lib/assets/favicon-32.png";
	import appleTouchIcon from "$lib/assets/apple-touch-icon.png";
	import "$lib/assets/css/global.css";
	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" type="image/png" sizes="32x32" href={favicon} />
	<link rel="apple-touch-icon" sizes="180x180" href={appleTouchIcon} />
</svelte:head>

{@render children()}
