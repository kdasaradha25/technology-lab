#!/usr/bin/env sh
# Creates every missing .env file from its .env.example and replaces each `change-me...`
# placeholder with a random hex secret. Existing .env files are never touched, because the
# databases keep the password they were first created with.
#
# Usage (from the repository root):  sh deploy/init-env.sh
set -eu

cd "$(dirname "$0")/.."

for example in .env.example backend/*/.env.example; do
  env_file="${example%.example}"
  if [ -f "$env_file" ]; then
    echo "keep    $env_file (already exists)"
    continue
  fi

  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      # Hex only: InfluxDB's setup fails on secrets that start with "-".
      *=change-me*) echo "${line%%=*}=$(openssl rand -hex 24)" ;;
      *) echo "$line" ;;
    esac
  done < "$example" > "$env_file"
  chmod 600 "$env_file"
  echo "created $env_file"
done

echo
echo "Next: set DOMAIN in .env, then run: docker compose up -d --build"
