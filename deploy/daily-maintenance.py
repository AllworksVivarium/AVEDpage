#!/usr/bin/env python3
"""One rolling daily snapshot and one snapshot refreshed every five days."""
import argparse
from contextlib import closing
import datetime as dt
import json
import os
from pathlib import Path
import sqlite3
import tempfile


def verified_backup(database, directory, day, prefix="daily"):
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    destination = directory / (prefix + "-" + day + ".sqlite")
    fd, temporary = tempfile.mkstemp(prefix="." + prefix + "-", suffix=".tmp", dir=directory)
    os.close(fd)
    try:
        with closing(sqlite3.connect(database.resolve().as_uri() + "?mode=ro", uri=True, timeout=10)) as source:
            with closing(sqlite3.connect(temporary)) as target:
                source.backup(target, pages=128, sleep=0.05)
                # Standalone snapshots need no WAL/SHM companion files.
                target.execute("PRAGMA journal_mode=DELETE")
                if target.execute("PRAGMA quick_check").fetchone()[0] != "ok":
                    raise RuntimeError("Backup integrity check failed")
        os.chmod(temporary, 0o600)
        os.replace(temporary, destination)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    return destination


def clean(database, now_ms):
    with closing(sqlite3.connect(database, timeout=10)) as db, db:
        db.execute("PRAGMA foreign_keys=ON")
        db.execute("BEGIN IMMEDIATE")
        # Other source tables and all tickets, balances, speech, and wagers stay intact.
        db.execute("""CREATE TEMP TABLE empty_sky AS SELECT f.id FROM sky_flights f
          WHERE f.id<>(SELECT MAX(id) FROM sky_flights)
          AND ((f.ended_at>0 AND f.ended_at<?) OR (f.ended_at=0 AND f.depart_at<?))
          AND NOT EXISTS(SELECT 1 FROM sky_passengers p WHERE p.flight_id=f.id)
          AND f.id NOT IN(SELECT CAST(json_extract(t.result_json,'$.flight') AS INTEGER)
            FROM game_tickets t WHERE t.game='sky' AND json_valid(t.result_json)
            AND json_extract(t.result_json,'$.flight') IS NOT NULL)""",
                   (now_ms, now_ms - 86400000))
        result = {}
        for table in ("sky_robot_plans", "sky_companion_checks"):
            result[table] = db.execute("DELETE FROM " + table + " WHERE flight_id IN (SELECT id FROM empty_sky)").rowcount
        result["sky_flights"] = db.execute("DELETE FROM sky_flights WHERE id IN (SELECT id FROM empty_sky)").rowcount
        db.execute('CREATE TEMP TABLE protected_derby(id INTEGER PRIMARY KEY)')
        if db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='derby_wagers'").fetchone():
            db.execute('INSERT OR IGNORE INTO protected_derby SELECT race_id FROM derby_wagers')
        # Empty historical results are disposable; keep only the current round.
        result["derby_races"] = db.execute("""DELETE FROM derby_races WHERE settled=1 AND next_at<?
          AND id<>(SELECT MAX(id) FROM derby_races)
          AND id NOT IN(SELECT id FROM protected_derby)
          AND NOT EXISTS(SELECT 1 FROM derby_bets b WHERE b.race_id=derby_races.id)
          AND id NOT IN(SELECT CAST(json_extract(t.result_json,'$.race') AS INTEGER)
            FROM game_tickets t WHERE t.game='derby' AND json_valid(t.result_json)
            AND json_extract(t.result_json,'$.race') IS NOT NULL)""", (now_ms,)).rowcount
        result["sessions"] = db.execute("DELETE FROM sessions WHERE expires_at<?", (now_ms,)).rowcount
        if db.execute("PRAGMA foreign_key_check").fetchone():
            raise RuntimeError("Foreign key check failed; cleanup rolled back")
        return result


def run(database, directory, now=None):
    # Share a crash-safe SQLite writer lock with account erasure in the app.
    database = Path(database)
    if not database.is_file():
        raise FileNotFoundError(database)
    with closing(sqlite3.connect(database.parent / 'maintenance-lock.sqlite', timeout=30)) as lock:
        lock.execute('BEGIN IMMEDIATE')
        try:
            return run_locked(database, directory, now)
        finally:
            lock.rollback()


def run_locked(database, directory, now=None):
    database, directory = Path(database), Path(directory)
    if not database.is_file():
        raise FileNotFoundError(database)
    now = now or dt.datetime.now(dt.timezone.utc)
    day = now.astimezone(dt.timezone(dt.timedelta(hours=8))).date().isoformat()
    backup = verified_backup(database, directory, day)
    five_day_backups = sorted(p for p in directory.glob("five-day-????-??-??.sqlite") if p.is_file())
    five_day = five_day_backups[-1] if five_day_backups else None
    if five_day is None or (dt.date.fromisoformat(day) - dt.date.fromisoformat(five_day.stem[len("five-day-"):])).days >= 5:
        five_day = verified_backup(backup, directory, day, prefix="five-day")
    # Remove old snapshots only after both replacement snapshots are available.
    for prefix, retained in (("daily", backup), ("five-day", five_day)):
        for old in directory.glob(prefix + "-????-??-??.sqlite"):
            if old.is_file() and old != retained:
                old.unlink()
    removed = clean(database, int(now.timestamp() * 1000))
    return {"backup": str(backup), "fiveDayBackup": str(five_day), "retainedBackups": 2, "removed": removed}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--database", default="/root/AVED/data/wanyehui.db")
    parser.add_argument("--backup-dir", default="/root/AVED/data/daily-backups")
    args = parser.parse_args()
    print(json.dumps(run(args.database, args.backup_dir)))
