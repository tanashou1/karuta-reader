import assert from 'node:assert/strict';
import {SETTINGS_KEY,defaults,loadSettings,saveSettings,createRepeater} from '../settings.js';
const memory=new Map();
globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
assert.deepEqual(loadSettings(),defaults);
saveSettings({readCount:3,intervalSeconds:1.5});
assert.deepEqual(loadSettings(),{readCount:3,intervalSeconds:1.5});
memory.set(SETTINGS_KEY,'broken JSON');assert.deepEqual(loadSettings(),defaults);
memory.set(SETTINGS_KEY,JSON.stringify({readCount:0,intervalSeconds:-1}));assert.deepEqual(loadSettings(),defaults);
localStorage.setItem=()=>{throw Error('blocked');};assert.throws(()=>saveSettings(defaults));
function fixture(readCount=3,intervalSeconds=2){
 let done,fail,reads=0,complete=0,errors=0;const timers=new Map();let serial=0;
 const repeater=createRepeater({readCount,intervalSeconds,read:(c,t,d,f)=>{reads++;done=d;fail=f;},onWait:()=>{},onComplete:()=>complete++,onError:()=>errors++,setTimer:(f,ms)=>{assert.equal(ms,intervalSeconds*1000);timers.set(++serial,f);return serial;},clearTimer:id=>timers.delete(id)});
 return {repeater,timers,end:()=>done(),fail:()=>fail(),get reads(){return reads;},get complete(){return complete;},get errors(){return errors;},tick:()=>{const [id,f]=timers.entries().next().value;timers.delete(id);f();}};
}
const a=fixture();a.repeater.start();assert.equal(a.reads,1);assert.equal(a.timers.size,0);a.end();assert.equal(a.timers.size,1);a.tick();a.end();a.tick();a.end();assert.equal(a.reads,3);assert.equal(a.complete,1);assert.equal(a.timers.size,0);
const b=fixture();b.repeater.start();b.end();b.repeater.cancel();assert.equal(b.timers.size,0);assert.equal(b.reads,1);
const c=fixture();c.repeater.start();c.repeater.cancel();c.end();assert.equal(c.timers.size,0);assert.equal(c.complete,0);
const d=fixture(1,0);d.repeater.start();d.end();assert.equal(d.complete,1);assert.equal(d.timers.size,0);
const e=fixture();e.repeater.start();e.fail();e.end();assert.equal(e.errors,1);assert.equal(e.timers.size,0);
console.log('PASS: settings persistence, invalid storage, repeat count, end-to-start interval, cancellation, single read, playback errors');
