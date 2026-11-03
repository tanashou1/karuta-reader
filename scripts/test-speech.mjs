import assert from 'node:assert/strict';
import {load as loadVoice} from 'aquestalk.js';
import {load as loadReader} from 'kanji2koe-openjtalk';
import {writeFile} from 'node:fs/promises';
const reader=await loadReader();
const voice=await loadVoice('f1');
try{
 for(const text of ['あさの あいさつ おはようさん','犬も歩けば棒に当たる','今日は良い天気です。']){
  const koe=reader.convert(text),wav=voice.run(koe,95).slice();
  assert.equal(Buffer.from(wav.slice(0,4)).toString(),'RIFF');
  assert.equal(Buffer.from(wav.slice(8,12)).toString(),'WAVE');
  assert.ok(wav.length>1000);
  const view=new DataView(wav.buffer,wav.byteOffset,wav.byteLength);
  assert.equal(view.getUint32(4,true)+8,wav.length);
  assert.ok(wav.slice(44).some(b=>b!==0));
  console.log(`PASS: ${text} → ${koe} → ${wav.length} bytes WAV`);
  await writeFile('/tmp/karuta-generated.wav',wav);
 }
}finally{await voice.destroy();}
