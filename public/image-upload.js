/* Resize before transmission; server validation remains authoritative. */
window.AVEDImageUpload=(()=>{
 const types=['image/png','image/jpeg','image/webp'],maxBytes=800000;
 const data=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('图片读取失败。'));reader.readAsDataURL(blob);});
 async function decode(file){if(typeof createImageBitmap==='function')return createImageBitmap(file,{imageOrientation:'from-image'});return new Promise((resolve,reject)=>{const image=new Image(),url=URL.createObjectURL(file);image.onload=()=>{URL.revokeObjectURL(url);resolve(image);};image.onerror=()=>{URL.revokeObjectURL(url);reject(Error('图片无法读取。'));};image.src=url;});}
 async function prepare(file,{kind='image'}={}){
  if(!file?.size)return null;if(!types.includes(file.type))throw Error('请选择 PNG、JPG 或 WEBP 图片。');if(file.size>20000000)throw Error('原始图片不能超过 20 MB。');
  const image=await decode(file);let canvas;
  try{
   const width=image.width||image.naturalWidth,height=image.height||image.naturalHeight;
   if(!width||!height||width*height>16000000)throw Error('图片不能超过 1600 万像素，请先缩小图片。');
   const edge=kind==='avatar'?512:1536;
   if(Math.max(width,height)<=edge&&file.size<=maxBytes)return file;
   canvas=document.createElement('canvas');const ctx=canvas.getContext('2d');if(!ctx)throw Error('当前浏览器无法处理图片。');let scale=Math.min(1,edge/Math.max(width,height));
   for(let attempt=0;attempt<7;attempt++){
    canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(image,0,0,canvas.width,canvas.height);
    const quality=Math.max(.62,.88-attempt*.05),blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',quality));
    if(!blob)throw Error('图片压缩失败，请换一张图片。');if(blob.size<=maxBytes&&types.includes(blob.type))return blob;scale*=.8;
   }
   throw Error('图片仍然过大，请先缩小后重试。');
  }finally{image.close?.();if(canvas){canvas.width=canvas.height=1;}}
 }
 async function read(file,options){const blob=await prepare(file,options);return blob?data(blob):'';}
 return {prepare,read};
})();
