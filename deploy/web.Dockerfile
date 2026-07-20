# AcademyJournal frontend (Vite/React build) served by nginx, which also
# reverse-proxies /api, /admin, /static to the backend and serves /media.
# Build context = repo root.

# ---- stage 1: build the SPA ----
FROM node:22-alpine AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# Self-hosted deployment talks to the API on the SAME origin (/api).
# This works today on http://IP:8080 and later on the real domain with no rebuild.
RUN sed -i 's#^VITE_API_URL=.*#VITE_API_URL=/api#' .env.production \
    || echo 'VITE_API_URL=/api' >> .env.production
RUN npm run build

# ---- stage 2: serve ----
FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
