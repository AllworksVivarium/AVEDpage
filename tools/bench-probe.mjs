import {monitorEventLoopDelay} from 'node:perf_hooks';
const delay=monitorEventLoopDelay({resolution:10});delay.enable();
process.on('message',message=>{if(message==='stats'){process.send({cpu:process.cpuUsage(),rss:process.memoryUsage().rss,heap:process.memoryUsage().heapUsed,loopP99:delay.percentile(99)/1e6});delay.reset();}});
