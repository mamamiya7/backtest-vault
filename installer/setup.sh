#!/usr/bin/env bash
# Install only the packaged extension files. Never change browser policy or storage.
set -Eeuo pipefail
umask 077

fail() { printf 'Backtest Vault: %s\n' "$*" >&2; exit 1; }
usage() {
  printf '%s\n' 'Usage: bash setup.sh [--target FOLDER | FOLDER] [--no-open] [--non-interactive]' \
    '       bash update.sh --target EXISTING_EXTENSION_FOLDER [--no-open] [--non-interactive]' \
    'Setup installs to your own data folder. Update keeps the existing extension path.'
}

mode=setup
target=''
no_open=0
non_interactive=0
while (($#)); do
  case "$1" in
    --update) mode=update ;;
    --target)
      (($# >= 2)) || fail '--target needs a folder.'
      [[ -z "$target" ]] || fail 'Specify only one destination.'
      target=$2; shift ;;
    --no-open) no_open=1 ;;
    --non-interactive) non_interactive=1; no_open=1 ;;
    --help|-h) usage; exit 0 ;;
    --*) fail "Unknown option: $1" ;;
    *) [[ -z "$target" ]] || fail 'Specify only one destination.'; target=$1 ;;
  esac
  shift
done

for command in realpath sha256sum mktemp cp mv rm mkdir grep cmp sed; do
  command -v "$command" >/dev/null 2>&1 || fail "Required Linux utility is missing: $command"
done
[[ ! -L "${BASH_SOURCE[0]}" ]] || fail 'Run setup.sh from the extracted package, not a symbolic link.'
package_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
[[ "$package_dir" != *$'\n'* && "$package_dir" != *$'\r'* ]] || fail 'The package path contains a line break.'
[[ -d "$package_dir/extension" && ! -L "$package_dir/extension" ]] || fail 'Extract the complete release first; its extension folder is missing or is a symbolic link.'
for file in extension-files.txt extension-sha256.txt; do
  [[ -f "$package_dir/$file" && ! -L "$package_dir/$file" ]] || fail "The release is incomplete: $file is missing."
done

# Accept only the builder's flat file list and exactly one checksum for each file.
declare -a files=()
declare -A expected=() listed=()
while IFS= read -r file || [[ -n "$file" ]]; do
  [[ "$file" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ && "$file" != *..* ]] || fail 'The release file list contains an unsafe name.'
  [[ ! ${listed[$file]+yes} ]] || fail "Duplicate release file: $file"
  [[ -f "$package_dir/extension/$file" && ! -L "$package_dir/extension/$file" ]] || fail "Missing or unsafe release file: $file"
  listed[$file]=1; files+=("$file")
