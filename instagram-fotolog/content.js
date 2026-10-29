/* A classic diary backed by Instagram's rendered photos and live video player. */
(() => {
  'use strict';
  const R=globalThis.RetroSkin,{el,own,mark,text,url}=R,site='https://www.instagram.com';
  const reserved=new Set(['p','reel','reels','explore','direct','accounts','stories','about','legal']);
  const state={selected:null,photo:0,path:'',contextPath:'',records:[],cache:new Map(),nativeTask:false,roots:new Map(),player:null,loading:null,pendingAction:null,actions:new Map(),autoOpened:null,view:location.pathname==='/'?'home':'diary',homeFilter:'all',homeCache:new Map(),directory:new Map(),visited:new Map(),sessionVisited:[],lastVisit:null};
  const link=(label,href,cls='')=>el('a',{href,text:label,class:cls});
  const button=(label,fn,cls='')=>el('button',{type:'button',text:label,onclick:fn,class:cls});
  const postKey=pathname=>pathname.match(/^\/(?:[^/]+\/)?(?:p|reel|reels)\/([^/]+)/)?.[1]||null;
  const keyOf=href=>{try{return postKey(new URL(href,site).pathname);}catch{return null;}};
  const idOf=href=>'post:'+keyOf(href);
  const original=n=>!n.closest('[data-retro-owned]');
  const main=()=>[...document.querySelectorAll('main,[role="main"]')].find(original);
  function profile(href){try{const p=new URL(href,site).pathname.split('/').filter(Boolean);return p.length===1&&!reserved.has(p[0])?p[0]:null;}catch{return null;}}
  function root(node){while(node?.parentElement&&node.parentElement!==document.body)node=node.parentElement;return node;}
  function labelOf(node){return node?.getAttribute('aria-label')||node?.querySelector('svg[aria-label]')?.getAttribute('aria-label')||'';}
  // Post controls precede comment controls; taking the last Like can like a comment.
  function control(scope,pattern){return [...(scope?.querySelectorAll('button,[role="button"]')||[])].find(n=>!n.closest('li,[role="listitem"]')&&pattern.test(labelOf(n)));}
  const actionPatterns={comment:/^(Comentar|Comment)$/i,like:/^(Me gusta|Like|Ya no me gusta|Unlike)$/i,save:/^(Guardar|Save|Eliminar|Remove|Quitar de guardados|Eliminar de guardados|Remove from saved|Unsave)$/i};
  function nativeAction(record,kind){
    if(!liveRecord(record))return null;
    const target=control(record.article,actionPatterns[kind]);if(!target)return null;
    const label=labelOf(target),pressed=target.getAttribute('aria-pressed');
    const active=pressed==='true'||(kind==='like'?/^(Ya no me gusta|Unlike)$/i:/^(Eliminar|Remove|Quitar de guardados|Eliminar de guardados|Remove from saved|Unsave)$/i).test(label);
    return {target,active};
  }
  function entryTitle(description){
    const value=(description||'').replace(/\s+/gu,' ').trim();
    const first=value?(typeof Intl.Segmenter==='function'?[...new Intl.Segmenter('es',{granularity:'sentence'}).segment(value)][0]?.segment:value.match(/^.*?(?:[.!?](?:\s|$)|$)/u)?.[0]):'';
    let title=(first||value||'Un día en mi Fotolog').trim();
    const parts=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter('es',{granularity:'grapheme'}).segment(title)].map(x=>x.segment):Array.from(title);
    if(parts.length>80){title=parts.slice(0,79).join('');const space=title.lastIndexOf(' ');if(space>40)title=title.slice(0,space);title=title.trimEnd()+'…';}
    let index=0;return title.replace(/\p{L}/gu,letter=>index++%2?letter.toLocaleLowerCase('es'):letter.toLocaleUpperCase('es'));
  }
  function syncActions(record){
    for(const kind of ['like','save']){
      const node=document.querySelector('.fl-'+kind),native=nativeAction(record,kind),key=record.id+':'+kind,pending=state.actions.get(key);
      if(pending&&!pending.error){
        if(native&&native.active===pending.expected)state.actions.delete(key);
        else if(Date.now()-pending.started>=5000)pending.error='No se confirmó el cambio. Revisá la publicación o reintentá.';
      }
      const status=state.actions.get(key),waiting=Boolean(status&&!status.error);
      node.disabled=waiting;node.setAttribute('aria-busy',String(waiting));
      if(native)node.setAttribute('aria-pressed',String(native.active));else node.removeAttribute('aria-pressed');
      text(node,waiting?'Aplicando…':kind==='like'?(native?.active?'Te gusta ♥ · Quitar me gusta':'Me gusta'):(native?.active?'Guardado en Instagram ★ · Quitar':'Agregar a favoritos en Instagram'));
    }
    text(document.getElementById('fl-action-status'),['like','save'].map(kind=>state.actions.get(record.id+':'+kind)?.error).filter(Boolean).join(' '));
  }
  const current=()=>state.records.find(r=>r.id===state.selected)||state.records[0];
  function renderedKey(scope){
    if(!scope)return null;
    const links=[...scope.querySelectorAll('a[href]')];
    return links.map(a=>a.querySelector('time')&&!/\/c\//.test(a.pathname)?keyOf(a.href):null).find(Boolean)||links.map(a=>keyOf(a.href)).find(Boolean)||null;
  }
  const liveRecord=record=>Boolean(record?.article?.isConnected&&renderedKey(record.article)===keyOf(record.href));
  const galleryRecords=()=>state.records.filter(r=>r.author===current()?.author);
  function videoIn(scope){return scope?.querySelector('video')||(state.player?.record.article===scope?state.player.video:null);}
  function videoThumbnail(video){
    const poster=url(video?.poster,'image');if(poster)return poster;
    if(!video||video.readyState<2||!video.videoWidth)return null;
    try{const canvas=document.createElement('canvas');canvas.width=180;canvas.height=Math.round(180*video.videoHeight/video.videoWidth);canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',.65);}catch{return null;}
  }
  function media(node,key=null){
    const seen=new Set();
    return [...node.querySelectorAll('img')].filter(n=>! /perfil|profile|avatar/i.test(n.alt)&&(n.naturalWidth>120||n.width>120||/Photo|Foto/i.test(n.alt)))
      .filter(n=>!key||!keyOf(n.closest('a[href]')?.href)||keyOf(n.closest('a[href]')?.href)===key)
      .map(n=>({src:url(n.currentSrc||n.src,'image'),alt:n.alt})).filter(n=>n.src&&!seen.has(n.src)&&seen.add(n.src));
  }
  function caption(scope,author){
    const heading=scope.querySelector('h1');if(heading?.textContent.trim())return heading.textContent.trim();
    const readable=node=>{const copy=node.cloneNode(true);for(const br of copy.querySelectorAll('br'))br.replaceWith('\n');return copy.textContent.trim();};
    const anchors=[...scope.querySelectorAll('a[href]')].filter(a=>profile(a.href)===author&&!a.querySelector('img'));
    for(const anchor of anchors)for(let n=anchor.parentElement,i=0;n&&n!==scope&&i<9;n=n.parentElement,i++){
      const body=[...n.querySelectorAll('span')].find(s=>s.textContent.trim().length>25&&!s.querySelector('a,button,time,svg')&&![...s.querySelectorAll('span')].some(c=>c.textContent.trim().length>25));
      if(body)return readable(body);
      let value=n.textContent.trim().replace(/\s+/g,' ');if(value.startsWith(author))value=value.slice(author.length).trim();
      value=value.replace(/^Verificado\s*/,'').replace(/\s*\.\.\.\s*más$/,'…');
      if(value.length>25&&value.length<2400&&!n.querySelector('svg[aria-label="Me gusta"],video,time'))return value;
    }
    const paragraph=[...scope.querySelectorAll('p')].find(p=>p.querySelector('strong')?.textContent.trim()===author);
    return paragraph?readable(paragraph).replace(author,'').trim():'';
  }
  function recordFrom(scope,href,fallbackId){
    const key=keyOf(href),old=state.cache.get(key?'post:'+key:fallbackId);
    const author=[...scope.querySelectorAll('a[href]')].map(a=>profile(a.href)).find(Boolean)||old?.author||profile(location.href)||'fotolog';
    const video=videoIn(scope),photos=video?[]:media(scope,key);
    const poster=video&&(old?.photos[0]?.src||videoThumbnail(video));if(poster)photos.push({src:poster,alt:'Video de '+author});
    const stamp=[...scope.querySelectorAll('time')].find(t=>keyOf(t.closest('a[href]')?.href)===key)||scope.querySelector('time');
    return {id:key?'post:'+key:fallbackId,href:url(href)||site+'/'+author+'/',author,article:scope,photos:photos.length?photos:old?.photos||[],video,isVideo:!!video||old?.isVideo||/\/reels?\//.test(href||''),date:stamp?.getAttribute('datetime')||old?.date||'',caption:scope.querySelector('h1')?(scope.querySelector('h1').textContent||'').trim():caption(scope,author)||old?.caption||''};
  }
  function collect(){
    const source=main();if(!source)return [];
    const records=[...source.querySelectorAll('article')].filter(article=>article.querySelector('time,video')||state.player?.record.article===article).map((article,i)=>{
      const p=[...article.querySelectorAll('a[href]')].find(a=>keyOf(a.href));return recordFrom(article,p?.href,'feed:'+i);
    }).filter(r=>r.video||r.photos.length);
    const key=postKey(location.pathname);
    const dialog=[...document.querySelectorAll('[role="dialog"]')].filter(original).find(n=>n.querySelector('video')||n.querySelector('time'));
    if(key&&(dialog||!records.length)&&(dialog||source.querySelector('video,time')||state.player?.record.article===source)){
      const scope=dialog||source,actual=renderedKey(scope),href=actual&&actual!==key?site+'/p/'+actual+'/':location.href,record=recordFrom(scope,href,'post:'+(actual||key));
      if(record.video||record.photos.length)records.unshift(record);
    }
    for(const anchor of location.pathname==='/'?[]:source.querySelectorAll('a[href]')){
      if(!keyOf(anchor.href)||!anchor.querySelector('img'))continue;
      if(records.some(record=>record.id===idOf(anchor.href)))continue;
      const photos=media(anchor);if(!photos.length)continue;
      const parts=new URL(anchor.href).pathname.split('/').filter(Boolean),author=profile(location.href)||profile(site+state.contextPath)||(!reserved.has(parts[0])?parts[0]:'fotolog');
      records.push({id:idOf(anchor.href),href:url(anchor.href),author,photos,date:'',caption:anchor.querySelector('img')?.alt||'',article:null,anchor,isVideo:/\/reels?\//.test(anchor.pathname)});
    }
    return records;
  }
  function paletteFor(author){
    if(R.settings.theme!=='azar')return R.settings.theme;
    const colors=R.config.themes.filter(([key])=>key!=='azar').map(([key])=>key);
    let hash=2166136261;for(const letter of author.toLowerCase())hash=Math.imul(hash^letter.charCodeAt(0),16777619)>>>0;
    return colors[((hash%colors.length)+(Number(R.settings.paletteSeed)>>>0)%colors.length)%colors.length];
  }
  function shufflePalettes(){const count=R.config.themes.length-1,random=new Uint32Array(1);crypto.getRandomValues(random);R.save({paletteSeed:((Number(R.settings.paletteSeed)>>>0)+1+random[0]%(count-1))>>>0});}
  function themePicker(){
    const select=el('select',{id:'fl-theme-select','aria-label':'Colores del Fotolog',onchange:e=>{R.save({theme:e.target.value});e.target.closest('details').open=false;}},R.config.themes.map(([value,label])=>el('option',{value,text:label})));
    return el('details',{class:'fl-theme-picker'},[el('summary',{text:'Colores'}),el('div',{class:'fl-theme-panel'},[el('label',{for:'fl-theme-select',text:'Colores del Fotolog'}),select,el('p',{id:'fl-theme-note',text:'Cada usuario tiene su propia paleta. Se mantiene al volver a visitarlo.'}),button('Mezclar paletas',shufflePalettes,'fl-shuffle')])]);
  }
  const date=value=>value&&!Number.isNaN(Date.parse(value))?new Date(value).toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'2-digit'}):'';
  const validAuthor=name=>typeof name==='string'&&/^[a-zA-Z0-9._]{1,30}$/.test(name)&&!reserved.has(name);
  const favorites=()=>Array.isArray(R.settings.favorites)?[...new Set(R.settings.favorites.filter(validAuthor))].slice(0,30):[];
  async function recentProfiles(author){
    try{const response=await chrome.runtime.sendMessage({type:'fotolog-recents',...(author?{author}:{})});if(Array.isArray(response?.authors)){state.sessionVisited=response.authors.filter(validAuthor).slice(0,12);R.render();}}catch{/* Local fixtures and reloaded extension contexts use the in-document list. */}
  }
  function favorite(author){if(!validAuthor(author))return;const list=favorites();R.save({favorites:list.includes(author)?list.filter(n=>n!==author):[author,...list].slice(0,30)});}
  function navigate(path){
    releasePlayer();state.nativeTask=false;
    const anchor=[...document.querySelectorAll('a[href]')].find(a=>original(a)&&a.pathname===path&&(!a.hash||a.hash==='#')&&!a.closest('[disabled],[aria-disabled="true"]'));
    if(anchor)anchor.click();else location.assign(site+path);
  }
  function visitProfile(author){if(validAuthor(author))navigate('/'+author+'/');}
  function profileLink(author,cls=''){const a=link(author,site+'/'+author+'/',cls);a.addEventListener('click',e=>{if(e.button===0&&!e.metaKey&&!e.ctrlKey&&!e.shiftKey&&!e.altKey){e.preventDefault();visitProfile(author);}});return a;}
  function home(){
    releasePlayer();state.view='home';state.nativeTask=false;
    if(location.pathname==='/')R.render();else navigate('/');
    document.getElementById('fl-app')?.scrollIntoView({block:'start'});
  }
  function thumbnail(record,alt=''){
    return record.photos[0]?.src?el('img',{src:record.photos[0].src,alt,loading:'lazy'}):el('span',{class:'fl-video-thumb',text:'▶','aria-label':'Reel de '+record.author});
  }
  function sidebar(selected){
    const name=selected?.author||'',homeView=state.view==='home';
    const recent=[...new Set([...state.sessionVisited,...[...state.visited.keys()].reverse()])].map(author=>state.visited.get(author)||state.directory.get(author)||{author,photos:[]});
    const authors=homeView?[...state.directory.values()]:recent;
    const list=authors.filter(r=>r.author!==name||homeView).slice(0,8),saved=favorites();
    const holder=document.getElementById(homeView?'fl-home-sidebar':'fl-friends'),sig=JSON.stringify([homeView,name,saved,list.map(r=>[r.author,r.photos[0]?.src])]);
    if(holder.dataset.signature===sig)return;holder.dataset.signature=sig;
    const nodes=[];
    if(!homeView&&selected){nodes.push(el('section',{class:'fl-side-section'},[el('h3',{text:'Este Fotolog'}),profileLink(name,'fl-side-owner'),button(saved.includes(name)?'★ En mis favoritos':'☆ Agregar a mis favoritos',()=>favorite(name),'fl-pin'),link('Ver todas sus publicaciones',site+'/'+name+'/','fl-all-posts')]));nodes.at(-1).querySelector('.fl-all-posts').addEventListener('click',e=>{e.preventDefault();visitProfile(name);});}
    nodes.push(el('section',{class:'fl-side-section'},[el('h3',{text:'Mis favoritos'}),...(saved.length?saved.map(author=>el('div',{class:'fl-favorite-row'},[profileLink(author),button('×',()=>favorite(author),'fl-unpin')])):[el('p',{class:'fl-side-note',text:'Guardá los Fotologs que te gustan para volver desde acá.'})])]));
    if(list.length)nodes.push(el('section',{class:'fl-side-section'},[el('h3',{text:homeView?'Fotologs de tu inicio':'Visitados recientemente'}),...list.map(record=>{const a=profileLink(record.author,'fl-friend');a.prepend(record.photos[0]?.src?thumbnail(record,''):el('span',{class:'fl-user-badge',text:record.author[0].toUpperCase(),'aria-hidden':true}));return a;})]));
    nodes.push(el('section',{class:'fl-side-section'},[el('h3',{text:'Seguí recorriendo'}),button('Página de inicio',home),button('Buscar Fotologs',()=>sourceAction(/^Buscar$|^Search$/i))]));
    holder.replaceChildren(...nodes);
  }
  function homeContent(){
    const records=state.records.filter(r=>state.homeFilter==='all'||(state.homeFilter==='reels'?r.isVideo:!r.isVideo));
    const holder=document.getElementById('fl-home-posts'),sig=JSON.stringify([state.homeFilter,records.map(r=>[r.id,r.author,r.photos[0]?.src,r.caption])]);
    for(const tab of document.querySelectorAll('[data-fl-filter]'))tab.setAttribute('aria-pressed',String(tab.dataset.flFilter===state.homeFilter));
    text(document.getElementById('fl-home-count'),state.records.length+' publicaciones');
    if(holder.dataset.signature===sig)return;holder.dataset.signature=sig;
    holder.replaceChildren(...records.map(record=>{
      const preview=link('',record.href,'fl-home-preview');preview.append(thumbnail(record,(record.isVideo?'Reel':'Foto')+' de '+record.author));preview.addEventListener('click',e=>{e.preventDefault();select(record.id);});
      return el('article',{class:'fl-home-entry'},[preview,el('div',{class:'fl-entry-text'},[el('div',{class:'fl-entry-heading'},[profileLink(record.author),el('small',{text:[record.isVideo?'REEL':'FOTO',date(record.date)].filter(Boolean).join(' · ')})]),el('h3',{class:'fl-entry-title',text:entryTitle(record.caption)}),el('p',{text:record.caption||'Una nueva publicación en su Fotolog.'}),el('div',{class:'fl-entry-links'},[button(record.isVideo?'▶ Ver reel':'Ver foto',()=>select(record.id)),profileLink(record.author,'fl-entry-profile')])])]);
    }));
    for(const a of holder.querySelectorAll('.fl-entry-profile'))text(a,'Visitar su Fotolog');
    if(!records.length)holder.append(el('p',{class:'fl-home-empty',text:'Todavía no hay publicaciones en esta sección.'}));
  }
  function releasePlayer(){
    const player=state.player;if(!player)return;state.player=null;
    player.video.pause();for(const [event,handler]of player.events)player.video.removeEventListener(event,handler);
    player.video.controls=player.controls;player.video.autoplay=player.autoplay;player.video.playsInline=player.playsInline;
    if(player.label===null)player.video.removeAttribute('aria-label');else player.video.setAttribute('aria-label',player.label);
    player.video.removeAttribute('data-fl-player');
    if(player.placeholder.parentNode)player.placeholder.replaceWith(player.video);else player.video.remove();
  }
  function syncPlayer(){
    const video=state.player?.video,play=document.getElementById('fl-play'),sound=document.getElementById('fl-sound');if(!play)return;
    text(play,video?(video.paused?'▶ Reproducir':'Ⅱ Pausar'):state.loading?'Cargando reel…':'▶ Reproducir reel');
    play.disabled=Boolean(state.loading&&!video);sound.hidden=!video;text(sound,video?.muted?'Activar sonido':'Silenciar');
  }
  function mountPlayer(record){
    const candidate=liveRecord(record)&&(record.video||videoIn(record.article)),video=candidate?.isConnected?candidate:null,slot=document.getElementById('fl-video-slot');
    if(state.player&&(state.player.video!==video||!state.player.video.isConnected))releasePlayer();
    if(!video||state.nativeTask){releasePlayer();slot.hidden=true;return false;}
    if(!state.player){
      const placeholder=own(el('span',{'data-fl-video-placeholder':''}));video.before(placeholder);video.pause();
      const player={video,record,placeholder,controls:video.controls,autoplay:video.autoplay,playsInline:video.playsInline,label:video.getAttribute('aria-label'),events:[]};state.player=player;
      video.controls=true;video.autoplay=true;video.playsInline=true;video.muted=true;video.setAttribute('data-fl-player','');video.setAttribute('aria-label','Reel de '+record.author);slot.append(video);
      // Native media controls live in the browser's shadow tree. Their play action
      // need not dispatch pointer/key events on <video>; never veto a play event.
      for(const event of ['play','pause','volumechange','ended','loadedmetadata','loadeddata','error']){const handler=()=>{syncPlayer();if(event==='loadeddata'&&!record.photos.length)setTimeout(R.render,0);if(event==='error')text(document.getElementById('fl-media-status'),'No se pudo reproducir. Podés reintentar o abrir la publicación.');};video.addEventListener(event,handler);player.events.push([event,handler]);}
      video.play().catch(()=>syncPlayer());
    }
    slot.hidden=false;syncPlayer();return true;
  }
  function loadRecord(record,action=null){
    if(!record||state.loading===record.id)return;
    releasePlayer();state.loading=record.id;state.pendingAction=action;
    // Use the real site's link handler so its authenticated player and carousel load normally.
    const anchor=record.anchor?.isConnected?record.anchor:[...document.querySelectorAll('a[href]')].find(a=>original(a)&&keyOf(a.href)===keyOf(record.href)&&/\/(?:p|reels?)\/[^/]+\/?$/.test(a.pathname));
    if(anchor){anchor.click();R.render();}
    else if(keyOf(location.href)===keyOf(record.href)){state.loading=null;R.render();}
    else location.assign(record.href);
  }
  function select(id){
    releasePlayer();state.view='diary';state.selected=id;state.photo=0;state.loading=null;state.autoOpened=id;state.pendingAction=null;R.render();
    const record=current();if(record&&!liveRecord(record))loadRecord(record);
    document.getElementById('fl-diary-heading')?.scrollIntoView({block:'start'});
  }
  function play(){const video=state.player?.video;if(video){if(video.paused){video.play().catch(()=>text(document.getElementById('fl-media-status'),'Tocá reproducir en el video para continuar.'));}else video.pause();}else loadRecord(current());}
  function sourceAction(pattern,query=''){
    const target=[...document.querySelectorAll('a,button,[role="button"]')].filter(original).find(n=>pattern.test(n.getAttribute('aria-label')||n.querySelector('svg[aria-label]')?.getAttribute('aria-label')||''));
    if(!target){location.assign(site+'/explore/');return;}
    releasePlayer();state.nativeTask=true;R.render();target.click();
    if(query){let count=0;const fill=()=>{const input=[...document.querySelectorAll('input')].find(n=>original(n)&&/buscar|search/i.test(n.placeholder+' '+(n.getAttribute('aria-label')||'')));if(input){Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,query);input.dispatchEvent(new Event('input',{bubbles:true}));input.focus();}else if(++count<15)setTimeout(fill,150);};fill();}
  }
  function postAction(kind){
    const record=current();if(!record)return;
    if(!liveRecord(record)){loadRecord(record,kind);return;}
    const native=kind==='comment'?{target:control(record.article,actionPatterns.comment)}:nativeAction(record,kind);
    const target=native?.target,key=record.id+':'+kind;
    if(!target?.isConnected||target.disabled||target.getAttribute('aria-disabled')==='true'){
      state.actions.set(key,{error:'No se encontró un control disponible. Abrí la publicación en Instagram.'});R.render();return;
    }
    if(kind==='comment'){releasePlayer();state.nativeTask=true;R.render();target.click();return;}
    const previous=state.actions.get(key);if(previous&&!previous.error)return;
    state.actions.set(key,{expected:!native.active,started:Date.now()});
    // Confirm only from Instagram's resulting state; never assume click means success.
    try{target.click();}catch{state.actions.set(key,{error:'No se pudo aplicar el cambio. Reintentá en Instagram.'});}
    R.render();setTimeout(R.render,250);setTimeout(R.render,5100);
  }
  function more(){
    const source=main(),last=source?.querySelector('article:last-of-type')||[...(source?.querySelectorAll('a[href]')||[])].filter(a=>keyOf(a.href)&&a.querySelector('img')).at(-1);
    last?.scrollIntoView({block:'end'});root(source)?.scrollTo({top:root(source).scrollHeight});
    const status=document.getElementById('fl-empty');text(status,'Buscando más publicaciones…');status.hidden=false;
  }
  function step(direction){const records=galleryRecords(),i=records.findIndex(r=>r.id===current()?.id),next=records[i+direction];if(next)select(next.id);else if(direction>0)more();}
  function user(){return [...document.querySelectorAll('a[href]')].filter(a=>original(a)&&a.querySelector('img[alt*="perfil"],img[alt*="profile"]')&&!a.closest('main,article')).map(a=>profile(a.href)).find(Boolean);}
  function shell(){
    if(document.getElementById('fl-app'))return;
    const input=el('input',{type:'search',name:'q',placeholder:'Buscar','aria-label':'Buscar un Fotolog',maxlength:100});
    const search=el('form',{class:'fl-search',onsubmit:e=>{e.preventDefault();sourceAction(/^Buscar$|^Search$/i,input.value.trim());}},[el('div',{},[input,el('button',{type:'submit',text:'Go'})]),el('small',{text:'Buscar Fotologs en Instagram'})]);
    const logo=link('',site+'/','fl-wordmark');logo.setAttribute('aria-label','Fotolog, inicio');logo.addEventListener('click',e=>{e.preventDefault();home();});logo.append(el('span',{class:'fl-logo-square','aria-hidden':true}),el('span',{text:'FOTOLOG'}),el('sup',{text:'®'}));
    const app=own(el('div',{id:'fl-app'},[
      el('header',{class:'fl-header'},[logo,search,el('nav',{'aria-label':'Tu Fotolog',class:'fl-header-links'},[el('div',{},[button('Inicio',home),' · ',link('Mi Fotolog',site+'/','fl-account-link')]),button('Subir una foto',()=>sourceAction(/Nueva publicación|New post|Create/i)),link('Mensajes',site+'/direct/inbox/'),themePicker(),button('Volver a Instagram',()=>R.save({enabled:false}))])]),
      el('section',{id:'fl-home'},[
        el('div',{class:'fl-home-heading'},[el('h1',{text:'Tu página de inicio'}),el('p',{text:'Pasá, mirá las fotos nuevas y visitá otros Fotologs.'})]),
        el('div',{class:'fl-home-layout'},[
          el('aside',{class:'fl-home-menu','aria-label':'Recorrer Fotolog'},[el('h2',{text:'Mi cuenta'}),link('Mi Fotolog',site+'/','fl-account-link'),button('Subir una foto',()=>sourceAction(/Nueva publicación|New post|Create/i)),link('Mensajes',site+'/direct/inbox/'),el('h2',{text:'Recorrer'}),button('Buscar Fotologs',()=>sourceAction(/^Buscar$|^Search$/i)),el('p',{text:'Los mejores viajes empiezan visitando otro Fotolog.'})]),
          el('section',{class:'fl-home-feed','aria-label':'Publicaciones de tu inicio'},[el('div',{class:'fl-home-feed-heading'},[el('h2',{text:'Últimas publicaciones'}),el('span',{id:'fl-home-count'})]),el('nav',{class:'fl-home-filters','aria-label':'Filtrar publicaciones'},[['all','Todas'],['photos','Fotos'],['reels','Reels']].map(([value,label])=>{const b=button(label,()=>{state.homeFilter=value;R.render();});b.dataset.flFilter=value;return b;})),el('div',{id:'fl-home-posts'}),button('Ver más publicaciones »',more,'fl-home-more')]),
          el('aside',{id:'fl-home-sidebar','aria-label':'Favoritos y Fotologs de tu inicio'})])]),
      el('nav',{id:'fl-diary-breadcrumb','aria-label':'Volver al inicio'},[button('« Página de inicio',home)]),
      el('section',{id:'fl-diary-heading'},[el('h1',{id:'fl-title'}),el('p',{id:'fl-byline'})]),
      el('div',{class:'fl-diary-grid'},[
        el('aside',{class:'fl-recent-rail','aria-label':'Publicaciones recientes'},[el('h2',{text:'Fotos Recientes de'}),el('a',{id:'fl-owner',href:site+'/',text:'mis favoritos'}),el('div',{id:'fl-recent'}),button('Más publicaciones »',more)]),
        el('section',{class:'fl-photo-column','aria-label':'Publicación del día'},[
          el('nav',{class:'fl-photo-navigation','aria-label':'Navegar por las publicaciones'},[button('« Anterior',()=>step(-1)),button('Siguiente »',()=>step(1))]),
          el('figure',{class:'fl-photo-frame'},[el('a',{id:'fl-photo-link',href:site+'/',title:'Ver esta publicación',onclick:e=>{e.preventDefault();const record=current();if(record?.isVideo)play();else if(!record?.article?.isConnected)loadRecord(record);}},[el('img',{id:'fl-photo',alt:'',decoding:'async'})]),el('div',{id:'fl-video-slot',hidden:true}),el('div',{id:'fl-player-controls'},[button('▶ Reproducir reel',play),button('Activar sonido',()=>{const video=state.player?.video;if(video)video.muted=!video.muted;})]),el('p',{id:'fl-media-status','aria-live':'polite'}),el('div',{id:'fl-carousel'})]),
          el('p',{id:'fl-photo-date',class:'fl-date'}),
          el('nav',{class:'fl-actions','aria-label':'Acciones de la publicación'},[button('Firmar',()=>postAction('comment')),button('Me gusta',()=>postAction('like'),'fl-like'),button('Agregar a favoritos en Instagram',()=>postAction('save'),'fl-save'),el('a',{id:'fl-original-post',href:site+'/',text:'Ver publicación'})]),
          el('p',{id:'fl-action-status','aria-live':'polite',role:'status'}),el('p',{id:'fl-caption'}),
          el('section',{class:'fl-guestbook'},[el('h2',{text:'Libro de visitas'}),el('p',{text:'Pasá y dejá tu firma :)'}),button('Firmar el libro de visitas',()=>postAction('comment'))]),
          el('p',{id:'fl-empty',text:'Cargando las publicaciones de tus amigos…'})]),
        el('aside',{class:'fl-friends-rail','aria-label':'Favoritos y perfiles visitados'},[el('div',{id:'fl-friends'})])]),
      el('footer',{class:'fl-footer'},[link('Inicio',site+'/'),' · ',link('Mi Fotolog',site+'/','fl-account-link'),' · ',button('Buscar Fotologs',()=>sourceAction(/^Buscar$|^Search$/i))])
    ]));
    app.querySelector('#fl-player-controls button:first-child').id='fl-play';app.querySelector('#fl-player-controls button:last-child').id='fl-sound';
    document.body.prepend(app,own(el('div',{id:'fl-return-bar'},[button('« Volver a mi Fotolog',()=>{state.nativeTask=false;R.render();}),el('span',{text:'Buscar · Crear · Configurar'})])));
  }
  function rails(records,selected){
    const index=Math.max(0,records.findIndex(r=>r.id===selected?.id)),start=Math.max(0,index-8),visible=records.slice(start,start+12);
    const recent=document.getElementById('fl-recent'),sig=visible.map(r=>r.id+(r.photos[0]?.src||'')+r.isVideo).join('|');
    if(recent.dataset.signature!==sig){recent.dataset.signature=sig;recent.replaceChildren(...visible.map(r=>{const a=link('',r.href,'fl-thumb');a.dataset.post=r.id;a.addEventListener('click',e=>{e.preventDefault();select(r.id);});a.append(thumbnail(r,(r.isVideo?'Reel':'Foto')+' de '+r.author),el('span',{text:(r.isVideo?'▶ ':'')+(date(r.date)||r.author)}));return a;}));}
    for(const a of recent.children)a.setAttribute('aria-current',String(a.dataset.post===selected?.id));
  }
  function markSources(){
    const nodes=[root(main()),...[...document.querySelectorAll('[role="dialog"]')].filter(original).map(root)];
    for(const node of new Set(nodes.filter(Boolean))){mark(node,'data-fl-native-root');if(!state.roots.has(node))state.roots.set(node,Boolean(node.inert));}
    for(const [node,inert]of state.roots){node.inert=state.nativeTask?inert:true;if(!node.isConnected)state.roots.delete(node);}
  }
  // Restore before React handles browser navigation, while its original parent still exists.
  addEventListener('popstate',releasePlayer,true);addEventListener('pagehide',releasePlayer);
  recentProfiles();
  R.start({
    supported(){return Boolean(main())&&!document.querySelector('input[type="password"]')&&!/^\/(accounts|direct|stories|challenge|oauth|emails|settings|consent|privacy)\b/.test(location.pathname)&&!/^\/reels?\/?$/.test(location.pathname)&&(collect().length>0||(location.pathname==='/'&&state.homeCache.size>0)||(state.cache.size>0&&(state.path===location.pathname||postKey(location.pathname)||state.contextPath===location.pathname)));},
    render(){
      if(state.path!==location.pathname){
        const key=postKey(location.pathname),known=key&&state.cache.has('post:'+key),back=state.contextPath===location.pathname;
        if(location.pathname==='/'||(!known&&!back)){releasePlayer();state.selected=null;state.photo=0;state.cache=location.pathname==='/'?new Map(state.homeCache):new Map();state.loading=null;state.autoOpened=null;state.contextPath=key?'':location.pathname;}
        state.path=location.pathname;state.view=location.pathname==='/'?'home':'diary';if(known&&!state.nativeTask)state.selected='post:'+key;
      }
      markSources();
      if(location.pathname==='/'&&!state.cache.size&&state.homeCache.size)state.cache=new Map(state.homeCache);
      for(const record of collect()){
        const previous=state.cache.get(record.id);state.cache.set(record.id,{...previous,...record,anchor:record.anchor||previous?.anchor,photos:record.photos.length?record.photos:previous?.photos||[]});
        const summary={...record,article:null,video:null,anchor:null};
        if(validAuthor(record.author)){state.directory.set(record.author,summary);while(state.directory.size>30)state.directory.delete(state.directory.keys().next().value);}
        if(location.pathname==='/'){state.homeCache.set(record.id,summary);while(state.homeCache.size>200)state.homeCache.delete(state.homeCache.keys().next().value);}
        if(state.loading===record.id&&liveRecord(record)){state.loading=null;if(state.pendingAction){const action=state.pendingAction;state.pendingAction=null;setTimeout(()=>{if(R.settings.enabled&&current()?.id===record.id)postAction(action);},0);}}
      }
      while(state.cache.size>200)state.cache.delete(state.cache.keys().next().value);
      state.records=[...state.cache.values()];if(!state.records.some(r=>r.id===state.selected))state.selected=(state.records.find(r=>keyOf(r.href)===postKey(location.pathname))||state.records[0])?.id||null;
      shell();const selected=current(),account=user();
      document.documentElement.setAttribute('data-retro-page',state.view);document.documentElement.setAttribute('data-retro-native-task',String(state.nativeTask));
      for(const a of document.querySelectorAll('.fl-account-link'))a.href=account?site+'/'+account+'/':site+'/';
      text(document.getElementById('fl-title'),entryTitle(selected?.caption));
      const byline=document.getElementById('fl-byline'),name=selected?.author||profile(location.href)||account||'Mis favoritos';
      document.documentElement.setAttribute('data-retro-palette',state.view==='home'?'papel':paletteFor(name));
      const themeSelect=document.getElementById('fl-theme-select');if(themeSelect.value!==R.settings.theme)themeSelect.value=R.settings.theme;
      document.getElementById('fl-theme-note').hidden=R.settings.theme!=='azar';document.querySelector('.fl-shuffle').hidden=R.settings.theme!=='azar';
      if(byline.dataset.author!==name){byline.dataset.author=name;const a=profileLink(name);text(a,'/'+name);byline.replaceChildren(a);}
      const owner=document.getElementById('fl-owner'),ownerName=profile(site+state.contextPath)||profile(location.href)||selected?.author;text(owner,ownerName||'mis favoritos');owner.href=ownerName?site+'/'+ownerName+'/':site+'/';
      document.getElementById('fl-empty').hidden=Boolean(selected);document.querySelector('.fl-photo-frame').hidden=!selected;document.querySelector('.fl-guestbook').hidden=!selected;
      if(selected&&state.view==='diary'){
        const hasVideo=mountPlayer(selected),photo=selected.photos[state.photo]||selected.photos[0],image=document.getElementById('fl-photo');
        document.getElementById('fl-photo-link').hidden=hasVideo||!photo;if(photo){if(image.getAttribute('src')!==photo.src)image.src=photo.src;image.alt=photo.alt||'Foto de '+selected.author;}
        document.getElementById('fl-photo-link').href=selected.href;document.getElementById('fl-original-post').href=selected.href;
        document.getElementById('fl-player-controls').hidden=!selected.isVideo&&!hasVideo;
        text(document.getElementById('fl-media-status'),state.loading?'Cargando la publicación…':'');syncPlayer();
        if(selected.isVideo&&!liveRecord(selected)&&!state.nativeTask&&!postKey(location.pathname)&&state.autoOpened!==selected.id){
          state.autoOpened=selected.id;
          setTimeout(()=>{if(R.settings.enabled&&!state.nativeTask&&current()?.id===selected.id)loadRecord(current());},0);
        }
        text(document.getElementById('fl-photo-date'),date(selected.date));text(document.getElementById('fl-caption'),selected.caption);syncActions(selected);
        const carousel=document.getElementById('fl-carousel'),sig=selected.id+selected.photos.length+':'+state.photo;
        if(carousel.dataset.signature!==sig){carousel.dataset.signature=sig;carousel.replaceChildren(...(!hasVideo&&selected.photos.length>1?selected.photos.map((p,i)=>button(String(i+1),()=>{state.photo=i;R.render();},i===state.photo?'fl-current-photo':'')):[]));}
      }else releasePlayer();
      if(!state.nativeTask)for(const video of document.querySelectorAll('video'))if(video!==state.player?.video&&!video.paused)video.pause();
      if(state.view==='home')homeContent();
      else if(selected){state.visited.delete(selected.author);state.visited.set(selected.author,{...selected,article:null,video:null,anchor:null});while(state.visited.size>12)state.visited.delete(state.visited.keys().next().value);if(state.lastVisit!==selected.author){state.lastVisit=selected.author;recentProfiles(selected.author);}}
      rails(galleryRecords(),selected);sidebar(selected);
    },
    beforeClear:releasePlayer,
    refresh(){if(state.loading||[...state.actions.values()].some(action=>!action.error))R.render();},
    cleanup(){releasePlayer();for(const [node,inert]of state.roots)node.inert=inert;state.roots.clear();state.records=[];state.cache.clear();if(!R.settings.enabled){state.homeCache.clear();state.directory.clear();state.visited.clear();}state.actions.clear();state.nativeTask=false;state.loading=null;state.pendingAction=null;state.autoOpened=null;}
  });
})();
