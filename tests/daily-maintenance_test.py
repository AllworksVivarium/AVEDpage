import datetime as dt
from contextlib import closing
import importlib.util
from pathlib import Path
import sqlite3
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("maintenance", Path(__file__).resolve().parents[1] / "deploy/daily-maintenance.py")
maintenance = importlib.util.module_from_spec(spec)
spec.loader.exec_module(maintenance)


class MaintenanceTest(unittest.TestCase):
    def test_account_moderation_only_records_changes(self):
        with closing(sqlite3.connect(':memory:')) as db:
            db.execute('CREATE TABLE employees(id INTEGER PRIMARY KEY,username TEXT,enabled INTEGER)')
            sql = (Path(__file__).resolve().parents[1] / 'deploy/event-account-history.sql').read_text()
            db.executescript(sql)
            db.execute("INSERT INTO employees VALUES(1,'synthetic',1)")
            db.execute('UPDATE employees SET enabled=1')
            self.assertEqual(db.execute('SELECT count(*) FROM event_account_history').fetchone()[0], 0)
            db.execute('UPDATE employees SET enabled=0')
            db.execute('UPDATE employees SET enabled=1')
            db.execute('DELETE FROM employees')
            self.assertEqual([r[0] for r in db.execute('SELECT action FROM event_account_history ORDER BY id')], ['disable','enable','delete'])

    def test_backup_rotation_and_active_or_participated_games_survive(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parent) as temporary:
            database = Path(temporary) / "event.sqlite"
            backups = Path(temporary) / "backups"
            with closing(sqlite3.connect(database)) as db, db:
                db.executescript("""
                CREATE TABLE sky_flights(id INTEGER PRIMARY KEY,depart_at INTEGER,ended_at INTEGER);
                CREATE TABLE sky_passengers(flight_id INTEGER REFERENCES sky_flights(id));
                CREATE TABLE sky_robot_plans(flight_id INTEGER);
                CREATE TABLE sky_companion_checks(flight_id INTEGER);
                CREATE TABLE game_tickets(game TEXT,result_json TEXT);
                CREATE TABLE derby_races(id INTEGER PRIMARY KEY,settled INTEGER,next_at INTEGER);
                CREATE TABLE derby_bets(race_id INTEGER REFERENCES derby_races(id));
                CREATE TABLE sessions(expires_at INTEGER);
                CREATE TABLE balance_ledger(delta INTEGER);
                INSERT INTO balance_ledger VALUES(123),(-9);
                INSERT INTO sky_flights VALUES(1,1,2),(2,1,2),(3,1,2),(4,1,0),(5,1,0),(6,1,0);
                INSERT INTO sky_passengers VALUES(2);
                INSERT INTO game_tickets VALUES('sky','{"flight":3}');
                INSERT INTO sky_robot_plans VALUES(1);
                INSERT INTO sky_companion_checks VALUES(1);
                INSERT INTO sessions VALUES(1),(9999999999999);
                """)
                db.executemany("INSERT INTO derby_races VALUES(?,1,2)", [(i,) for i in range(1, 11)])
                db.execute("INSERT INTO derby_bets VALUES(2)")
            start = dt.datetime(2026, 11, 8, tzinfo=dt.timezone.utc)
            for offset in range(3):
                result = maintenance.run(database, backups, start + dt.timedelta(days=offset))
            with closing(sqlite3.connect(database)) as db:
                self.assertEqual([r[0] for r in db.execute("SELECT id FROM sky_flights ORDER BY id")], [2, 3, 6])
                self.assertEqual([r[0] for r in db.execute("SELECT id FROM derby_races ORDER BY id")], [2, 10])
                self.assertEqual(db.execute("SELECT SUM(delta) FROM balance_ledger").fetchone()[0], 114)
                self.assertEqual(db.execute("SELECT count(*) FROM game_tickets").fetchone()[0], 1)
                self.assertEqual(db.execute("SELECT count(*) FROM sessions").fetchone()[0], 1)
            self.assertEqual(len(list(backups.glob("*.sqlite"))), 2)
            for backup in backups.glob("*.sqlite"):
                with closing(sqlite3.connect(backup)) as db:
                    self.assertEqual(db.execute("PRAGMA quick_check").fetchone()[0], "ok")
                    self.assertEqual(db.execute("SELECT SUM(delta) FROM balance_ledger").fetchone()[0], 114)
            maintenance.run(database, backups, start + dt.timedelta(days=2))
            self.assertEqual(len(list(backups.glob("*.sqlite"))), 2)


if __name__ == "__main__":
    unittest.main()
