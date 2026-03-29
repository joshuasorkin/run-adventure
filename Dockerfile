# syntax = docker/dockerfile:1

ARG NODE_VERSION=24.11.1
FROM node:${NODE_VERSION}-slim AS base

WORKDIR /app
ENV NODE_ENV="production"

# --- Build stage ---
FROM base AS build

RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential node-gyp pkg-config python-is-python3

COPY package-lock.json package.json ./
RUN npm ci --include=dev

COPY . .

# NEXT_PUBLIC_* vars must be present at build time for Next.js to inline them
ARG NEXT_PUBLIC_GOOGLE_MAPS_KEY
ENV NEXT_PUBLIC_GOOGLE_MAPS_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_KEY

RUN npm run build

RUN npm prune --omit=dev

# --- Production stage ---
FROM base

COPY --from=build /app /app

EXPOSE 3000
CMD [ "npm", "run", "start" ]
