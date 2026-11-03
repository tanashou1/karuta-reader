import {loadSettings,saveSettings,createRepeater} from './settings.js';
import {generateCards,cancelGeneration} from './speech-client.js';
const $=s=>document.querySelector(s), app=$('#app');
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const lines=text=>text.replace(/^\uFEFF/,'').split(/\r\n|\n|\r/).map(s=>s.trim()).filter(Boolean);
export function shuffle(items){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
let preferences=loadSettings(),repeater=null;
let db,sets=[],session=null,player=null,url=null,epoch=0,dirty=false;
const request=indexedDB.open('kotonoha-karuta',1);
request.onupgradeneeded=()=>request.result.createObjectStore('sets',{keyPath:'id'});
request.onerror=()=>{app.innerHTML='<div class="panel">ブラウザの保存機能が使えません。保存を許可して、もう一度開いてください。</div>';};
request.onsuccess=async()=>{db=request.result;await refresh();home();};
function store(mode,fn){return new Promise((resolve,reject)=>{const t=db.transaction('sets',mode);const r=fn(t.objectStore('sets'));t.oncomplete=()=>resolve(r.result);t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error);});}
async function refresh(){sets=await store('readonly',s=>s.getAll());}
function toast(t){$('#notice').textContent=t;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#notice').textContent='',4000);}
function stop(){epoch++;repeater?.cancel();repeater=null;if(player){player.pause();player=null;}if(url){URL.revokeObjectURL(url);url=null;}window.speechSynthesis?.cancel();}
function leave(){if($('#cancel-generate')&&!$('#cancel-generate').hidden||$('#cancel-prepare')&&!$('#cancel-prepare').hidden){toast('音声作成を中止してから、メニューにもどってね。');return;}cancelGeneration();if(dirty&&!confirm('保存していない内容があります。メニューにもどりますか？'))return;dirty=false;stop();session=null;home();}
$('#home').onclick=e=>{e.preventDefault();leave();};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
function home(){app.innerHTML=`<section class="hero"><div><div class="eyebrow">ことばで あそぶ、みんなの時間</div><h1>さあ、かるたの<br>じかんだよ。</h1><p>すきな読み札をえらんだら、<br>耳をすまして、よーい、スタート！</p></div><div class="cards" aria-hidden="true"><div class="paper">あ</div><div class="paper two">か</div></div></section><div class="grid"><button class="panel menu" id="start"><span class="number">01 あそぶ</span><strong>はじめる →</strong><span>かるたセットをえらんで、あそぼう。</span></button><button class="panel menu" id="create"><span class="number">02 つくる</span><strong>かるたセット作成 →</strong><span>ファイルや手入力で、じぶんだけの札を。</span></button></div><div class="row between" style="margin-top:24px"><button id="settings">⚙ 設定</button><span class="muted">1枚を${preferences.readCount}回・間隔${preferences.intervalSeconds}秒</span></div><p class="muted">このブラウザに ${sets.length} セット保存されています</p>`;$('#start').onclick=setup;$('#create').onclick=library;$('#settings').onclick=settingsMenu;}
function top(title){return `<div class="row between"><h1>${title}</h1><button id="back" class="small">メニューへ</button></div>`;}

function settingsMenu(){
 app.innerHTML=top('読み上げの設定')+`<form id="settings-form" class="panel stack"><div><label for="read-count">1枚を読む回数</label><input id="read-count" type="number" min="1" max="10" step="1" required value="${preferences.readCount}"><p class="muted">1〜10回でえらべます。</p></div><div><label for="read-interval">繰り返すときの時間間隔（秒）</label><input id="read-interval" type="number" min="0" max="60" step="0.1" required value="${preferences.intervalSeconds}"><p class="muted">0〜60秒。読み終わってから、同じ札をもう一度読むまでの待ち時間です。</p></div><p class="help">次の札には「次へ」で進みます。設定はこのブラウザに保存され、次に開いたときも使えます。</p><button type="submit" class="primary">設定を保存</button></form>`;
 $('#back').onclick=leave;
 $('#settings-form').oninput=()=>dirty=true;
 $('#settings-form').onsubmit=e=>{
  e.preventDefault();
  if(!e.target.reportValidity())return;
  try{preferences=saveSettings({readCount:Number($('#read-count').value),intervalSeconds:Number($('#read-interval').value)});dirty=false;home();toast('設定を保存しました！');}
  catch{toast('設定を保存できませんでした。ブラウザの保存設定を確認してください。');}
 };
}
function library(){app.innerHTML=top('かるたをつくろう')+`<div class="grid"><div class="panel"><h2>ファイルから読みこむ</h2><p class="muted">テキスト（.txt）の1行が、読み札1枚になります。</p><label class="file">テキストファイルをえらぶ<input id="import" type="file" accept=".txt,text/plain"></label><label class="muted" style="margin-top:16px">文字コード<select id="encoding"><option value="utf-8">UTF-8（通常はこちら）</option><option value="shift_jis">Shift_JIS</option></select></label></div><div class="panel"><h2>手入力でつくる</h2><p>すきなことばや文章を、<br>1行ずつ書いてみよう。</p><button id="new" class="primary">＋ 新しいセット</button></div></div><h2>保存したセット</h2><div class="panel">${sets.length?sets.map(s=>`<div class="set row between"><div><strong>${escape(s.name)}</strong><div class="muted">${s.cards.length} 枚</div></div><div class="row"><button class="small edit" data-id="${s.id}">編集</button><button class="small danger delete" data-id="${s.id}">削除</button></div></div>`).join(''):'<p class="empty">まだセットがありません。まずは1つ、つくってみよう！</p>'}</div>`;$('#back').onclick=leave;$('#new').onclick=()=>editor();$('#import').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const text=new TextDecoder($('#encoding').value).decode(await file.arrayBuffer());editor({name:file.name.replace(/\.txt$/i,''),cards:lines(text),audio:[]},true);}catch{toast('ファイルを読みこめませんでした。');}};document.querySelectorAll('.edit').forEach(b=>b.onclick=()=>editor(sets.find(s=>s.id===b.dataset.id)));document.querySelectorAll('.delete').forEach(b=>b.onclick=async()=>{if(!confirm('このセットと音声を削除しますか？'))return;try{await store('readwrite',s=>s.delete(b.dataset.id));await refresh();library();}catch{toast('削除できませんでした。');}});}
function editor(set={name:'',cards:[],audio:[]},imported=false){let audio=[...(set.audio||[])];dirty=imported;app.innerHTML=top(set.id?'セットを編集':'新しいセット')+`<div class="panel stack"><div><label for="name">セットのなまえ</label><input id="name" maxlength="100" placeholder="例：どうぶつかるた" value="${escape(set.name)}"></div><div><div class="row between"><label for="cards">読み札（1行に1枚）</label><span class="muted" id="count"></span></div><textarea id="cards" placeholder="あさの あいさつ おはようさん&#10;いぬも あるけば ぼうに あたる">${escape(set.cards.join('\n'))}</textarea><p class="muted">空の行は読みとばします。上から順に、1枚、2枚…になります。</p></div><details><summary>ゆっくり音声を作成・設定する</summary><p>読み札の文章から、ゆっくり音声をまとめて作成できます。漢字も読み上げられます。</p><div class="row"><button id="generate" class="orange">文章から音声をつくる</button><button id="cancel-generate" class="small" hidden>作成を中止</button><span id="generation-status" role="status" class="muted"></span></div><p class="muted">初回はエンジンの読み込みに時間がかかります。文章はこの端末内で処理します。</p><p class="help">お手持ちのゆっくり音声を取りこみます。読み札の順に <b>1.wav、2.wav、3.wav…</b> と名前をつけてください。MP3・OGG・M4Aにも対応。利用条件を確認した音声をご用意ください。</p><input id="audio" type="file" accept="audio/*,.wav,.mp3,.ogg,.m4a" multiple><p class="muted" id="audio-count"></p><button id="clear-audio" class="small">音声をすべて外す</button><p class="muted">読み札を並べかえたときは、音声も設定しなおしてください。</p></details><div class="row"><button class="primary" id="save">このセットを保存</button><button id="export">テキストで出力 ↓</button><button id="cancel" class="small">もどる</button></div></div>`;
const count=()=>{$('#count').textContent=`${lines($('#cards').value).length} 枚`;$('#audio-count').textContent=`音声 ${audio.filter(Boolean).length} 件を設定中`;};count();
let generating=false;
$('#generate').onclick=async()=>{
 const cards=lines($('#cards').value);
 if(!cards.length){toast('読み札を入れてね。');return;}
 if(audio.some(Boolean)&&!confirm('設定中の音声を、文章から作りなおしますか？'))return;
 generating=true;$('#cancel-generate').hidden=false;
 const controls=[...app.querySelectorAll('input,textarea,button')].filter(e=>e.id!=='cancel-generate');
 controls.forEach(e=>e.disabled=true);
 try{
  const result=await generateCards(cards,(i,n)=>$('#generation-status').textContent=`音声を作成中 ${i} / ${n}枚`);
  audio=result;dirty=true;count();$('#generation-status').textContent='音声ができました。セットを保存してね！';
 }catch(error){if($('#generation-status'))$('#generation-status').textContent=error.message;}
 finally{generating=false;controls.forEach(e=>e.disabled=false);if($('#cancel-generate'))$('#cancel-generate').hidden=true;}
};
$('#cancel-generate').onclick=cancelGeneration;
$('#name').oninput=()=>dirty=true;$('#cards').oninput=()=>{dirty=true;count();};$('#back').onclick=leave;$('#cancel').onclick=()=>{cancelGeneration();if(!dirty||confirm('保存せずにもどりますか？')){dirty=false;library();}};$('#clear-audio').onclick=()=>{audio=[];dirty=true;count();};$('#audio').onchange=async e=>{let invalid=0;for(const file of e.target.files){const match=file.name.match(/^([1-9]\d*)\.(wav|mp3|ogg|m4a)$/i);if(!match||Number(match[1])>lines($('#cards').value).length){invalid++;continue;}audio[Number(match[1])-1]=file;}dirty=true;count();if(invalid)toast(`${invalid} 件は番号・ファイル名を確認してください。`);};
$('#export').onclick=()=>{const blob=new Blob([lines($('#cards').value).join('\n')+'\n'],{type:'text/plain;charset=utf-8'});const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=($('#name').value.trim()||'かるた')+'.txt';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};$('#save').onclick=async()=>{const name=$('#name').value.trim(),cards=lines($('#cards').value);if(!name||!cards.length){toast('セットのなまえと読み札を入れてね。');return;}try{await store('readwrite',s=>s.put({id:set.id||crypto.randomUUID(),name,cards,audio:audio.slice(0,cards.length)}));dirty=false;await refresh();library();toast('セットを保存しました！');}catch{toast('保存できませんでした。空き容量やブラウザの設定を確認してください。');}};}
function setup(){app.innerHTML=top('あそぶ準備')+`<div class="panel stack">${sets.length?`<div><label for="set">かるたセットをえらぼう</label><select id="set">${sets.map(s=>`<option value="${s.id}">${escape(s.name)}（${s.cards.length}枚）</option>`).join('')}</select></div><fieldset><legend>読むじゅんばん</legend><label><input type="radio" name="order" value="ordered" checked> 順番どおり</label><label><input type="radio" name="order" value="random"> ランダム</label></fieldset><div><label for="voice">読み上げの音声</label><select id="voice"><option value="generate">ゆっくり音声（文章から自動作成）</option><option value="audio">保存したゆっくり音声</option><option value="browser">ブラウザの日本語音声（ゆっくりではありません）</option></select></div><label><input type="checkbox" id="hide" checked> 読んでいる札の文章をかくす</label><div class="help">「文章から自動作成」は、はじめに音声をまとめて作成・保存します。作成後は、保存した音声ですぐにあそべます。</div><span id="prepare-status" role="status"></span><button class="primary" id="go">はじめる ▶</button><button id="cancel-prepare" class="small" hidden>作成を中止</button>`:'<p>まずは、かるたセットをつくってね。</p><button id="make" class="primary">かるたセット作成へ</button>'}</div>`;$('#back').onclick=leave;if($('#make'))$('#make').onclick=library;if($('#go'))$('#go').onclick=async()=>{const set=sets.find(s=>s.id===$('#set').value),voice=$('#voice').value;if(voice==='audio'&&set.cards.some((_,i)=>!set.audio?.[i])){toast('すべての読み札にゆっくり音声を設定してください。');return;}if(voice==='browser'&&!window.speechSynthesis){toast('このブラウザは読み上げに対応していません。');return;}if(voice==='generate'){
 const controls=[...app.querySelectorAll('input,select,button')].filter(e=>e.id!=='cancel-prepare');
 controls.forEach(e=>e.disabled=true);$('#cancel-prepare').hidden=false;$('#cancel-prepare').onclick=cancelGeneration;
 try{
  const audio=await generateCards(set.cards,(i,n)=>$('#prepare-status').textContent=`ゆっくり音声を作成中 ${i} / ${n}枚`);
  // Commit only a complete set, so errors and cancellation preserve previous audio.
  await store('readwrite',s=>s.put({...set,audio}));set.audio=audio;await refresh();
 }catch(error){if($('#prepare-status'))$('#prepare-status').textContent=error.message;return;}
 finally{controls.forEach(e=>e.disabled=false);if($('#cancel-prepare'))$('#cancel-prepare').hidden=true;}
}let order=set.cards.map((_,i)=>i);if($('input[name=order]:checked').value==='random')order=shuffle(order);session={set,order,index:0,voice:voice==='generate'?'audio':voice,hide:$('#hide').checked};play();speak();};}
function play(){const s=session,n=s.order[s.index];app.innerHTML=`<div class="play"><div class="eyebrow">${escape(s.set.name)}</div><h1>耳をすまして、きいてね。</h1><div class="row between"><span>${s.index+1} / ${s.order.length} 枚</span><span class="muted" id="status" role="status">読み上げ中…</span></div><div class="progress"><span style="width:${(s.index+1)/s.order.length*100}%"></span></div><div class="read-card">${s.hide?'♪ よみふだを きこう':escape(s.set.cards[n])}</div><button id="next" class="primary next">${s.index===s.order.length-1?'おしまい ✓':'次へ →'}</button><div class="row between"><button id="prev" class="small" ${s.index===0?'disabled':''}>← 戻る</button><button id="repeat" class="small">もう一度きく</button><button id="end" class="small">終了</button></div></div>`;$('#next').onclick=()=>{stop();if(++s.index===s.order.length){finish();return;}play();speak();};$('#prev').onclick=()=>{stop();s.index--;play();speak();};$('#repeat').onclick=speak;$('#end').onclick=()=>{if(confirm('かるたを終了しますか？')){stop();session=null;home();}};}
function speak(){
 stop();const token=epoch,s=session,n=s.order[s.index];
 const status=text=>{if(token===epoch&&$('#status'))$('#status').textContent=text;};
 repeater=createRepeater({
  ...preferences,
  read:(count,total,done,fail)=>{
   status(`読み上げ中… ${count} / ${total}回`);
   if(s.voice==='audio'){
    if(player){player.pause();player=null;}
    if(url)URL.revokeObjectURL(url);
    url=URL.createObjectURL(s.set.audio[n]);player=new Audio(url);
    player.onended=done;player.onerror=fail;player.play().catch(fail);
   }else{
    const u=new SpeechSynthesisUtterance(s.set.cards[n]);u.lang='ja-JP';u.rate=.85;
    const v=speechSynthesis.getVoices().find(v=>v.lang.startsWith('ja'));if(v)u.voice=v;
    u.onend=done;u.onerror=fail;speechSynthesis.speak(u);
   }
  },
  onWait:(count,total)=>status(`${count} / ${total}回 よめたよ。${preferences.intervalSeconds}秒まってね…`),
  onComplete:()=>status('「次へ」でつぎの札へ'),
  onError:()=>status('音声を再生できません。「もう一度きく」を押してね。')
 });
 repeater.start();
}
function finish(){session=null;app.innerHTML=`<div class="panel play"><div style="font-size:64px">🌸</div><h1>ぜんぶ、よめたね！</h1><p>みんなで、たのしくあそべたかな？</p><div class="row" style="justify-content:center"><button id="again" class="primary">もう一度あそぶ</button><button id="menu">メニューへ</button></div></div>`;$('#again').onclick=setup;$('#menu').onclick=home;}
