const sources=[['thread','forum_threads'],['reply','forum_replies'],['life','life_records']];

export function checkImageVersion(db,kind,sourceId,expected){
  if(expected===undefined)return;
  const current=db.prepare('SELECT id FROM image_upload_archive WHERE source_type=? AND source_id=? ORDER BY id DESC LIMIT 1').get(kind,sourceId);
  if(!current||current.id!==Number(expected))throw new Error('图片已更新，请刷新审核列表后再处理。');
}

export function recordImageReview(db,kind,sourceId,reviewer,action){
  db.prepare(`UPDATE image_upload_archive SET reviewed_by=?,reviewer_name=?,reviewed_at=CURRENT_TIMESTAMP,moderation=?
    WHERE id=(SELECT id FROM image_upload_archive WHERE source_type=? AND source_id=? ORDER BY id DESC LIMIT 1)`)
    .run(reviewer.id,reviewer.displayName||reviewer.username,action==='approve'?'approved':'rejected',kind,sourceId);
}

export function installImageArchive(db){
  db.exec(`CREATE TABLE IF NOT EXISTS image_upload_archive(
    id INTEGER PRIMARY KEY,source_type TEXT NOT NULL,source_id INTEGER NOT NULL,employee_id INTEGER,
    username TEXT NOT NULL,display_name TEXT NOT NULL,title TEXT NOT NULL DEFAULT '',body TEXT NOT NULL DEFAULT '',
    image_data TEXT NOT NULL,moderation TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewed_by INTEGER,reviewer_name TEXT NOT NULL DEFAULT '',reviewed_at TEXT NOT NULL DEFAULT '');
    CREATE INDEX IF NOT EXISTS image_archive_source ON image_upload_archive(source_type,source_id,id DESC);
    CREATE INDEX IF NOT EXISTS image_archive_time ON image_upload_archive(julianday(created_at),id);`);
  for(const [kind,table] of sources){
    const title=kind==='reply'?"COALESCE((SELECT title FROM forum_threads WHERE id=NEW.thread_id),'论坛回复')":'NEW.title';
    const capture=`INSERT INTO image_upload_archive(source_type,source_id,employee_id,username,display_name,title,body,image_data,moderation)
      VALUES('${kind}',NEW.id,NEW.employee_id,COALESCE((SELECT username FROM employees WHERE id=NEW.employee_id),''),
      COALESCE((SELECT display_name FROM employees WHERE id=NEW.employee_id),''),${title},NEW.body,NEW.image_data,NEW.moderation);`;
    db.exec(`CREATE TRIGGER IF NOT EXISTS archive_${kind}_upload AFTER INSERT ON ${table} WHEN NEW.image_data<>'' BEGIN ${capture} END;
      CREATE TRIGGER IF NOT EXISTS archive_${kind}_replace AFTER UPDATE OF image_data ON ${table} WHEN NEW.image_data<>'' BEGIN ${capture} END;
      CREATE TRIGGER IF NOT EXISTS archive_${kind}_decision AFTER UPDATE OF moderation ON ${table}
      WHEN NEW.moderation IN ('approved','rejected') AND NEW.moderation<>OLD.moderation BEGIN
      UPDATE image_upload_archive SET moderation=NEW.moderation WHERE id=(SELECT id FROM image_upload_archive WHERE source_type='${kind}' AND source_id=NEW.id ORDER BY id DESC LIMIT 1); END;`);
  }
  // Backfill currently retained images once; later removals never remove archive rows.
  if(!db.prepare("SELECT 1 FROM community_migrations WHERE name='image-archive-v1'").get()){
    db.exec('BEGIN IMMEDIATE');
    try{
      for(const [kind,table] of sources){
        const title=kind==='reply'?"COALESCE((SELECT title FROM forum_threads WHERE id=s.thread_id),'论坛回复')":'s.title';
        db.exec(`INSERT INTO image_upload_archive(source_type,source_id,employee_id,username,display_name,title,body,image_data,moderation,created_at)
          SELECT '${kind}',s.id,s.employee_id,COALESCE(e.username,''),COALESCE(e.display_name,''),${title},s.body,s.image_data,s.moderation,s.created_at
          FROM ${table} s LEFT JOIN employees e ON e.id=s.employee_id WHERE s.image_data<>''
          AND NOT EXISTS(SELECT 1 FROM image_upload_archive a WHERE a.source_type='${kind}' AND a.source_id=s.id);`);
      }
      db.prepare("INSERT INTO community_migrations VALUES('image-archive-v1')").run();db.exec('COMMIT');
    }catch(e){db.exec('ROLLBACK');throw e;}
  }
  return {
    query(params,range){
      const status=params.get('status')||'';
      if(status&&!['pending','approved','rejected'].includes(status))throw new Error('图片审核状态无效。');
      const keyword=(params.get('keyword')||'').slice(0,120),like='%'+keyword+'%';
      const rows=db.prepare(`SELECT id,source_type,source_id,employee_id,username,display_name,title,body,moderation,created_at,reviewed_by,reviewer_name,reviewed_at
        FROM image_upload_archive WHERE id<? AND julianday(created_at)>=julianday(?) AND julianday(created_at)<julianday(?)
        AND (?='' OR moderation=?) AND (?='' OR username LIKE ? OR display_name LIKE ? OR title LIKE ? OR body LIKE ?)
        ORDER BY id DESC LIMIT 51`).all(Number(params.get('before'))||Number.MAX_SAFE_INTEGER,range.start,range.end,status,status,keyword,like,like,like,like);
      const items=rows.slice(0,50).map(row=>({...row,category:'image',target:row.source_type==='life'?'life_records':row.source_type==='thread'?'forum_threads':'forum_replies',
        sourceBoard:row.source_type==='life'?'生活记录':'匿名聊天论坛',imageUrl:'/api/admin/image-archive/'+row.id,
        details:JSON.stringify({title:row.title,body:row.body,sourceId:row.source_id})}));
      return {items,next:rows.length>50?items.at(-1).id:null};
    },
    image(id,res){
      const row=db.prepare('SELECT image_data FROM image_upload_archive WHERE id=?').get(id),match=row?.image_data.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
      if(!match){res.writeHead(404,{'Cache-Control':'no-store'});res.end();return;}
      const bytes=Buffer.from(match[2],'base64');res.writeHead(200,{'Content-Type':match[1],'Content-Length':bytes.length,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});res.end(bytes);
    }
  };
}
