import puppeteer from 'puppeteer-core';
import http from 'http';import fs from 'fs';import path from 'path';import {spawn} from 'child_process';
const ROOT=import.meta.dirname;const TL=JSON.parse(fs.readFileSync(ROOT+'/timeline.json'));
const [,,mode,fmt,...rest]=process.argv;const P=fmt==='p';const W=P?1080:1920,H=P?1920:1080,FPS=30;
const mt={'.html':'text/html','.css':'text/css','.woff2':'font/woff2','.woff':'font/woff'};
const srv=http.createServer((q,r)=>{const f=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':mt[path.extname(f)]||'application/octet-stream'});r.end(d)})}).listen(0,'127.0.0.1');
await new Promise(r=>srv.on('listening',r));
const b=await puppeteer.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--hide-scrollbars','--force-color-profile=srgb']});
const open=async()=>{const p=await b.newPage();p.on('pageerror',e=>console.log('ERR',e.message));await p.setViewport({width:W,height:H});await p.goto(`http://127.0.0.1:${srv.address().port}/index.html${P?'?p':''}`,{waitUntil:'networkidle0'});await p.evaluate(async tl=>{await Promise.all([500,600,700,800].map(w=>document.fonts.load(`${w} 40px "Be Vietnam Pro"`,'Sàn Xây Dựng đội ữ')));await document.fonts.ready;init(tl)},TL);return p};
if(mode==='still'){const p=await open();for(const t of rest){await p.evaluate(t=>seek(+t),t);await p.screenshot({path:`${ROOT}/still_${fmt}_${t}.png`})}}
else{const N=Math.round(TL[6].end*FPS);const K=4;const pages=[];for(let i=0;i<K;i++)pages.push(await open());
 const ff=spawn('ffmpeg',['-y','-v','error','-f','image2pipe','-framerate',FPS,'-c:v','mjpeg','-i','-','-c:v','libx264','-preset','medium','-crf','17','-vf','scale=out_color_matrix=bt709:out_range=tv','-pix_fmt','yuv420p','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709',`${ROOT}/video_${fmt}.mp4`],{stdio:['pipe','inherit','inherit']});
 const buf={};let next=0;const write=async()=>{while(buf[next]){const d=buf[next];delete buf[next];next++;if(!ff.stdin.write(d))await new Promise(r=>ff.stdin.once('drain',r))}};
 for(let n=0;n<N;n+=K){const r=await Promise.all(pages.map(async(p,j)=>{if(n+j>=N)return;await p.evaluate(t=>seek(t),(n+j)/FPS);return p.screenshot({type:'jpeg',quality:95})}));r.forEach((d,j)=>{if(d)buf[n+j]=Buffer.from(d)});await write()}
 ff.stdin.end();await new Promise(r=>ff.on('close',r));console.log('frames',N,next)}
await b.close();srv.closeAllConnections();srv.close();process.exit(0);
