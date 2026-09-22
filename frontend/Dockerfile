# syntax=docker/dockerfile:1

# --- Build ------------------------------------------------------------------
# Pinned so the build does not depend on whatever Node the host happens to have;
# the toolchain requires ^20.19 || >=22.12.
FROM node:24-alpine AS build

WORKDIR /app

# Install from the lockfile before copying source, so editing a component does
# not invalidate the dependency layer. `npm ci` fails loudly if package.json and
# the lockfile have drifted apart.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Serve ------------------------------------------------------------------
FROM nginx:1.27-alpine AS serve

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
