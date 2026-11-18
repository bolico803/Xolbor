'use strict';
require('dotenv').config();
const fs=require('node:fs');
const path=require('node:path');
const {Store}=require('../lib/store');
async function main(){
  const args=process.argv.slice(2),sourceArg=args.indexOf('--source'),databaseArg=args.indexOf('--database');
  if(sourceArg<0||databaseArg<0||!args[sourceArg+1]||!args[databaseArg+1])throw new Error('Usage : npm run migrate:legacy -- --source /sauvegarde/data --database /disque/xolbor.sqlite');
  const source=path.resolve(args[sourceArg+1]),target=path.resolve(args[databaseArg+1]);
  if(fs.existsSync(target))throw new Error('La base cible existe déjà : import refusé.');
  const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
  const users=read(path.join(source,'users.json'));
  if(!Array.isArray(users)||!users.length)throw new Error('La source doit contenir une liste non vide de comptes.');
  const ids=new Set(),names=new Set();let unsupported=0;
  for(const user of users){
    if(!user||typeof user.id!=='string'||!user.id||typeof user.username!=='string'||!user.username||!Number.isSafeInteger(user.xubor)||user.xubor<0)throw new Error('Compte historique invalide : import annulé.');
    if(ids.has(user.id)||names.has(user.username.toLowerCase()))throw new Error('Identité en double : import annulé.');
    ids.add(user.id);names.add(user.username.toLowerCase());
    if(typeof user.password!=='string'||!/^\$2[ab]\$(0[4-9]|[12]\d|3[01])\$[./A-Za-z0-9]{53}$/.test(user.password))unsupported++;
    for(const key of ['friends','friendRequests','blocked','inventory','cosmetics','achievements','tournamentsJoined']){if(user[key]===undefined)user[key]=[];if(!Array.isArray(user[key]))throw new Error('Liste de compte invalide : import annulé.');}
    delete user.sessionToken;
  }
  if(unsupported)throw new Error(`${unsupported} comptes utilisent un format de mot de passe non reconnu. Aucun compte importé : auditer ces formats avant de poursuivre.`);
  const documents=[];
  for(const entry of fs.readdirSync(source,{withFileTypes:true})){
    if(!entry.isFile()||!entry.name.endsWith('.json')||['users.json','sessions.json'].includes(entry.name))continue;
    const name=entry.name.slice(0,-5);if(!/^[a-z][a-z0-9_-]*$/i.test(name))continue;
    documents.push([name,read(path.join(source,entry.name))]);
  }
  fs.mkdirSync(path.dirname(target),{recursive:true});
  const temporary=fs.mkdtempSync(path.join(path.dirname(target),'.xolbor-import-'));
  let store;
  try{
    store=new Store(path.join(temporary,'working.sqlite'));
    store.transaction(()=>{store._saveUsers(users,'legacy-import');for(const [name,value] of documents)store.write(name,value);store.addPendingFriendNotifications();});
    const snapshot=path.join(temporary,'snapshot.sqlite');await store.backup(snapshot);store.close();store=null;
    // Atomic creation without replacing an existing database, even if another process created it meanwhile.
    fs.chmodSync(snapshot,0o600);fs.linkSync(snapshot,target);
    console.log(`Import vérifié : ${users.length} comptes, ${documents.length} documents. Source conservée ; anciennes sessions révoquées.`);
  }finally{store?.close();fs.rmSync(temporary,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
