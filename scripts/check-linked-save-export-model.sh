#!/bin/sh
# Model-checks docs/models/linked-save-export/LinkedSaveExport.tla with TLC.
# Exit 0: each check gives its expected result. Exit 1: a result changed or a mapped function is gone. Exit 2: TLC error.
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
model=$root/docs/models/linked-save-export

# Each model action names code. Fail when a name is gone, so that someone reads the model again.
status=0
while read -r file pattern; do
  grep -qF -- "$pattern" "$root/$file" || { echo "MISSING  '$pattern' in $file"; status=1; }
done <<'EOF'
src/lib/pksx/linked-save-sources/index.ts observe(file: StoredSaveFile)
src/lib/pksx/linked-save-sources/index.ts export(file: StoredSaveFile, serialize
src/lib/pksx/linked-save-sources/index.ts loadExternal(file: StoredSaveFile
src/lib/pksx/linked-save-sources/index.ts recover(file: StoredSaveFile
src/lib/pksx/linked-save-sources/index.ts reason: 'linked-source-before-export'
src/lib/pksx/linked-save-sources/runtime.ts export async function recoveryBackupId(
src/routes/saves/SavesGrid.svelte if (await recoveryBackupId(saveFile)) throw
src/lib/components/pksx/BackupBrowser.svelte if ((await recoveryBackupId(owner)) === backup.id)
src/lib/pksx/linked-save-folders/runtime.svelte.ts await importLinkedSave(storage, save, bytes);
src/lib/pksx/saves/capacitor-storage.ts catalog.saves.find((save) => save.linkedDocumentId === input.linkedDocumentId)
android/app/src/main/java/com/pksx/app/LinkedSavesPlugin.java private JSONObject source(JSONObject sources, PluginCall call)
android/app/src/main/java/com/pksx/app/LinkedSavesPlugin.java public void inspect(PluginCall call)
android/app/src/main/java/com/pksx/app/LinkedSavesPlugin.java public void write(PluginCall call)
android/app/src/main/java/com/pksx/app/LinkedSavesPlugin.java openFileDescriptor(before.uri, "rwt")
EOF

jar=${TLA2TOOLS:-$HOME/.cache/pksx-tla/tla2tools-1.7.4.jar}
if [ ! -f "$jar" ]; then
  mkdir -p "$(dirname "$jar")"
  curl -sSfL -o "$jar.tmp" https://github.com/tlaplus/tlaplus/releases/download/v1.7.4/tla2tools.jar
  echo "936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88  $jar.tmp" | shasum -a 256 -c - >/dev/null
  mv "$jar.tmp" "$jar"
fi

work=$(mktemp -d)
cp "$model/LinkedSaveExport.tla" "$work/"
ALL="TypeOK PendingKeepsSaveFile PendingKeepsBackup NoWriteWithoutBackup NoDuplicateSaveFile SourceStaysUsable"

# check NAME EXPECTED SAVE_GUARD BACKUP_GUARD SOURCE_CAN_VANISH RULE...
check() {
  name=$1 expected=$2 save_guard=$3 backup_guard=$4 vanish=$5
  shift 5
  {
    echo "CONSTANTS GuardDeleteSave = $save_guard GuardDeleteBackup = $backup_guard SourceCanVanish = $vanish"
    echo "CONSTANTS MaxSaves = 2 MaxLiveBackups = 2 MaxExports = 3"
    echo "INIT Init"
    echo "NEXT Next"
    for rule in "$@"; do echo "INVARIANT $rule"; done
  } >"$work/$name.cfg"
  if (cd "$work" && "${JAVA:-java}" -XX:+UseParallelGC -cp "$jar" tlc2.TLC -workers 1 -deadlock \
    -metadir "$work/$name.states" -config "$name.cfg" LinkedSaveExport.tla >"$name.out" 2>&1); then
    result=holds
  elif grep -q "Invariant .* is violated" "$work/$name.out"; then
    result=breaks
  else
    cat "$work/$name.out"
    echo "TLC error on $name"
    exit 2
  fi
  if [ "$result" = "$expected" ]; then
    echo "ok       $name: $result"
  else
    echo "CHANGED  $name: $result (expected $expected), TLC output: $work/$name.out"
    status=1
  fi
  if [ "$result" = breaks ]; then
    grep -o "Invariant [A-Za-z]* is violated" "$work/$name.out" | sed 's/^/         /'
    sed -n 's/^State [0-9]*: <\([A-Za-z]*\).*/\1/p' "$work/$name.out" | paste -sd' ' - | sed 's/^/         path: /'
  fi
}

check guarded holds TRUE TRUE FALSE $ALL
check reaches-pending-recovery breaks TRUE TRUE FALSE NeverPending
check source-can-vanish breaks TRUE TRUE TRUE PendingKeepsSaveFile
check without-delete-save-guard breaks FALSE TRUE FALSE PendingKeepsSaveFile
check without-delete-save-guard-symptom breaks FALSE TRUE FALSE SourceStaysUsable
check without-delete-backup-guard breaks TRUE FALSE FALSE PendingKeepsBackup
exit $status
