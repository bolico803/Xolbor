'use strict';
window.XolborNotifications=(()=>{
 const header=document.querySelector('header'),account=header?.querySelector('.account')||header;
 let socket=null,cursor=null,loading=false,loaded=false;
 const element=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
 const symbol=name=>{const s=document.createElementNS('http://www.w3.org/2000/svg','svg'),u=document.createElementNS('http://www.w3.org/2000/svg','use');s.setAttribute('class','ui-icon');s.setAttribute('aria-hidden','true');u.setAttribute('href','/public/icons.svg#'+name);s.append(u);return s;};
 const badge=()=>{const span=element('span','notification-badge');span.hidden=true;return span;};
 const bell=element('button','notification-bell');bell.type='button';bell.setAttribute('aria-label','Notifications');bell.setAttribute('aria-expanded','false');bell.setAttribute('aria-controls','notifications-window');bell.append(symbol('bell'));const bellBadge=badge();bell.append(bellBadge);
 if(header?.querySelector('.account'))account.prepend(bell);else header?.insertBefore(bell,header.querySelector('#identity'));
 const dialog=element('section','notifications-window');dialog.id='notifications-window';dialog.hidden=true;dialog.setAttribute('aria-label','Notifications reçues');
 const heading=element('div','notifications-heading'),title=element('h2',null,'Notifications'),close=element('button','notification-close','Fermer');close.type='button';close.setAttribute('aria-label','Fermer les notifications');heading.append(title,close);
 const list=element('div','notifications-list');list.setAttribute('aria-live','polite');const footer=element('div','notifications-footer'),more=element('button','notification-more','Afficher les suivantes'),readAll=element('button','notification-read-all','Tout marquer comme lu');more.type=readAll.type='button';more.hidden=true;footer.append(more,readAll);dialog.append(heading,list,footer);document.body.append(dialog);
 const underFriends=document.querySelector('.friends');let secondaryBadge;
 if(underFriends){const open=element('button','notification-open','Notifications');open.type='button';open.prepend(symbol('bell'));secondaryBadge=badge();open.append(secondaryBadge);underFriends.insertBefore(open,underFriends.querySelector('.notice'));open.onclick=()=>toggle(true);}
 const typeBadges=[];
 for(const [selector,type] of [['a[href="/hub#messages"],a[href="#messages"]','messages'],['a[href="/hub#friends"],a[href="#friends"]','friends']]){
  for(const anchor of document.querySelectorAll(selector)){const b=badge();anchor.classList.add('notification-anchor');anchor.append(b);typeBadges.push({anchor,b,type,label:anchor.getAttribute('aria-label')||anchor.textContent.trim()});}
 }
 async function request(url,options){const res=await fetch(url,{...options,headers:{'Content-Type':'application/json',...options?.headers}});const data=await res.json();if(!res.ok)throw new Error(data.error||'Impossible de charger les notifications.');return data;}
 function setBadge(b,n){if(!b)return;b.textContent=String(n);b.hidden=n===0;}
 async function refreshCounts(){
  if(!socket)return;
  try{const c=await request('/api/notifications/counts');setBadge(bellBadge,c.total);setBadge(secondaryBadge,c.total);bell.setAttribute('aria-label',`Notifications, ${c.total} non lues`);for(const {anchor,b,type,label} of typeBadges){setBadge(b,c[type]);anchor.setAttribute('aria-label',c[type]?`${label}, ${c[type]} non lues`:label);}}catch{bell.setAttribute('aria-label','Notifications');}
 }
 function messageFor(item){if(item.type==='message')return `${item.actor} t’a envoyé un message.`;if(item.type==='friend_request')return `${item.actor} t’a envoyé une demande d’ami.`;if(item.type==='friend_accepted')return `${item.actor} a accepté ta demande d’ami.`;return 'Nouvelle notification.';}
 async function mark(body){await request('/api/notifications/read',{method:'POST',body:JSON.stringify(body)});await refreshCounts();}
 function renderItem(item){
  const b=element('button','notification-item'+(item.readAt?'':' unread'));b.type='button';const glyph=element('span','notification-item-icon');glyph.append(symbol(item.type==='message'?'message':'users'));const body=element('span','notification-item-content');body.append(element('strong',null,messageFor(item)));const time=element('time');time.dateTime=new Date(item.createdAt).toISOString();time.textContent=new Date(item.createdAt).toLocaleString('fr-FR',{dateStyle:'medium',timeStyle:'short'});body.append(time);b.append(glyph,body);if(!item.readAt)b.append(element('span','notification-dot'));b.onclick=async()=>{try{if(!item.readAt)await mark({ids:[item.id]});const href=item.type==='message'?`/hub?contact=${encodeURIComponent(item.actor)}#messages`:'/hub#friends';location.assign(href);}catch(e){showError(e.message);}};return b;
 }
 function showError(message){list.replaceChildren(element('p','notification-state',message));}
 async function load(append=false){
  if(loading)return;loading=true;if(!append){cursor=null;list.replaceChildren(element('p','notification-state','Chargement…'));}
  try{const result=await request('/api/notifications'+(cursor?'?before='+encodeURIComponent(cursor):''));if(!append)list.replaceChildren();if(!result.items.length&&!append)list.append(element('p','notification-state','Tu n’as pas encore de notifications.'));for(const item of result.items)list.append(renderItem(item));cursor=result.nextCursor;more.hidden=!cursor;loaded=true;}
  catch(e){if(!append)showError(e.message);}finally{loading=false;}
 }
 function toggle(force){
  if(!socket){const auth=document.getElementById('auth');if(auth&&!auth.open)auth.showModal();return;}
  const open=typeof force==='boolean'?force:dialog.hidden;dialog.hidden=!open;bell.setAttribute('aria-expanded',String(open));if(open){load();refreshCounts();}else bell.focus();
 }
 bell.onclick=()=>toggle();close.onclick=()=>toggle(false);more.onclick=()=>load(true);readAll.onclick=async()=>{try{await mark({all:true});await load();}catch(e){showError(e.message);}};
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!dialog.hidden)toggle(false);});
 document.addEventListener('click',e=>{if(!dialog.hidden&&!dialog.contains(e.target)&&!bell.contains(e.target)&&!e.target.closest('.notification-open')){dialog.hidden=true;bell.setAttribute('aria-expanded','false');}});
 function connect(newSocket){
  if(socket&&socket!==newSocket){socket.off('notifications-changed');socket.off('connect',refreshCounts);}socket=newSocket;
  socket.on('notifications-changed',()=>{refreshCounts();if(!dialog.hidden&&loaded)load();});socket.on('connect',refreshCounts);refreshCounts();
 }
 function disconnect(){socket=null;loaded=false;dialog.hidden=true;bell.setAttribute('aria-expanded','false');setBadge(bellBadge,0);setBadge(secondaryBadge,0);for(const {b,anchor,label} of typeBadges){setBadge(b,0);anchor.setAttribute('aria-label',label);}}
 return {connect,disconnect,refresh:refreshCounts};
})();
