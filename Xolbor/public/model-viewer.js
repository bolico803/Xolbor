'use strict';
window.XolborModelViewer=(()=>{
 function open(options={}){
  const modal=document.createElement('dialog');modal.className='model-viewer-dialog';modal.setAttribute('aria-label','Aperçu 3D du modèle');
  const heading=document.createElement('div');heading.className='model-viewer-heading';
  const title=document.createElement('h2');title.textContent=options.title||'Avatar en 3D';
  const close=document.createElement('button');close.type='button';close.textContent='Fermer';close.className='model-viewer-close';heading.append(title,close);
  const stage=document.createElement('div');stage.className='model-viewer-stage';const info=document.createElement('p');info.className='model-viewer-status';info.textContent='Chargement du modèle 3D…';
  const hints=document.createElement('p');hints.className='model-viewer-hint';hints.textContent='Glisse pour tourner le modèle · Molette ou pincement pour zoomer';modal.append(heading,stage,info,hints);document.body.append(modal);
  let renderer,controls,raf=0,alive=true,model=null;
  function disposeModel(object){const geometries=new Set(),materials=new Set(),textures=new Set();object.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material){for(const m of (Array.isArray(o.material)?o.material:[o.material])){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}}});geometries.forEach(x=>x.dispose());materials.forEach(x=>x.dispose());textures.forEach(x=>x.dispose());}
  function cleanup(){alive=false;cancelAnimationFrame(raf);controls?.dispose();if(model)disposeModel(model);renderer?.dispose();renderer?.forceContextLoss();modal.remove();}
  close.onclick=()=>modal.close();modal.addEventListener('close',cleanup,{once:true});modal.showModal();
  try{
   renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.25));renderer.outputEncoding=THREE.sRGBEncoding;renderer.setSize(stage.clientWidth,stage.clientHeight);stage.append(renderer.domElement);
   const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xffffff,0x494131,1.35));const light=new THREE.DirectionalLight(0xffffff,1.6);light.position.set(3,4,3);scene.add(light);
   const camera=new THREE.PerspectiveCamera(36,stage.clientWidth/stage.clientHeight,.01,100);controls=new THREE.OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=.7;controls.maxDistance=5;
   new THREE.GLTFLoader().load(options.src||'/public/assets/imported/avatar-1.glb',gltf=>{if(!alive){disposeModel(gltf.scene);return;}model=gltf.scene;scene.add(model);const bounds=new THREE.Box3().setFromObject(model),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3()),length=Math.max(size.x,size.y,size.z);camera.position.copy(center).add(options.catalogue?new THREE.Vector3(0,0,-length*2.2):new THREE.Vector3(length*2.1,length*.18,length*.18));camera.near=Math.max(.001,length/100);camera.far=length*50;camera.updateProjectionMatrix();controls.target.copy(center);controls.minDistance=length*.9;controls.maxDistance=length*6;controls.update();info.textContent='Aperçu 3D';},progress=>{if(alive&&progress.lengthComputable)info.textContent=`Chargement du modèle 3D… ${Math.round(progress.loaded/progress.total*100)} %`;},()=>{if(alive)info.textContent='Impossible de charger le modèle. Ferme et réessaie.';});
   function frame(){if(!alive)return;const w=stage.clientWidth,h=stage.clientHeight;if(w&&h&&(renderer.domElement.width!==Math.floor(w*renderer.getPixelRatio())||renderer.domElement.height!==Math.floor(h*renderer.getPixelRatio()))){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}controls.update();renderer.render(scene,camera);raf=requestAnimationFrame(frame);}frame();
  }catch(error){info.textContent='L’aperçu 3D nécessite WebGL. L’image du modèle reste disponible dans la boutique.';}
 }
 return {open};
})();
