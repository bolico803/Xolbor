'use strict';
const {randomUUID}=require('node:crypto');
function installNotifications({app,store,auth,io}){
 const requireUser=(req,res,next)=>{req.user=auth.resolve(req);if(!req.user)return res.status(401).json({error:'Connecte-toi pour voir tes notifications.'});next();};
 function create(userId,type,actor,referenceId){
  const item={id:randomUUID(),userId,type,actor,referenceId,createdAt:Date.now()};
  store.db.prepare('INSERT INTO notifications(id,user_id,type,actor,reference_id,created_at) VALUES(?,?,?,?,?,?)').run(item.id,userId,type,actor,referenceId,item.createdAt);
  return item;
 }
 function broadcast(userId){
  io.to(`user:${userId}`).emit('notifications-changed');
  io.of('/lobby').to(`user:${userId}`).emit('notifications-changed');
 }
 app.get('/api/notifications',requireUser,(req,res)=>{
  const parsed=Number(req.query.before),before=Number.isSafeInteger(parsed)&&parsed>0?parsed:Number.MAX_SAFE_INTEGER;
  const rows=store.db.prepare('SELECT rowid AS cursor,id,type,actor,reference_id AS referenceId,created_at AS createdAt,read_at AS readAt FROM notifications WHERE user_id=? AND rowid<? ORDER BY rowid DESC LIMIT 31').all(req.user.id,before);
  const hasMore=rows.length>30,items=rows.slice(0,30);res.json({items,nextCursor:hasMore?items.at(-1).cursor:null});
 });
 app.get('/api/notifications/counts',requireUser,(req,res)=>{
  const rows=store.db.prepare('SELECT type,COUNT(*) AS count FROM notifications WHERE user_id=? AND read_at IS NULL GROUP BY type').all(req.user.id);
  const counts={total:0,messages:0,friends:0};for(const row of rows){counts.total+=row.count;if(row.type==='message')counts.messages+=row.count;if(row.type==='friend_request')counts.friends+=row.count;}res.json(counts);
 });
 app.post('/api/notifications/read',requireUser,(req,res)=>{
  const {all,ids,type,actor,referenceId}=req.body||{},now=Date.now();let result;
  if(all===true)result=store.db.prepare('UPDATE notifications SET read_at=? WHERE user_id=? AND read_at IS NULL').run(now,req.user.id);
  else if(Array.isArray(ids)&&ids.length>0&&ids.length<=100&&ids.every(x=>typeof x==='string'&&x.length<=64)){
   result=store.transaction(()=>ids.reduce((sum,id)=>sum+store.db.prepare('UPDATE notifications SET read_at=? WHERE user_id=? AND id=? AND read_at IS NULL').run(now,req.user.id,id).changes,0));
   result={changes:result};
  }else if(type==='message'&&typeof actor==='string'&&actor.length<=64)result=store.db.prepare("UPDATE notifications SET read_at=? WHERE user_id=? AND type='message' AND actor=? AND read_at IS NULL").run(now,req.user.id,actor);
  else if(type==='friend_request'&&typeof referenceId==='string'&&referenceId.length<=64)result=store.db.prepare("UPDATE notifications SET read_at=? WHERE user_id=? AND type='friend_request' AND reference_id=? AND read_at IS NULL").run(now,req.user.id,referenceId);
  else return res.status(400).json({error:'Sélection de notifications invalide.'});
  if(result.changes)broadcast(req.user.id);res.json({success:true,updated:result.changes});
 });
 return {create,broadcast};
}
module.exports={installNotifications};
