export const releaseId='daily-backups-only-20261119';

// Database snapshots are managed only by the daily/five-day maintenance job.
// Keep the startup/health contract without reading or creating release snapshots.
export async function backupBeforeContainmentRelease(){
 return {status:'disabled',policy:'daily-and-five-day'};
}
