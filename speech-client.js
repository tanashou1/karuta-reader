let worker,serial=0,pending;
export function cancelGeneration(){
 if(worker)worker.terminate();worker=null;
 if(pending){clearTimeout(pending.timer);pending.reject(new Error('音声作成を中止しました。'));pending=null;}
}
function synthesize(text){
 if(!worker){
  worker=new Worker(new URL('./speech/worker.js',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{
   if(!pending||pending.id!==data.id)return;
   const p=pending;pending=null;clearTimeout(p.timer);
   if(data.error)p.reject(new Error(data.error));
   else p.resolve(new Blob([data.bytes],{type:'audio/wav'}));
  };
  worker.onerror=()=>cancelGeneration();
 }
 return new Promise((resolve,reject)=>{
  const id=++serial;
  pending={id,resolve,reject,timer:setTimeout(cancelGeneration,120000)};
  worker.postMessage({id,text});
 });
}
export async function generateCards(cards,progress=()=>{}){
 const audio=[];
 for(let i=0;i<cards.length;i++){
  progress(i,cards.length);
  try{audio.push(await synthesize(cards[i]));}
  catch(error){throw new Error(`${i+1}枚目：${error.message}`);}
 }
 progress(cards.length,cards.length);
 return audio;
}
