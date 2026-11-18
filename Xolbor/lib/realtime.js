'use strict';
const {profileAvatar} = require('./profile-avatars');
const { randomBytes,randomUUID }=require('node:crypto');
function installRealtime({io,app,store,auth}) {
  const rooms=new Map(); const lobby=io.of('/lobby');
  const bounded=(value,fallback,min,max)=>{const n=Number(value);return Number.isInteger(n)&&n>=min&&n<=max?n:fallback;};
  const maxPlayers=bounded(process.env.ROOM_CAPACITY,16,2,32);
  const maxRooms=bounded(process.env.MAX_ROOMS,100,1,500);
  const maxSockets=bounded(process.env.MAX_SOCKETS_PER_USER,4,1,20);
  let closing=false;
  function authenticate(socket,next){
    if(closing)return next(new Error('Serveur en arrêt'));
    const user=auth.resolve(socket.request);if(!user)return next(new Error('Authentification requise'));
    // Both existing namespaces count separately; disconnected sockets are removed by Socket.IO.
    if ([...socket.nsp.sockets.values()].filter(s=>s.data.userId===user.id).length>=maxSockets)return next(new Error('Trop de connexions pour ce compte'));
    socket.data.userId=user.id;socket.data.username=user.username;next();
  }
  io.use(authenticate);lobby.use(authenticate);
  // Guard historical events before their listeners execute; identity always comes from the session.
  io.on('connection',socket=>{
    socket.join(`user:${socket.data.userId}`);
    const counts=new Map();let lastMove=Date.now();let position={x:400,y:300};
    const allowed=new Set(['join-user','start-game','stop-game','send-game-invite','call-user','make-answer','ice-candidate','end-call','claim-glitch','nexus-join','nexus-move','nexus-chat','nexus-leave','superspace-join','superspace-move','superspace-shoot']);
    socket.use((packet,next)=>{
      const [event,payload]=packet;const user=auth.resolve(socket.request);
      if(!user){socket.disconnect(true);return;}
      if(!allowed.has(event))return;
      const now=Date.now(),bucket=counts.get(event)||{time:now,count:0};
      if(now-bucket.time>1000){bucket.time=now;bucket.count=0;}
      counts.set(event,bucket);const limit=/move/.test(event)?40:/shoot/.test(event)?8:5;
      if(++bucket.count>limit)return;
      if(event==='join-user'||event==='stop-game'){packet[1]=user.username;return next();}
      if(event==='claim-glitch')return; // Legacy random cash reward has no verified game event.
      if(event==='nexus-leave')return next();
      if(!payload||typeof payload!=='object'||Array.isArray(payload))return;
      payload.username=user.username;payload.from=user.username;delete payload.id;
      if(event==='nexus-join'){payload.x=400;payload.y=300;payload.skinId=user.equippedSkinId;position={x:400,y:300};}
      if(event==='nexus-move'){
        if(!Number.isFinite(payload.x)||!Number.isFinite(payload.y))return;
        const elapsed=Math.min((now-lastMove)/1000,.2),dx=payload.x-position.x,dy=payload.y-position.y,d=Math.hypot(dx,dy),max=300*elapsed;
        if(d>max){payload.x=position.x+dx/d*max;payload.y=position.y+dy/d*max;}
        payload.x=Math.max(0,Math.min(2000,payload.x));payload.y=Math.max(0,Math.min(2000,payload.y));position={x:payload.x,y:payload.y};lastMove=now;
      }
      if(event==='nexus-chat'&&(typeof payload.message!=='string'||!payload.message.trim()||payload.message.length>300))return;
      if(event==='superspace-move'){
        if(!Number.isFinite(payload.dx)||!Number.isFinite(payload.dy))return;
        const length=Math.max(1,Math.hypot(payload.dx,payload.dy));payload.dx/=length;payload.dy/=length;
      }
      if(event==='superspace-shoot'&&!Number.isFinite(payload.angle))return;
      if(event==='send-game-invite'){
        try { const url=new URL(payload.link);if(!['https:','http:'].includes(url.protocol))return;payload.link=url.href; } catch{return;}
        payload.gameId=String(payload.gameId||'').slice(0,40);
      }
      if(['call-user','ice-candidate','end-call'].includes(event)&&!user.friends.includes(payload.to))return;
      if(event==='make-answer'){
        const target=io.sockets.sockets.get(payload.to);if(!target||!user.friends.includes(target.data.username))return;
      }
      next();
    });
  });
  function summary(room){return{id:room.id,name:room.name,players:room.players.size,capacity:maxPlayers,private:room.private};}
  app.get('/api/lobby/rooms',(req,res)=>{
    if(!auth.resolve(req))return res.status(401).json({error:'Connexion requise'});
    res.json([...rooms.values()].filter(r=>!r.private).map(summary));
  });
  function snapshot(room){return{room:summary(room),players:[...room.players.values()].map(({input,lastInput,socketId,...p})=>p),serverTime:Date.now()};}
  function leave(socket){
    const room=rooms.get(socket.data.roomId);if(room){room.players.delete(socket.id);room.emptySince=room.players.size?null:Date.now();socket.leave(room.id);lobby.to(room.id).emit('state',snapshot(room));}
    socket.data.roomId=null;
  }
  function makeRoom(isPrivate){
    const room={id:randomUUID(),name:isPrivate?'Salon privé':'Nexus public',private:isPrivate,code:isPrivate?randomBytes(5).toString('hex').toUpperCase():null,players:new Map(),emptySince:Date.now()};
    rooms.set(room.id,room);return room;
  }
  lobby.on('connection',socket=>{
    socket.join(`user:${socket.data.userId}`);
    let count=0,windowStart=Date.now(),lastChat=0,lastCreate=0;
    socket.use((packet,next)=>{
      if(!auth.resolve(socket.request)){socket.disconnect(true);return;}
      if(Date.now()-windowStart>1000){windowStart=Date.now();count=0;}
      if(++count>60)return;
      if(!['join','input','chat','leave','ping-check'].includes(packet[0]))return;
      next();
    });
    socket.on('join',(options={},ack=()=>{})=>{
      if(typeof ack!=='function')ack=()=>{};
      if(!options||typeof options!=='object'||Array.isArray(options))return ack({error:'Requête invalide'});
      let room;
      if(options.code){room=[...rooms.values()].find(r=>r.private&&r.code===String(options.code).toUpperCase());if(!room)return ack({error:'Code de salon introuvable'});}
      else if(options.roomId){room=rooms.get(options.roomId);if(!room||room.private)return ack({error:'Salon introuvable'});}
      else if(options.private===true){if(Date.now()-lastCreate<2000)return ack({error:'Patientez avant de créer un autre salon'});if(rooms.size>=maxRooms)return ack({error:'Capacité serveur atteinte'});lastCreate=Date.now();room=makeRoom(true);}
      else{room=[...rooms.values()].find(r=>!r.private&&r.players.size<maxPlayers);if(!room){if(rooms.size>=maxRooms)return ack({error:'Capacité serveur atteinte'});room=makeRoom(false);}}
      if(socket.data.roomId===room.id)return ack({ok:true,...snapshot(room),code:room.code});
      if(room.players.size>=maxPlayers)return ack({error:'Salon complet'});
      if([...room.players.values()].some(p=>p.id===socket.data.userId))return ack({error:'Ce compte est déjà dans ce salon sur un autre appareil.'});
      leave(socket);const user=auth.resolve(socket.request);socket.data.roomId=room.id;socket.join(room.id);room.emptySince=null;
      room.players.set(socket.id,{id:user.id,socketId:socket.id,username:user.username,founder:!!user.founder,profileAvatar:profileAvatar(user),x:0,z:0,rotation:0,animation:'idle',avatar:user.avatar||{color:'#101827',accent:'#0ab6ff',style:'explorer'},input:{x:0,z:0},lastInput:0,sequence:-1});
      const history=store.db.prepare('SELECT id,user_id AS userId,username,content,created_at AS timestamp FROM room_messages WHERE room_id=? ORDER BY created_at DESC LIMIT 50').all(room.id).reverse();
      ack({ok:true,...snapshot(room),code:room.code,history});lobby.to(room.id).emit('state',snapshot(room));
    });
    socket.on('input',data=>{
      const player=rooms.get(socket.data.roomId)?.players.get(socket.id);if(!player||!data||typeof data!=='object')return;
      if(!Number.isFinite(data.x)||!Number.isFinite(data.z)||!Number.isSafeInteger(data.sequence)||data.sequence<=player.sequence)return;
      const magnitude=Math.max(1,Math.hypot(data.x,data.z));
      player.input={x:data.x/magnitude,z:data.z/magnitude};player.sequence=data.sequence;player.lastInput=Date.now();
    });
    socket.on('chat',(data,ack=()=>{})=>{
      if(typeof ack!=='function')ack=()=>{};
      const room=rooms.get(socket.data.roomId);if(!room)return ack({error:'Rejoignez un salon'});
      if(!data||typeof data.content!=='string'||!data.content.trim()||data.content.length>300)return ack({error:'Message : 1 à 300 caractères'});
      if(Date.now()-lastChat<1000)return ack({error:'Attendez une seconde entre les messages'});lastChat=Date.now();
      // Links are disabled for the first release until contact/age moderation is implemented.
      if(/(?:https?:|www\.)/i.test(data.content))return ack({error:'Les liens sont désactivés dans le chat du lobby'});
      const message={id:randomUUID(),userId:socket.data.userId,username:socket.data.username,content:data.content.trim(),timestamp:Date.now()};
      store.db.prepare('INSERT INTO room_messages VALUES(?,?,?,?,?,?)').run(message.id,room.id,message.userId,message.username,message.content,message.timestamp);
      lobby.to(room.id).emit('chat',message);ack({ok:true,id:message.id});
    });
    socket.on('ping-check',ack=>{if(typeof ack==='function')ack(Date.now());});
    socket.on('leave',()=>leave(socket));socket.on('disconnect',()=>leave(socket));
  });
  const tick=setInterval(()=>{
    for(const room of rooms.values()){
      if(!room.players.size){if(Date.now()-room.emptySince>300000)rooms.delete(room.id);continue;}
      for(const player of room.players.values()){
        const active=Date.now()-player.lastInput<250,dx=active?player.input.x:0,dz=active?player.input.z:0;
        // Fixed 20Hz tick: extra input packets cannot increase speed.
        player.x=Math.max(-18,Math.min(18,player.x+dx*5/20));player.z=Math.max(-18,Math.min(18,player.z+dz*5/20));
        player.animation=Math.hypot(dx,dz)>.01?'walk':'idle';if(player.animation==='walk')player.rotation=Math.atan2(dx,dz);
      }
      lobby.to(room.id).volatile.emit('state',snapshot(room));
    }
  },50);tick.unref();
  return {rooms,beginShutdown:()=>{closing=true;},close:()=>clearInterval(tick)};
}
module.exports={installRealtime};
