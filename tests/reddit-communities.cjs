// Simulated Reddit DOM: no claim of a live reddit.com test.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 const root=path.resolve(__dirname,'../reddit-taringa');
 await page.route('https://www.reddit.com/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body><shreddit-app><reddit-header-large>Reddit</reddit-header-large><div class="grid-container"><main><h2>Explore communities</h2><div class="subreddit"><a href="/r/argentina/">r/argentina</a><button id="join" onclick="this.textContent=\'Joined\'">Join</button></div><div class="subreddit"><a href="/r/gaming/">r/gaming</a></div><input placeholder="Search communities"><button id="next" onclick="this.textContent=\'Loaded\'">Next</button></main></div></shreddit-app></body></html>'}));
 async function install(){
  await page.addStyleTag({path:path.join(root,'skin.css')});
  await page.evaluate(()=>{globalThis.chrome={storage:{local:{get:async defaults=>defaults,set:async()=>{}},onChanged:{addListener(){}}}}});
  for(const file of ['config.js','runtime.js','content.js'])await page.addScriptTag({path:path.join(root,file)});
 }
 async function navigate(url,posts=false){await page.evaluate(({url,posts})=>{history.pushState({},'',url);document.querySelectorAll('shreddit-post').forEach(n=>n.remove());if(posts){const n=document.createElement('shreddit-post');n.id='post1';n.setAttribute('post-title','Título real de ejemplo');n.setAttribute('permalink','/r/argentina/comments/abc/test/');n.setAttribute('subreddit-prefixed-name','r/argentina');document.querySelector('main').append(n)}RetroSkin.render()},{url,posts})}
 const target='https://www.reddit.com/subreddits/?screen_view_count=1&ext-referrer=DIRECT';
 await page.goto(target);await install();
 assert.equal(await page.getAttribute('html','data-retro-page'),'communities');
 assert.equal(await page.locator('shreddit-app').evaluate(n=>n.inert),false);
 await page.locator('#join').click();assert.equal(await page.locator('#join').textContent(),'Joined');
 await page.locator('#next').click();assert.equal(await page.locator('#next').textContent(),'Loaded');
 await page.locator('input[placeholder="Search communities"]').fill('argentina');
 assert.equal(await page.locator('.rt-primary [aria-current=page]').textContent(),'Comunidades');
 await page.screenshot({path:'/workspace/nostalgia-extensions/dist/communities-simulated.png',fullPage:true});
 await navigate('/r/argentina/',true);assert.equal(await page.getAttribute('html','data-retro-page'),'feed');assert.equal(await page.locator('.rt-post-title').textContent(),'Título real de ejemplo');
 await navigate('/r/argentina/comments/abc/test/',true);assert.equal(await page.getAttribute('html','data-retro-page'),'post');assert.equal(await page.locator('shreddit-app').evaluate(n=>n.inert),false);
 await navigate('/subreddits/new/');assert.equal(await page.getAttribute('html','data-retro-page'),'communities');
 await navigate('/r/empty/');assert.equal(await page.getAttribute('html','data-retro-page'),'post');assert.equal(await page.locator('shreddit-app').evaluate(n=>n.inert),false);
 await navigate('/',true);assert.equal(await page.getAttribute('html','data-retro-page'),'feed');
 await navigate('/subreddits/mine/');assert.equal(await page.getAttribute('html','data-retro-page'),'communities');
 await page.evaluate(()=>RetroSkin.save({theme:'noche'}));assert.equal(await page.getAttribute('html','data-retro-theme'),'noche');
 await page.evaluate(()=>RetroSkin.save({enabled:false}));assert.equal(await page.locator('#rt-app').count(),0);assert.equal(await page.locator('shreddit-app').evaluate(n=>n.inert),false);
 await page.reload();await install();assert.equal(await page.getAttribute('html','data-retro-page'),'communities');
 await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('#rt-directory-heading').isVisible(),true);
 await browser.close();console.log('PASS simulated Chromium: directory/query, controls, SPA community/feed/post/empty/back, reload, night, disable, mobile');
})().catch(e=>{console.error(e);process.exit(1)});
