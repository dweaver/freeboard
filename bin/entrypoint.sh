#!/usr/bin/env sh

ENVIRONMENT=${ENVIRONMENT-dev}

# Announce when running.
banner () {
  echo "Running Exosite Device Dashboard:"
  echo ""
  echo "Env:"
  echo " - Environment: $ENVIRONMENT"
  echo ""
  echo "============ LOGS =============="
}

# symlink the correct index.html file for environment
ln -sfn "index.html.$ENVIRONMENT" index.html

case "${1:-run}" in
#  run) banner && exec nginx -p ~/nginx -c nginx.conf;;
  run) banner && exec nginx -g "daemon off;";;
  *) exec "$@";;
esac
