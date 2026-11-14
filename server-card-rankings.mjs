// Small settlement-only records; the existing round transaction owns atomicity.
export function installCardRankings(db,clock=()=>Date.now()){
 db.exec(`CREATE TABLE IF NOT EXISTS card_rank_wins(round_id TEXT NOT NULL,employee_id INTEGER NOT NULL,role TEXT NOT NULL,name TEXT NOT NULL,won_at INTEGER NOT NULL,PRIMARY KEY(round_id,employee_id));CREATE INDEX IF NOT EXISTS card_rank_time ON card_rank_wins(won_at,role,employee_id);`);
 let cached=null,expires=0;
 return {
 record(room){
  if(room.mode!=='online'||room.game?.phase!=='ended'||!room.money?.settlement)return;
  const people=room.seats.filter(p=>p&&!p.bot);
  if(new Set(people.map(p=>p.id)).size<2)return;
  const g=room.game;
  room.seats.forEach((p,i)=>{if(!p||p.bot)return;const role=i===g.landlord?'landlord':'farmers';if(role===g.winner)db.prepare('INSERT OR IGNORE INTO card_rank_wins VALUES(?,?,?,?,?)').run(room.money.round,p.id,role,p.name||'员工',clock());});
  cached=null;
 },
 list(){const now=clock();if(cached&&now<expires)return cached;const since=now-5*86400000;
  const rows=role=>db.prepare(`SELECT w.employee_id AS employeeId,(SELECT name FROM card_rank_wins n WHERE n.employee_id=w.employee_id ORDER BY won_at DESC,rowid DESC LIMIT 1) AS name,COUNT(*) AS wins FROM card_rank_wins w WHERE won_at>? AND role=? GROUP BY employee_id ORDER BY wins DESC,MAX(won_at) ASC,employee_id ASC LIMIT 5`).all(since,role).map((r,i,a)=>({...r,rank:i&&a[i-1].wins===r.wins?a.slice(0,i).findIndex(x=>x.wins===r.wins)+1:i+1}));
  cached={since,asOf:now,landlord:rows('landlord'),farmers:rows('farmers')};expires=now+30000;return cached;
 }
 };
}
