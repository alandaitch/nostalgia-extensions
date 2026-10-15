(() => {
  'use strict';
  const config = globalThis.RetroConfig;
  document.body.dataset.skin = config.id;
  document.title = config.name;
  document.getElementById('brand').textContent = config.brand;
  document.getElementById('description').textContent = config.description;
  const open = document.getElementById('open');
  open.href = config.destination;
  open.textContent = `Abrir ${config.original}`;
  const select = document.getElementById('theme');
  for (const [value, label] of config.themes) select.add(new Option(label, value));
  document.getElementById('tagline-field').hidden = config.id !== 'fotolog';
  document.getElementById('compact-field').hidden = config.id !== 'taringa';
  const status = document.getElementById('status');
  const fields = ['enabled', 'theme', 'tagline', 'compact'];
  chrome.storage.local.get(config.defaults).then(settings => {
    if (config.legacyTagline && settings.tagline === config.legacyTagline) settings.tagline = config.defaults.tagline;
    const randomControls=document.getElementById('random-theme-controls');
    const syncRandom=()=>{randomControls.hidden=config.id!=='fotolog'||select.value!=='azar';};
    syncRandom();
    document.getElementById('shuffle-palettes').addEventListener('click',async()=>{
      const count=config.themes.filter(([key])=>key!=='azar').length,random=new Uint32Array(1);crypto.getRandomValues(random);
      settings.paletteSeed=((Number(settings.paletteSeed)>>>0)+1+random[0]%(count-1))>>>0;
      try{await chrome.storage.local.set({paletteSeed:settings.paletteSeed});status.textContent='Paletas mezcladas. Cada usuario conserva su nuevo color.';}catch{status.textContent='No se pudo guardar. Volvé a abrir la extensión.';}
    });
    for (const key of fields) {
      const field = document.getElementById(key);
      if (field.type === 'checkbox') field.checked = Boolean(settings[key]);
      else field.value = settings[key] ?? '';
      field.addEventListener('change', async () => {
        const value = field.type === 'checkbox' ? field.checked : field.value;
        try {
          await chrome.storage.local.set({ [key]: value });
          settings[key]=value;
          syncRandom();
          status.textContent = 'Guardado. Se aplica en tus pestañas abiertas.';
        } catch { status.textContent = 'No se pudo guardar. Volvé a abrir la extensión.'; }
      });
    }
    syncRandom();
    status.textContent = settings.enabled ? 'Skin activada.' : 'Estás viendo el diseño original.';
  }).catch(() => { status.textContent = 'Volvé a abrir la extensión para cargar tus preferencias.'; });
})();
