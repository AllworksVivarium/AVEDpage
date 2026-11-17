export const DAILY_REWARD=8000;
export const HOURLY_REWARD=2000;
const HOUR=3600000,DAY=24*HOUR,DAY_OFFSET=8*HOUR;

// Check-ins reset at midnight; supplies are independently claimable every hour.
export function installHourlyRewards({db,recordLedger,clock=Date.now}) {
 const current=db.prepare('SELECT 1 FROM hourly_claims WHERE employee_id=? AND hour=?');
 const insert=db.prepare('INSERT OR IGNORE INTO hourly_claims(employee_id,hour,reward) VALUES(?,?,?)');
 function state(id,now=clock()) {
  const hour=Math.floor(now/HOUR),dayStart=Math.floor((now+DAY_OFFSET)/DAY)*DAY-DAY_OFFSET,dailyResetAt=dayStart+DAY;
  return {serverTime:now,dailyReward:DAILY_REWARD,dailyResetAt,hourlyReward:HOURLY_REWARD,
   hourlyClaimed:!!current.get(id,hour),hourlyResetAt:(hour+1)*HOUR};
 }
 function claim(id) {
  db.exec('BEGIN IMMEDIATE');
  try {
   const now=clock(),claimed=insert.run(id,Math.floor(now/HOUR),HOURLY_REWARD).changes>0;
   if(claimed)recordLedger(id,HOURLY_REWARD,'整点补给');
   const result={...state(id,now),reward:claimed?HOURLY_REWARD:0};
   db.exec('COMMIT');return result;
  }catch(error){db.exec('ROLLBACK');throw error;}
 }
 return {state,claim};
}
