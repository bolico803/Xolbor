import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { insideLake,resolveLake } from './lakes.js';

// Poly Haven CC0 models: Tree Small 02, Pine Sapling Small and Fern 02.
export function createForest(scene){
 const loader=new GLTFLoader(),models={},tiles=new Map(),animated=[],anchors=[];const size=60;let isReady=false,lastTile='',seasons=[];const seasonMaterials=new Map(),windTime={value:0};
 // Leaves ripple independently while the trees sway from their rooted bases.
 function animateFoliage(material){if(!/leav|twig/i.test(material.name))return;material.onBeforeCompile=shader=>{shader.uniforms.forestWindTime=windTime;shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform float forestWindTime;').replace('#include <begin_vertex>',`#include <begin_vertex>
 vec3 windOrigin = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
 vec3 windPoint = (modelMatrix * vec4(transformed, 1.0)).xyz;
 float heightWeight = smoothstep(0.8, 6.0, max(0.0, windPoint.y - windOrigin.y));
 float windPhase = forestWindTime * 1.4 + windOrigin.x * 0.37 + windOrigin.z * 0.29;
 float ripple = sin(windPhase + windPoint.y * 1.1 + windPoint.x * 0.5);
 float modelScale = max(length(modelMatrix[0].xyz), 0.001);
 transformed.x += (0.16 * ripple + 0.10 * sin(windPhase * 0.55)) * heightWeight / modelScale;
 transformed.z += 0.10 * cos(windPhase + windPoint.z * 0.6) * heightWeight / modelScale;`)};material.customProgramCacheKey=()=> 'forest-leaves-wind-v1';material.needsUpdate=true}
 const ready=Promise.all(['broadleaf','pine','fern'].map(n=>loader.loadAsync(`./real-forest/${n}.glb`))).then(([broad,pine,fern])=>{
   models.broad=broad.scene.getObjectByName('tree_small_02_LOD0');
   for(const key of ['a','b','c'])models['pine_'+key]=pine.scene.getObjectByName('pine_sapling_small_'+key);
   for(const key of ['a','b','c','d'])models['fern_'+key]=fern.scene.getObjectByName('fern_02_'+key);
   for(const name of Object.keys(models)){if(!models[name])throw Error('Modèle manquant : '+name);models[name].traverse(o=>{if(o.isMesh){const mats=Array.isArray(o.material)?o.material:[o.material];for(const mat of mats){if(mat.transparent){mat.transparent=false;mat.alphaTest=.4;mat.depthWrite=true;mat.side=THREE.DoubleSide}animateFoliage(mat)}}})}
   isReady=true;createAnchors();updateTiles(0,0);
 });
 function randomFactory(x,z){let h=(Math.imul(x,73856093)^Math.imul(z,19349663)^0x7ab421)>>>0;return ()=>{h=(Math.imul(h,1664525)+1013904223)>>>0;return h/4294967296}}
 function pathCenter(z){return Math.sin(z/50)*3.5}
 function tint(group){const season=seasons.find(s=>Math.hypot(group.position.x-s.x,group.position.z-s.z)<24);group.traverse(o=>{if(!o.isMesh)return;if(!o.userData.originalMaterial)o.userData.originalMaterial=o.material;const base=o.userData.originalMaterial;const change=m=>{if(!season||!/leav|fern|twig/i.test(m.name))return m;let key=m.uuid+season.id;if(!seasonMaterials.has(key)){let copy=m.clone();copy.color.multiply(new THREE.Color(season.tint));animateFoliage(copy);seasonMaterials.set(key,copy)}return seasonMaterials.get(key)};o.material=Array.isArray(base)?base.map(change):change(base)})}
 function add(tile,name,x,z,scale,yaw,wind,seed){const group=new THREE.Group(),model=models[name].clone();model.position.set(0,0,0);model.scale.multiplyScalar(scale);if(name==='broad'){model.scale.x*=1.35;model.scale.z*=1.35}group.position.set(x,0,z);group.rotation.y=yaw;group.add(model);tile.group.add(group);model.traverse(o=>{if(o.isMesh){o.receiveShadow=true;o.castShadow=false}});tint(group);if(wind){const entry={model,seed,wind};animated.push(entry);tile.animated.push(entry)}}
 function createAnchors(){const tile={group:new THREE.Group(),colliders:[],animated:[]};scene.add(tile.group);let coords=[[-12,8],[12,11],[-14,-11],[15,-12],[-13,27],[14,29],[-17,-27],[18,-30]];coords.forEach(([x,z],i)=>{if(insideLake(x,z,2))return;let type=i%3?'broad':'pine_a',scale=type==='broad'?5.7:20;add(tile,type,x,z,scale,i*.9,.009,i*2);tile.colliders.push({x,z,r:1.7})});for(let i=0;i<16;i++){let a=i*2.4,r=8+(i%4)*3,x=Math.cos(a)*r,z=Math.sin(a)*r;if(Math.abs(x-pathCenter(z))<5||insideLake(x,z,1))continue;add(tile,'fern_'+['a','b','c','d'][i%4],x,z,5+(i%3),a,.022,i)}anchors.push(tile)}
 function makeTile(tx,tz){let rand=randomFactory(tx,tz);const tile={group:new THREE.Group(),colliders:[],animated:[]};scene.add(tile.group);const cx=tx*size,cz=tz*size;
   for(let i=0;i<16;i++){let x=cx+(rand()-.5)*size,z=cz+(rand()-.5)*size;if(Math.hypot(x,z)<24||Math.abs(x-pathCenter(z))<6.5||insideLake(x,z,2))continue;const broad=rand()<.72,name=broad?'broad':'pine_'+['a','b','c'][Math.floor(rand()*3)];let scale=broad?4.8+rand()*2.0:16+rand()*7;add(tile,name,x,z,scale,rand()*6.28,.008,rand()*10);tile.colliders.push({x,z,r:broad?1.4:1.0})}
   for(let i=0;i<26;i++){let x=cx+(rand()-.5)*size,z=cz+(rand()-.5)*size;if(Math.hypot(x,z)<7||Math.abs(x-pathCenter(z))<4.5||insideLake(x,z,1))continue;let name='fern_'+['a','b','c','d'][Math.floor(rand()*4)];add(tile,name,x,z,3.5+rand()*4,rand()*6.28,.025,rand()*10)}return tile}
 function updateTiles(x,z){if(!isReady)return;let tx=Math.floor((x+size/2)/size),tz=Math.floor((z+size/2)/size);for(let a=tx-1;a<=tx+1;a++)for(let b=tz-1;b<=tz+1;b++){let key=`${a},${b}`;if(!tiles.has(key))tiles.set(key,makeTile(a,b))}for(const [key,tile] of tiles){let [a,b]=key.split(',').map(Number);if(Math.abs(a-tx)>1||Math.abs(b-tz)>1){scene.remove(tile.group);for(const entry of tile.animated){let i=animated.indexOf(entry);if(i>=0)animated.splice(i,1)}tiles.delete(key)}}}
 const lightCanvas=document.createElement('canvas');lightCanvas.width=64;lightCanvas.height=64;let ctx=lightCanvas.getContext('2d'),glow=ctx.createRadialGradient(32,32,0,32,32,32);glow.addColorStop(0,'rgba(255,255,210,.8)');glow.addColorStop(1,'rgba(255,222,120,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,64,64);const glowMap=new THREE.CanvasTexture(lightCanvas),fireGeo=new THREE.BufferGeometry(),firePos=new Float32Array(12*3);fireGeo.setAttribute('position',new THREE.BufferAttribute(firePos,3));const fireflies=new THREE.Points(fireGeo,new THREE.PointsMaterial({map:glowMap,color:0xffedbd,size:.38,transparent:true,opacity:.35,depthWrite:false,blending:THREE.AdditiveBlending}));scene.add(fireflies);
 function update(t,x,z){windTime.value=t;let k=`${Math.floor((x+size/2)/size)},${Math.floor((z+size/2)/size)}`;if(k!==lastTile&&isReady){updateTiles(x,z);lastTile=k}for(const a of animated){const gust=.8+.35*Math.sin(t*.16+a.seed*.3);a.model.rotation.z=(Math.sin(t*.65+a.seed)+.2*Math.sin(t*1.13+a.seed*.4))*a.wind*3.2*gust;a.model.rotation.x=Math.sin(t*.47+a.seed*.7)*a.wind*1.8*gust}for(let i=0;i<12;i++){let p=i*2.4;firePos[3*i]=x+Math.cos(p+t*.12)*(8+(i%4)*3);firePos[3*i+1]=1+(i%4)*1.1+Math.sin(t*.8+p)*.35;firePos[3*i+2]=z+Math.sin(p+t*.12)*(8+(i%4)*3)}fireGeo.attributes.position.needsUpdate=true}
 function move(x,z,dx,dz){let nx=x+dx,nz=z+dz;for(const tile of [...anchors,...tiles.values()])for(const c of tile.colliders){let vx=nx-c.x,vz=nz-c.z,dist=Math.hypot(vx,vz),min=c.r+1;if(dist<min&&dist>0){nx=c.x+vx/dist*min;nz=c.z+vz/dist*min}}return resolveLake(nx,nz)}
 function setSeasons(value){seasons=value;for(const tile of [...anchors,...tiles.values()])for(const group of tile.group.children)tint(group)}
 return{ready,update,move,setSeasons,getTree:()=>models.broad};
}
