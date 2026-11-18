'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {tmpdir}=require('node:os');
const {spawnSync}=require('node:child_process');
const {DatabaseSync}=require('node:sqlite');
test('legacy import preserves accounts and documents, revokes sessions and refuses overwrite',t=>{
  const dir=fs.mkdtempSync(path.join(tmpdir(),'xolbor-migrate-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const source=path.join(dir,'data');fs.mkdirSync(source);const target=path.join(dir,'target.sqlite');
  const hash=require('bcryptjs').hashSync('TestPassword123',4);
  const users=[{id:'one',username:'PlayerOne',password:hash,xubor:100,friends:['PlayerTwo'],sessionToken:'old-token'}];
  const original=JSON.stringify(users);fs.writeFileSync(path.join(source,'users.json'),original);fs.writeFileSync(path.join(source,'messages.json'),'[{"content":"hello"}]');
  const run=()=>spawnSync(process.execPath,[path.join(__dirname,'../scripts/migrate-legacy.js'),'--source',source,'--database',target],{encoding:'utf8'});
  const result=run();assert.equal(result.status,0,result.stderr);
  const db=new DatabaseSync(target);try{const user=JSON.parse(db.prepare('SELECT payload FROM users').get().payload);assert.equal(user.password,hash);assert.equal(user.xubor,100);assert.deepEqual(user.friends,['PlayerTwo']);assert.equal(user.sessionToken,undefined);assert.equal(db.prepare('SELECT count(*) AS n FROM sessions').get().n,0);assert.equal(JSON.parse(db.prepare("SELECT payload FROM documents WHERE name='messages'").get().payload)[0].content,'hello');}finally{db.close();}
  assert.equal(run().status,1);assert.equal(fs.readFileSync(path.join(source,'users.json'),'utf8'),original);
});
test('unsupported legacy passwords leave the target absent',t=>{
  const dir=fs.mkdtempSync(path.join(tmpdir(),'xolbor-migrate-refuse-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  fs.writeFileSync(path.join(dir,'users.json'),JSON.stringify([{id:'one',username:'Player',xubor:0,password:'unsupported'}]));
  const target=path.join(dir,'target.sqlite');const result=spawnSync(process.execPath,[path.join(__dirname,'../scripts/migrate-legacy.js'),'--source',dir,'--database',target],{encoding:'utf8'});
  assert.equal(result.status,1);assert.equal(fs.existsSync(target),false);
});
