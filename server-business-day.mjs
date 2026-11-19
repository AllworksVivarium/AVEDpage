// Business dates use Beijing time and roll over at 04:00, not midnight.
export const BUSINESS_DAY_MS=86400000;
const OFFSET=4*3600000;
export const businessDay=(time=Date.now())=>new Date(time+OFFSET).toISOString().slice(0,10);
export const businessDayStart=(time=Date.now())=>Math.floor((time+OFFSET)/BUSINESS_DAY_MS)*BUSINESS_DAY_MS-OFFSET;
export const businessDayEnd=(time=Date.now())=>businessDayStart(time)+BUSINESS_DAY_MS;
