/* Shared local watermark for Pages and offline Wallpaper Engine previews. */
(() => {
  'use strict';
  const embedded=new URLSearchParams(location.search).has('embed');
  const script=document.currentScript;
  const avatar=new URL('github-avatar.jpg',script.src).href;
  const storageKey='ascii-grass-watermark-opacity';
  const style=document.createElement('style');
  style.textContent=`
  #grass-watermark{position:fixed;right:22px;bottom:20px;display:flex;align-items:center;gap:9px;color:#fff;font:500 14px/1.3 system-ui,"Microsoft YaHei",sans-serif;letter-spacing:.04em;text-shadow:0 1px 5px #000;pointer-events:none;z-index:40;opacity:.35}
  #grass-watermark[hidden],#grass-watermark-panel[hidden]{display:none}
  #grass-watermark img{display:block;width:30px;height:30px;object-fit:cover;border-radius:50%;box-shadow:0 1px 7px #0008}
  #grass-watermark-panel{position:fixed;right:18px;bottom:68px;width:246px;padding:16px;background:#101a11f5;color:#e3eccf;border:1px solid #536640;border-radius:9px;box-shadow:0 8px 28px #0005;z-index:60;font:13px/1.5 system-ui,"Microsoft YaHei",sans-serif}
  #grass-watermark-panel label{display:block;margin:0 0 10px;font:inherit;color:inherit}
  #grass-watermark-panel output{float:right;color:#ccdda9}
  #grass-watermark-panel input{display:block;width:100%;margin:6px 0;accent-color:#c3da87}
  #grass-watermark-panel small{font:12px/1.4 system-ui,sans-serif;color:#aebfa0}
  .grass-watermark-toggle{border:1px solid #4a5a3e;border-radius:5px;padding:7px 11px;background:#132014db;color:#ccdbb4;font:13px/1.4 system-ui,sans-serif;cursor:pointer}
  .grass-watermark-floating{position:fixed;right:20px;bottom:62px;z-index:50}
  @media(max-width:600px){#grass-watermark{right:15px;bottom:84px}#grass-watermark-panel{right:12px;bottom:132px}.grass-watermark-floating{right:14px;bottom:126px}}
  @media(pointer:coarse){.grass-watermark-toggle{min-height:44px}#grass-watermark-panel input{min-height:28px}}
  `;
  document.head.append(style);
  const mark=document.createElement('div');mark.id='grass-watermark';mark.setAttribute('aria-label','Sha Taojin · GitHub');
  const image=document.createElement('img');image.src=avatar;image.alt='';image.width=30;image.height=30;image.draggable=false;
  const name=document.createElement('span');name.textContent='Sha Taojin';mark.append(image,name);document.body.append(mark);
  const panel=document.createElement('section');panel.id='grass-watermark-panel';panel.hidden=true;panel.setAttribute('aria-label','水印设置');
  panel.innerHTML='<label for="grass-watermark-opacity">水印不透明度 <output id="grass-watermark-value" for="grass-watermark-opacity">35%</output></label><input id="grass-watermark-opacity" aria-label="水印不透明度，0 表示隐藏" type="range" min="0" max="100" step="1" value="35"><small>调到 0% 隐藏水印</small>';
  document.body.append(panel);
  const slider=panel.querySelector('input'),value=panel.querySelector('output');
  let toggle=document.getElementById('watermark-tool');
  if(!toggle){toggle=document.createElement('button');toggle.type='button';toggle.textContent='水印';toggle.className='grass-watermark-toggle grass-watermark-floating';document.body.append(toggle);}
  else toggle.classList.add('grass-watermark-toggle');
  toggle.setAttribute('aria-controls',panel.id);toggle.setAttribute('aria-expanded','false');
  toggle.hidden=embedded;
  function setOpacity(raw,save=false){
    const number=Number(raw);if(!Number.isFinite(number))return;
    const opacity=Math.max(0,Math.min(100,Math.round(number)));
    mark.hidden=opacity===0||(embedded&&!document.fullscreenElement);mark.style.opacity=String(opacity/100);slider.value=opacity;value.textContent=opacity+'%';
    if(save)try{localStorage.setItem(storageKey,String(opacity));}catch{}
  }
  function close(){panel.hidden=true;toggle.setAttribute('aria-expanded','false');}
  toggle.addEventListener('click',()=>{panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));});
  slider.addEventListener('input',()=>setOpacity(slider.value,true));
  document.addEventListener('pointerdown',event=>{if(!panel.hidden&&!panel.contains(event.target)&&!toggle.contains(event.target))close();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){close();toggle.focus();}});
  try{const saved=localStorage.getItem(storageKey);setOpacity(saved===null?35:saved);}catch{setOpacity(35);}
  window.addEventListener('storage',event=>{if(event.key===storageKey)setOpacity(event.newValue===null?35:event.newValue);});
  document.addEventListener('fullscreenchange',()=>{toggle.hidden=embedded&&!document.fullscreenElement;setOpacity(slider.value);});
  const listener=window.wallpaperPropertyListener||{},previous=listener.applyUserProperties;
  listener.applyUserProperties=function(properties){if(previous)previous.call(this,properties);if(properties.watermarkopacity)setOpacity(properties.watermarkopacity.value,true);};
  window.wallpaperPropertyListener=listener;
})();
