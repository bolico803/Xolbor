'use strict';
const $=id=>document.getElementById(id);let user=null,socket=null,activeFriend=new URLSearchParams(location.search).get('contact'),viewVersion=0;
const sections={game:['Jeu',''],charts:['Charts','Explore les jeux du catalogue Xolbor.'],profile:['Profil','Ton identité et tes informations personnelles.'],friends:['Amis','Retrouve les joueurs avec lesquels tu souhaites jouer.'],messages:['Messages','Discute en privé avec tes amis.'],inventory:['Inventaire','Les objets enregistrés sur ton compte.'],marketplace:['Marketplace','Découvre les objets du catalogue Xolbor.'],wallet:['Xubor','Consulte ton solde et tes opérations.']};
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
function showNotice(message,error=false){const el=$('notice');el.textContent=message;el.className=error?'error':'';el.style.display='block';}
async function api(url,options={}){const res=await fetch(url,{...options,headers:{'Content-Type':'application/json',...options.headers}});const data=await res.json();if(!res.ok)throw new Error(data.error||'Une erreur est survenue.');return data;}
const post=(url,data)=>api(url,{method:'POST',body:JSON.stringify(data)});
function button(label,action,cls=''){const e=node('button',label,cls);e.type='button';e.addEventListener('click',action);return e;}
function panel(title,description){const p=node('section',undefined,'panel');p.append(node('h2',title));if(description)p.append(node('p',description));return p;}
function container(tag,cls){return node(tag,undefined,cls);}
function input(placeholder,max=100){const x=document.createElement('input');x.placeholder=placeholder;x.maxLength=max;return x;}
function cosmeticName(name){return String(name||'Objet').replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu,'').trim();}

function accountSettings() {
 const settings=container('div','two-col');
 const rename=panel('Changer mon pseudo',user.founder?'Gratuit':'Coût du changement : 100 Xubor.');
 const password=panel('Changer mon mot de passe','Le nouveau mot de passe doit contenir au moins 12 caractères.');

 function form(parent,fields,label,submit) {
  const form=container('form','account-form');
  for(const [name,caption,type,autocomplete] of fields) {
   const row=node('label',caption);
   const field=node('input');
   field.name=name;
   field.type=type;
   field.autocomplete=autocomplete;
   field.required=true;
   if(name==='newUsername') {field.pattern='[A-Za-z0-9_]{3,24}';field.maxLength=24;field.value=user.username;}
   if(autocomplete==='new-password') field.minLength=12;
   row.append(field);
   form.append(row);
  }
  const save=node('button',label,'action');
  save.type='submit';
  form.append(save);
  form.onsubmit=async event=>{
   event.preventDefault();
   save.disabled=true;
   try {await submit(Object.fromEntries(new FormData(form)));}
   catch(error) {showNotice(error.message,true);}
   finally {save.disabled=false;}
  };
  parent.append(form);
  return form;
 }

 form(rename,[['newUsername','Nouveau pseudo','text','username']],'Enregistrer le pseudo',async data=>{
  await post('/api/profile/rename',data);
  await refresh();
  showNotice('Pseudo mis à jour.');
 });
 const passwordForm=form(password,[
  ['currentPassword','Mot de passe actuel','password','current-password'],
  ['newPassword','Nouveau mot de passe','password','new-password'],
  ['confirmation','Confirmer le nouveau mot de passe','password','new-password']
 ],'Enregistrer le mot de passe',async ({confirmation,...data})=>{
  if(data.newPassword!==confirmation) throw new Error('Les nouveaux mots de passe ne correspondent pas.');
  await post('/api/profile/password',data);
  passwordForm.reset();
  showNotice('Mot de passe mis à jour.');
 });
 settings.append(rename,password);
 return settings;
}

