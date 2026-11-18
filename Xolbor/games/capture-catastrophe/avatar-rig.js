import * as THREE from 'three';
import {createLimbBender} from './gait.js';

// The supplied GLBs are static meshes. Separate their connected pieces into
// limbs, then bend each limb around a joint while the player walks.
export function buildAvatarRig(mesh){
 const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();g.computeBoundingBox();const box=g.boundingBox,scale=5.86/(box.max.y-box.min.y);g.translate(-(box.min.x+box.max.x)/2,-box.min.y,0);g.scale(scale,scale,scale);
 const pos=g.attributes.position,nor=g.attributes.normal,uv=g.attributes.uv,count=pos.count/3,parent=Array.from({length:count},(_,i)=>i),vertexMap=new Map();
 function root(i){while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i]}return i}
 for(let t=0;t<count;t++)for(let j=0;j<3;j++){const i=t*3+j,key=[pos.getX(i),pos.getY(i),pos.getZ(i)].map(v=>v.toFixed(4)).join(',');if(vertexMap.has(key))parent[root(t)]=root(vertexMap.get(key));else vertexMap.set(key,t)}
 const islands=new Map();for(let t=0;t<count;t++){const r=root(t);let c=islands.get(r);if(!c){c={triangles:[],min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};islands.set(r,c)}c.triangles.push(t);for(let j=0;j<3;j++){const i=t*3+j;[pos.getX(i),pos.getY(i),pos.getZ(i)].forEach((v,k)=>{c.min[k]=Math.min(c.min[k],v);c.max[k]=Math.max(c.max[k],v)})}}
 const chunks={};function add(key,t){let out=chunks[key]??={p:[],n:[],u:[],min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};for(let j=0;j<3;j++){const i=t*3+j,xyz=[pos.getX(i),pos.getY(i),pos.getZ(i)];out.p.push(...xyz);xyz.forEach((v,k)=>{out.min[k]=Math.min(out.min[k],v);out.max[k]=Math.max(out.max[k],v)});if(nor)out.n.push(nor.getX(i),nor.getY(i),nor.getZ(i));if(uv)out.u.push(uv.getX(i),uv.getY(i))}}
 for(const c of islands.values()){const cx=(c.min[0]+c.max[0])/2,arm=Math.abs(cx)>.8&&c.min[1]>1.5&&c.max[1]<4.3,leg=c.max[1]<2.7&&c.min[1]<2;for(const t of c.triangles){let key='body';if(arm)key=cx<0?'leftArm':'rightArm';else if(leg){let side=cx;if(c.min[0]<-.3&&c.max[0]>.3)side=(pos.getX(t*3)+pos.getX(t*3+1)+pos.getX(t*3+2))/3;if(Math.abs(side)>.03)key=side<0?'leftLeg':'rightLeg'}add(key,t)}}
 const avatar=new THREE.Group(),parts={};for(const key of ['body','leftLeg','rightLeg','leftArm','rightArm']){const c=chunks[key],isArm=key.endsWith('Arm'),isLeg=key.endsWith('Leg');let point=[0,0,0];if(c&&(isArm||isLeg)){point=[(c.min[0]+c.max[0])/2,isArm?Math.min(4.15,Math.max(3.7,c.max[1])):Math.min(2.4,Math.max(1.9,c.max[1])),0]}const pivot=new THREE.Group();pivot.position.set(...point);parts[key]=pivot;avatar.add(pivot);if(!c)continue;const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(c.p,3));if(c.n.length)geom.setAttribute('normal',new THREE.Float32BufferAttribute(c.n,3));if(c.u.length)geom.setAttribute('uv',new THREE.Float32BufferAttribute(c.u,2));geom.translate(-point[0],-point[1],-point[2]);const m=new THREE.Mesh(geom,mesh.material);m.castShadow=true;m.receiveShadow=true;m.frustumCulled=false;pivot.add(m);if(isArm||isLeg)pivot.userData.bend=createLimbBender(geom,(c.min[1]+c.max[1])*.5-point[1])}
 g.dispose();return{avatar,parts};
}
