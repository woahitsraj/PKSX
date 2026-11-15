# Use app-managed Saves

PKSX treats Saves as the source of truth for imported saves, Backups, and bank data. Imported baseline bytes remain immutable. Editing and external refresh update a persisted Workspace; replacement first backs up the current Workspace and, when different, the imported baseline.

Android users can link folders through the platform picker. Document identity, persistent grants, acknowledged source hashes, and interrupted Export journals belong to this installation. They are not Cloud Sync data. Automatic discovery imports new documents without activating them. Startup, resume, and requested scans offer changed external versions without silently replacing a Workspace.

For a linked Save File, the user's explicit Export action writes serialized Workspace bytes to the original document. Export a copy retains the separate-file path. Unlinked imports keep separate-file Export. PKSX compares source bytes against its acknowledged SHA-256 baseline immediately before writing, blocks conflicting external changes, and offers external refresh or a separate copy. Timestamps do not establish ownership of a version.

Write-back requires a durable Backup of the external bytes and a native journal before opening the document for write. Success requires read-back equality with the Engine-validated export. On restart, the journal distinguishes original, completed, and indeterminate bytes. Indeterminate writes require explicit recovery from the original external Backup; current external bytes receive another Backup before recovery.

Android document providers do not expose a portable compare-and-swap or atomic replacement contract. PKSX uses `rwt`, flushes and requests descriptor sync, then reads back the bytes. A provider can truncate before an interrupted write, refuse sync, or change concurrently after the hash check. Close the emulator before Export. The journal and immutable Backups support recovery but do not make SAF writes atomic. PKSX never automatically retries a destructive write.
