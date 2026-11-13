import {expandedAchievementCatalog} from './achievement-expansion.mjs';
import {funAchievementCatalog} from './server-fun-achievements.mjs';
import {socialAchievementCatalog} from './server-social-achievements.mjs';
import {gameplayAchievementCatalog} from './server-game-achievements.mjs';
// Definitions stay on the server. Only earned entries are sent to employees.
export const achievementCatalog = [
 ['zero','归零时刻','曾将非零余额归零。','zero_count',1],
 ['relief-1','重新出发','领取一次低保。','relief_count',1],
 ['relief-10','后勤常客','累计领取十次低保。','relief_count',10],
 ['100k','六位数档案','余额曾超过十万。','peak',100001],
 ['1m','百万账簿','余额曾超过一百万。','peak',1000001],
 ['10m','千万级权限','余额曾超过一千万。','peak',10000001],
 ['debt-100k','负数深处','负债曾达到十万。','debt',100000],
 ['donor-1','一份心意','首次向爱心账户捐款。','donated',1],
 ['donor-100k','后勤支柱','累计向爱心账户捐出十万。','donated',100000],
 ['checkin-7','七次报到','累计完成七次每日签到。','checkin_count',7],
 ['hourly-24','整点守望','累计领取二十四次整点补给。','hourly_count',24],
 ['jackpot','异常进账','单局返还达到五十万。','prize_max',500000],
 ['loss-100k','风险备忘录','单局净亏损达到十万。','loss_max',100000]
].map(([code,title,description,metric,threshold])=>({code,title,description,metric,threshold})).concat(gameplayAchievementCatalog,expandedAchievementCatalog,socialAchievementCatalog,funAchievementCatalog);
