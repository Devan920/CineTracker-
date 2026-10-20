
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4173'],{stdio:'pipe'});
let browser;
try{
 let ready=false;
 for(let i=0;i<80;i++){try{const r=await fetch('http://127.0.0.1:4173');if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}
 if(!ready)throw new Error('Preview server did not start');
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const now=new Date().toISOString();
 const report={movies:[{id:'test',title:'Test Film',languages:['Malayalam'],industry:'Mollywood',poster:null,day:1,reportDate:null,releaseDate:null,indiaNet:1,indiaGross:1.2,worldwide:2,overseas:.8,daily:[],sourceUrl:'https://www.sacnilk.com/live',sourceUpdatedAt:now,checkedAt:now,lastSeenAt:now,status:'reported',coverage:'active-report',warnings:[]}],checkedAt:now,lastAttemptAt:now,nextCheckAt:new Date(Date.now()+1200000).toISOString(),errors:[],sourceStatus:'ok'};
 await page.route('**/api/report',route=>route.fulfill({json:report}));
 await page.route('**/api/refresh',route=>route.fulfill({json:{state:'current'}}));
 await page.goto('http://127.0.0.1:4173');
 await page.getByRole('button',{name:'Save Test Film',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:/pause/i}).count(),0);
 const nav=page.getByRole('navigation',{name:'Mobile navigation'});
 await nav.getByRole('button',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Dark',exact:true}).click();
 assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
 assert.equal(await page.getByRole('link',{name:/Instagram:/}).getAttribute('href'),'https://www.instagram.com/devvvanarayanan?stkn=MXd6ajFrdG5tMnV5NQ==');
 assert.equal(await page.getByRole('link',{name:/Facebook:/}).getAttribute('href'),'https://www.facebook.com/share/14uxK1yCDgS/');
 assert.equal(await page.getByRole('link',{name:/Telegram:/}).getAttribute('href'),'https://t.me/Devanarayananv2006');
 assert.equal(await page.locator('.settings-credit strong').textContent(),'Devanarayanan');
 await page.getByRole('button',{name:'Close settings'}).click();
 await page.reload();
 await page.getByRole('button',{name:'Save Test Film',exact:true}).waitFor();
 assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
 await page.getByRole('button',{name:'Save Test Film',exact:true}).click();
 await nav.getByRole('button',{name:'Watchlist',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Remove Test Film',exact:true}).count(),1);
 assert.deepEqual(errors,[]);
 console.log('Mobile UI passed: launch, settings, dark-mode persistence, social URLs, credit, watchlist, no pause button.');
}finally{await browser?.close();server.kill();}
