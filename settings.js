export const SETTINGS_KEY='kotonoha-karuta-settings-v1';
export const defaults=Object.freeze({readCount:1,intervalSeconds:2});
export function normalizeSettings(value){
 const count=Number(value?.readCount),interval=Number(value?.intervalSeconds);
 return {
  readCount:Number.isInteger(count)&&count>=1&&count<=10?count:defaults.readCount,
  intervalSeconds:Number.isFinite(interval)&&interval>=0&&interval<=60?Math.round(interval*10)/10:defaults.intervalSeconds
 };
}
export function loadSettings(){
 try{return normalizeSettings(JSON.parse(localStorage.getItem(SETTINGS_KEY)));}
 catch{return {...defaults};}
}
export function saveSettings(value){
 const settings=normalizeSettings(value);
 localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));
 return settings;
}
// Each interval begins when the previous reading finishes, regardless of its length.
export function createRepeater({readCount,intervalSeconds,read,onWait,onComplete,onError,setTimer=setTimeout,clearTimer=clearTimeout}){
 let cancelled=false,timer=null,count=0;
 const cancel=()=>{cancelled=true;if(timer!==null)clearTimer(timer);};
 const next=()=>{
  if(cancelled)return;
  count++;
  let settled=false;
  const fail=()=>{if(cancelled||settled)return;settled=true;cancel();onError();};
  const done=()=>{
   if(cancelled||settled)return;settled=true;
   if(count>=readCount){cancelled=true;onComplete();return;}
   onWait(count,readCount);
   timer=setTimer(()=>{timer=null;next();},intervalSeconds*1000);
  };
  try{read(count,readCount,done,fail);}catch{fail();}
 };
 return {start:next,cancel};
}
