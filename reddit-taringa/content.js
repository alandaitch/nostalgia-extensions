/* Taringa's white, striped index from Alan's reference, with the blue header. */
(() => {
  'use strict';
  const R=globalThis.RetroSkin,{el,own,mark,text,url}=R,site='https://www.reddit.com';
  const state={path:'',posts:[],cache:new Map(),feeds:new Map(),filter:'all',rows:new Map(),root:null,priorInert:false};
  const link=(label,href,cls='')=>el('a',{href,text:label,class:cls});
  const button=(label,fn,cls='')=>el('button',{type:'button',text:label,onclick:fn,class:cls});
  const isPost=()=>location.pathname.includes('/comments/');
  const isDirectory=()=>/^\/subreddits(?:\/|$)/.test(location.pathname);
  // Empty communities and their information tabs still need usable native controls.
  const isCommunity=()=>/^\/r\/[^/]+(?:\/(?:hot|new|top|rising|about)(?:\/.*)?)?\/?$/.test(location.pathname);
  function navigation(directory){
    for(const a of document.querySelectorAll('#rt-app .rt-primary>a')){
      const selected=directory?a.pathname==='/subreddits/':a.textContent==='Posts';
      a.classList.toggle('rt-selected',selected);
      if(selected)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');
    }
  }
  function source(){return document.querySelector('shreddit-app')||document.querySelector('body>.content');}
  function collect(){
    return [...document.querySelectorAll('shreddit-post,shreddit-ad-post')].filter(n=>!n.closest('[data-retro-owned]')).map((node,i)=>{
      const promoted=node.tagName==='SHREDDIT-AD-POST'||node.hasAttribute('promoted');
      const title=node.getAttribute('post-title')||node.querySelector('[slot="title"]')?.textContent?.trim()||'';
      const href=url(node.getAttribute('permalink'))||url(node.querySelector('[slot="title"]')?.getAttribute('href'));
      const image=node.querySelector('[slot="post-media-container"] img, img[alt^="r/"]');
      return {id:node.id||node.getAttribute('permalink')||title+':'+i,title,href,sub:node.getAttribute('subreddit-prefixed-name')||'',author:node.getAttribute('author')||'',score:node.getAttribute('score'),comments:node.getAttribute('comment-count'),type:node.getAttribute('post-type')||'text',image:url(image?.currentSrc||image?.src,'image'),node,promoted};
    }).filter(p=>p.title);
  }
  function panel(title,id,cls=''){return el('section',{class:'rt-panel '+cls},[el('h2',{},[title]),el('div',{id,class:'rt-panel-body'})]);}
  function searchForm(){return el('form',{action:site+'/search/',method:'get',class:'rt-search'},[el('input',{name:'q',type:'search',placeholder:'Buscar','aria-label':'Buscar posts en Reddit',required:true}),el('button',{type:'submit',text:'Buscar'})]);}
  function shell(){
    if(document.getElementById('rt-app'))return;
    const categories=el('select',{id:'rt-category','aria-label':'Filtrar por comunidad',onchange:e=>{state.filter=e.target.value;R.render();}},[el('option',{value:'all',text:'Seleccionar categoría'})]);
    const app=own(el('div',{id:'rt-app'},[
      el('header',{class:'rt-header'},[el('div',{class:'rt-brand'},[link('TARINGA!',site+'/','rt-wordmark'),el('span',{class:'rt-slogan',text:'INTELIGENCIA COLECTIVA'})]),el('nav',{class:'rt-user-links','aria-label':'Tu cuenta'},[link('✉',site+'/notifications/','rt-mail'),link('★',site+'/user/me/saved/','rt-favorite'),link('Mi cuenta ▾',site+'/user/me/'),button('Volver a Reddit',()=>R.save({enabled:false}))]),searchForm()]),
      el('nav',{class:'rt-primary','aria-label':'Taringa'},[link('⌂',site+'/','rt-home'),link('Posts',site+'/','rt-selected'),link('Comunidades',site+'/subreddits/'),link('Música',site+'/r/Music/'),link('Juegos',site+'/r/gaming/'),link('TOPs',site+'/top/')]),
      el('nav',{class:'rt-secondary','aria-label':'Orden del feed'},[link('Inicio',site+'/','rt-current'),link('Novatos',site+'/new/'),link('Destacados',site+'/top/?t=day'),link('✚ Crear post',site+'/submit','rt-create'),link('Historial',site+'/user/me/history/')]),
      el('div',{id:'rt-classic-content',class:'rt-columns'},[
        el('section',{class:'rt-index-column'},[el('div',{class:'rt-panel rt-list-panel'},[el('div',{class:'rt-list-header'},[el('h1',{id:'rt-list-heading',text:'Recientes'}),categories]),el('div',{id:'rt-post-list'}),el('p',{id:'rt-empty',text:'Cargando los últimos posts…'}),button('Siguientes posts »',loadMore,'rt-more')])]),
        el('aside',{class:'rt-middle-column','aria-label':'Buscador y comunidad'},[
          panel('Estadísticas','rt-stats'),link('Taringa! en vivo',site+'/new/','rt-live'),panel('Comunidades','rt-communities'),panel('Aportes recientes','rt-latest'),
        ]),
        el('aside',{class:'rt-right-column','aria-label':'Destacados'},[link('Los TOPs de hoy',site+'/top/?t=day','rt-top-banner'),panel('Destacados','rt-featured'),panel('Accesos','rt-access'),panel('Categorías','rt-categories')]),
      ]),
      el('footer',{class:'rt-footer'},[link('Inicio',site+'/'),' - ',link('TOPs',site+'/top/'),' - ',link('Comunidades',site+'/subreddits/'),' - ',link('Agregar post',site+'/submit')]),
    ]));
    document.body.prepend(app);
    document.querySelector('.rt-mail').setAttribute('aria-label','Mensajes y notificaciones');document.querySelector('.rt-favorite').setAttribute('aria-label','Mis favoritos');document.querySelector('.rt-home').setAttribute('aria-label','Inicio de Taringa');
    document.getElementById('rt-access').append(link('Mis favoritos',site+'/user/me/saved/'),link('Crear un post',site+'/submit'),link('Mi perfil',site+'/user/me/'),link('Mensajes y notificaciones',site+'/notifications/'));
  }
  function row(post){
    let node=state.rows.get(post.id);
    if(!node){
      const icon=el('span',{class:'rt-type-icon','aria-hidden':true});
      const anchor=post.href?link('',post.href,'rt-post-title'):el('button',{type:'button',class:'rt-post-title',onclick:()=>post.node?.shadowRoot?.querySelector('a[slot="title"],a')?.click()});
      node=el('div',{class:'rt-post-row'},[icon,anchor,el('small',{class:'rt-row-detail'})]);node.dataset.postId=post.id;state.rows.set(post.id,node);
    }
    node.dataset.kind=post.promoted?'ad':post.type;
    node.classList.toggle('rt-promoted',post.promoted);
    const title=node.querySelector('.rt-post-title');text(title,post.title);title.title=[post.title,post.sub,post.author&&'por '+post.author,post.score!==null&&post.score+' puntos',post.comments!==null&&post.comments+' comentarios'].filter(Boolean).join(' · ');
    text(node.querySelector('.rt-row-detail'),post.promoted?'Patrocinado':post.sub.replace(/^r\//,''));
    return node;
  }
  function renderRows(posts){
    const list=document.getElementById('rt-post-list'),filtered=posts.filter(p=>state.filter==='all'||p.sub===state.filter);
    const wanted=filtered.map(row),set=new Set(wanted);
    for(const node of [...list.children])if(!set.has(node))node.remove();
    wanted.forEach((node,i)=>{if(list.children[i]!==node)list.insertBefore(node,list.children[i]||null);});
    for(const [id]of state.rows)if(!posts.some(p=>p.id===id))state.rows.delete(id);
    document.getElementById('rt-empty').hidden=Boolean(filtered.length);
    document.getElementById('rt-more-status')?.remove();
    const heading=location.pathname.match(/^\/r\/([^/]+)/)?.[1];
    const label=heading?'Posts de '+heading:location.pathname.includes('/top')?'TOPs':'Recientes';
    const h=document.getElementById('rt-list-heading');if(h.firstChild.nodeType===3)h.firstChild.textContent=label;
  }
  function sidebars(posts){
    const organic=posts.filter(p=>!p.promoted),communities=[...new Set(organic.map(p=>p.sub).filter(Boolean))];
    const select=document.getElementById('rt-category'),sig=communities.join('|');
    if(select.dataset.signature!==sig){select.dataset.signature=sig;select.replaceChildren(el('option',{value:'all',text:'Seleccionar categoría'}),...communities.map(c=>el('option',{value:c,text:c.replace(/^r\//,'')})));select.value=state.filter;}
    const stats=document.getElementById('rt-stats'),comments=organic.reduce((sum,p)=>sum+(Number(p.comments)||0),0);
    const statSignature=[organic.length,communities.length,comments].join('|');
    if(stats.dataset.signature!==statSignature){stats.dataset.signature=statSignature;stats.replaceChildren(el('div',{class:'rt-stat-grid'},[el('span',{},[el('strong',{text:organic.length}),' posts cargados']),el('span',{},[el('strong',{text:communities.length}),' comunidades']),el('span',{},[el('strong',{text:comments.toLocaleString('es-AR')}),' comentarios']),el('span',{text:'en este feed',class:'rt-stat-note'})]));}
    const communityNode=document.getElementById('rt-communities');
    if(communityNode.dataset.signature!==sig){communityNode.dataset.signature=sig;communityNode.replaceChildren(...communities.slice(0,14).map(c=>link(c.replace(/^r\//,''),site+'/'+c+'/')));document.getElementById('rt-categories').replaceChildren(...communities.slice(0,9).map(c=>link(c.replace(/^r\//,''),site+'/'+c+'/')));}
    const top=organic.slice().sort((a,b)=>Number(b.score)-Number(a.score)).slice(0,5),topSig=top.map(p=>p.id+p.score).join('|');
    const featured=document.getElementById('rt-featured');
    if(featured.dataset.signature!==topSig){featured.dataset.signature=topSig;featured.replaceChildren(...top.map((p,i)=>{const a=link('',p.href||site+'/','rt-feature');a.append(el('span',{class:'rt-feature-number',text:String(i+1)}),el('span',{text:p.title}),el('small',{text:p.score+' puntos'}));return a;}));}
    const latest=document.getElementById('rt-latest'),latestSig=organic.slice(0,10).map(p=>p.id).join('|');
    if(latest.dataset.signature!==latestSig){latest.dataset.signature=latestSig;latest.replaceChildren(...organic.slice(0,10).map(p=>el('div',{class:'rt-latest-item'},[el('strong',{text:(p.author||p.sub)+' '}),link(p.title,p.href||site+'/')])));}
  }
  function loadMore(){
    const nodes=[...document.querySelectorAll('shreddit-post')];nodes.at(-1)?.scrollIntoView({block:'end'});
    // Reddit's loading sentinel can sit below the final post and its footer.
    state.root?.scrollTo({top:state.root.scrollHeight,behavior:'auto'});
    const load=document.querySelector('#rt-app .rt-more');text(load,'Cargando posts…');const count=state.posts.length;
    setTimeout(()=>{if(state.posts.length<=count)text(load,'Reintentar cargar más »');else text(load,'Siguientes posts »');},1800);
  }
  R.start({
    supported(){return location.hostname!=='old.reddit.com'&&!/^\/(login|register|account|settings|chat|message|notifications|submit|appeal)\b/.test(location.pathname)&&Boolean(source())&&(isDirectory()||isCommunity()||isPost()||collect().length>0||state.feeds.has(location.pathname+location.search)||(state.path===location.pathname+location.search&&state.cache.size>0));},
    render(){
      const path=location.pathname+location.search;
      if(state.path!==path){
        if(state.path&&!state.path.includes('/comments/')&&state.cache.size){
          // Keep only metadata across routes; detached React trees stay collectible.
          state.feeds.delete(state.path);
          state.feeds.set(state.path,new Map([...state.cache].map(([id,p])=>[id,{...p,node:null}])));
          while(state.feeds.size>3)state.feeds.delete(state.feeds.keys().next().value);
        }
        state.path=path;state.filter='all';state.rows.clear();state.cache=new Map(state.feeds.get(path)||[]);
      }
      const nativeRoot=source();mark(nativeRoot,'data-rt-native-root');shell();
      if(state.root!==nativeRoot){if(state.root)state.root.inert=state.priorInert;state.root=nativeRoot;state.priorInert=Boolean(nativeRoot.inert);}
      const thread=isPost(),directory=isDirectory(),nativeCommunity=isCommunity()&&collect().length===0;
      document.documentElement.setAttribute('data-retro-page',directory?'communities':thread||nativeCommunity?'post':'feed');
      navigation(directory);
      nativeRoot.inert=thread||directory||nativeCommunity?state.priorInert:true;
      let heading=document.getElementById('rt-directory-heading');
      if(directory&&!heading){heading=el('h1',{id:'rt-directory-heading',text:'Comunidades'});document.getElementById('rt-classic-content').before(heading);}
      if(heading)heading.hidden=!directory;
      if(thread||directory||nativeCommunity){document.getElementById('rt-classic-content').hidden=true;return;}
      document.getElementById('rt-classic-content').hidden=false;
      for(const post of collect())state.cache.set(post.id,post);
      while(state.cache.size>200)state.cache.delete(state.cache.keys().next().value);
      state.posts=[...state.cache.values()];renderRows(state.posts);sidebars(state.posts);
      text(document.querySelector('#rt-app .rt-more'),'Siguientes posts »');
    },
    cleanup(){if(state.root)state.root.inert=state.priorInert;state.root=null;state.posts=[];state.cache.clear();state.feeds.clear();state.rows.clear();}
  });
})();
