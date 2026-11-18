// Bend the existing limb mesh smoothly around its middle without splitting it.
export function createLimbBender(geometry,jointY=-.98){
 const positions=geometry.getAttribute('position'),normals=geometry.getAttribute('normal');
 const originalPosition=new Float32Array(positions.array),originalNormal=normals?new Float32Array(normals.array):null;
 const weights=new Float32Array(positions.count);
 for(let i=0;i<weights.length;i++){const y=originalPosition[i*3+1];let t=Math.max(0,Math.min(1,(jointY+.30-y)/.6));weights[i]=t*t*(3-2*t)}
 positions.setUsage(35048);if(normals)normals.setUsage(35048);let previous=NaN;
 return angle=>{if(Math.abs(angle-previous)<.0001)return;previous=angle;
  for(let i=0;i<weights.length;i++){const k=i*3,w=weights[i],a=angle*w,c=Math.cos(a),s=Math.sin(a),y=originalPosition[k+1]-jointY,z=originalPosition[k+2];positions.array[k]=originalPosition[k];positions.array[k+1]=jointY+y*c-z*s;positions.array[k+2]=y*s+z*c;
   if(normals&&originalNormal){const ny=originalNormal[k+1],nz=originalNormal[k+2];normals.array[k]=originalNormal[k];normals.array[k+1]=ny*c-nz*s;normals.array[k+2]=ny*s+nz*c}}
  positions.needsUpdate=true;if(normals)normals.needsUpdate=true;
 };
}
