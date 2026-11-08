export const radioVisibleSQL="julianday(c.created_at)>=julianday('now','-3 days')";

export function installRadioRetention(db,{intervalMs=3600000}={}){
 db.exec('CREATE INDEX IF NOT EXISTS radio_expiry ON chat_messages(julianday(created_at))');
 function prune(){
  db.exec('BEGIN IMMEDIATE');
  try{
   db.exec(`DELETE FROM speech_revisions WHERE source_type='chat' AND source_id IN (SELECT id FROM chat_messages WHERE julianday(created_at)<julianday('now','-3 days'));
    DELETE FROM activity_logs WHERE target='chat_messages' AND (julianday(created_at)<julianday('now','-3 days') OR (CASE WHEN json_valid(details) THEN julianday(json_extract(details,'$.created_at')) END<julianday('now','-3 days')));
    DELETE FROM chat_messages WHERE julianday(created_at)<julianday('now','-3 days');`);
   db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
 }
 prune();
 const timer=setInterval(()=>{try{prune();}catch(e){console.error('Radio retention failed:',e.message);}},intervalMs);timer.unref();
 return {prune,close(){clearInterval(timer);}};
}
