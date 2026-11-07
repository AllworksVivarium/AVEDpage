-- Minimal account moderation history; no login failures or browsing history.
-- Actor is not guessed: existing content deletion records already store deleted_by.
CREATE TABLE IF NOT EXISTS event_account_history(
  id INTEGER PRIMARY KEY,
  employee_id INTEGER NOT NULL,
  username TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN('disable','enable','delete')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER IF NOT EXISTS event_account_enabled AFTER UPDATE OF enabled ON employees
WHEN OLD.enabled<>NEW.enabled BEGIN
  INSERT INTO event_account_history(employee_id,username,action)
  VALUES(NEW.id,NEW.username,CASE WHEN NEW.enabled=0 THEN 'disable' ELSE 'enable' END);
END;
CREATE TRIGGER IF NOT EXISTS event_account_deleted BEFORE DELETE ON employees BEGIN
  INSERT INTO event_account_history(employee_id,username,action)
  VALUES(OLD.id,OLD.username,'delete');
END;
