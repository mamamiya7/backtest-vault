#!/usr/bin/env bash
# Keep the existing unpacked extension folder so Chrome keeps its identity/data.
set -Eeuo pipefail
[[ ! -L "${BASH_SOURCE[0]}" ]] || { printf '%s\n' 'Run update.sh from the extracted release, not a symbolic link.' >&2; exit 1; }
package_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
[[ -f "$package_dir/setup.sh" && ! -L "$package_dir/setup.sh" ]] || { printf '%s\n' 'Extract the complete release before updating.' >&2; exit 1; }
exec bash "$package_dir/setup.sh" --update "$@"
