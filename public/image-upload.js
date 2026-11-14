/* Resize before transmission; server validation remains authoritative. */
window.AVEDImageUpload=(()=>{
 const types=['image/png','image/jpeg','image/webp'],maxBytes=800000;
 const data=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('图片读取失败。'));reader.readAsDataURL(blob);});
 async function decode(file,avatar=false){
  if(typeof createImageBitmap==='function'){
   try{return await createImageBitmap(file,{imageOrientation:'from-image',...(avatar?{resizeWidth:512,resizeQuality:'high'}:{})});}
   catch{/* Older browsers may not support bitmap resize options; use the image decoder. */}
  }
  return new Promise((resolve,reject)=>{const image=new Image(),url=URL.createObjectURL(file);image.onload=()=>{URL.revokeObjectURL(url);resolve(image);};image.onerror=()=>{URL.revokeObjectURL(url);reject(Error('图片无法读取，请换成 PNG、JPG 或 WEBP 后重试。'));};image.src=url;});
 }
 async function prepare(file,{kind='image'}={}){
  if(!file?.size)return null;if(!types.includes(file.type))throw Error('请选择 PNG、JPG 或 WEBP 图片。');if(file.size>20000000)throw Error('原始图片不能超过 20 MB。');
  const image=await decode(file,kind==='avatar');let canvas;
  try{
   const width=image.width||image.naturalWidth,height=image.height||image.naturalHeight;
   if(!width||!height)throw Error('图片尺寸无法读取。');
   if(kind!=='avatar'&&width*height>16000000)throw Error('图片不能超过 1600 万像素，请先缩小图片。');
   const edge=kind==='avatar'?512:1536;
   // A resized bitmap does not change the original file: avatars must always be encoded.
   if(kind!=='avatar'&&Math.max(width,height)<=edge&&file.size<=maxBytes)return file;
   canvas=document.createElement('canvas');const ctx=canvas.getContext('2d');if(!ctx)throw Error('当前浏览器无法处理图片。');let scale=Math.min(1,edge/Math.max(width,height));
   for(let attempt=0;attempt<7;attempt++){
    canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(image,0,0,canvas.width,canvas.height);
    const quality=Math.max(.62,.88-attempt*.05),blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',quality));
    if(!blob)throw Error('图片压缩失败，请换一张图片。');if(blob.size<=maxBytes&&types.includes(blob.type))return blob;scale*=.8;
   }
   throw Error('图片仍然过大，请先缩小后重试。');
  }finally{image.close?.();if(canvas){canvas.width=canvas.height=1;}}
 }
 // Preview and save reuse the same compressed avatar without decoding the original twice.
 const avatarCache=new WeakMap();
 function cachedPrepare(file,options={}){
  if(options.kind!=='avatar'||!file)return prepare(file,options);
  if(!avatarCache.has(file)){const task=prepare(file,options).catch(error=>{avatarCache.delete(file);throw error;});avatarCache.set(file,task);}
  return avatarCache.get(file);
 }
 async function read(file,options){const blob=await cachedPrepare(file,options);return blob?data(blob):'';}
 return {prepare:cachedPrepare,read};
})();
