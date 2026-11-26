---- MODULE LinkedSaveExport ----
\* Export of an Android-linked Save File to its emulator file, and the
\* pending-recovery journal. README.md maps each action to the code.
EXTENDS Naturals, FiniteSets

CONSTANTS
    GuardDeleteSave,    \* SavesGrid.confirmDelete checks recoveryBackupId
    GuardDeleteBackup,  \* BackupBrowser.deleteBackup checks recoveryBackupId
    SourceCanVanish,    \* the folder can be unlinked or the file moved, then come back
    MaxSaves,           \* Save Files created in one run
    MaxLiveBackups,     \* Backups that exist at one time
    MaxExports          \* Export and recovery attempts in one run

VARIABLES
    ext,          \* bytes of the emulator file
    imported,     \* Save File id -> bytes at import
    nextSave,
    backups,      \* Backup id -> [owner, bytes]
    nextBackup,
    owner,        \* journal: saveFileId of the source, 0 = no source
    baseline,     \* journal: baselineHash
    pending,      \* journal: empty, or one pending record
    op,           \* the Export or recovery that runs now
    scan,         \* the rescan that runs now
    exports,
    readable,     \* the plugin can read the emulator file
    unsafeWrite   \* ghost: the emulator file was opened for write without the Backup

vars == <<ext, imported, nextSave, backups, nextBackup, owner, baseline, pending,
          op, scan, exports, readable, unsafeWrite>>

Valid == {"a", "b", "c"}   \* bytes that the engine accepts; a hash is the bytes
Torn == "torn"             \* a truncated or partly written file
Content == Valid \cup {Torn}
Idle == [step |-> "idle", save |-> 0, bytes |-> "a", expected |-> "a",
         backup |-> 0, recover |-> FALSE]

saves == DOMAIN imported
Pending == [before : Content, after : Content, backupId : Nat,
            recoveryBackupId : Nat, recoveryHash : Content]

TypeOK ==
    /\ ext \in Content
    /\ saves \subseteq 1..MaxSaves
    /\ \A s \in saves : imported[s] \in Valid
    /\ \A b \in DOMAIN backups : backups[b] \in [owner : Nat, bytes : Content]
    /\ owner \in 0..MaxSaves
    /\ baseline \in Content \cup {"none"}
    /\ pending \subseteq Pending /\ Cardinality(pending) <= 1
    /\ op.step \in {"idle", "backup", "write", "truncate", "writing", "verify"}
    /\ scan \in {"idle", "missing"}
    /\ readable \in BOOLEAN
    /\ unsafeWrite \in BOOLEAN

Init ==
    /\ ext = "a"
    /\ imported = [s \in {} |-> "a"]
    /\ nextSave = 1
    /\ backups = [b \in {} |-> 0]
    /\ nextBackup = 1
    /\ owner = 0 /\ baseline = "none" /\ pending = {}
    /\ op = Idle /\ scan = "idle"
    /\ exports = 0 /\ readable = TRUE /\ unsafeWrite = FALSE

\* ---- LinkedSavesPlugin.inspect for Save File s ----
\* source() rejects a new owner while the old owner has a pending record.
Rejected(s) == owner # s /\ pending # {}
SrcBaseline(s) == IF owner = s THEN baseline ELSE imported[s]
SrcPending(s) == IF owner = s THEN pending ELSE {}
Completed(s) == \E p \in SrcPending(s) : ext = p.after
NotWritten(s) == \E p \in SrcPending(s) : ext = p.before /\ ext = SrcBaseline(s)
InsBaseline(s) == IF Completed(s) THEN ext ELSE SrcBaseline(s)
InsPending(s) == IF Completed(s) \/ NotWritten(s) THEN {} ELSE SrcPending(s)
Inspect(s) == readable /\ owner' = s /\ baseline' = InsBaseline(s) /\ pending' = InsPending(s)

Journal == <<owner, baseline, pending>>
Storage == <<imported, nextSave, backups, nextBackup, readable>>

\* ---- Rescan ----
RescanSnapshot ==
    /\ scan = "idle" /\ saves = {}
    /\ scan' = "missing"
    /\ UNCHANGED <<ext, Storage, Journal, op, exports, unsafeWrite>>

\* importSave returns the existing Save File when one has this linkedDocumentId.
RescanImport ==
    /\ scan = "missing"
    /\ scan' = "idle"
    /\ IF saves = {} /\ readable /\ ext \in Valid /\ nextSave <= MaxSaves
       THEN /\ imported' = [s \in {nextSave} |-> ext]
            /\ nextSave' = nextSave + 1
       ELSE UNCHANGED <<imported, nextSave>>
    /\ UNCHANGED <<ext, backups, nextBackup, readable, Journal, op, exports, unsafeWrite>>

