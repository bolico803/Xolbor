'use strict';
const bcrypt = require('bcryptjs');
const { randomUUID } = require('node:crypto');
const { limiter } = require('./security');
const { PROFILE_AVATARS, DEFAULT_AVATAR, profileAvatar } = require('./profile-avatars');
const usernameOk = v => typeof v === 'string' && /^[A-Za-z0-9_]{3,24}$/.test(v);
const passwordOk = v => typeof v === 'string' && v.length >= 12 && Buffer.byteLength(v) <= 72;
const cleanUser = u => {
  const {password,sessionToken,_version,processedPayments,...safe}=u;
  return {...safe,profileAvatar:profileAvatar(u),ownedProfileAvatars:[DEFAULT_AVATAR,...(Array.isArray(u.ownedProfileAvatars)?u.ownedProfileAvatars.filter(id=>id!==DEFAULT_AVATAR&&PROFILE_AVATARS.some(p=>p.id===id)):[])],sessionToken:'cookie-session',isKing:u.role==='admin'};
};
const asyncRoute = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);
function installApi({app,store,auth,io,notifications}) {
  const requireUser=(req,res,next)=>{ req.user=auth.resolve(req); if(!req.user) return res.status(401).json({error:'Connectez-vous pour continuer.'}); next(); };
  app.get('/api/health',(_req,res)=>res.json({ok:true,phase:1,database:'sqlite',uptime:Math.floor(process.uptime())}));
  app.get('/api/platform',(_req,res)=>res.json({phase:1,payments:false,avatarImport:false,studioWeb:false,lobby:true}));
  app.post('/api/register',asyncRoute(async(req,res)=>{
    const {username,password,email=''}=req.body;
    if(!usernameOk(username)) return res.status(400).json({error:'Pseudo : 3 à 24 lettres, chiffres ou traits de soulignement.'});
    if(!passwordOk(password)) return res.status(400).json({error:'Mot de passe : au moins 12 caractères, au maximum 72 octets.'});
    if(typeof email!=='string'||email.length>254||(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) return res.status(400).json({error:'Email invalide.'});
    const encoded=await bcrypt.hash(password,12);
    const users=store.users(); // Reload only after the asynchronous hash.
    if(users.some(u=>u.username.toLowerCase()===username.toLowerCase()||(email&&u.email?.toLowerCase()===email.toLowerCase()))) return res.status(409).json({error:'Pseudo ou email déjà utilisé.'});
    const founder=users.length===0;
    if(!founder && username.toLowerCase()==='imrane') return res.status(409).json({error:'Pseudo réservé.'});
    const user={id:randomUUID(),username:founder?'Imrane':username,founder,password:encoded,email:email.toLowerCase(),role:'user',xubor:0,inventory:[],cosmetics:[],equippedCosmetics:{},equippedSkinId:0,friends:[],friendRequests:[],blocked:[],xp:0,level:1,achievements:[],tournamentsJoined:[],dailyStreak:0,bio:'Nouveau joueur sur Xolbor !',gameStats:{},joinedAt:new Date().toISOString()};
    store.saveUsers([user],'registration'); auth.issue(req,res,user); res.status(201).json(cleanUser(user));
  }));
  app.post('/api/login',asyncRoute(async(req,res)=>{
    const {username,password}=req.body;
    if(typeof username!=='string'||username.length>100||typeof password!=='string'||Buffer.byteLength(password)>72) return res.status(400).json({error:'Identifiants invalides.'});
    const candidate=store.users().find(u=>u.username.toLowerCase()===username.toLowerCase());
    // Always run a password comparison to avoid a quick unknown-account response.
    const dummy='$2b$12$6rKZoGWSwqH6WKZaLHaqPeX5fgj6v2wc7OgM2yEICuFmZ8t2KvdjK';
    const valid=await bcrypt.compare(password,candidate?.password||dummy);
    const user=candidate&&store.users().find(u=>u.id===candidate.id);
    if(!valid||!user||user.password!==candidate.password) return res.status(401).json({error:'Identifiants incorrects.'});
    auth.issue(req,res,user); res.json(cleanUser(user));
  }));
  app.get('/api/me',requireUser,(req,res)=>res.json(cleanUser(req.user)));
  app.post('/api/logout',(req,res)=>{auth.revoke(req);res.clearCookie('xolbor_session',{path:'/'});res.json({success:true});});
  app.get('/api/sessions',requireUser,(req,res)=>res.json(store.db.prepare('SELECT hash,created_at,expires_at,device FROM sessions WHERE user_id=? AND expires_at>?').all(req.user.id,Date.now()).map(s=>({...s,current:s.hash===auth.hash(auth.cookieToken(req))}))));
  app.delete('/api/sessions/:hash',requireUser,(req,res)=>{store.db.prepare('DELETE FROM sessions WHERE hash=? AND user_id=?').run(req.params.hash,req.user.id);res.json({success:true});});
  app.post('/api/profile/password',requireUser,asyncRoute(async(req,res)=>{
    const {currentPassword,newPassword}=req.body;
    if(typeof currentPassword!=='string'||Buffer.byteLength(currentPassword)>72||!passwordOk(newPassword)) return res.status(400).json({error:'Mot de passe actuel et nouveau mot de passe de 12 caractères requis.'});
    if(!await bcrypt.compare(currentPassword,req.user.password)) return res.status(403).json({error:'Mot de passe actuel incorrect.'});
    const encoded=await bcrypt.hash(newPassword,12), user=store.users().find(u=>u.id===req.user.id);
    if(user.password!==req.user.password) return res.status(409).json({error:'Le mot de passe a changé. Reconnectez-vous.'});
    user.password=encoded; store.saveUsers([user],'password-change');
    store.db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);auth.issue(req,res,user);res.json({success:true});
  }));
  app.post('/api/profile/rename',requireUser,(req,res,next)=>{
    if(!req.user.founder && String(req.body.newUsername).toLowerCase()==='imrane') return res.status(403).json({error:'Pseudo réservé.'});
    if(!usernameOk(req.body.newUsername)) return res.status(400).json({error:'Pseudo invalide.'});
    if(store.users().some(u=>u.username.toLowerCase()===req.body.newUsername.toLowerCase())) return res.status(409).json({error:'Pseudo déjà pris.'});
    next();
  });
  app.post('/api/profile/update',requireUser,(req,res,next)=>{
    if(typeof req.body.bio!=='string'||req.body.bio.length>200||/[<>]/.test(req.body.bio)) return res.status(400).json({error:'Bio : texte simple de 200 caractères maximum.'});next();
  });
  app.post('/api/friend-request',requireUser,(req,res)=>{
    const {targetUsername}=req.body||{};
    if(typeof targetUsername!=='string'||targetUsername.length>64)return res.status(400).json({error:'Pseudo invalide.'});
    const users=store.users(),sender=users.find(u=>u.id===req.user.id),target=users.find(u=>u.username===targetUsername);
    if(!target)return res.status(404).json({error:'Utilisateur introuvable.'});
    if(target.id===sender.id)return res.status(400).json({error:'Impossible de s’ajouter soi-même.'});
    if((sender.blocked||[]).includes(target.username)||(target.blocked||[]).includes(sender.username))return res.status(403).json({error:'Contact non autorisé.'});
    target.friends ||= [];target.friendRequests ||= [];
    if(target.friends.includes(sender.username))return res.status(400).json({error:'Vous êtes déjà amis.'});
    if(target.friendRequests.some(r=>r.from===sender.username))return res.status(400).json({error:'Demande déjà envoyée.'});
    const request={id:randomUUID(),from:sender.username,timestamp:Date.now()};target.friendRequests.push(request);
    store.transaction(()=>{store._saveUsers([target],'friend-request');notifications.create(target.id,'friend_request',sender.username,request.id);});
    notifications.broadcast(target.id);res.json({success:true,message:'Demande envoyée.'});
  });
  app.post('/api/friend-respond',requireUser,(req,res)=>{
    const {requestId,action}=req.body||{};
    if(typeof requestId!=='string'||!['accept','reject'].includes(action))return res.status(400).json({error:'Réponse invalide.'});
    const users=store.users(),recipient=users.find(u=>u.id===req.user.id);recipient.friendRequests ||= [];recipient.friends ||= [];
    const index=recipient.friendRequests.findIndex(r=>r.id===requestId);if(index<0)return res.status(404).json({error:'Demande introuvable.'});
    const request=recipient.friendRequests[index],sender=users.find(u=>u.username===request.from);
    if(action==='accept'&&(!sender||(sender.blocked||[]).includes(recipient.username)||(recipient.blocked||[]).includes(request.from)))return res.status(403).json({error:'Contact non autorisé.'});
    recipient.friendRequests.splice(index,1);
    if(action==='accept'){sender.friends ||= [];if(!recipient.friends.includes(sender.username))recipient.friends.push(sender.username);if(!sender.friends.includes(recipient.username))sender.friends.push(recipient.username);}
    store.transaction(()=>{
      store._saveUsers(action==='accept'?[recipient,sender]:[recipient],'friend-response');
      store.db.prepare("UPDATE notifications SET read_at=? WHERE user_id=? AND type='friend_request' AND reference_id=? AND read_at IS NULL").run(Date.now(),recipient.id,requestId);
      if(action==='accept')notifications.create(sender.id,'friend_accepted',recipient.username,requestId);
    });
    notifications.broadcast(recipient.id);if(action==='accept')notifications.broadcast(sender.id);res.json({success:true,friends:recipient.friends});
  });
  app.get('/api/friends/profiles',requireUser,(req,res)=>{
    const users=store.users(),me=users.find(u=>u.id===req.user.id);
    res.json(users.filter(u=>(me.friends||[]).includes(u.username)&&(u.friends||[]).includes(me.username)).map(u=>({username:u.username,profileAvatar:profileAvatar(u),founder:!!u.founder})));
  });
  app.post('/api/friends/transfer',requireUser,(req,res)=>{
    const {to,amount}=req.body||{};if(typeof to!=='string'||!Number.isSafeInteger(amount)||amount<=0||amount>1000000000)return res.status(400).json({error:'Saisis un montant entier valide.'});
    let result;store.transaction(()=>{const users=store.users(),sender=users.find(u=>u.id===req.user.id),recipient=users.find(u=>u.username===to);
      if(!recipient||recipient.id===sender.id||!(sender.friends||[]).includes(to)||!(recipient.friends||[]).includes(sender.username)||(sender.blocked||[]).includes(to)||(recipient.blocked||[]).includes(sender.username)){result={error:'Cet ami est indisponible.',status:403};return}
      const balance=Number(sender.xubor)||0,received=Number(recipient.xubor)||0;if(!sender.founder&&balance<amount){result={error:'Solde Xubor insuffisant.',status:400};return}if(!Number.isSafeInteger(received+amount)){result={error:'Montant trop élevé.',status:400};return}
      if(!sender.founder)sender.xubor=balance-amount;recipient.xubor=received+amount;store._saveUsers([sender,recipient],'friend-xubor-transfer');result={success:true,balance:sender.xubor};
    });if(result.error)return res.status(result.status).json({error:result.error});res.json(result);
  });
  app.post('/api/add-funds',requireUser,(_req,res)=>res.status(403).json({error:'Le crédit direct est interdit. Un paiement vérifié est nécessaire.'}));
  app.use(['/api/create-stripe-checkout-session','/api/stripe-success','/api/create-paypal-order','/api/paypal-success'],(_req,res)=>res.status(503).json({error:'Paiements désactivés en phase 1. Webhooks et rapprochement doivent être déployés avant activation.'}));
  app.post('/api/tournaments/:id/score',requireUser,(_req,res)=>res.status(409).json({error:'Les scores doivent provenir d’un serveur de jeu vérifié.'}));
  app.post('/api/tournaments/join',requireUser,(_req,res)=>res.status(409).json({error:'Tournois rémunérés en attente de validation des scores serveur.'}));
  app.use(['/api/admin','/api/king'],requireUser,(req,res,next)=>{if(req.user.role!=='admin')return res.status(403).json({error:'Rôle administrateur requis.'});next();});
  for(const [route,idKey,catalog,inventory] of [['skin','skinId','skins','inventory'],['cosmetic','cosmeticId','cosmetics','cosmetics']]) {
    app.post(`/api/buy-${route}`,requireUser,(req,res)=>{
      const item=store.read(catalog).find(i=>String(i.id)===String(req.body[idKey]));
      if(!item||!Number.isSafeInteger(item.price)||item.price<0) return res.status(404).json({error:'Objet indisponible.'});
      const user=req.user; user[inventory] ||= [];
      if(!user[inventory].includes(item.id)) {
        if(!user.founder && user.xubor<item.price)return res.status(400).json({error:'Fonds insuffisants.'});
        if(!user.founder) user.xubor-=item.price;user[inventory].push(item.id);store.saveUsers([user],`purchase:${catalog}:${item.id}`);
      }
      res.json({success:true,xubor:user.xubor,newBalance:user.xubor,inventory:user.inventory});
    });
  }
  app.get('/api/profile-avatars',(_req,res)=>res.json(PROFILE_AVATARS));
  app.post('/api/profile-avatars/buy',requireUser,(req,res)=>{
    const item=PROFILE_AVATARS.find(p=>p.id===req.body?.id);
    if(!item)return res.status(404).json({error:'Avatar introuvable.'});
    let result;
    store.transaction(()=>{
      const user=store.userById(req.user.id);user.ownedProfileAvatars=Array.isArray(user.ownedProfileAvatars)?user.ownedProfileAvatars:[];
      if(item.id!==DEFAULT_AVATAR&&!user.ownedProfileAvatars.includes(item.id)){
        if(!user.founder && user.xubor<item.price){result={error:'Solde Xubor insuffisant.',status:400};return;}
        if(!user.founder) user.xubor-=item.price;user.ownedProfileAvatars.push(item.id);store._saveUsers([user],`purchase:profile-avatar:${item.id}`);
      }
      result={user:cleanUser(user)};
    });
    if(result.error)return res.status(result.status).json({error:result.error});res.json(result);
  });
  app.post('/api/profile-avatars/equip',requireUser,(req,res)=>{
    const item=PROFILE_AVATARS.find(p=>p.id===req.body?.id);
    if(!item)return res.status(404).json({error:'Avatar introuvable.'});
    const user=req.user;if(item.id!==DEFAULT_AVATAR&&!(user.ownedProfileAvatars||[]).includes(item.id))return res.status(403).json({error:'Cet avatar doit être acheté avant de pouvoir l’équiper.'});
    user.profileAvatar=item.id;store.saveUsers([user],'profile-avatar-equip');res.json({user:cleanUser(user)});
  });
  app.get('/api/wallet/history',requireUser,(req,res)=>res.json(store.db.prepare('SELECT id,delta,balance,reason,created_at FROM wallet_ledger WHERE user_id=? ORDER BY created_at DESC LIMIT 100').all(req.user.id)));
  app.get('/api/avatar',requireUser,(req,res)=>res.json({avatar:req.user.avatar||{color:'#101827',accent:'#0ab6ff',style:'explorer'},outfits:req.user.outfits||[]}));
  app.put('/api/avatar',requireUser,(req,res)=>{
    const {color,accent,style='explorer',outfitName}=req.body;
    if(!/^#[0-9a-f]{6}$/i.test(color)||!/^#[0-9a-f]{6}$/i.test(accent)||!['explorer','robot','scout'].includes(style))return res.status(400).json({error:'Personnalisation invalide.'});
    const user=req.user;user.avatar={color,accent,style};
    if(outfitName!==undefined){
      if(typeof outfitName!=='string'||!outfitName.trim()||outfitName.length>30)return res.status(400).json({error:'Nom de tenue invalide.'});
      user.outfits ||= [];const existing=user.outfits.find(x=>x.name===outfitName.trim());
      if(existing)existing.avatar=user.avatar;
      else if(user.outfits.length>=8)return res.status(400).json({error:'Maximum 8 tenues.'});
      else user.outfits.push({name:outfitName.trim(),avatar:user.avatar});
    }
    store.saveUsers([user],'avatar-update');res.json({avatar:user.avatar,outfits:user.outfits||[]});
  });
  app.get('/api/chat/history',requireUser,(req,res)=>{
    const friend=String(req.query.friend||''); const before=Number(req.query.before)||Infinity;
    res.json(store.read('messages').filter(m=>m.timestamp<before&&((m.from===req.user.username&&m.to===friend)||(m.from===friend&&m.to===req.user.username))).slice(-100));
  });
  app.post('/api/chat/send',limiter({limit:30}),requireUser,(req,res)=>{
    const {to,content}=req.body,user=req.user,target=store.users().find(u=>u.username===to);
    if(typeof content!=='string'||!content.trim()||content.length>1000)return res.status(400).json({error:'Message de 1 à 1000 caractères requis.'});
    if(!target||!user.friends.includes(to)||!target.friends.includes(user.username)||user.blocked?.includes(to)||target.blocked?.includes(user.username))return res.status(403).json({error:'Contact non autorisé.'});
    const message={id:randomUUID(),from:user.username,to,content:content.trim(),timestamp:Date.now()};
    store.transaction(()=>{const messages=store.read('messages');messages.push(message);store.write('messages',messages);notifications.create(target.id,'message',user.username,message.id);});
    notifications.broadcast(target.id);
    io.to(`user:${target.id}`).to(`user:${user.id}`).emit('chat-message',message);res.json({success:true,message});
  });
  app.post('/api/block',requireUser,(req,res)=>{
    const target=store.users().find(u=>u.username===req.body.username);
    if(!target||target.id===req.user.id)return res.status(400).json({error:'Utilisateur invalide.'});
    req.user.blocked ||= [];if(!req.user.blocked.includes(target.username))req.user.blocked.push(target.username);
    store.saveUsers([req.user],'block-user');res.json({success:true});
  });
  // Legacy text rendering is hardened on the frontend too; reject HTML in older community forms.
  app.use('/api',(req,res,next)=>{
    if(req.method==='POST')for(const key of ['name','description','condition','content']){
      const value=req.body?.[key];if(value!==undefined&&(typeof value!=='string'||value.length>1000||/[<>]/.test(value)))return res.status(400).json({error:'Texte simple requis (1000 caractères maximum).'});
    }
    next();
  });
}
module.exports={installApi};