done < "$package_dir/extension-files.txt"
((${#files[@]} > 0)) || fail 'The release file list is empty.'
for file in manifest.json index.html core.js background.js runner.js; do
  [[ ${listed[$file]+yes} ]] || fail "The release is missing $file."
done
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ "$line" =~ ^([a-f0-9]{64})\ \ extension/([A-Za-z0-9][A-Za-z0-9._-]*)$ ]] || fail 'The release checksum list is invalid.'
  hash=${BASH_REMATCH[1]}; file=${BASH_REMATCH[2]}
  [[ ${listed[$file]+yes} && ! ${expected[$file]+yes} ]] || fail "Unexpected or duplicate checksum: $file"
  expected[$file]=$hash
done < "$package_dir/extension-sha256.txt"
((${#expected[@]} == ${#files[@]})) || fail 'A release checksum is missing.'
verify_files() {
  local directory=$1 file actual
  for file in "${files[@]}"; do
    [[ -f "$directory/$file" && ! -L "$directory/$file" ]] || return 1
    actual=$(sha256sum < "$directory/$file") || return 1
    [[ "${actual:0:64}" == "${expected[$file]}" ]] || return 1
  done
}
verify_files "$package_dir/extension" || fail 'Release verification failed. Download and extract the release again.'
is_vault() {
  [[ -f "$1/manifest.json" && ! -L "$1/manifest.json" ]] &&
    grep -Eq '"name"[[:space:]]*:[[:space:]]*"Definedge Backtest Vault"' "$1/manifest.json" &&
    grep -Eq '"manifest_version"[[:space:]]*:[[:space:]]*3([[:space:],}]|$)' "$1/manifest.json" &&
    [[ -f "$1/core.js" && -f "$1/background.js" && -f "$1/index.html" ]]
}
is_vault "$package_dir/extension" || fail 'This is not a Backtest Vault release.'
grep -Eq '"key"[[:space:]]*:' "$package_dir/extension/manifest.json" && fail 'This installer does not support a manifest identity key.'
normalize_manifest() {
  # Keep the known JSON layout and string contents; tolerate indentation, CRLF,
  # key spacing and a different release version without parsing arbitrary JSON.
  sed -E 's/\r$//; s/^[[:space:]]+//; s/[[:space:]]+$//; s/^"version"[[:space:]]*:[[:space:]]*"[0-9]+\.[0-9]+\.[0-9]+"[[:space:]]*,$/"version":"VERSION",/; s/"[[:space:]]*:[[:space:]]*/":/g' "$1"
}
has_supported_manifest() {
  local manifest=$1 count
  count=$(grep -Ec '"version"[[:space:]]*:' "$manifest") || return 1
  [[ "$count" == 1 ]] || return 1
  grep -Eq '^[[:space:]]*"version"[[:space:]]*:[[:space:]]*"[0-9]+\.[0-9]+\.[0-9]+"[[:space:]]*,[[:space:]]*$' "$manifest" || return 1
  cmp -s <(normalize_manifest "$package_dir/extension/manifest.json") <(normalize_manifest "$manifest")
}

if [[ -z "$target" && "$mode" == update ]]; then
  ((non_interactive == 0)) && [[ -t 0 ]] || fail 'Update needs --target with the existing folder containing manifest.json.'
  printf 'Existing Backtest Vault extension folder (the folder containing manifest.json): '
  IFS= read -r target || fail 'No folder was supplied.'
  [[ -n "$target" ]] || fail 'No folder was supplied.'
fi
if [[ -z "$target" ]]; then
  [[ -n ${HOME:-} ]] || fail 'HOME is unavailable; supply --target.'
  data_dir=${XDG_DATA_HOME:-"$HOME/.local/share"}
  [[ "$data_dir" == /* ]] || fail 'XDG_DATA_HOME must be an absolute path; supply --target instead.'
  target=$data_dir/backtest-vault/extension
fi
[[ "$target" != *$'\n'* && "$target" != *$'\r'* ]] || fail 'The destination contains a line break.'
[[ "$target" == /* ]] || target=$PWD/$target

# Refuse symlinks in the original spelling before resolving .. or creating directories.
check_no_symlink() {
  local path=$1 component current=''
  local -a components
  IFS=/ read -r -a components <<< "$path"
  for component in "${components[@]}"; do
    [[ -n "$component" && "$component" != . ]] || continue
    current=$current/$component
    [[ ! -L "$current" ]] || return 1
  done
}
check_no_symlink "$target" || fail 'The destination or a parent is a symbolic link. Use the actual extension folder.'
target=$(realpath -m -- "$target")
[[ "$target" != / && "$target" != "${HOME:-}" && "$target" != "$package_dir" && "$target" != "$package_dir/"* ]] || fail 'Choose a permanent extension folder outside the extracted release.'
[[ ! -e "$target" || -d "$target" ]] || fail 'The destination is not a folder.'
if [[ -d "$target" ]]; then
  if [[ -e "$target/manifest.json" || -L "$target/manifest.json" ]]; then
    is_vault "$target" || fail 'The destination contains a different or invalid extension.'
    grep -Eq '"key"[[:space:]]*:' "$target/manifest.json" && fail 'The existing manifest uses an identity key. Keep its identity intact and update manually.'
    has_supported_manifest "$target/manifest.json" || fail 'The existing manifest is customized, malformed, or from an unsupported layout. Review it and use the documented manual update to preserve its identity.'
  elif [[ "$mode" == update ]]; then
    fail 'Update needs the existing Backtest Vault folder containing manifest.json.'
  else
    shopt -s nullglob dotglob
    entries=("$target"/*)
    ((${#entries[@]} == 0)) || fail 'The destination is not empty and does not contain Backtest Vault.'
    shopt -u nullglob dotglob
  fi
elif [[ "$mode" == update ]]; then
  fail 'The existing extension folder was not found.'
fi
for file in "${files[@]}"; do
  [[ ! -L "$target/$file" && (! -e "$target/$file" || -f "$target/$file") ]] || fail "The destination contains an unsafe file: $file"
done

parent=$(dirname -- "$target")
mkdir -p -- "$parent"
check_no_symlink "$target" || fail 'The destination changed during installation. Nothing was installed.'
lock_hash=$(printf '%s' "$target" | sha256sum)
lock=$parent/.vault-install-${lock_hash:0:16}.lock
mkdir -- "$lock" 2>/dev/null || fail "Another installation may be using this folder. If none is running, remove the empty lock folder: $lock"
stage=''
backup=''
committed=0
target_created=0
declare -a installed=()
cleanup() {
  local status=$? file rollback_failed=0 resolved
  trap - EXIT INT TERM
  if ((committed == 0 && ${#installed[@]} > 0)); then
    printf 'Installation stopped; restoring the previous files.\n' >&2
    for file in "${installed[@]}"; do
      if [[ -n "$backup" && -f "$backup/$file" ]]; then
        cp -p -- "$backup/$file" "$target/$file" || rollback_failed=1
      else
        rm -f -- "$target/$file" || rollback_failed=1
      fi
    done
    if ((rollback_failed)); then
      printf 'Some files could not be restored. Recovery copy: %s\n' "$backup" >&2
    fi
  fi
  if [[ -n "$stage" && -d "$stage" && ! -L "$stage" ]]; then
    resolved=$(realpath -- "$stage")
    [[ "$resolved" == "$parent/.vault-stage."* ]] && rm -rf -- "$resolved"
  fi
  if ((committed == 0 && target_created)); then rmdir -- "$target" 2>/dev/null || true; fi
  rmdir -- "$lock" 2>/dev/null || true
  exit "$status"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
stage=$(mktemp -d -- "$parent/.vault-stage.XXXXXXXX")
for file in "${files[@]}"; do cp -- "$package_dir/extension/$file" "$stage/$file"; done
verify_files "$stage" || fail 'The staged copy did not verify. Nothing was installed.'
if [[ -f "$target/manifest.json" ]]; then
  backup=$(mktemp -d -- "$parent/.vault-backup.XXXXXXXX")
  for file in "${files[@]}"; do
    if [[ -f "$target/$file" ]]; then cp -p -- "$target/$file" "$backup/$file"; fi
  done
  printf 'Previous extension files: %s\n' "$backup"
else
  if [[ ! -d "$target" ]]; then
    mkdir -- "$target"
    target_created=1
  fi
fi
for file in "${files[@]}"; do
  [[ "$file" != manifest.json ]] || continue
  installed+=("$file")
  mv -f -- "$stage/$file" "$target/$file"
done
# The manifest is the last file replaced, after every other file has arrived.
installed+=(manifest.json)
mv -f -- "$stage/manifest.json" "$target/manifest.json"
verify_files "$target" || fail 'Installed files did not verify.'
committed=1
printf '\nBacktest Vault is ready at:\n%s\n\n' "$target"
if [[ -n "$backup" ]]; then
  printf '%s\n' 'In your browser Extensions page, reload the existing Backtest Vault extension.' \
    'Then refresh RZone and reopen Vault. Your browser-stored runs stay in place.'
else
  printf '%s\n' 'Open chrome://extensions (or edge://extensions), enable Developer mode,' \
    'choose Load unpacked, and select the exact folder printed above.' \
    'Keep that folder in place. Future updates use the same folder.'
fi
printf '%s\n' 'No administrator access, browser policy change, or application runtime is needed.'
if ((no_open == 0)) && [[ -f "$package_dir/START-HERE.html" ]] && command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$package_dir/START-HERE.html" >/dev/null 2>&1 &
fi
