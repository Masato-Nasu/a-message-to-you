(()=>{
const FILTERS=[{id:'none',label:'なし',css:'none'},{id:'soft',label:'ふんわり',css:'brightness(1.08) saturate(.92) contrast(.95)'},{id:'sparkle',label:'きらきら',css:'brightness(1.06) saturate(1.14) contrast(1.02)'},{id:'film',label:'フィルム',css:'sepia(.18) contrast(.96) saturate(.92) brightness(1.02)'},{id:'sunset',label:'ゆうやけ',css:'sepia(.16) saturate(1.12) brightness(1.04) hue-rotate(-10deg)'},{id:'sky',label:'そらいろ',css:'brightness(1.05) saturate(.92) hue-rotate(10deg)'},{id:'milk',label:'ミルク',css:'brightness(1.1) contrast(.86) saturate(.88)'},{id:'clear',label:'はっきり',css:'brightness(1.04) contrast(1.08) saturate(1.03)'}];
const PASTELS=['#F9B7D1','#FFC6A8','#FFD96A','#FFF3B4','#D6F5B0','#B7F0D0','#BDEBFF','#BFCBFF','#DCC8FF','#F4C8FF','#FFFFFF','#F4EEE7'];
const STICKERS=['💗','✨','🎀','🌼','☁️','🍓','🫧','⭐','🐰','🧸','🌙','💌'];
const EMBED_MODE = new URLSearchParams(location.search).get('embed') === '1';
const EMBED_ROOM_INDEX = Number(new URLSearchParams(location.search).get('room') || -1);
function notifyMothershipImage(imageData, meta = {}) {
  try {
    if (window.parent && window.parent !== window && imageData) {
      window.parent.postMessage({ type: 'mothership:image', roomIndex: Number.isFinite(EMBED_ROOM_INDEX) && EMBED_ROOM_INDEX >= 0 ? EMBED_ROOM_INDEX : undefined, imageData, ...meta }, '*');
    }
  } catch (e) {}
}
const $=id=>document.getElementById(id);
const els={video:$('video'),previewImage:$('previewImage'),overlayLayer:$('overlayLayer'),placeholder:$('placeholder'),stage:$('stage'),modeBtns:[...document.querySelectorAll('[data-mode]')],tabBtns:[...document.querySelectorAll('[data-tab]')],titleInput:$('titleInput'),cameraBtn:$('cameraBtn'),pickBtn:$('pickBtn'),saveImageBtn:$('saveImageBtn'),resetBtn:$('resetBtn'),cameraInput:$('cameraInput'),imageInput:$('imageInput'),msgError:$('msgError'),msgInfo:$('msgInfo'),textDraft:$('textDraft'),textSize:$('textSize'),textMotion:$('textMotion'),colorChips:$('colorChips'),addTextBtn:$('addTextBtn'),stickerChips:$('stickerChips'),stickerSize:$('stickerSize'),stickerMotion:$('stickerMotion'),addStickerBtn:$('addStickerBtn'),filterBar:$('filterBar'),filterName:$('filterName'),filterPrevBtn:$('filterPrevBtn'),filterNextBtn:$('filterNextBtn'),selectedEmpty:$('selectedEmpty'),selectedEditor:$('selectedEditor'),selectedSize:$('selectedSize'),selectedMotion:$('selectedMotion'),selectedTextFields:$('selectedTextFields'),selectedTextValue:$('selectedTextValue'),selectedColorChips:$('selectedColorChips'),deleteSelectedBtn:$('deleteSelectedBtn'),nudgeUp:$('nudgeUp'),nudgeLeft:$('nudgeLeft'),nudgeCenter:$('nudgeCenter'),nudgeRight:$('nudgeRight'),nudgeDown:$('nudgeDown'),panelActions:$('panel-actions'),panelText:$('panel-text'),panelSticker:$('panel-sticker'),panelSelected:$('panel-selected')};
const state={mode:'capture',activeTab:'actions',selectedColor:PASTELS[0],selectedSticker:STICKERS[0],stream:null,capturedImage:'',filterId:'soft',overlays:[],selectedId:null,drag:null};
function uid(){return `${Date.now()}-${Math.random().toString(36).slice(2,8)}`}
function clamp(n,min,max){return Math.min(max,Math.max(min,n))}
function nowStamp(){const d=new Date();const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`}
function safeName(t){return (t||'houkago-camera').trim().replace(/[^a-zA-Z0-9ぁ-んァ-ヶ一-龯ー_-]+/g,'-').replace(/^-+|-+$/g,'')||'houkago-camera'}
function imageFileName(){return `${safeName(els.titleInput.value)}-${nowStamp()}.png`}
function sceneBase(){if(!state.capturedImage){setMessage('先に写真を撮るか、写真を選んでください。','error');return null}return {version:17,title:els.titleInput.value,filter:state.filterId,overlays:state.overlays,createdAt:new Date().toISOString()}}
function buildScene(){const base=sceneBase(); if(!base) return null; return {...base,imageDataUrl:state.capturedImage}}
function selectedItem(){return state.overlays.find(x=>x.id===state.selectedId)||null}
function setMessage(text,type='info'){const info=els.msgInfo, err=els.msgError; info.classList.add('hidden'); err.classList.add('hidden'); if(!text)return; (type==='error'?err:info).textContent=text; (type==='error'?err:info).classList.remove('hidden')}
function renderTabs(){const panels={actions:els.panelActions,text:els.panelText,sticker:els.panelSticker,selected:els.panelSelected};Object.entries(panels).forEach(([k,p])=>p.classList.toggle('active',state.activeTab===k));els.tabBtns.forEach(b=>b.classList.toggle('active',b.dataset.tab===state.activeTab))}
function renderModes(){els.modeBtns.forEach(b=>b.classList.toggle('active',b.dataset.mode===state.mode))}
function renderButtons(){const on=!!state.capturedImage;[els.addTextBtn,els.addStickerBtn].forEach(b=>b.disabled=!on);els.saveImageBtn.disabled=false}
function renderColorChips(root,current,onSelect){root.innerHTML='';PASTELS.forEach(c=>{const b=document.createElement('button');b.className='colorChip'+(c===current?' active':'');b.style.background=c;b.type='button';b.addEventListener('click',()=>onSelect(c));root.appendChild(b)})}
function renderStickerChips(){els.stickerChips.innerHTML='';STICKERS.forEach(s=>{const b=document.createElement('button');b.className='stickerChip'+(state.selectedSticker===s?' active':'');b.type='button';b.textContent=s;b.style.fontSize='26px';b.addEventListener('click',()=>{state.selectedSticker=s;renderStickerChips()});els.stickerChips.appendChild(b)})}
function currentFilterIndex(){return Math.max(0,FILTERS.findIndex(f=>f.id===state.filterId))}
function renderFilterBar(){const show=!!state.capturedImage; els.filterBar.classList.toggle('hidden', !show); if(show){const f=FILTERS[currentFilterIndex()]||FILTERS[0]; els.filterName.textContent='フィルター：'+f.label;}}
function stepFilter(dir){const i=currentFilterIndex(); const next=(i+dir+FILTERS.length)%FILTERS.length; state.filterId=FILTERS[next].id; renderFilterBar(); renderPreview();}
function renderSelected(){const item=selectedItem();const show=!!item;els.selectedEmpty.classList.toggle('hidden',show);els.selectedEditor.classList.toggle('hidden',!show);if(!item)return;els.selectedSize.min=item.kind==='text'?'18':'26';els.selectedSize.max=item.kind==='text'?'52':'80';els.selectedSize.value=String(item.size);els.selectedMotion.value=item.motion;if(item.kind==='text'){els.selectedTextFields.classList.remove('hidden');els.selectedTextValue.value=item.value;renderColorChips(els.selectedColorChips,item.color,(c)=>{item.color=c;renderPreview();renderSelected()})}else{els.selectedTextFields.classList.add('hidden')}}
function renderOverlayLayer(items,editable){
  els.overlayLayer.innerHTML='';
  els.overlayLayer.classList.remove('hidden');
  items.forEach(item=>{
    const wrap=document.createElement('div');
    wrap.className=`overlay ${item.kind} motion-${item.motion}`+(editable&&state.selectedId===item.id?' selected':'');
    wrap.style.left=`${item.x*100}%`;
    wrap.style.top=`${item.y*100}%`;
    wrap.dataset.id=item.id;
    const span=document.createElement('span');
    span.textContent=item.value;
    span.style.fontSize=`${item.size}px`;
    if(item.kind==='text')span.style.color=item.color;
    wrap.appendChild(span);
    if(editable){
      wrap.addEventListener('pointerdown',(e)=>{
        e.preventDefault();
        e.stopPropagation();
        try{wrap.setPointerCapture(e.pointerId)}catch(_){}
        state.selectedId=item.id;
        els.overlayLayer.querySelectorAll('.overlay.selected').forEach(el=>el.classList.remove('selected'));
        wrap.classList.add('selected','dragging');
        const r=els.stage.getBoundingClientRect();
        state.drag={id:item.id,startX:e.clientX,startY:e.clientY,baseX:item.x,baseY:item.y,w:r.width,h:r.height,el:wrap,pointerId:e.pointerId};
        state.activeTab='selected';
        renderTabs();
        renderSelected();
      });
    }else{
      wrap.style.pointerEvents='none';
    }
    els.overlayLayer.appendChild(wrap);
  });
}
function renderPreview(){els.video.classList.add('hidden');els.previewImage.classList.add('hidden');els.overlayLayer.classList.add('hidden');els.placeholder.classList.add('hidden');
  if(state.mode==='capture'&&!state.capturedImage){if(state.stream){els.video.classList.remove('hidden')}else{els.placeholder.classList.remove('hidden')}return}
  if(state.capturedImage){els.previewImage.src=state.capturedImage;els.previewImage.style.filter=(FILTERS.find(f=>f.id===state.filterId)||FILTERS[0]).css;els.previewImage.classList.remove('hidden');renderOverlayLayer(state.overlays,true);return}
  els.placeholder.classList.remove('hidden')
}
function renderAll(){renderModes();renderTabs();renderButtons();renderSelected();renderFilterBar();renderPreview()}
async function startVideoCamera(){setMessage(''); if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){setMessage('このブラウザではカメラに対応していません。写真を選ぶを使ってください。','error');return} try{stopVideoCamera(); const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'},audio:false}); state.stream=s; els.video.srcObject=s; els.video.classList.remove('hidden'); await els.video.play().catch(()=>{}); renderPreview(); }catch(e){setMessage('カメラが使えないため、写真を選んで試せます。','error')}}
function stopVideoCamera(){if(state.stream){state.stream.getTracks().forEach(t=>t.stop());state.stream=null;els.video.srcObject=null}}
function openCamera(){ if(window.innerWidth<800){ els.cameraInput.click(); } else { if(state.mode!=='capture'){state.mode='capture'; renderAll();} startVideoCamera(); setMessage('PCではライブ映像が出たら、もう一度「カメラで撮る」を押すと撮影します。'); if(state.stream&&els.video.videoWidth){ captureFromVideo(); } } }
function captureFromVideo(){ if(!els.video.videoWidth){setMessage('カメラの準備ができたら、もう一度押してください。'); return;} const c=document.createElement('canvas'); c.width=els.video.videoWidth; c.height=els.video.videoHeight; const ctx=c.getContext('2d'); ctx.drawImage(els.video,0,0,c.width,c.height); state.capturedImage=c.toDataURL('image/jpeg',.92); stopVideoCamera(); state.mode='decorate'; state.activeTab='text'; renderAll(); }
function readImageFile(file){ const fr=new FileReader(); fr.onload=()=>{state.capturedImage=String(fr.result||''); state.mode='decorate'; state.activeTab='text'; stopVideoCamera(); renderAll();}; fr.readAsDataURL(file); }
function addText(){ if(!state.capturedImage){setMessage('先に写真を入れてください。','error'); return;} const value=els.textDraft.value.trim(); if(!value){setMessage('文字を入力してください。','error'); return;} const item={id:uid(),kind:'text',x:.5,y:.78,size:Number(els.textSize.value),color:state.selectedColor,motion:els.textMotion.value,value}; state.overlays.push(item); state.selectedId=item.id; state.activeTab='selected'; renderAll(); setMessage('文字を追加しました。'); }
function addSticker(){ if(!state.capturedImage){setMessage('先に写真を入れてください。','error'); return;} const item={id:uid(),kind:'sticker',x:.78,y:.2,size:Number(els.stickerSize.value),motion:els.stickerMotion.value,value:state.selectedSticker}; state.overlays.push(item); state.selectedId=item.id; state.activeTab='selected'; renderAll(); setMessage('スタンプを追加しました。'); }
function deleteSelected(){ if(!state.selectedId)return; state.overlays=state.overlays.filter(x=>x.id!==state.selectedId); state.selectedId=null; renderAll(); }
function resetAll(){ stopVideoCamera(); state.mode='capture'; state.capturedImage=''; state.filterId='soft'; state.overlays=[]; state.selectedId=null; els.titleInput.value='放課後カメラ'; state.activeTab='actions'; setMessage(''); renderAll(); }
async function saveImage(){ const scene=buildScene(); if(!scene)return; const img=await new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=scene.imageDataUrl; }); const c=document.createElement('canvas'); c.width=img.naturalWidth||1080; c.height=img.naturalHeight||1440; const ctx=c.getContext('2d'); const scale=c.width/320; ctx.filter=(FILTERS.find(f=>f.id===scene.filter)||FILTERS[0]).css; ctx.drawImage(img,0,0,c.width,c.height); ctx.filter='none'; ctx.textAlign='center'; ctx.textBaseline='middle'; for(const item of scene.overlays){ const x=item.x*c.width, y=item.y*c.height, size=item.size*scale; if(item.kind==='text'){ ctx.save(); ctx.font=`700 ${size}px Arial,sans-serif`; ctx.fillStyle=item.color; ctx.shadowColor='rgba(255,255,255,.72)'; ctx.shadowBlur=Math.max(2,size*.08); ctx.fillText(item.value,x,y); ctx.restore(); } else { ctx.save(); ctx.font=`${size}px Arial,sans-serif`; ctx.fillText(item.value,x,y); ctx.restore(); } } const dataUrl=c.toDataURL('image/jpeg',.92); notifyMothershipImage(dataUrl,{ title:'放課後カメラ', note:els.titleInput.value||'見つけたものを撮る' }); if(EMBED_MODE){ setMessage('Room に反映しました。'); return; } const a=document.createElement('a'); a.href=dataUrl; a.download=imageFileName(); a.click(); setMessage(`画像を保存しました: ${a.download}`); }
function moveSelectedToPointer(e){
  const item=selectedItem();
  if(!item||!state.capturedImage)return;
  const target=e.target;
  if(target&&target.closest&&target.closest('.overlay'))return;
  const r=els.stage.getBoundingClientRect();
  item.x=clamp((e.clientX-r.left)/r.width,.05,.95);
  item.y=clamp((e.clientY-r.top)/r.height,.05,.95);
  renderPreview();
  renderSelected();
}
function nudgeSelected(dx,dy){
  const item=selectedItem();
  if(!item)return;
  if(dx==='center'){
    item.x=.5; item.y=.5;
  }else{
    item.x=clamp(item.x+dx,.05,.95);
    item.y=clamp(item.y+dy,.05,.95);
  }
  renderPreview();
  renderSelected();
}
function rerenderMainColors(){ renderColorChips(els.colorChips,state.selectedColor,(c)=>{state.selectedColor=c; rerenderMainColors();}); }
rerenderMainColors(); renderStickerChips(); renderFilterBar();
els.modeBtns.forEach(b=>b.addEventListener('click',()=>{ state.mode=b.dataset.mode; if(state.mode==='capture'&&!state.capturedImage) startVideoCamera(); renderAll(); }));
els.tabBtns.forEach(b=>b.addEventListener('click',()=>{ state.activeTab=b.dataset.tab; renderTabs(); }));
els.filterPrevBtn.addEventListener('click',()=>stepFilter(-1));
els.filterNextBtn.addEventListener('click',()=>stepFilter(1));
els.cameraBtn.addEventListener('click',()=>{ if(window.innerWidth<800){ els.cameraInput.click(); } else { if(state.stream&&els.video.videoWidth) captureFromVideo(); else startVideoCamera(); }});
els.pickBtn.addEventListener('click',()=>els.imageInput.click()); els.saveImageBtn.addEventListener('click',saveImage); els.resetBtn.addEventListener('click',resetAll); els.addTextBtn.addEventListener('click',addText); els.addStickerBtn.addEventListener('click',addSticker); els.deleteSelectedBtn.addEventListener('click',deleteSelected);
els.cameraInput.addEventListener('change',e=>{ const f=e.target.files&&e.target.files[0]; if(f) readImageFile(f); e.target.value=''; });
els.imageInput.addEventListener('change',e=>{ const f=e.target.files&&e.target.files[0]; if(f) readImageFile(f); e.target.value=''; });
els.selectedSize.addEventListener('input',()=>{ const item=selectedItem(); if(!item)return; item.size=Number(els.selectedSize.value); renderPreview(); });
els.selectedMotion.addEventListener('change',()=>{ const item=selectedItem(); if(!item)return; item.motion=els.selectedMotion.value; renderPreview(); });
els.selectedTextValue.addEventListener('input',()=>{ const item=selectedItem(); if(!item||item.kind!=='text')return; item.value=els.selectedTextValue.value; renderPreview(); });
els.stage.addEventListener('pointerdown',moveSelectedToPointer);
if(els.nudgeUp)els.nudgeUp.addEventListener('click',()=>nudgeSelected(0,-.025));
if(els.nudgeLeft)els.nudgeLeft.addEventListener('click',()=>nudgeSelected(-.025,0));
if(els.nudgeCenter)els.nudgeCenter.addEventListener('click',()=>nudgeSelected('center',0));
if(els.nudgeRight)els.nudgeRight.addEventListener('click',()=>nudgeSelected(.025,0));
if(els.nudgeDown)els.nudgeDown.addEventListener('click',()=>nudgeSelected(0,.025));
window.addEventListener('pointermove',e=>{ if(!state.drag)return; e.preventDefault(); const item=state.overlays.find(x=>x.id===state.drag.id); if(!item)return; const dx=(e.clientX-state.drag.startX)/state.drag.w; const dy=(e.clientY-state.drag.startY)/state.drag.h; item.x=clamp(state.drag.baseX+dx,.05,.95); item.y=clamp(state.drag.baseY+dy,.05,.95); if(state.drag.el){state.drag.el.style.left=`${item.x*100}%`;state.drag.el.style.top=`${item.y*100}%`;} });
function endDrag(e){ if(state.drag?.el){state.drag.el.classList.remove('dragging');try{state.drag.el.releasePointerCapture(state.drag.pointerId ?? e.pointerId)}catch(_){}} state.drag=null; }
window.addEventListener('pointerup',endDrag);
window.addEventListener('pointercancel',endDrag);
if('serviceWorker' in navigator){ window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js?v=47').catch(()=>{})); }
renderAll(); startVideoCamera();
})();
