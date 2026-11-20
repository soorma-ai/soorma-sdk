#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0
#
# pip-audit over each resolution in uv.lock (NFR-U4-25): the latest and the
# floor groups conflict, so each is exported and audited on its own, with
# hashes. Any known vulnerability fails: no advisory is accepted (the user,
# U4 G3). Run from anywhere; nothing is written to disk.
set -euo pipefail
cd "$(dirname "$0")/.."
for group in otel-latest otel-floor; do
  echo "pip-audit: dev + ${group}"
  uv run --locked pip-audit --require-hashes --disable-pip --progress-spinner off \
    -r <(uv export --quiet --locked --no-default-groups --group dev --group "${group}" \
      --no-emit-project --format requirements.txt)
done
