'use strict';
require('dotenv').config();
const {DatabaseSync,backup}=require('node:sqlite');
const fs=require('node:fs');
const path=require('node:path');
async function main(){
  const source=path.resolve(process.env.DATABASE_PATH||'./runtime/xolbor.sqlite');
  if(!fs.existsSync(source))throw new Error('Base source introuvable : sauvegarde annulée.');
  const directory=path.resolve(process.env.BACKUP_DIR||'./runtime/backups');
  fs.mkdirSync(directory,{recursive:true,mode:0o700});
  const target=path.join(directory,`xolbor-${new Date().toISOString().replace(/[:.]/g,'-')}-${require('node:crypto').randomUUID()}.sqlite`);
  const db=new DatabaseSync(source,{readOnly:true});
  try{
    await backup(db,target);
    fs.chmodSync(target,0o600);
    const copy=new DatabaseSync(target);
    try{copy.exec('PRAGMA journal_mode=DELETE');if(copy.prepare('PRAGMA quick_check').get().quick_check!=='ok')throw new Error('Vérification de la sauvegarde échouée.');}finally{copy.close();}
    console.log(`Sauvegarde vérifiée : ${target}`);
  }finally{db.close();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
