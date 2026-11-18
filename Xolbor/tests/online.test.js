'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {mkdtempSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const path=require('node:path');
const {io}=require('socket.io-client');
const {once}=require('node:events');

test('Render configuration: friends, messages and two authenticated multiplayer clients', {timeout:30000}, async t=>{
  const folder=mkdtempSync(path.join(tmpdir(),'xolbor-test-'));
  const port=15987,base=`http://127.0.0.1:${port}`;
  const child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),HOST:'',NODE_ENV:'test',RENDER:'true',RENDER_EXTERNAL_URL:'https://xolbor-test.onrender.com',DATABASE_PATH:path.join(folder,'test.sqlite')},stdio:['ignore','pipe','pipe']});
  let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
  const sockets=[];
  t.after(async()=>{for(const s of sockets)s.disconnect();if(child.exitCode===null){const exited=once(child,'exit');child.kill();await exited;}rmSync(folder,{recursive:true,force:true});});
  let ready=false;
  for(let n=0;n<100;n++){try{ready=(await fetch(base+'/health/ready')).ok;if(ready)break;}catch{}await new Promise(r=>setTimeout(r,50));}
  assert.ok(ready,logs);
  for(const asset of [...require('../lib/profile-avatars').PROFILE_AVATARS.map(a=>a.model),'/games/capture-catastrophe/assets/brainrot-map.glb']){
    const res=await fetch(base+asset);assert.equal(res.status,200,asset);
    assert.equal(Buffer.from(await res.arrayBuffer()).subarray(0,4).toString(),'glTF',asset);
  }
  async function api(route,body,cookie){const res=await fetch(base+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(cookie?{cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await res.json();return {status:res.status,data,cookie:res.headers.get('set-cookie')?.split(';')[0]};}
  const a=await api('/api/register',{username:'PlayerOne',password:'TestPassword12345'});
  const b=await api('/api/register',{username:'PlayerTwo',password:'TestPassword12345'});
  assert.equal(a.status,201);assert.equal(b.status,201);
  assert.equal((await api('/api/chat/send',{to:b.data.username,content:'blocked before friendship'},a.cookie)).status,403);
  assert.equal((await api('/api/friend-request',{targetUsername:b.data.username},a.cookie)).status,200);
  const me=await api('/api/me',null,b.cookie);
  assert.equal((await api('/api/friend-respond',{requestId:me.data.friendRequests[0].id,action:'accept'},b.cookie)).status,200);
  assert.ok((await api('/api/me',null,a.cookie)).data.friends.includes(b.data.username));
  assert.equal((await api('/api/chat/send',{to:b.data.username,content:'Bonjour ami'},a.cookie)).status,200);
  assert.ok((await api('/api/chat/history?friend='+encodeURIComponent(a.data.username),null,b.cookie)).data.some(m=>m.content==='Bonjour ami'));
  async function connect(cookie){const s=io(base+'/lobby',{extraHeaders:{cookie,origin:'https://xolbor-test.onrender.com'},transports:['websocket'],reconnection:false});sockets.push(s);await Promise.race([once(s,'connect'),once(s,'connect_error').then(([e])=>Promise.reject(e))]);return s;}
  const s1=await connect(a.cookie),s2=await connect(b.cookie);
  const emit=(s,event,data)=>new Promise((resolve,reject)=>s.timeout(3000).emit(event,data,(err,result)=>err?reject(err):resolve(result)));
  const room=await emit(s1,'join',{private:true});assert.ok(room.ok);
  const denied=await emit(s2,'join',{roomId:room.room.id});assert.ok(denied.error);
  const joined=await emit(s2,'join',{code:room.code});assert.equal(joined.players.length,2);
  const chatReceived=once(s2,'chat');assert.ok((await emit(s1,'chat',{content:'Bonjour salon'})).ok);assert.equal((await chatReceived)[0].content,'Bonjour salon');
  s1.emit('input',{x:1,z:0,sequence:1});
  let moved;const until=Date.now()+2000;while(Date.now()<until){const [state]=await once(s2,'state');moved=state.players.find(p=>p.id===a.data.id);if(moved.x>0)break;}
  assert.ok(moved.x>0&&moved.x<=1.5,'server-authoritative movement');
  s2.disconnect();const reconnected=await connect(b.cookie);assert.ok((await emit(reconnected,'join',{code:room.code})).ok);
  const ping=await new Promise((resolve,reject)=>s1.timeout(2000).emit('ping-check',(err,stamp)=>err?reject(err):resolve(stamp)));assert.equal(typeof ping,'number');
});
