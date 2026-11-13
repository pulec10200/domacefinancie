# Local and externally synchronized inboxes

In **Dokumenty**, click **Sledovať priečinok** and choose a dedicated inbox. The app imports stable supported files, archives a local copy and never deletes or moves the source. Its selected folder survives restart. Only one folder is watched at a time; document states are tracked in the application, not inferred from file names.

Windows: Google Drive for desktop or OneDrive can synchronize the selected folder. Make files available offline so the desktop app can read complete local bytes. The finance app has no access to your Google/Microsoft login and does not configure synchronization.

Linux: an official Drive desktop client is not assumed. You can use any separately trusted synchronization program or rclone. Install/configure it independently using its own current official instructions, authenticate directly there, and verify an isolated test folder first. The finance app works without rclone or a Google account.

A conservative rclone example after configuring a remote named mydrive:

```sh
mkdir -p "$HOME/FinanceInbox"
rclone copy mydrive:FinanceInbox "$HOME/FinanceInbox" --dry-run
# Inspect the proposed copies, then deliberately repeat without --dry-run.
```

Do not use sync, purge, delete flags or bidirectional jobs unless you independently understand their deletion behavior. The example uses copy into a dedicated local destination. Do not sync the live SQLite database/WAL files; use verified completed backups for copying instead. Avoid putting private financial files into a public GitHub repository. A local synchronized folder may upload its contents through the separately configured service; review that service's sharing settings yourself.
