FROM node:22-alpine AS build
WORKDIR /app

# `PUBLIC_API_BASE_URL` est lu via `$env/static/public` : SvelteKit l'inline
# dans le bundle AU BUILD. Elle ne peut donc pas venir des variables de l'app
# CapRover au démarrage — d'où ce `--build-arg`, et une image différente par
# environnement (le workflow suffixe le tag par `-preprod` / `-prod`).
ARG PUBLIC_API_BASE_URL
ENV PUBLIC_API_BASE_URL=$PUBLIC_API_BASE_URL

# Sans la variable, `vite build` échoue sur un export manquant depuis
# `$env/static/public` — message peu parlant. On échoue ici, avec la raison,
# et avant d'installer quoi que ce soit.
RUN test -n "$PUBLIC_API_BASE_URL" || { \
      echo "PUBLIC_API_BASE_URL manquant : passe --build-arg PUBLIC_API_BASE_URL=https://…" >&2; \
      exit 1; \
    }

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
EXPOSE 3000
# adapter-node écoute sur $PORT (3000 par défaut) et attend `ORIGIN` (URL
# publique exacte, sans slash final) — à définir dans les variables de l'app
# CapRover.
CMD ["node", "build/index.js"]
