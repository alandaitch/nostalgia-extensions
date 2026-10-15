/* Only account names explicitly visited in the skin, in Chrome's session memory.
   Session storage stays restricted to trusted extension contexts. */
(() => {
  'use strict';
  let queue=Promise.resolve();
  const valid=name=>typeof name==='string'&&/^[a-zA-Z0-9._]{1,30}$/.test(name);
  chrome.runtime.onMessage.addListener((message,sender,reply)=>{
    if(sender.id!==chrome.runtime.id||!/^https:\/\/(?:www\.)?instagram\.com\//.test(sender.url||''))return false;
    if(message?.type!=='fotolog-recents')return false;
    const result=queue.then(async()=>{
      const data=await chrome.storage.session.get('fotologRecents');
      let authors=Array.isArray(data.fotologRecents)?data.fotologRecents.filter(valid).slice(0,12):[];
      if(valid(message.author)){authors=[message.author,...authors.filter(name=>name!==message.author)].slice(0,12);await chrome.storage.session.set({fotologRecents:authors});}
      return authors;
    });
    queue=result.catch(()=>{});result.then(authors=>reply({authors}),()=>reply({authors:[]}));return true;
  });
})();
