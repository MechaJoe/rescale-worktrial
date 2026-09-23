# syntax=docker/dockerfile:1

# The image's browsers are built for one Playwright release, so its tag must
# match the @playwright/test version pinned in package.json exactly.
FROM mcr.microsoft.com/playwright:v1.63.0-noble

WORKDIR /e2e

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

CMD ["npx", "playwright", "test"]
