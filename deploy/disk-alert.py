#!/usr/bin/env python3
"""Check root disk after safe cache cleanup; SES via an EC2 instance role."""
import argparse
import datetime
import json
import math
import os
from pathlib import Path
import subprocess
import time

STATE = Path('/var/lib/aved-disk-alert/state.json')
RECIPIENT = '3166367907@qq.com'

def usage():
    s = os.statvfs('/')
    used = s.f_blocks - s.f_bfree
    return {'percent': math.ceil(100 * used / (used + s.f_bavail)),
            'usedGiB': round(used * s.f_frsize / 2**30, 2),
            'availableGiB': round(s.f_bavail * s.f_frsize / 2**30, 2)}

def run(test=False):
    current = usage()
    if not test and current['percent'] < 95:
        print(json.dumps({'status':'below_threshold', **current})); return
    cleanup = 'not run (test email)'
    if not test:
        # Share the daily maintenance lock; never remove databases, volumes or images.
        result = subprocess.run(['flock','-n','/run/aved-daily-maintenance.lock',
            'docker','builder','prune','--force'],capture_output=True,text=True,timeout=180)
        cleanup = 'completed' if result.returncode == 0 else 'failed or maintenance busy'
        current = usage()
        if current['percent'] < 95:
            print(json.dumps({'status':'recovered_after_cleanup', **current})); return
    previous = json.loads(STATE.read_text()) if STATE.exists() else {}
    now = time.time()
    if not test and now - previous.get('lastSent',0) < 86400:
        print(json.dumps({'status':'daily_cooldown', **current})); return
    import boto3
    client = boto3.client('ses',region_name='ap-northeast-1')
    subject = '[AVED] ' + ('磁盘告警通道测试' if test else '清理后磁盘使用率仍达到 95%')
    body = (f"时间：{datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).isoformat()}\n"
            f"根分区使用率：{current['percent']}%\n已用：{current['usedGiB']} GiB\n"
            f"剩余：{current['availableGiB']} GiB\n缓存清理：{cleanup}\n"
            '请检查磁盘容量。脚本不会删除玩家数据或数据库备份。')
    client.send_email(Source=os.environ.get('AVED_ALERT_FROM',RECIPIENT),
        Destination={'ToAddresses':[RECIPIENT]},Message={
        'Subject':{'Data':subject,'Charset':'UTF-8'},
        'Body':{'Text':{'Data':body,'Charset':'UTF-8'}}})
    # Record success only; failed delivery is retried on the next timer run.
    if not test:
        STATE.parent.mkdir(parents=True,exist_ok=True)
        temporary=STATE.with_suffix('.tmp')
        temporary.write_text(json.dumps({'lastSent':now,**current}))
        temporary.replace(STATE)
    print(json.dumps({'status':'sent','test':test,**current}))

if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--test-email',action='store_true')
    args=parser.parse_args()
    run(args.test_email)
