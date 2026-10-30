# Stage 1: build the Angular app
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# The backend URLs are compiled into the bundle at build time, so they are build args.
# They are URLs the *browser* calls, so localhost:800x is correct even when this runs in Docker.
ARG NG_DJANGO_URL=http://localhost:8001
ARG NG_FASTAPI_URL=http://localhost:8002
ARG NG_EXPRESS_URL=http://localhost:8003
ARG NG_GO_URL=http://localhost:8004
ARG NG_PHP_URL=http://localhost:8005
ARG NG_PYTHON_URL=http://localhost:8006

RUN npx ng build --configuration production \
      --define "NG_DJANGO_URL='${NG_DJANGO_URL}'" \
      --define "NG_FASTAPI_URL='${NG_FASTAPI_URL}'" \
      --define "NG_EXPRESS_URL='${NG_EXPRESS_URL}'" \
      --define "NG_GO_URL='${NG_GO_URL}'" \
      --define "NG_PHP_URL='${NG_PHP_URL}'" \
      --define "NG_PYTHON_URL='${NG_PYTHON_URL}'"

# Stage 2: serve the static files with nginx (no Node.js in the final image)
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/angular-app/browser /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
