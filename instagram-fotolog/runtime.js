/* Shared, dependency-free runtime. Everything stays in this extension's isolated world. */
(() => {
  'use strict';
  const config = globalThis.RetroConfig;
  const owned = 'data-retro-owned';
  const marks = new Set();
  const settings = { ...config.defaults };
  let adapter, timer, observer, lastPath = '', stopped = false, lastRender = 0;

  function el(tag, attributes = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attributes)) {
      if (value === null || value === undefined) continue;
      if (key === 'text') node.textContent = value;
      else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, String(value));
    }
    for (const child of [].concat(children)) if (child != null) node.append(typeof child === 'string' ? document.createTextNode(child) : child);
    return node;
  }
  function own(node) { node.setAttribute(owned, config.id); return node; }
  function mark(node, name, value = '') {
    if (!node) return;
    marks.add(name);
    if (node.getAttribute(name) !== value) node.setAttribute(name, value);
  }
  function text(node, value) { if (node && node.textContent !== String(value)) node.textContent = value; }
  function url(value, type = 'link') {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      const parsed = new URL(value, type === 'image' ? document.baseURI : config.destination);
      if (type === 'image') return /^https?:$/.test(parsed.protocol) || (parsed.protocol === 'data:' && parsed.href.startsWith('data:image/')) ? parsed.href : null;
      const site = new URL(config.destination).hostname.replace(/^www\./, '');
      return /^https?:$/.test(parsed.protocol) && (parsed.hostname === site || parsed.hostname.endsWith('.' + site) || parsed.origin === location.origin) ? parsed.href : null;
    } catch { return null; }
  }
  async function save(patch) {
    Object.assign(settings, patch);
    try { await chrome.storage.local.set(patch); } catch { /* A reloaded unpacked extension may invalidate its old context. */ }
    render();
  }
  function clear() {
    // Return borrowed native media before removing the extension's containers.
    adapter?.beforeClear?.();
    document.documentElement.removeAttribute('data-retro-skin');
    document.documentElement.removeAttribute('data-retro-theme');
    document.documentElement.removeAttribute('data-retro-compact');
    document.documentElement.removeAttribute('data-retro-page');
    document.documentElement.removeAttribute('data-retro-native-task');
    document.documentElement.removeAttribute('data-retro-palette');
    for (const name of marks) for (const node of document.querySelectorAll(`[${name}]`)) node.removeAttribute(name);
    for (const node of document.querySelectorAll(`[${owned}="${config.id}"]`)) node.remove();
    adapter?.cleanup?.();
  }
  function observe() {
    observer?.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true,
      attributeFilter: ['href', 'src', 'datetime', 'score', 'comment-count', 'post-title', 'subreddit-prefixed-name', 'aria-label', 'aria-pressed'] });
  }
  function render() {
    if (stopped || !document.body || !adapter) return;
    observer?.disconnect();
    lastRender = Date.now();
    try {
      if (!settings.enabled || !adapter.supported()) clear();
      else {
        const root = document.documentElement;
        root.setAttribute('data-retro-skin', config.id);
        root.setAttribute('data-retro-theme', settings.theme);
        root.setAttribute('data-retro-compact', String(settings.compact));
        adapter.render();
      }
    } catch (error) {
      clear();
      console.warn(`[${config.name}] Se restauró la página original.`, error);
    } finally { observe(); }
  }
  function schedule() { if (!timer) timer = setTimeout(() => { timer = null; render(); }, Math.max(120, 240 - (Date.now() - lastRender))); }
  async function start(nextAdapter) {
    adapter = nextAdapter;
    try { Object.assign(settings, await chrome.storage.local.get(config.defaults)); } catch { /* Defaults work in the local preview too. */ }
    observer = new MutationObserver(records => {
      if (records.some(record => {
        const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
        if (target?.closest(`[${owned}]`)) return false;
        if (record.type === 'characterData') return true;
        if (record.type === 'attributes') return true;
        return [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1 && !node.hasAttribute(owned));
      })) schedule();
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      for (const [key, change] of Object.entries(changes)) if (key in config.defaults) settings[key] = change.newValue ?? config.defaults[key];
      render();
    });
    addEventListener('popstate', schedule);
    addEventListener('pageshow', schedule);
    addEventListener('load', event => {
      if (event.target?.tagName === 'IMG' && !event.target.closest(`[${owned}]`)) schedule();
    }, true);
    setInterval(() => {
      if (location.pathname + location.search !== lastPath) {
        lastPath = location.pathname + location.search;
        render();
      } else adapter.refresh?.();
    }, 750);
    addEventListener('pagehide', () => { clearTimeout(timer); timer = null; observer.disconnect(); });
    render();
  }
  globalThis.RetroSkin = { config, settings, el, own, mark, text, url, save, start, render, clear };
})();
