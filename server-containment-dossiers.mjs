// A containment account owns one durable dossier; the profile bio stays independent.
export function installContainmentDossiers(db){
 db.exec('BEGIN IMMEDIATE');
 try{
  if(!db.prepare('PRAGMA table_info(dossiers)').all().some(c=>c.name==='player_visible'))db.exec('ALTER TABLE dossiers ADD COLUMN player_visible INTEGER NOT NULL DEFAULT 1 CHECK(player_visible IN (0,1))');
  if(!db.prepare('PRAGMA table_info(dossiers)').all().some(c=>c.name==='employee_id'))db.exec('ALTER TABLE dossiers ADD COLUMN employee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS dossiers_employee_unique ON dossiers(employee_id) WHERE employee_id IS NOT NULL');
  const accounts=db.prepare("SELECT e.id,e.display_name,e.containment_classification,COALESCE(p.bio,'') AS bio FROM employees e LEFT JOIN profiles p ON p.employee_id=e.id WHERE e.identity_kind IN ('player_containment','company_containment')").all();
  for(const e of accounts){
   if(db.prepare('SELECT 1 FROM dossiers WHERE employee_id=?').get(e.id))continue;
   // Reuse an unambiguous existing archive, preserving its ID, comments and content.
   const candidates=db.prepare('SELECT id,classification FROM dossiers WHERE employee_id IS NULL AND title=?').all(e.display_name);
   const owners=accounts.filter(x=>x.display_name===e.display_name);
   if(candidates.length===1&&owners.length===1){
    const old=candidates[0];
    db.prepare('UPDATE dossiers SET employee_id=?,classification=? WHERE id=?').run(e.id,e.containment_classification||old.classification,old.id);
    if(!e.containment_classification&&old.classification)db.prepare('UPDATE employees SET containment_classification=? WHERE id=?').run(old.classification,e.id);
   }else db.prepare("INSERT INTO dossiers(code,title,department,status,summary,classification,employee_id) VALUES('PC-'||?||'-'||lower(hex(randomblob(3))),?,'收容部','观察中',?,?,?)").run(e.id,e.display_name,e.bio||'档案待补充。',e.containment_classification,e.id);
  }
  db.exec(`
   CREATE TRIGGER IF NOT EXISTS containment_dossier_insert AFTER INSERT ON employees
   WHEN NEW.identity_kind IN ('player_containment','company_containment') BEGIN
    INSERT INTO dossiers(code,title,department,status,summary,classification,employee_id)
    VALUES('PC-'||NEW.id||'-'||lower(hex(randomblob(3))),NEW.display_name,'收容部','观察中','档案待补充。',NEW.containment_classification,NEW.id);
   END;
   CREATE TRIGGER IF NOT EXISTS containment_dossier_update AFTER UPDATE OF identity_kind,display_name,containment_classification ON employees
   WHEN NEW.identity_kind IN ('player_containment','company_containment') BEGIN
    INSERT INTO dossiers(code,title,department,status,summary,classification,employee_id)
    SELECT 'PC-'||NEW.id||'-'||lower(hex(randomblob(3))),NEW.display_name,'收容部','观察中',COALESCE(NULLIF((SELECT bio FROM profiles WHERE employee_id=NEW.id),''),'档案待补充。'),NEW.containment_classification,NEW.id
    WHERE NOT EXISTS(SELECT 1 FROM dossiers WHERE employee_id=NEW.id);
    UPDATE dossiers SET title=NEW.display_name,classification=NEW.containment_classification
    WHERE employee_id=NEW.id AND (title IS NOT NEW.display_name OR classification IS NOT NEW.containment_classification);
   END;
   CREATE TRIGGER IF NOT EXISTS containment_dossier_bio AFTER INSERT ON profiles
   WHEN NEW.bio<>'' BEGIN
    UPDATE dossiers SET summary=NEW.bio WHERE employee_id=NEW.employee_id AND summary='档案待补充。';
   END;
   CREATE TRIGGER IF NOT EXISTS containment_dossier_identity AFTER UPDATE OF title,classification ON dossiers
   WHEN NEW.employee_id IS NOT NULL BEGIN
    UPDATE employees SET display_name=NEW.title,containment_classification=NEW.classification
    WHERE id=NEW.employee_id AND identity_kind IN ('player_containment','company_containment')
     AND (display_name IS NOT NEW.title OR containment_classification IS NOT NEW.classification);
   END;
  `);
  db.exec('COMMIT');
 }catch(error){db.exec('ROLLBACK');throw error;}
}

export function listDossiers(db,{admin=false}={}){
 return db.prepare(`SELECT d.id,d.code,d.title,d.department,d.status,d.summary,d.abstract,d.classification,d.procedures,d.sections_json,
  d.player_visible AS playerVisible,length(d.image_data)>0 AS hasImage,d.employee_id AS employeeId,e.identity_kind AS identityKind
  FROM dossiers d LEFT JOIN employees e ON e.id=d.employee_id ${admin?'':'WHERE d.player_visible=1'} ORDER BY d.id ${admin?'DESC':'ASC'}`).all();
}