function section(){const id=location.hash.slice(1);if(id.startsWith('game/'))return 'game';return id.startsWith('marketplace/')?'marketplace':sections[id]?id:'profile';}
function ensureAccount(){if(user)return true;$('auth').showModal();return false;}
async function refresh(){try{user=await api('/api/me');XolborPortrait.name(user,$('who'));$('header-avatar').textContent=user.username.slice(0,1).toUpperCase();$('profile-link').hidden=false;XolborPortrait.render(user,$('header-avatar'));$('balance').textContent=(user.founder?'∞':user.xubor);$('auth-open').hidden=true;$('logout').hidden=false;socket?.disconnect();socket=io();XolborNotifications.connect(socket);socket.on('connect',()=>socket.emit('join-user',user.username));socket.on('chat-message',m=>{if(section()==='messages'&&activeFriend&&[m.from,m.to].includes(activeFriend))render();});}catch{user=null;}$('content').replaceChildren();await render();}
async function render(){const v=++viewVersion,id=section();document.querySelector('.hub-main').classList.toggle('marketplace-view',id==='marketplace');$('section-title').textContent=sections[id][0];$('section-intro').textContent=sections[id][1];$('notice').style.display='none';document.querySelectorAll('[data-section]').forEach(a=>a.classList.toggle('selected',a.dataset.section===id));const root=$('content');root.replaceChildren();
 if(!user&&id!=='marketplace'&&id!=='charts'&&id!=='game'){const p=panel('Connecte-toi','Ton compte te permet de retrouver tes données sur tes appareils.');p.append(button('Se connecter ou créer un compte',ensureAccount,'action'));root.append(p);return;}
 try{
  if(id==='game'){
   const games=await api('/api/games');if(v!==viewVersion)return;
   await XolborGames.detail(root,games,decodeURIComponent(location.hash.slice(6)),{post,ensureAccount,notice:showNotice});
  }else if(id==='charts'){
   const games=await api('/api/games');if(v!==viewVersion)return;const p=panel('Découvrir les jeux','Classement fondé sur les visites et favoris enregistrés.');
   const controls=container('div','row'),search=input('Rechercher un jeu',80),sort=document.createElement('select');search.setAttribute('aria-label','Rechercher un jeu');sort.setAttribute('aria-label','Trier les jeux');
   for(const [value,label] of [['visits','Plus visités'],['likes','Plus appréciés'],['title','Ordre alphabétique']]){const option=node('option',label);option.value=value;sort.append(option);}controls.append(search,sort);p.append(controls);
   const grid=container('div','chart-grid');p.append(grid);root.append(p);
   const draw=()=>{grid.replaceChildren();const list=games.filter(g=>g.title.toLocaleLowerCase('fr').includes(search.value.trim().toLocaleLowerCase('fr'))).slice().sort((a,b)=>sort.value==='title'?a.title.localeCompare(b.title,'fr'):sort.value==='likes'?(b.likesCount||0)-(a.likesCount||0):(b.visits||0)-(a.visits||0));if(!list.length)grid.append(node('p','Aucun jeu trouvé.','empty'));for(const game of list){const card=container('article','chart-card'),picture=XolborGames.art(game,true);const body=container('div','chart-body'),title=node('h3',game.title),meta=node('p',`${game.visits||0} visites · ${game.likesCount||0} favoris`),actions=container('div','row');
    const fav=button(game.isLiked?'Retirer des favoris':'Ajouter aux favoris',async()=>{if(!ensureAccount())return;try{const result=await post('/api/games/'+encodeURIComponent(game.id)+'/like',{});game.isLiked=result.liked;game.likesCount=result.likesCount;draw();}catch(error){showNotice(error.message,true);}});actions.append(fav);body.append(title,meta,actions);card.append(picture,body);grid.append(card);}};search.oninput=draw;sort.onchange=draw;draw();
  }
  if(id==='profile'){
   const grid=container('div','two-col'),p=panel('Ton profil'),name=node('div',user.username,'profile-avatar');name.textContent=user.username.slice(0,1).toUpperCase();name.setAttribute('aria-label','Photo de profil : avatar de '+user.username);XolborPortrait.render(user,name);p.append(name,XolborPortrait.name(user,node('h2')),node('p',`Niveau ${user.level||1} · ${user.xp||0} XP · ${(user.founder?'∞':user.xubor)} Xubor`));const profileShop=node('a','Choisir ma photo de profil','primary');profileShop.href='#marketplace';p.append(profileShop);const avatar=node('a','Personnaliser mon personnage du Nexus','primary');avatar.href='/play';p.append(avatar);
   const bio=panel('Ma présentation','Visible sur ton profil.');const field=node('textarea');field.maxLength=200;field.value=user.bio||'';field.setAttribute('aria-label','Présentation');const save=button('Enregistrer',async()=>{try{await post('/api/profile/update',{bio:field.value});user.bio=field.value;showNotice('Présentation enregistrée.');}catch(e){showNotice(e.message,true);}},'action');bio.append(field,save);grid.append(p,bio);root.append(grid,accountSettings());
  }
  if(id==='friends'){
   const [friends,requests,profiles]=await Promise.all([api('/api/friends'),api('/api/friend-requests'),api('/api/friends/profiles')]);if(v!==viewVersion)return;
   const grid=container('div','two-col'),add=panel('Ajouter un ami','Saisis le pseudo exact du joueur.');const form=container('form','row'),field=input('Pseudo du joueur',24),send=node('button','Envoyer','action');send.type='submit';field.required=true;form.append(field,send);form.onsubmit=async e=>{e.preventDefault();try{const result=await post('/api/friend-request',{targetUsername:field.value.trim()});field.value='';showNotice(result.message);}catch(error){showNotice(error.message,true);}};add.append(form);
   const pending=panel('Demandes reçues');if(!requests.length)pending.append(node('p','Aucune demande pour le moment.','empty'));for(const request of requests){const row=container('div','list-item'),actions=container('div','row');for(const [label,action] of [['Accepter','accept'],['Refuser','reject']])actions.append(button(label,async()=>{try{await post('/api/friend-respond',{requestId:request.id,action});await render();showNotice('Demande traitée.');}catch(e){showNotice(e.message,true);}},action==='accept'?'action':''));row.append(node('strong',request.from),actions);pending.append(row);}grid.append(add,pending);root.append(grid);
   const list=panel('Mes amis');if(!friends.length)list.append(node('p','Tu n’as pas encore d’amis.','empty'));for(const friend of friends){const row=container('div','list-item'),identity=container('div','row'),actions=container('div','row'),profile=profiles.find(p=>p.username===friend),portrait=container('div','profile-avatar');if(profile)XolborPortrait.render(profile,portrait);else portrait.textContent=friend.slice(0,1).toUpperCase();portrait.style.width='48px';portrait.style.height='48px';const name=node('strong',friend);if(profile)XolborPortrait.name(profile,name);identity.append(portrait,name);actions.append(button('Message',()=>{activeFriend=friend;location.hash='messages';},'action'));const transfer=container('form','row'),amount=input('Montant Xubor',10),submit=node('button','Envoyer Xubor','action');amount.type='number';amount.min='1';amount.max='1000000000';amount.step='1';amount.required=true;submit.type='submit';transfer.append(amount,submit);transfer.onsubmit=async e=>{e.preventDefault();submit.disabled=true;try{await post('/api/friends/transfer',{to:friend,amount:Number(amount.value)});amount.value='';showNotice('Xubor envoyés à '+friend+'.');}catch(error){showNotice(error.message,true)}finally{submit.disabled=false}};actions.append(transfer);row.append(identity,actions);list.append(row);}root.append(list);
  }
  if(id==='messages'){
   const friends=await api('/api/friends');if(v!==viewVersion)return;if(!friends.length){const p=panel('Aucune conversation','Ajoute un ami pour commencer une discussion.');const a=node('a','Voir mes amis','primary');a.href='#friends';p.append(a);root.append(p);return;}
   if(!friends.includes(activeFriend))activeFriend=friends[0];const grid=container('div','chat-layout'),list=panel('Mes amis'),chat=panel(`Discussion avec ${activeFriend}`);for(const friend of friends){const row=button(friend,()=>{activeFriend=friend;render();},friend===activeFriend?'action':'');row.style.display='block';row.style.width='100%';row.style.marginBottom='8px';list.append(row);}const history=await api('/api/chat/history?friend='+encodeURIComponent(activeFriend));if(v!==viewVersion)return;await post('/api/notifications/read',{type:'message',actor:activeFriend});if(v!==viewVersion)return;const log=container('div','chat-log');log.setAttribute('role','log');for(const m of history){const b=container('div','bubble'+(m.from===user.username?' mine':''));b.append(node('strong',m.from),document.createTextNode(m.content));log.append(b);}if(!history.length)log.append(node('p','Aucun message pour le moment.','empty'));const form=container('form','row'),field=input('Écrire un message…',1000),send=node('button','Envoyer','action');field.required=true;send.type='submit';form.append(field,send);form.onsubmit=async e=>{e.preventDefault();try{await post('/api/chat/send',{to:activeFriend,content:field.value});field.value='';await render();}catch(error){showNotice(error.message,true);}};chat.append(log,form);grid.append(list,chat);root.append(grid);log.scrollTop=log.scrollHeight;
  }
  if(id==='inventory'){
   const [skins,cosmetics,avatars]=await Promise.all([api('/api/skins'),api('/api/cosmetics'),api('/api/profile-avatars')]);if(v!==viewVersion)return;
   const avatarPanel=panel('Mes avatars de profil','Choisis un avatar possédé pour ta photo de profil.'),avatarGrid=container('div','item-grid');for(const avatar of avatars.filter(a=>a.id==='avatar-1'||user.ownedProfileAvatars?.includes(a.id))){const card=container('article','item'),picture=XolborPortrait.image(avatar.id,avatar.name,'owned-avatar-image');const a=node('a',(user.profileAvatar||'avatar-1')===avatar.id?'Équipé':'Voir et équiper','primary');a.href='#marketplace/'+avatar.id;card.append(picture,node('h3',avatar.name),a);avatarGrid.append(card);}avatarPanel.append(avatarGrid);root.append(avatarPanel);
   const owned=[...skins.filter(x=>user.inventory?.includes(x.id)),...cosmetics.filter(x=>user.cosmetics?.includes(x.id))];const p=panel('Mes objets',`${owned.length} objet${owned.length!==1?'s':''} enregistré${owned.length!==1?'s':''} sur ton compte.`),grid=container('div','item-grid');if(!owned.length)p.append(node('p','Ton inventaire est vide pour le moment.','empty'));for(const item of owned){const card=container('article','item'),swatch=container('div','swatch');if(/^#[0-9a-f]{6}$/i.test(item.color||''))swatch.style.background=item.color;card.append(swatch,node('h3',cosmeticName(item.name)),node('span','Possédé','badge'));grid.append(card);}p.append(grid);root.append(p);
  }
  if(id==='marketplace'){
   const products=await api('/api/profile-avatars');if(v!==viewVersion)return;
   XolborCatalogue.render(root,products,{user,post,ensureAccount,notice:showNotice,refresh:render,setUser:next=>{user=next;$('balance').textContent=(user.founder?'∞':user.xubor);XolborPortrait.render(user,$('header-avatar'));}});
  }
  if(id==='wallet'){
   const [history,shop]=await Promise.all([api('/api/wallet/history'),api('/api/payments/packs')]);if(v!==viewVersion)return;
   const hero=container('section','wallet-hero');hero.append(node('span','XOLBOR · XUBOR','badge'),node('h2','Tes Xubor, ton univers'),node('p','Retrouve ton solde et les informations de recharge au même endroit.'));
   const balance=container('div','wallet-balance');balance.append(node('small','SOLDE DISPONIBLE'),node('strong',`${(user.founder?'∞':user.xubor)} Xubor`));hero.append(balance);root.append(hero);
   const packs=panel('Acheter des Xubor');
   if(!shop.enabled){packs.append(node('p','Les achats de Xubor ne sont pas encore activés. Aucun paiement réel ne peut être effectué pour le moment.','wallet-unavailable'));}
   else{
    packs.append(node('p','MODE TEST : ces paiements ne débitent pas de carte réelle et les prix sont provisoires.'));
    const cards=container('div','packs-grid');
    for(const pack of shop.packs){const card=container('article','pack-card'),icon=node('div','X','coin'),title=node('h3',`${pack.xubor.toLocaleString('fr-FR')} Xubor`),label=node('p',pack.name),buy=button(`${(pack.cents/100).toFixed(2).replace('.',',')} € · TEST`,async()=>{buy.disabled=true;try{const result=await post('/api/payments/checkout',{packId:pack.id});const url=new URL(result.checkoutUrl);if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com')throw new Error('Adresse de paiement invalide.');location.assign(url.href);}catch(error){showNotice(error.message,true);buy.disabled=false;}},'action');card.append(icon,title,label,buy);cards.append(card);}packs.append(cards);
   }
   root.append(packs);const list=panel('Historique des opérations');if(!history.length)list.append(node('p','Aucune opération pour le moment.','empty'));for(const tx of history){const row=container('div','list-item');row.append(node('span',new Date(tx.created_at).toLocaleString('fr-FR')+' · '+tx.reason),node('strong',`${tx.delta>0?'+':''}${tx.delta} X`));list.append(row);}root.append(list);
   const faq=panel('Questions fréquentes');for(const [question,answer] of [['À quoi servent les Xubor ?','Ils représentent le solde virtuel associé à ton compte Xolbor. Les achats dans la marketplace ne sont pas encore activés.'],['Comment acheter des Xubor ?','Les paiements réels ne sont pas encore disponibles. Les offres et le paiement seront affichés ici une fois le service prêt.'],['Où voir mes opérations ?','Les opérations enregistrées sont affichées dans ton historique ci-dessus.']]){const details=document.createElement('details'),summary=node('summary',question);details.append(summary,node('p',answer));faq.append(details);}root.append(faq);
  }
 }catch(error){if(v===viewVersion){root.replaceChildren();showNotice(error.message,true);}}
}
window.addEventListener('hashchange',()=>{window.scrollTo(0,0);render();});$('auth-open').onclick=()=>$('auth').showModal();$('auth-close').onclick=()=>$('auth').close();$('auth-form').onsubmit=async e=>{e.preventDefault();try{await post('/api/'+e.submitter.value,{username:$('username').value,password:$('password').value});$('password').value='';$('auth').close();await refresh();}catch(error){$('error').textContent=error.message;}};
$('logout').onclick=async()=>{try{await post('/api/logout',{});socket?.disconnect();XolborNotifications.disconnect();user=null;$('who').textContent='Invité';$('profile-link').hidden=true;$('header-avatar').replaceChildren();$('balance').textContent='0';$('auth-open').hidden=false;$('logout').hidden=true;await render();}catch(error){showNotice(error.message,true);}};refresh();