\* checkSources after a scan, and each guard, call observe.
Observe(s) ==
    /\ op = Idle /\ s \in saves /\ ~Rejected(s)
    /\ Inspect(s)
    /\ UNCHANGED <<ext, Storage, op, scan, exports, unsafeWrite>>

LoadExternal(s) ==
    /\ op = Idle /\ readable /\ s \in saves /\ ~Rejected(s)
    /\ InsPending(s) = {} /\ ext \in Valid
    /\ owner' = s /\ baseline' = ext /\ pending' = {}
    /\ UNCHANGED <<ext, Storage, op, scan, exports, unsafeWrite>>

\* ---- Export ----
ExportStart(s, v) ==
    /\ op = Idle /\ readable /\ s \in saves /\ ~Rejected(s) /\ exports < MaxExports
    /\ InsPending(s) = {}
    /\ owner' = s /\ pending' = {}
    /\ exports' = exports + 1
    /\ IF v = ext
       THEN baseline' = ext /\ op' = op
       ELSE /\ ext = InsBaseline(s) /\ ext \in Valid
            /\ baseline' = InsBaseline(s)
            /\ op' = [step |-> "backup", save |-> s, bytes |-> v, expected |-> ext,
                      backup |-> 0, recover |-> FALSE]
    /\ UNCHANGED <<ext, Storage, scan, unsafeWrite>>

RecoverStart(s) ==
    /\ op = Idle /\ s \in saves /\ ~Rejected(s) /\ exports < MaxExports
    /\ \E p \in InsPending(s) :
        /\ p.recoveryBackupId \in DOMAIN backups
        /\ backups[p.recoveryBackupId] = [owner |-> s, bytes |-> p.recoveryHash]
        /\ p.recoveryHash \in Valid
        /\ op' = [step |-> "backup", save |-> s, bytes |-> p.recoveryHash,
                  expected |-> ext, backup |-> 0, recover |-> TRUE]
    /\ Inspect(s)
    /\ exports' = exports + 1
    /\ UNCHANGED <<ext, Storage, scan, unsafeWrite>>

\* storage.createBackup with the emulator bytes that inspect returned.
ExportBackup ==
    /\ op.step = "backup" /\ op.save \in saves
    /\ Cardinality(DOMAIN backups) < MaxLiveBackups
    /\ backups' = [b \in DOMAIN backups \cup {nextBackup} |->
                     IF b = nextBackup THEN [owner |-> op.save, bytes |-> op.expected]
                     ELSE backups[b]]
    /\ nextBackup' = nextBackup + 1
    /\ op' = [op EXCEPT !.step = "write", !.backup = nextBackup]
    /\ UNCHANGED <<ext, imported, nextSave, readable, Journal, scan, exports, unsafeWrite>>

\* LinkedSavesPlugin.write, up to the first persist.
WriteJournal ==
    /\ op.step = "write" /\ readable /\ owner = op.save /\ ext = op.expected
    /\ IF op.recover
       THEN \E p \in pending :
              /\ p.recoveryHash = op.bytes
              /\ pending' = {[before |-> ext, after |-> op.bytes, backupId |-> op.backup,
                              recoveryBackupId |-> p.recoveryBackupId,
                              recoveryHash |-> p.recoveryHash]}
       ELSE /\ pending = {} /\ baseline = op.expected
            /\ pending' = {[before |-> ext, after |-> op.bytes, backupId |-> op.backup,
                            recoveryBackupId |-> op.backup, recoveryHash |-> ext]}
    /\ op' = [op EXCEPT !.step = "truncate"]
    /\ UNCHANGED <<ext, Storage, owner, baseline, scan, exports, unsafeWrite>>

BackupHeld ==
    /\ owner \in saves
    /\ \E p \in pending : /\ p.recoveryBackupId \in DOMAIN backups
                          /\ backups[p.recoveryBackupId].owner = owner

\* openFileDescriptor(uri, "rwt") truncates the emulator file.
WriteTruncate ==
    /\ op.step = "truncate"
    /\ ext' = Torn
    /\ unsafeWrite' = (unsafeWrite \/ ~BackupHeld)
    /\ op' = [op EXCEPT !.step = "writing"]
    /\ UNCHANGED <<Storage, Journal, scan, exports>>

WriteBytes ==
    /\ op.step = "writing"
    /\ ext' = op.bytes
    /\ op' = [op EXCEPT !.step = "verify"]
    /\ UNCHANGED <<Storage, Journal, scan, exports, unsafeWrite>>

