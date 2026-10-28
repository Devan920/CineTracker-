
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4173'],{stdio:'pipe'});
let browser;
try{
 let ready=false;
 for(let i=0;i<80;i++){try{const r=await fetch('http://127.0.0.1:4173');if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}
 if(!ready)throw new Error('Preview server did not start');
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true});
 await page.addInitScript(()=>{
  let state={status:'idle',installedVersion:'1.2.0',installedBuild:5,latest:null,checkedAt:null,dismissedBuild:null,message:null};
  let outcome='current'; const listeners=new Set();
  const latest={version:'1.3.0',versionCode:6,publishedAt:'2026-10-20T18:00:00Z',
   downloadUrl:'https://github.com/Devan920/CineTracker-/releases/download/android-test-v1.3.0-6/CineTracker-1.3.0-debug.apk',
   releaseUrl:'https://github.com/Devan920/CineTracker-/releases/tag/android-test-v1.3.0-6'};
  const publish=patch=>{state={...state,...patch};for(const fn of listeners)fn();};
  window.addEventListener('test:update-feed',event=>{
   outcome=event.detail;
   if(outcome==='available')publish({status:'available',latest,checkedAt:new Date().toISOString()});
  });
  window.cinetrackerNative={version:'1.2.0',request:(path,init)=>fetch(path,init),shareCsv:async()=>{},updates:{
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
 const older={...report.movies[0],id:'archive-2024',title:'Archive Film',year:2024,day:null,archive:true,indiaNet:40,indiaGross:48,worldwide:70,overseas:22};
 await page.route('**/api/archive*',route=>route.fulfill({json:{movies:[older,report.movies[0]],checkedAt:now,stale:false}}));
 await page.route('**/api/movies/search*',route=>{
  const q=new URL(route.request().url()).searchParams.get('q');
  return route.fulfill({json:{movies:q?.includes('Remake')?[{pageId:101,title:'Remake',year:2013,description:'2013 Malayalam film'},{pageId:102,title:'Remake',year:2015,description:'2015 Hindi film'}]:[]}});
 });
 await page.route('**/api/movies/details*',route=>{
  const params=new URL(route.request().url()).searchParams,title=params.get('title');
  return route.fulfill({json:{title,year:Number(params.get('year')),cast:['Lead Actor','Supporting Actor'],director:'Film Director',story:params.get('pageid')==='102'?'Story of the 2015 remake.':'A journey brings a group of old friends together.',sourceUrl:'https://en.wikipedia.org/wiki/Example',checkedAt:now}});
 });
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
 await page.getByText('Installed version 1.2.0',{exact:true}).waitFor();
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
 assert.equal(await download.getAttribute('href'),'https://github.com/Devan920/CineTracker-/releases/download/android-test-v1.3.0-6/CineTracker-1.3.0-debug.apk');
 await download.scrollIntoViewIfNeeded();
 const clickedLink=page.waitForEvent('popup');
 await download.click();
 const popup=await clickedLink;
 await popup.waitForLoadState('domcontentloaded');
 assert.ok(popup.url().endsWith('/CineTracker-1.3.0-debug.apk'));
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
 await nav.getByRole('button',{name:'Archive',exact:true}).click();
 await page.getByRole('button',{name:'Open Archive Film',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Open Test Film',exact:true}).count(),0,'Active feed must not be presented as a final collection');
 await page.getByLabel('Archive release year').selectOption('2024');
 await page.getByRole('button',{name:'Open Archive Film',exact:true}).click();
 await page.getByText('Lead Actor',{exact:true}).waitFor();
 await page.getByText('A journey brings a group of old friends together.',{exact:true}).waitFor();
 assert.equal(await page.getByRole('link',{name:'CC BY-SA 4.0',exact:true}).getAttribute('href'),'https://creativecommons.org/licenses/by-sa/4.0/');
 mkdirSync('../artifacts',{recursive:true});
 assert.notEqual(await page.locator('dialog[open]').evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');
 await page.screenshot({path:'../artifacts/ui-movie-dark.png',animations:'disabled'});
 await page.getByRole('button',{name:'Save movie',exact:true}).click();
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 await nav.getByRole('button',{name:'Watchlist',exact:true}).click();
 await page.getByRole('button',{name:'Remove Archive Film',exact:true}).waitFor();
 await page.reload();
 await nav.getByRole('button',{name:'Watchlist',exact:true}).click();
 await page.getByRole('button',{name:'Remove Archive Film',exact:true}).waitFor();
 await nav.getByRole('button',{name:'Search',exact:true}).click();
 await page.getByLabel('Search movies',{exact:true}).fill('Remake');
 await page.getByRole('button',{name:'Open Remake',exact:true}).nth(1).waitFor();
 assert.equal(await page.getByRole('button',{name:'Open Remake',exact:true}).count(),2);
 await page.getByRole('button',{name:'Open Remake',exact:true}).nth(1).click();
 await page.getByText('Story of the 2015 remake.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Close dialog',exact:true}).click();
 await nav.getByRole('button',{name:'Settings',exact:true}).click();
 await page.getByRole('button',{name:'Light',exact:true}).click();
 await page.getByRole('button',{name:'Close settings'}).click();
 await nav.getByRole('button',{name:'Overview',exact:true}).click();
 await page.screenshot({path:'../artifacts/ui-home-light.png',animations:'disabled'});
 await page.setViewportSize({width:320,height:700});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow on small phones');
 for(const button of await nav.getByRole('button').all()){const box=await button.boundingBox();assert.ok(box&&box.x>=0&&box.x+box.width<=321&&box.y+box.height<=701,'Every navigation button stays on screen');}
 assert.deepEqual(errors,[]);
 console.log('Mobile UI passed: search/remake selection, cast/story, archive isolation/year filter, saved archive persistence, 320px navigation, light/dark themes, settings/socials/credit, updates and download target.');
}finally{await browser?.close();server.kill();}

