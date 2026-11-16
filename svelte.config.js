import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// Cible fixée : serveur Node dans une image Docker, déployée sur CapRover
		// (voir Dockerfile + .github/workflows/deploy.yml). `adapter-auto` ne
		// reconnaît pas cet environnement et ne produirait rien de démarrable.
		adapter: adapter()
	}
};

export default config;
