// A real authenticated session awards this once; creating an account is not login.
export function installContainmentWelcome(db){
 db.exec(`CREATE TRIGGER IF NOT EXISTS containment_welcome_login AFTER INSERT ON sessions BEGIN
  INSERT OR IGNORE INTO earned_achievements(employee_id,code)
  SELECT NEW.employee_id,d.code FROM achievement_definitions d
  WHERE d.code='containment-welcome' AND d.enabled=1
  AND EXISTS(SELECT 1 FROM employees e WHERE e.id=NEW.employee_id AND e.identity_kind='player_containment');
 END;`);
}
