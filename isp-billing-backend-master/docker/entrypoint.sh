#!/bin/sh
set -eu

export PYTHONUNBUFFERED=1

# Schema migrations are a reviewed, separately backed-up release operation.
# Container restarts must never apply irreversible Alembic changes implicitly.
exec "$@"
