'use strict';
window.XolborGames = (() => {
 const el=(tag,text,cls)=>Object.assign(document.createElement(tag),{textContent:text||'',className:cls||''});
 const href=game=>'/hub#game/'+encodeURIComponent(game.id);
 const regenerated = new Set(["6","31","32","33","34","35","36","37","38","39","40"]);
 function art(game,linked=false) {
  const cover=el(linked?'a':'div','','game-cover');
  if(linked) {cover.href=href(game);cover.setAttribute('aria-label',game.title);}
  const background=el('img','','game-cover-scene');
  background.src=regenerated.has(String(game.id)) ? '/public/assets/game-covers/'+game.id+'.jpg' : (game.img||'/favicon.png');
  background.alt='';
  cover.append(background);
  return cover;
 }
 async function detail(root,games,id,ctx) {
  const game=games.find(item=>String(item.id)===id);
  if(!game){root.append(el('p','Jeu introuvable.'));return;}
  const back=el('a','\u2190 Tous les jeux');back.href='/hub#charts';
  const hero=el('section','','game-detail-hero');
  const info=el('div','','panel game-detail-info');
  const launch=el('a','\u25b6 Jouer','primary game-launch');
  if(typeof game.url==='string' && game.url.startsWith('/games/')) {
   launch.href=game.url;
   launch.addEventListener('click',()=>fetch('/api/games/'+encodeURIComponent(id)+'/play',{method:'POST',keepalive:true}).catch(()=>{}));
  }
  const controls=el('div','','game-detail-actions');
  const fav=el('button'), follow=el('button'), up=el('button'), down=el('button');
  const storageKey='xolbor-game-'+id;
  const prefs=JSON.parse(localStorage.getItem(storageKey)||'{}');
  function update(){
   fav.textContent=(game.isLiked?'\u2605':'\u2606')+' Favoris ('+game.likesCount+')';
   fav.setAttribute('aria-pressed',!!game.isLiked);
   follow.textContent='\u2667 '+(prefs.follow?'Suivi':'Notifier');
   follow.setAttribute('aria-pressed',!!prefs.follow);
   up.textContent='\u25b2 J\u2019aime';down.textContent='\u25bc Je n\u2019aime pas';
   up.setAttribute('aria-pressed',prefs.vote==='up');down.setAttribute('aria-pressed',prefs.vote==='down');
  }
  fav.onclick=async()=>{if(!ctx.ensureAccount())return;fav.disabled=true;try{
   const result=await ctx.post('/api/games/'+encodeURIComponent(id)+'/like',{});
   game.isLiked=result.liked;game.likesCount=result.likesCount;update();
  }catch(error){ctx.notice(error.message,true);}finally{fav.disabled=false;}};
  const save=()=>{localStorage.setItem(storageKey,JSON.stringify(prefs));update();};
  follow.onclick=()=>{prefs.follow=!prefs.follow;save();ctx.notice(prefs.follow?'Suivi enregistr\u00e9 sur cet appareil.':'Suivi retir\u00e9.');};
  for(const [button,vote] of [[up,'up'],[down,'down']])button.onclick=()=>{prefs.vote=prefs.vote===vote?null:vote;save();};
  update();
  controls.append(fav,follow,up,down);
  info.append(el('p','XOLBOR'),el('h2',game.title),launch,controls);
  hero.append(art(game),info);
  const tabs=el('nav','','game-detail-tabs');tabs.setAttribute('aria-label','Informations du jeu');
  const content=el('section','','panel game-detail-content');
  const choices=[['\u00c0 propos',()=>{
   content.append(el('h2','Description'),el('p',game.description||'Joue \u00e0 '+game.title+' sur Xolbor.'),el('p',(game.visits||0)+' visites \u00b7 '+(game.likesCount||0)+' favoris'));
   const more=games.filter(item=>item!==game);
   if(!more.length)return;
   const recommendations=el('div','','game-recommendations');
   let shown=0;
   const expand=el('button','Afficher plus');
   function appendGames(){
    for(const item of more.slice(shown,shown+4)){
     const card=el('article');card.append(art(item,true),el('h3',item.title));recommendations.append(card);
    }
    shown+=4;expand.hidden=shown>=more.length;
   }
   expand.onclick=appendGames;
   content.append(el('h2','Autres jeux Xolbor'),recommendations,expand);
   appendGames();
  }],['Boutique',()=>{
   const shop=el('a','Voir la boutique Xolbor','primary');shop.href='/hub#marketplace';content.append(el('h2','Boutique'),shop);
  }],['Serveurs',()=>{
   content.append(el('h2','Serveurs'),el('p','Ce jeu se lance directement depuis Xolbor.'),launch.cloneNode(true));
   content.lastElementChild.onclick=event=>{event.preventDefault();launch.click();};
  }]];
  for(const [label,draw] of choices){
   const tab=el('button',label);
   tab.onclick=()=>{for(const button of tabs.children)button.setAttribute('aria-pressed',button===tab);content.replaceChildren();draw();};
   tabs.append(tab);
  }
  tabs.firstElementChild.click();
  root.append(back,hero,tabs,content);
 }
 return {art,href,detail};
})();
