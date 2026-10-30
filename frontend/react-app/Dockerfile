# Stage 1: build the static site
FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# VITE_* values are compiled into the JavaScript bundle at build time, so they are build args.
# They are URLs the *browser* calls, so localhost:800x is correct even when this runs in Docker.
ARG VITE_DJANGO_URL=http://localhost:8001
ARG VITE_FASTAPI_URL=http://localhost:8002
ARG VITE_EXPRESS_URL=http://localhost:8003
ARG VITE_GO_URL=http://localhost:8004
ARG VITE_PHP_URL=http://localhost:8005
ARG VITE_PYTHON_URL=http://localhost:8006
ARG VITE_REQUEST_TIMEOUT_MS=5000

RUN npm run build

# Stage 2: serve the files with nginx (no Node.js in the final image)
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
