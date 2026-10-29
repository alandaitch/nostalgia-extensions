// Controlled DOM fixture. Does not like or save any real Instagram content.
const {chromium}=require('playwright');
const path=require('node:path');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://www.instagram.com/**',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta charset="utf-8"></head><body><div><main>
 <article id="a"><a href="/alice/">alice</a><a href="/p/ONE/"><time datetime="2026-10-29">Hoy</time></a><img width="400" alt="Foto" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="><h1>Árboles y café 😊. Esta segunda frase no va en el título.</h1><section><button id="like" onclick="if(!window.fail)this.querySelector('svg').setAttribute('aria-label',this.querySelector('svg').getAttribute('aria-label')==='Unlike'?'Like':'Unlike')"><svg aria-label="Unlike"></svg></button><button id="save" onclick="if(!window.fail)this.querySelector('svg').setAttribute('aria-label',this.querySelector('svg').getAttribute('aria-label')==='Remove'?'Save':'Remove')"><svg aria-label="Remove"></svg></button></section><div><button id="comment-like" onclick="window.commentLikes=(window.commentLikes||0)+1"><svg aria-label="Like"></svg></button></div></article>
 <article id="b"><a href="/alice/">alice</a><a href="/p/TWO/"><time>Hoy</time></a><img width="400" alt="Foto" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="><h1>Un segundo recuerdo</h1><button id="like2" onclick="this.querySelector('svg').setAttribute('aria-label','Unlike')"><svg aria-label="Like"></svg></button><button id="save2" onclick="this.querySelector('svg').setAttribute('aria-label','Remove')"><svg aria-label="Save"></svg></button></article>
 </main></div></body></html>`}));
 await page.goto('https://www.instagram.com/alice/');
 await page.evaluate(()=>{globalThis.chrome={runtime:{sendMessage:async()=>({authors:[]})},storage:{local:{get:async d=>d,set:async()=>{}},onChanged:{addListener(){}}}}});
 for(const file of ['config.js','runtime.js','content.js'])await page.addScriptTag({path:path.resolve('instagram-fotolog',file)});
 await page.addStyleTag({path:path.resolve('instagram-fotolog/skin.css')});
 await page.waitForSelector('.fl-like');
 assert.equal(await page.locator('#fl-title').textContent(),'ÁrBoLeS y CaFé 😊.');
 assert.match(await page.locator('#fl-caption').textContent(),/Esta segunda frase/);
 assert.equal(await page.locator('.fl-like').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('.fl-save').getAttribute('aria-pressed'),'true');
 await page.locator('.fl-like').click();assert.equal(await page.locator('.fl-like').getAttribute('aria-pressed'),'false');assert.equal(await page.evaluate(()=>window.commentLikes||0),0);
 await page.locator('.fl-like').click();assert.equal(await page.locator('.fl-like').getAttribute('aria-pressed'),'true');
 await page.locator('.fl-save').click();assert.equal(await page.locator('.fl-save').getAttribute('aria-pressed'),'false');
 await page.locator('.fl-save').click();assert.match(await page.locator('.fl-save').textContent(),/Guardado en Instagram/);
 await page.evaluate(()=>{window.fail=true});await page.locator('.fl-like').click();assert.match(await page.locator('.fl-like').textContent(),/Aplicando/);
 await page.waitForFunction(()=>document.querySelector('#fl-action-status').textContent.includes('No se confirmó'),{timeout:7000});
 assert.equal(await page.locator('.fl-like').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('.fl-like').isDisabled(),false);
 // Select a second entry while prior action has failed; state belongs to its own post.
 await page.locator('.fl-thumb[data-post="post:TWO"]').click();
 assert.equal(await page.locator('.fl-like').getAttribute('aria-pressed'),'false');assert.equal(await page.locator('.fl-save').getAttribute('aria-pressed'),'false');assert.equal(await page.locator('#fl-action-status').textContent(),'');
 await page.locator('.fl-like').click();await page.locator('.fl-save').click();assert.equal(await page.locator('.fl-save').getAttribute('aria-pressed'),'true');
 // Replace native controls as React would, and verify resulting state, not stale references.
 await page.evaluate(()=>{const old=document.querySelector('#like2');const next=old.cloneNode(true);next.querySelector('svg').setAttribute('aria-label','Like');old.replaceWith(next);RetroSkin.render()});
 assert.equal(await page.locator('.fl-like').getAttribute('aria-pressed'),'false');
 await page.evaluate(()=>{document.querySelector('#b h1').textContent='😊 '+('árboles y café 👨‍👩‍👧‍👦 '.repeat(12));RetroSkin.render()});
 const title=await page.locator('#fl-title').textContent();assert.ok(title.endsWith('…'));assert.ok(!title.includes('�'));assert.ok(title.includes('👨‍👩‍👧‍👦'));
 await page.evaluate(()=>{document.querySelector('#b h1').textContent='';document.querySelector('#b').querySelectorAll('a').forEach(n=>{if(n.getAttribute('href')==='/alice/')n.remove()});RetroSkin.render()});
 assert.equal(await page.locator('#fl-title').textContent(),'Un DíA eN mI fOtOlOg');
 await page.screenshot({path:'dist/fotolog-simulated.png',fullPage:true});
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS simulated Chromium: initial states, toggle/undo, no comment likes, failed confirmation, post switching, replaced controls, sentence/case/accents/emoji/truncation/fallback');
})().catch(e=>{console.error(e);process.exit(1)});
