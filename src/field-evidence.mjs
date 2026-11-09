// Evidências fotográficas privadas; redimensionamento no celular remove metadados EXIF.
export const FIELD_BUCKET='cv-field-evidence-v1';
const allowed=['image/jpeg','image/png','image/webp'];
const dimension=1600;
export async function compactFieldPhoto(file){
 if(!file||!allowed.includes(file.type))
  throw Error('Envie uma foto JPG, PNG ou WebP.');
 if(file.size>18*1024*1024)
  throw Error('A foto original deve ter até 18 MB.');
 const url=URL.createObjectURL(file);
 let image;
 try{
  image=await new Promise((resolve,reject)=>{
   const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Foto inválida ou corrompida.'));img.src=url;
  });
  const factor=Math.min(1,dimension/Math.max(image.naturalWidth,image.naturalHeight));
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(image.naturalWidth*factor));
  canvas.height=Math.max(1,Math.round(image.naturalHeight*factor));
  const ctx=canvas.getContext('2d');
  if(!ctx)throw Error('Não foi possível preparar a foto no celular.');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(image,0,0,canvas.width,canvas.height);
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(
   output=>output?resolve(output):reject(Error('Não foi possível compactar a foto.')),
   'image/jpeg',0.76));
  if(blob.size>4*1024*1024)throw Error('A foto ficou muito grande para enviar.');
  return blob;
 }finally{URL.revokeObjectURL(url);}
}
export async function uploadFieldPhotos(client,userId,workId,itemId,files,prior=[]){
 const chosen=Array.from(files||[]);
 if(!chosen.length)return {paths:prior.slice(),uploaded:[]};
 if(chosen.length+prior.length>3)
  throw Error('O limite é de 3 fotos por serviço. Selecione menos arquivos.');
 if(!/^[0-9a-f-]{36}$/i.test(userId)||!/^[0-9a-f-]{36}$/i.test(workId)||
    !/^[a-zA-Z0-9_-]{1,64}$/.test(itemId))
  throw Error('Identificação da obra ou serviço inválida para salvar fotos.');
 const uploaded=[];
 try{
  for(const file of chosen){
   const compressed=await compactFieldPhoto(file);
   const path=userId+'/'+workId+'/'+itemId+'/'+crypto.randomUUID()+'.jpg';
   const {error}=await client.storage.from(FIELD_BUCKET).upload(path,compressed,{
    contentType:'image/jpeg',cacheControl:'3600',upsert:false
   });
   if(error)throw Error('Falha ao enviar foto: '+error.message);
   uploaded.push(path);
  }
  return {paths:[...prior,...uploaded],uploaded};
 }catch(err){
  if(uploaded.length)await client.storage.from(FIELD_BUCKET).remove(uploaded).catch(()=>{});
  throw err;
 }
}
export async function rollbackFieldPhotos(client,paths){
 if(paths?.length){
  try{await client.storage.from(FIELD_BUCKET).remove(paths);}catch{/* a interface não mostra credenciais */}
 }
}
export async function showFieldPhotos(client,paths,container){
 if(!container||!paths?.length)return;
 container.replaceChildren();
 const heading=document.createElement('strong');
 heading.textContent='Evidências fotográficas registradas';
 container.append(heading);
 for(let i=0;i<paths.length;i++){
  const {data,error}=await client.storage.from(FIELD_BUCKET).createSignedUrl(paths[i],3600);
  const link=document.createElement('a');
  link.className='field-photo-link';
  link.textContent='Ver foto '+(i+1);
  if(!error&&/^https:\/\//.test(data?.signedUrl||'')){
   link.href=data.signedUrl;
   link.target='_blank';link.rel='noopener noreferrer';
  }else{
   link.textContent='Foto '+(i+1)+' indisponível neste momento';
   link.removeAttribute('href');
  }
  container.append(link);
 }
}