\* The read-back matches: the second persist clears the pending record.
WriteCommit ==
    /\ op.step = "verify" /\ ext = op.bytes
    /\ baseline' = ext /\ pending' = {}
    /\ op' = Idle
    /\ UNCHANGED <<ext, Storage, owner, scan, exports, unsafeWrite>>

\* ---- Delete ----
\* observe returns "unavailable" when inspect rejects or the file is unreadable,
\* and then the guard passes.
DeleteSave(s) ==
    /\ op = Idle /\ s \in saves
    /\ IF GuardDeleteSave /\ readable /\ ~Rejected(s)
       THEN InsPending(s) = {} /\ Inspect(s)
       ELSE UNCHANGED Journal
    /\ imported' = [t \in saves \ {s} |-> imported[t]]
    /\ backups' = [b \in {c \in DOMAIN backups : backups[c].owner # s} |-> backups[b]]
    /\ UNCHANGED <<ext, nextSave, nextBackup, readable, op, scan, exports, unsafeWrite>>

DeleteBackup(b) ==
    /\ op = Idle /\ b \in DOMAIN backups /\ backups[b].owner \in saves
    /\ LET s == backups[b].owner IN
       IF GuardDeleteBackup /\ readable /\ ~Rejected(s)
       THEN (\A p \in InsPending(s) : p.recoveryBackupId # b) /\ Inspect(s)
       ELSE UNCHANGED Journal
    /\ backups' = [c \in DOMAIN backups \ {b} |-> backups[c]]
    /\ UNCHANGED <<ext, imported, nextSave, nextBackup, readable, op, scan, exports, unsafeWrite>>

\* ---- Environment ----
EmulatorWrite(v) ==
    /\ v # ext
    /\ ext' = v
    /\ UNCHANGED <<Storage, Journal, op, scan, exports, unsafeWrite>>

\* Unlink the folder or move the file away, and link or move it back.
SourceVanishes ==
    /\ SourceCanVanish /\ readable
    /\ readable' = FALSE
    /\ UNCHANGED <<ext, imported, nextSave, backups, nextBackup, Journal, op, scan, exports, unsafeWrite>>

SourceReturns ==
    /\ ~readable
    /\ readable' = TRUE
    /\ UNCHANGED <<ext, imported, nextSave, backups, nextBackup, Journal, op, scan, exports, unsafeWrite>>

\* An error in a step also ends the Export; it has the same effect on op.
AppKill ==
    /\ op # Idle \/ scan # "idle"
    /\ op' = Idle /\ scan' = "idle"
    /\ UNCHANGED <<ext, Storage, Journal, exports, unsafeWrite>>

\* One named disjunct per action, so that TLC names each step of a trace.
ObserveAny == \E s \in saves : Observe(s)
LoadExternalAny == \E s \in saves : LoadExternal(s)
ExportStartAny == \E s \in saves, v \in Valid : ExportStart(s, v)
RecoverStartAny == \E s \in saves : RecoverStart(s)
DeleteSaveAny == \E s \in saves : DeleteSave(s)
DeleteBackupAny == \E b \in DOMAIN backups : DeleteBackup(b)
EmulatorWriteAny == \E v \in Valid : EmulatorWrite(v)

Next ==
    \/ RescanSnapshot \/ RescanImport \/ ObserveAny \/ LoadExternalAny
    \/ ExportStartAny \/ RecoverStartAny
    \/ ExportBackup \/ WriteJournal \/ WriteTruncate \/ WriteBytes \/ WriteCommit
    \/ DeleteSaveAny \/ DeleteBackupAny
    \/ EmulatorWriteAny \/ SourceVanishes \/ SourceReturns \/ AppKill

Spec == Init /\ [][Next]_vars

\* ---- Rules ----
PendingKeepsSaveFile == pending # {} => owner \in saves

PendingKeepsBackup ==
    \A p \in pending :
        /\ p.recoveryBackupId \in DOMAIN backups
        /\ backups[p.recoveryBackupId] = [owner |-> owner, bytes |-> p.recoveryHash]

NoWriteWithoutBackup == ~unsafeWrite

NoDuplicateSaveFile == Cardinality(saves) <= 1

\* Breaks when an Export can leave a pending record. The check expects that,
\* so that a pass of the other rules is not vacuous.
NeverPending == pending = {}

\* The symptom of the first #488 finding: a Save File that inspect always rejects.
SourceStaysUsable == \A s \in saves : ~Rejected(s)
====
