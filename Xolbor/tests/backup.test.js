'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {tmpdir}=require('node:os');
const {DatabaseSync}=require('node:sqlite');
const {spawnSync}=require('node:child_process');
test('online backup retains committed WAL data without modifying its source',t=>{
  const dir=fs.mkdtempSync(path.join(tmpdir(),'xolbor-backup-'));
  const source=path.join(dir,'source.sqlite'),dest=path.join(dir,'copies');
  const db=new DatabaseSync(source);
  t.after(()=>{db.close();fs.rmSync(dir,{recursive:true,force:true});});
  db.exec("PRAGMA journal_mode=WAL; CREATE TABLE example(value TEXT); INSERT INTO example VALUES('committed');");
  const result=spawnSync(process.execPath,[path.join(__dirname,'../scripts/backup.js')],{encoding:'utf8',env:{...process.env,DATABASE_PATH:source,BACKUP_DIR:dest}});
  assert.equal(result.status,0,result.stderr);
  const files=fs.readdirSync(dest);assert.equal(files.length,1);
  const copy=new DatabaseSync(path.join(dest,files[0]),{readOnly:true});
  try{assert.equal(copy.prepare('SELECT value FROM example').get().value,'committed');}finally{copy.close();}
  assert.equal(db.prepare('SELECT count(*) AS n FROM example').get().n,1);
});
