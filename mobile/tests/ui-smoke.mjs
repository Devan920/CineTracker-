
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
 await page.addInitScript(()=>{
  let state={status:'idle',installedVersion:'1.1.2',installedBuild:4,latest:null,checkedAt:null,dismissedBuild:null,message:null};
  let outcome='current'; const listeners=new Set();
  const latest={version:'1.2.0',versionCode:5,publishedAt:'2026-10-20T18:00:00Z',
   downloadUrl:'https://github.com/Devan920/CineTracker-/releases/download/android-test-v1.2.0-5/CineTracker-1.2.0-debug.apk',
   releaseUrl:'https://github.com/Devan920/CineTracker-/releases/tag/android-test-v1.2.0-5'};
  const publish=patch=>{state={...state,...patch};for(const fn of listeners)fn();};
  window.addEventListener('test:update-feed',event=>{
   outcome=event.detail;
   if(outcome==='available')publish({status:'available',latest,checkedAt:new Date().toISOString()});
  });
  window.cinetrackerNative={version:'1.1.2',request:(path,init)=>fetch(path,init),shareCsv:async()=>{},updates:{
   getSnapshot:()=>state,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},
   dismiss:()=>publish({dismissedBuild:state.latest?.versionCode??null}),
   check:async()=>{
    publish({status:'checking'});
    await new Promise(r=>setTimeout(r,100));
    publish({status:outcome,message:outcome==='error'?'You’re offline. Connect to the internet and try again.':null,checkedAt:new Date().toISOString()});
    return state;
   },
  }};
 });
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const now=new Date().toISOString();
 const report={movies:[{id:'test',title:'Test Film',languages:['Malayalam'],industry:'Mollywood',poster:null,day:1,reportDate:null,releaseDate:null,indiaNet:1,indiaGross:1.2,worldwide:2,overseas:.8,daily:[],sourceUrl:'https://www.sacnilk.com/live',sourceUpdatedAt:now,checkedAt:now,lastSeenAt:now,status:'reported',coverage:'active-report',warnings:[]}],checkedAt:now,lastAttemptAt:now,nextCheckAt:new Date(Date.now()+1200000).toISOString(),errors:[],sourceStatus:'ok'};
 await page.route('**/api/report',route=>route.fulfill({json:report}));
 await page.route('**/api/refresh',route=>route.fulfill({json:{state:'current'}}));
 await page.context().route('https://github.com/Devan920/CineTracker-/releases/download/**',route=>route.fulfill({contentType:'text/html',body:'<p>APK download target verified</p>'}));
 await page.goto('http://127.0.0.1:4173');
 await page.getByRole('button',{name:'Save Test Film',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:/pause/i}).count(),0);
 const nav=page.getByRole('navigation',{name:'Mobile navigation'});
 console.log('Navigation diagnostics: '+JSON.stringify(await page.evaluate(()=>{
   const nav=document.querySelector('.mobile-bottom-nav'), button=nav?.lastElementChild;
   const rect=button?.getBoundingClientRect(), style=nav?getComputedStyle(nav):null;
   return {width:innerWidth,viewport:visualViewport&&{width:visualViewport.width,height:visualViewport.height,scale:visualViewport.scale},documentWidth:document.documentElement.scrollWidth,viewportMeta:document.querySelector('meta[name=viewport]')?.content,nav:nav?.getBoundingClientRect().toJSON(),button:rect?.toJSON(),position:style?.position,zIndex:style?.zIndex,hit:rect?document.elementsFromPoint(rect.x+rect.width/2,rect.y+rect.height/2).slice(0,5).map(e=>e.tagName+'.'+e.className):[]};
 })));
 const navBox=await nav.boundingBox();
 assert.ok(navBox && navBox.y+navBox.height<=845,'Bottom navigation must stay inside the visible phone screen');
 await nav.getByRole('button',{name:'Settings',exact:true}).click();
 await page.getByRole('heading',{name:'App updates',exact:true}).waitFor();
 await page.getByText('Installed version 1.1.2',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Check for updates',exact:true}).click();
 await page.getByText('No newer version is available.',{exact:true}).waitFor();
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('test:update-feed',{detail:'error'})));
 await page.getByRole('button',{name:'Check for updates',exact:true}).click();
 await page.getByText('You’re offline. Connect to the internet and try again.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Close settings'}).click();
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('test:update-feed',{detail:'available'})));
 await page.getByRole('complementary',{name:'App update available'}).waitFor();
 await page.getByRole('button',{name:'View update',exact:true}).click();
 const download=page.getByRole('link',{name:'Download update',exact:true});
 assert.equal(await download.getAttribute('href'),'https://github.com/Devan920/CineTracker-/releases/download/android-test-v1.2.0-5/CineTracker-1.2.0-debug.apk');
 await download.scrollIntoViewIfNeeded();
 const clickedLink=page.waitForEvent('popup');
 await download.click();
 const popup=await clickedLink;
 await popup.waitForLoadState('domcontentloaded');
 assert.ok(popup.url().endsWith('/CineTracker-1.2.0-debug.apk'));
 await popup.close();
 await page.getByRole('button',{name:'Close settings'}).click();
 await page.getByRole('button',{name:'Dismiss update notification',exact:true}).click();
 assert.equal(await page.getByRole('complementary',{name:'App update available'}).count(),0);
 await nav.getByRole('button',{name:'Settings',exact:true}).click();
 await download.waitFor(); // Dismissal hides the banner, not the available download.
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
 console.log('Mobile UI passed: launch, settings, dark-mode persistence, social URLs, credit, watchlist, no pause button, update notification/check/error/download/dismissal.');
}finally{await browser?.close();server.kill();}
