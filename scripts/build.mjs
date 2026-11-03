import {build} from 'esbuild';
import {mkdir,copyFile,readFile,writeFile,readdir} from 'node:fs/promises';
await mkdir('speech',{recursive:true});
await build({entryPoints:['src/speech-worker.js'],outfile:'speech/worker.js',bundle:true,format:'esm',platform:'browser',define:{'process':'undefined'},external:['crypto','fs','perf_hooks','fs/promises','url','node:fs/promises','node:url'],minify:true,legalComments:'eof'});
await copyFile('node_modules/aquestalk.js/voices/f1.zip','speech/f1.zip');
await copyFile('node_modules/aquestalk.js/voices/v86.wasm','speech/v86.wasm');
await copyFile('node_modules/kanji2koe-openjtalk/pkg/aqkanji2koe_wasm_bg.wasm','speech/reader.wasm');
await mkdir('speech/licenses',{recursive:true});
for(const name of ['aquestalk.js','kanji2koe-openjtalk','v86','jszip','encoding-japanese','pako','lie','immediate','setimmediate','core-util-is','inherits','isarray','process-nextick-args','readable-stream','safe-buffer','string_decoder','util-deprecate']){
 const dir=`node_modules/${name}`;
 const files=(await readdir(dir)).filter(f=>/^licen[sc]e(?:\.|$)/i.test(f));
 for(const file of files)await copyFile(`${dir}/${file}`,`speech/licenses/${name}-${file}`);
}
// Preserve AquesTalk's original license bytes alongside the unchanged voice package.
const {default:JSZip}=await import('jszip');
const zip=await JSZip.loadAsync(await readFile('speech/f1.zip'));
await writeFile('speech/licenses/AqLicence.txt',await zip.file('f1/AqLicence.txt').async('uint8array'));
console.log('Built browser speech worker, engines, and licenses.');
