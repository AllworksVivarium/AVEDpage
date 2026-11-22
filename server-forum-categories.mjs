export function forumCategoryList(db){
 return db.prepare('SELECT id,name,sort_order AS sortOrder FROM forum_categories ORDER BY sort_order,id').all();
}

export function resolveForumCategory(db,value,fallback){
 if(value===undefined)value=fallback??forumCategoryList(db)[0]?.id;
 if(typeof value==='string'&&/^\d+$/.test(value))value=Number(value);
 if(!Number.isSafeInteger(value)||value<1||!db.prepare('SELECT id FROM forum_categories WHERE id=?').get(value))throw Error('请选择有效分类。');
 return value;
}

export function installForumCategories(db){
 db.exec('SAVEPOINT forum_categories_schema');
 try{
  db.exec(`CREATE TABLE IF NOT EXISTS forum_categories(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL UNIQUE COLLATE NOCASE,sort_order INTEGER NOT NULL DEFAULT 0);`);
  if(!db.prepare('SELECT id FROM forum_categories LIMIT 1').get()){
   const insert=db.prepare('INSERT INTO forum_categories(name,sort_order) VALUES(?,?)');
   ['员工日常','组队招募','出谋划策'].forEach((name,index)=>insert.run(name,index));
  }
  if(!db.prepare('PRAGMA table_info(forum_threads)').all().some(c=>c.name==='category_id')){
   db.exec('ALTER TABLE forum_threads ADD COLUMN category_id INTEGER REFERENCES forum_categories(id)');
   db.prepare('UPDATE forum_threads SET category_id=?').run(forumCategoryList(db)[0].id);
  }
  // Older clients and scripts use the first category when they omit the new field.
  db.exec(`CREATE TRIGGER IF NOT EXISTS forum_category_default AFTER INSERT ON forum_threads WHEN NEW.category_id IS NULL BEGIN
   UPDATE forum_threads SET category_id=(SELECT id FROM forum_categories ORDER BY sort_order,id LIMIT 1) WHERE id=NEW.id; END;
   CREATE INDEX IF NOT EXISTS forum_threads_category ON forum_threads(category_id,id);`);
  db.exec('RELEASE forum_categories_schema');
 }catch(error){db.exec('ROLLBACK TO forum_categories_schema;RELEASE forum_categories_schema');throw error;}
 return {
  list:()=>forumCategoryList(db),resolve:(value,fallback)=>resolveForumCategory(db,value,fallback),
  save(id,data){
   const name=typeof data.name==='string'?data.name.trim():'';
   if(!name||Array.from(name).length>20)throw Error('分类名称须为 1 至 20 字。');
   const order=data.sortOrder??(db.prepare('SELECT COALESCE(MAX(sort_order),-1)+1 AS n FROM forum_categories').get().n);
   if(!Number.isSafeInteger(order)||order<0||order>9999)throw Error('分类顺序须为 0 至 9999 的整数。');
   if(db.prepare('SELECT id FROM forum_categories WHERE name=? COLLATE NOCASE AND id<>?').get(name,id||0))throw Error('分类名称已存在。');
   if(id){if(!db.prepare('UPDATE forum_categories SET name=?,sort_order=? WHERE id=?').run(name,order,id).changes)throw Error('分类不存在。');}
   else id=Number(db.prepare('INSERT INTO forum_categories(name,sort_order) VALUES(?,?)').run(name,order).lastInsertRowid);
   return {id,items:forumCategoryList(db)};
  }
 };
}
