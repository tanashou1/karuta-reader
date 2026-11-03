import {Worker} from 'node:worker_threads';
import assert from 'node:assert/strict';
const runner=`
 const {parentPort}=await import('node:worker_threads');
 const {readFile}=await import('node:fs/promises');
 globalThis.self=globalThis;
 self.location={href:${JSON.stringify(new URL('../speech/worker.js',import.meta.url).href)}};
 self.postMessage=(data)=>parentPort.postMessage(data);
 globalThis.fetch=async url=>new Response(await readFile(new URL(url)),{headers:{'Content-Type':String(url).endsWith('.wasm')?'application/wasm':'application/octet-stream'}});
 await import(self.location.href);
 parentPort.on('message',data=>self.onmessage({data}));
`;
const worker=new Worker(runner,{eval:true});
try{
 for(const [i,text] of ['犬も歩けば棒に当たる','あさの あいさつ おはようさん'].entries()){
  const result=await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('worker timeout')),30000);
   worker.once('error',reject);
   worker.once('message',data=>{clearTimeout(timer);resolve(data);});
   worker.postMessage({id:i,text});
  });
  assert.equal(result.error,undefined);assert.equal(result.id,i);
  assert.equal(Buffer.from(result.bytes.slice(0,4)).toString(),'RIFF');
  assert.ok(result.bytes.length>1000);
  console.log('PASS: 配布用Workerで文章→WAV生成',text,result.bytes.length);
 }
}finally{await worker.terminate();}
