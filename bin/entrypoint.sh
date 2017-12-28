#!/usr/bin/env sh

ENVIRONMENT=${ENVIRONMENT-dev}

# Announce when running.
banner () {
  echo "Running Exosite Device Dashboard:"
  echo ""
  echo "Env:"
  echo " - ENVIRONMENT: $ENVIRONMENT"
  echo ""
  echo "============ LOGS =============="
}

# symlink the correct index.html file for environment
ln -sfn "index.html.$ENVIRONMENT" build/index.html

case "${1:-run}" in
  run) banner && exec nginx -p ~/nginx -c nginx.conf;;
  html) exec cat ~/build/index.html;;
  dump) exec tar -c -z -f- -C ~/build .;;
  *) exec "$@";;
esac
