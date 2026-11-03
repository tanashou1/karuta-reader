import {load as loadVoice} from 'aquestalk.js';
import {load as loadReader} from 'kanji2koe-openjtalk';
let ready;
async function engine(){
  if(!ready)ready=(async()=>{
    const base=new URL('./',self.location.href);
    const reader=await loadReader({wasmPath:new URL('reader.wasm',base)});
    const voice=await loadVoice('f1',{baseUrl:base.href,wasmPath:new URL('v86.wasm',base).href});
    return {reader,voice};
  })().catch(e=>{ready=null;throw e;});
  return ready;
}
self.onmessage=async({data:{id,text}})=>{
  try{
    const {reader,voice}=await engine();
    const bytes=voice.run(reader.convert(text),95).slice();
    if(bytes.length<44||String.fromCharCode(...bytes.slice(0,4))!=='RIFF')throw Error('正しい音声を生成できませんでした。');
    self.postMessage({id,bytes},[bytes.buffer]);
  }catch(error){self.postMessage({id,error:String(error.message||error)});}
};
