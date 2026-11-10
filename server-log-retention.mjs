export const logRetention = Object.freeze({operationsDays:30, ledgerCopiesDays:90, batchSize:500});

export function installLogRetention(db, {intervalMs=3600000, now=()=>Date.now()}={}) {
  db.exec(`CREATE INDEX IF NOT EXISTS activity_retention_operations ON activity_logs(julianday(created_at),id)
    WHERE action IN ('view','GET','login','logout','request','heartbeat','presence','cards.pass')
      AND target NOT IN ('balance_ledger','stock_trades','forum_threads','forum_replies','posts',
        'dossier_comments','chat_messages','life_records','image_archive');
    CREATE INDEX IF NOT EXISTS activity_retention_ledger ON activity_logs(julianday(created_at),id)
      WHERE target='balance_ledger' AND action='insert';`);
  // Only known, disposable telemetry. Unknown actions and all speech/image audits stay.
  const operations=db.prepare(`DELETE FROM activity_logs WHERE id IN (
    SELECT id FROM activity_logs
    WHERE julianday(created_at)<julianday(?)
      AND action IN ('view','GET','login','logout','request','heartbeat','presence','cards.pass')
      AND target NOT IN ('balance_ledger','stock_trades','forum_threads','forum_replies','posts',
        'dossier_comments','chat_messages','life_records','image_archive')
    ORDER BY julianday(created_at),id LIMIT 500)`);
  const copies=db.prepare(`DELETE FROM activity_logs WHERE id IN (
    SELECT a.id FROM activity_logs a
    WHERE a.target='balance_ledger' AND a.action='insert'
      AND julianday(a.created_at)<julianday(?)
      AND EXISTS(SELECT 1 FROM balance_ledger b
        WHERE b.id=CASE WHEN json_valid(a.details) THEN json_extract(a.details,'$.id') END
          AND b.employee_id=CASE WHEN json_valid(a.details) THEN json_extract(a.details,'$.employee_id') END
          AND b.delta=CASE WHEN json_valid(a.details) THEN json_extract(a.details,'$.delta') END
          AND b.reason=CASE WHEN json_valid(a.details) THEN json_extract(a.details,'$.reason') END)
    ORDER BY julianday(a.created_at),a.id LIMIT 500)`);
  function prune() {
    const at=now(),cutoff=days=>new Date(at-days*86400000).toISOString();
    db.exec('BEGIN IMMEDIATE');
    try {
      const result={operations:Number(operations.run(cutoff(logRetention.operationsDays)).changes),
        ledgerCopies:Number(copies.run(cutoff(logRetention.ledgerCopiesDays)).changes)};
      db.exec('COMMIT');
      return result;
    } catch(error) {db.exec('ROLLBACK');throw error;}
  }
  const initial=prune();
  const timer=setInterval(()=>{try{prune();}catch(error){console.error('Log retention failed:',error.message);}},intervalMs);
  timer.unref();
  return {initial,prune,close(){clearInterval(timer);}};
}
