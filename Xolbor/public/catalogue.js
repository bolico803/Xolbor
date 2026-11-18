'use strict';
window.XolborCatalogue=(()=>{
 const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
 const makeButton=(label,handler,cls='')=>{const e=el('button',cls,label);e.type='button';e.addEventListener('click',handler);return e;};
 const image=(p,cls='catalog-art-image')=>XolborPortrait.image(p.id,p.name,cls);
 const owns=(u,p)=>p.id==='avatar-1'||!!u?.ownedProfileAvatars?.includes(p.id);
 const equipped=(u,p)=>!!u&&(u.profileAvatar||'avatar-1')===p.id;
 const open3d=p=>XolborModelViewer.open({src:p.model,title:p.name+' en 3D',catalogue:true});
 function action(p,ctx,kind){return async()=>{if(!ctx.ensureAccount())return;try{const data=await ctx.post('/api/profile-avatars/'+kind,{id:p.id});ctx.setUser(data.user);await ctx.refresh();ctx.notice(kind==='buy'?'Avatar acheté. Tu peux maintenant l’équiper sur ton profil.':'Avatar équipé sur ton profil et dans La Forêt des saisons.');}catch(error){ctx.notice(error.message,true);}};}
 function grid(root,products,ctx){
  const top=el('div','catalog-header'),copy=el('div');copy.append(el('span','catalog-kicker','LA COLLECTION XOLBOR'),el('h2','catalog-title','Boutique d’avatars'),el('p','catalog-subtitle','Choisis un modèle pour ton profil et ton personnage dans La Forêt des saisons.'));top.append(copy);root.append(top);
  const list=el('div','catalog-grid');for(const p of products){const card=el('article','catalog-card'),art=el('div','catalog-art'),link=el('a','catalog-image-link');link.href='#marketplace/'+p.id;link.setAttribute('aria-label','Voir '+p.name);link.append(image(p));art.append(link);const title=el('a','catalog-item-name',p.name);title.href='#marketplace/'+p.id;
   card.append(art,title,el('p','catalog-creator',p.id==='handle'?'Modèle OBJ fourni':'Modèle 3D fourni'),el('p','catalog-price',equipped(ctx.user,p)?'Équipé':owns(ctx.user,p)?'Inclus / possédé':`${p.price} Xubor`));list.append(card);}root.append(list);
 }
 function detail(root,p,ctx){
  const back=el('a','catalog-back','← Retour à la boutique');back.href='#marketplace';root.append(back);const layout=el('div','catalog-detail'),left=el('div','catalog-detail-left'),visual=el('div','catalog-detail-visual');visual.append(image(p));const visualActions=el('div','catalog-visual-actions');visualActions.append(makeButton('Voir en 3D',()=>open3d(p),'catalog-secondary'));visual.append(visualActions);left.append(visual,el('p','catalog-note','Fais tourner le modèle dans l’aperçu 3D.'));
  const right=el('div','catalog-detail-info'),head=el('div','catalog-detail-head'),heading=el('div');heading.append(el('h2','catalog-detail-title',p.name),el('p','catalog-creator','Modèle fourni'));head.append(heading);right.append(head);const price=el('div','catalog-detail-price');price.append(el('span','','Prix'),el('strong','',p.price===0?'Inclus':`${p.price} Xubor`));right.append(price);
  if(owns(ctx.user,p)){const b=makeButton(equipped(ctx.user,p)?'Équipé sur le profil':'Équiper sur mon profil',action(p,ctx,'equip'),'catalog-buy');b.disabled=equipped(ctx.user,p);right.append(b);}
  else{const buy=makeButton(`Acheter · ${p.price} Xubor`,action(p,ctx,'buy'),'catalog-buy');right.append(buy,el('p','catalog-note','Après l’achat, tu peux choisir de l’équiper sur ta photo de profil.'));}
  const facts=el('dl','catalog-facts');for(const [k,v] of [['Type',p.id==='handle'?'Chapeau et coiffure':'Avatar'],['Utilisation','Profil et jeu'],['Description',p.description]])facts.append(el('dt','',k),el('dd','',v));right.append(facts);layout.append(left,right);root.append(layout);
 }
 function render(root,products,ctx){root.replaceChildren();const slug=location.hash.slice(1).split('/')[1],p=products.find(x=>x.id===slug);if(p)return detail(root,p,ctx);grid(root,products,ctx);}
 return {render};
})();
