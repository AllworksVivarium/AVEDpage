// Money committed to one game/round; prizes and existing saved rounds keep their rules.
export const MAX_GAME_STAKE=100000;
export const MAX_SHARED_GAME_STAKE=500000;
export const MAX_SKY_STAKE=300000;
export function validateGameStake(amount,maximum=MAX_GAME_STAKE){
 if(!Number.isSafeInteger(amount)||amount<100||amount>maximum)throw Error('投入应为 100 至 '+maximum.toLocaleString('en-US')+' 的整数。');
 return amount;
}
