const AI_PASSWORD = ''; // GitHub public build: set a real value only in a private local copy
const STORAGE_KEY = 'mothership_state_v1';
const LIBRARY_KEY = 'mothership_library_v1';
const UNLOCK_KEY = 'mothership_ai_unlock_v1';

const APPS = [
  { id: '904', name: '904', locked: true, desc: '意味をずらす', path: './apps/904/index.html' },
  { id: 'kirei', name: 'Kirei Filter', locked: true, desc: '整える', path: './apps/kirei/index.html' },
  { id: 'haiku', name: 'Haiku', locked: true, desc: '圧縮する', path: './apps/haiku/index.html' },
  { id: 'hokago', name: '放課後カメラ', locked: false, desc: '見つけたものを撮る', path: './apps/hokago/index.html' },
  { id: 'small-memory', name: 'SMALL MEMORY', locked: false, desc: '言葉を置く', path: './apps/small-memory/index.html' },
  { id: 'mandelbrot', name: 'Mandelbrot Explorer', locked: false, desc: '構造を覗く', path: './apps/mandelbrot/index.html' },
  { id: 'kaleidoscope', name: '万華鏡', locked: false, desc: '視覚を反復させる', path: './apps/kaleidoscope/index.html' },
  { id: 'loop', name: 'Loop', locked: false, desc: '時間を切り出す', path: './apps/loop/index.html' },
  { id: 'fortune', name: '100％星占い', locked: false, desc: 'その日の気配を読む', path: './apps/fortune/index.html' },
];

const screenHome = document.getElementById('screen-home');
const screenEditor = document.getElementById('screen-editor');
const screenApp = document.getElementById('screen-app');
const homeButton = document.getElementById('homeButton');
const appFrame = document.getElementById('appFrame');
const appScreenLabel = document.getElementById('appScreenLabel');
const appBackButton = document.getElementById('appBackButton');
const useInRoomButton = document.getElementById('useInRoomButton');
const canvasWrap = document.getElementById('canvasWrap');
const formatLabel = document.getElementById('formatLabel');
const changeFormatButton = document.getElementById('changeFormatButton');
const swapModeButton = document.getElementById('swapModeButton');
const removeButton = document.getElementById('removeButton');
const clearButton = document.getElementById('clearButton');
const sendHtmlButton = document.getElementById('sendHtmlButton');
const downloadHtmlButton = document.getElementById('downloadHtmlButton');
const exportButton = document.getElementById('exportButton');
const importInput = document.getElementById('importInput');
const libraryButton = document.getElementById('libraryButton');

const appPickerDialog = document.getElementById('appPickerDialog');
const appList = document.getElementById('appList');
const pickerRoomLabel = document.getElementById('pickerRoomLabel');
const choiceDialog = document.getElementById('choiceDialog');
const choiceTitle = document.getElementById('choiceTitle');
const newButton = document.getElementById('newButton');
const libraryPickButton = document.getElementById('libraryPickButton');
const saveRoomJpegButton = document.getElementById('saveRoomJpegButton');
const removeRoomButton = document.getElementById('removeRoomButton');
const previewDialog = document.getElementById('previewDialog');
const previewStage = document.getElementById('previewStage');
const previewCloseButton = document.getElementById('previewCloseButton');
const editorDialog = document.getElementById('editorDialog');
const editorTitle = document.getElementById('editorTitle');
const editorAppLabel = document.getElementById('editorAppLabel');
const roomTitleInput = document.getElementById('roomTitleInput');
const roomNoteInput = document.getElementById('roomNoteInput');
const saveRoomButton = document.getElementById('saveRoomButton');
const libraryDialog = document.getElementById('libraryDialog');
const libraryTitle = document.getElementById('libraryTitle');
const libraryList = document.getElementById('libraryList');
const passwordDialog = document.getElementById('passwordDialog');
const passwordInput = document.getElementById('passwordInput');
const passwordError = document.getElementById('passwordError');
const unlockButton = document.getElementById('unlockButton');

let state = loadState();
let library = loadLibrary();
let unlocked = localStorage.getItem(UNLOCK_KEY) === '1';
let pendingRoomIndex = null;
let pendingApp = null;
let swapSourceIndex = null;
let removingMode = false;
let activeEmbeddedRoomIndex = null;
let arrangingMode = false;
let draggedRoomIndex = null;

function blankRoom(i) {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `room-${Date.now()}-${i}`,
    appId: null,
    title: '',
    note: '',
    createdAt: null,
    source: null,
    imageData: null,
    posterData: null,
    videoData: null,
    appExperience: false,
  };
}

function createRooms(count) {
  return Array.from({ length: count }, (_, i) => blankRoom(i));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { screen: 'home', format: null, rooms: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.rooms)) throw new Error('invalid');
    parsed.rooms = parsed.rooms.map((room, i) => ({
      ...blankRoom(i),
      ...room,
      imageData: room?.imageData || null,
      posterData: room?.posterData || null,
      videoData: room?.videoData || null,
      appExperience: !!room?.appExperience || room?.appId === 'fortune',
    }));
    return parsed;
  } catch {
    return { screen: 'home', format: null, rooms: [] };
  }
}

function loadLibrary() {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('saveState skipped', error);
  }
}

function saveLibrary() {
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
  } catch (error) {
    console.warn('saveLibrary skipped', error);
  }
}

function setScreen(screen) {
  state.screen = screen;
  screenHome.classList.toggle('active', screen === 'home');
  screenEditor.classList.toggle('active', screen === 'editor');
  screenApp.classList.toggle('active', screen === 'app');
  homeButton.classList.toggle('hidden', screen === 'home');
  saveState();
}

function appById(id) {
  return APPS.find(app => app.id === id);
}


function commitRoomImage(roomIndex, imageData, meta = {}) {
  if (roomIndex === null || roomIndex === undefined || !state.rooms[roomIndex] || !imageData) return;
  const room = state.rooms[roomIndex];
  room.imageData = imageData;
  room.posterData = imageData;
  room.videoData = null;
  room.appExperience = false;
  room.source = 'generated';
  if (meta.title && (!room.title || room.title === appById(room.appId)?.name)) room.title = meta.title;
  if (meta.note && (!room.note || room.note === appById(room.appId)?.desc)) room.note = meta.note;
  room.createdAt = new Date().toISOString();
  upsertLibrary(room);
  render();
}

function commitRoomVideo(roomIndex, videoData, posterData, meta = {}) {
  if (roomIndex === null || roomIndex === undefined || !state.rooms[roomIndex] || !videoData) return;
  const room = state.rooms[roomIndex];
  room.videoData = videoData;
  room.posterData = posterData || room.posterData || room.imageData || null;
  room.imageData = posterData || room.imageData || null;
  room.appExperience = false;
  room.source = 'generated';
  if (meta.title && (!room.title || room.title === appById(room.appId)?.name)) room.title = meta.title;
  if (meta.note && (!room.note || room.note === appById(room.appId)?.desc)) room.note = meta.note;
  room.createdAt = new Date().toISOString();
  render();
  try {
    upsertLibrary(room);
  } catch (error) {
    console.warn('video library save skipped', error);
  }
}

function appExperienceUrl(appInfo) {
  if (!appInfo?.path) return '';
  try {
    const url = new URL(appInfo.path, location.href);
    url.searchParams.set('gift', '1');
    url.searchParams.set('embed', '1');
    url.searchParams.set('msv', '37');
    return url.href;
  } catch {
    return String(appInfo.path || '') + '?gift=1&embed=1&msv=38';
  }
}

function commitRoomAppExperience(roomIndex, appInfo, meta = {}) {
  if (roomIndex === null || roomIndex === undefined || !state.rooms[roomIndex] || !appInfo) return;
  const room = state.rooms[roomIndex];
  room.appId = appInfo.id;
  room.title = meta.title || room.title || appInfo.name;
  room.note = meta.note || room.note || appInfo.desc || '';
  room.imageData = null;
  room.posterData = null;
  room.videoData = null;
  room.appExperience = true;
  room.source = 'app';
  room.createdAt = new Date().toISOString();
  upsertLibrary(room);
  render();
}



function roomUseSignature(roomIndex) {
  const room = state.rooms?.[roomIndex];
  if (!room) return '';
  const sig = value => value ? `${String(value).length}:${String(value).slice(0, 48)}` : '';
  return [
    room.appId || '',
    room.createdAt || '',
    room.appExperience ? 'app' : '',
    sig(room.imageData),
    sig(room.posterData),
    sig(room.videoData),
    room.title || '',
    room.note || ''
  ].join('|');
}

function roomHasUsableOutput(roomIndex) {
  const room = state.rooms?.[roomIndex];
  return !!(room && (room.imageData || room.posterData || room.videoData || room.appExperience));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForRoomOutput(roomIndex, beforeSignature, timeout = 1200) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (roomUseSignature(roomIndex) !== beforeSignature && roomHasUsableOutput(roomIndex)) return true;
    await sleep(60);
  }
  return roomUseSignature(roomIndex) !== beforeSignature && roomHasUsableOutput(roomIndex);
}

async function finishUseInRoomIfSucceeded(roomIndex, beforeSignature) {
  if (await waitForRoomOutput(roomIndex, beforeSignature)) {
    flashUseInRoom('Added');
    return true;
  }
  return false;
}

function cleanupEmbeddedExportControls(frameDoc, appInfo) {
  if (!frameDoc) return;
  const hideIds = new Set([
    'export-txt','export-json','export-jpeg','saveBtn','saveImageBtn','downloadButton',
    'saveWebmBtn','saveJpegBtn','exportJpeg','saveJson','loadJson','exportTxt','jsonFileInput',
    'installButton','nukeBtn'
  ]);
  const saveTextPattern = /^(save|download|export|jpeg|png|json|txt|open json|jpeg card|save png|save webm|save jpeg|use jpeg|use loop|保存|jpeg保存|画像で保存)$/i;
  const hideElement = (el) => {
    if (!el) return;
    if (!el.classList.contains('mothership-hide-export')) el.classList.add('mothership-hide-export');
    if (el.style.getPropertyValue('display') !== 'none' || el.style.getPropertyPriority('display') !== 'important') {
      el.style.setProperty('display', 'none', 'important');
    }
  };
  const apply = () => {
    try {
      hideIds.forEach(id => {
        const el = frameDoc.getElementById(id);
        if (el) {
          hideElement(el);
        }
      });
      frameDoc.querySelectorAll('button,label,a').forEach(el => {
        const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
        const id = el.id || '';
        if (hideIds.has(id) || saveTextPattern.test(text)) {
          hideElement(el);
        }
      });
      frameDoc.querySelectorAll('.export-actions,.exports').forEach(el => {
        const visibleChildren = Array.from(el.children).filter(child => {
          const cs = frameDoc.defaultView.getComputedStyle(child);
          return cs.display !== 'none';
        });
        if (visibleChildren.length === 0) {
          hideElement(el);
        }
      });
      if (appInfo?.id === 'mandelbrot') {
        frameDoc.querySelectorAll('button').forEach(el => {
          const text = (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
          if (text === 'reset.html' || text === 'cache nuke') {
            hideElement(el);
          }
        });
      }
    } catch (e) {}
  };
  try {
    if (!frameDoc.getElementById('mothership-embed-cleanup-style')) {
      const style = frameDoc.createElement('style');
      style.id = 'mothership-embed-cleanup-style';
      style.textContent = '.mothership-hide-export{display:none!important}';
      frameDoc.head.appendChild(style);
    }
    apply();
    setTimeout(apply, 250);
    setTimeout(apply, 1000);
    setTimeout(apply, 2200);
    if (frameDoc.body && !frameDoc.body.dataset.mothershipCleanupObserver) {
      frameDoc.body.dataset.mothershipCleanupObserver = '1';
      const observer = new MutationObserver(apply);
      observer.observe(frameDoc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'disabled'] });
      setTimeout(() => observer.disconnect(), 15000);
    }
  } catch (e) {}
}

function patchEmbeddedApp(appInfo) {
  const frameWin = appFrame.contentWindow;
  if (!frameWin) return;
  const frameDoc = appFrame.contentDocument || frameWin.document;
  cleanupEmbeddedExportControls(frameDoc, appInfo);
  const roomIndex = activeEmbeddedRoomIndex;
  try {
    if (appInfo.id === 'small-memory' && typeof frameWin.exportJPEG === 'function') {
      frameWin.exportJPEG = function () {
        const canvas = frameWin.renderPageToCanvas(frameWin.getPage());
        const imageData = canvas ? canvas.toDataURL('image/jpeg', 0.94) : null;
        commitRoomImage(roomIndex, imageData, {
          title: 'SMALL MEMORY',
          note: (frameWin.getPage().text || '').split(/\n/).find(Boolean)?.slice(0, 80) || 'Small memory'
        });
      };
    }
    if (appInfo.id === 'kaleidoscope' && typeof frameWin.saveJPEG === 'function') {
      frameWin.saveJPEG = function () {
        const imageData = frameWin.canvas.toDataURL('image/jpeg', 0.94);
        commitRoomImage(roomIndex, imageData, { title: '万華鏡', note: '36分割の万華鏡' });
      };
    }
    if (appInfo.id === 'mandelbrot' && typeof frameWin.savePNG === 'function') {
      frameWin.savePNG = async function () {
        const imageData = frameWin.canvas.toDataURL('image/jpeg', 0.94);
        commitRoomImage(roomIndex, imageData, { title: 'Mandelbrot Explorer', note: 'Fractal view' });
      };
    }
    if (appInfo.id === 'loop') {
      if (typeof frameWin.saveJpeg === 'function') {
        frameWin.saveJpeg = async function () {
          const previewUrl = await frameWin.createPosterData();
          commitRoomImage(roomIndex, previewUrl, { title: 'Loop', note: frameWin.selectedFilter || 'Original' });
        };
      }
      if (typeof frameWin.saveWebm === 'function') {
        frameWin.saveWebm = async function () {
          const ok = await frameWin.ensurePlaybackReady();
          if (!ok) return false;
          const vw = frameWin.playbackVideo.videoWidth || 1080;
          const vh = frameWin.playbackVideo.videoHeight || 1080;
          const side = Math.min(vw, vh);
          frameWin.workCanvas.width = 480;
          frameWin.workCanvas.height = 480;
          const ctx = frameWin.workCanvas.getContext('2d', { alpha: false });
          const streamOut = frameWin.workCanvas.captureStream(frameWin.FPS || 30);
          const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
            ? 'video/webm;codecs=vp9'
            : 'video/webm;codecs=vp8';
          const rec = new MediaRecorder(streamOut, { mimeType, videoBitsPerSecond: 1200000 });
          const localChunks = [];
          rec.ondataavailable = e => { if (e.data && e.data.size > 0) localChunks.push(e.data); };
          const finished = new Promise(resolve => {
            rec.onstop = async () => {
              try {
                const blob = new Blob(localChunks, { type: mimeType });
                const posterData = await frameWin.createPosterData();
                const reader = new FileReader();
                reader.onload = () => {
                  commitRoomVideo(roomIndex, String(reader.result), posterData, {
                    title: 'Loop',
                    note: frameWin.selectedFilter || 'Original'
                  });
                  resolve(true);
                };
                reader.onerror = () => resolve(false);
                reader.readAsDataURL(blob);
              } catch (e) {
                resolve(false);
              } finally {
                streamOut.getTracks().forEach(track => track.stop());
              }
            };
          });
          const durationMs = Math.max(500, Math.min(frameWin.RECORD_MS || 3000, (frameWin.playbackVideo.duration || 3) * 1000));
          let rafId = 0;
          const drawFrame = () => {
            ctx.save();
            ctx.clearRect(0, 0, frameWin.workCanvas.width, frameWin.workCanvas.height);
            ctx.filter = frameWin.getFilterCss(frameWin.selectedFilter);
            const sx = (vw - side) / 2;
            const sy = (vh - side) / 2;
            ctx.drawImage(frameWin.playbackVideo, sx, sy, side, side, 0, 0, frameWin.workCanvas.width, frameWin.workCanvas.height);
            ctx.restore();
            rafId = requestAnimationFrame(drawFrame);
          };
          try {
            frameWin.playbackVideo.pause();
            frameWin.playbackVideo.currentTime = 0;
          } catch (e) {}
          frameWin.playbackVideo.loop = true;
          frameWin.playbackVideo.muted = true;
          rec.start(100);
          drawFrame();
          try { await frameWin.playbackVideo.play(); } catch (e) {
            cancelAnimationFrame(rafId);
            rec.stop();
            streamOut.getTracks().forEach(track => track.stop());
            return false;
          }
          setTimeout(() => {
            cancelAnimationFrame(rafId);
            frameWin.playbackVideo.pause();
            frameWin.playbackVideo.currentTime = 0;
            rec.stop();
            frameWin.playbackVideo.play().catch(() => {});
          }, durationMs);
          return await finished;
        };
      }
      try {
        const saveWebmBtn = frameWin.document.getElementById('saveWebm');
        if (saveWebmBtn) saveWebmBtn.textContent = 'Use Loop';
      } catch (e) {}
    }
    // hide non-JPEG exports in embed mode defensively
    try {
      ['saveJson','loadJson','exportTxt','jsonFileInput'].forEach(id => {
        const el = frameWin.document.getElementById(id);
        if (el) el.style.display = 'none';
      });
    } catch (e) {}
  } catch (e) {
    console.warn('patchEmbeddedApp failed', e);
  }
}

function openEmbeddedApp(appInfo) {
  if (!appInfo?.path) return;
  appScreenLabel.textContent = appInfo.name;
  activeEmbeddedRoomIndex = pendingRoomIndex;
  const sep = appInfo.path.includes('?') ? '&' : '?';
  appFrame.onload = () => patchEmbeddedApp(appInfo);
  appFrame.src = `${appInfo.path}${sep}embed=1&room=${pendingRoomIndex ?? ''}&msv=38`;
  setScreen('app');
}

function returnFromAppRoom() {
  appFrame.src = 'about:blank';
  activeEmbeddedRoomIndex = null;
  setScreen('editor');
}


async function useCurrentAppInRoom() {
  const roomIndex = activeEmbeddedRoomIndex;
  if (roomIndex === null || roomIndex === undefined || !state.rooms[roomIndex]) {
    alert('Room が選択されていません。');
    return;
  }

  const room = state.rooms[roomIndex];
  const appInfo = appById(room.appId);
  const frameWin = appFrame.contentWindow;
  const frameDoc = appFrame.contentDocument || frameWin?.document;

  if (!appInfo || !frameWin || !frameDoc) {
    alert('APP を読み込めていません。');
    return;
  }

  const beforeUseSignature = roomUseSignature(roomIndex);

  try {
    if (typeof frameWin.__mothershipGetAsset === 'function') {
      const asset = await frameWin.__mothershipGetAsset();
      if (asset && asset.kind === 'video' && asset.videoData) {
        commitRoomVideo(roomIndex, asset.videoData, asset.posterData || null, {
          title: asset.title || appInfo.name,
          note: asset.note || appInfo.desc
        });
        flashUseInRoom('Added');
        return;
      }
      if (asset && asset.imageData) {
        commitRoomImage(roomIndex, asset.imageData, {
          title: asset.title || appInfo.name,
          note: asset.note || appInfo.desc
        });
        flashUseInRoom('Added');
        return;
      }
      if (await finishUseInRoomIfSucceeded(roomIndex, beforeUseSignature)) return;
    }

    if (frameWin.__mothershipLastVideoData) {
      commitRoomVideo(roomIndex, frameWin.__mothershipLastVideoData, frameWin.__mothershipLastPosterData || null, {
        title: frameWin.__mothershipLastVideoMeta?.title || appInfo.name,
        note: frameWin.__mothershipLastVideoMeta?.note || appInfo.desc
      });
      flashUseInRoom('Added');
      return;
    }
    if (frameWin.__mothershipLastImageData) {
      commitRoomImage(roomIndex, frameWin.__mothershipLastImageData, {
        title: frameWin.__mothershipLastImageMeta?.title || appInfo.name,
        note: frameWin.__mothershipLastImageMeta?.note || appInfo.desc
      });
      flashUseInRoom('Added');
      return;
    }

    if (appInfo.id === 'loop') {
      if (typeof frameWin.saveWebm === 'function') {
        await frameWin.saveWebm();
        if (await finishUseInRoomIfSucceeded(roomIndex, beforeUseSignature)) return;
        if (frameWin.__mothershipLastVideoData) {
          commitRoomVideo(roomIndex, frameWin.__mothershipLastVideoData, frameWin.__mothershipLastPosterData || null, {
            title: frameWin.__mothershipLastVideoMeta?.title || appInfo.name,
            note: frameWin.__mothershipLastVideoMeta?.note || appInfo.desc
          });
          flashUseInRoom('Added');
          return;
        }
        alert('Loop がまだ撮影されていません。');
        return;
      }
      alert('Loop がまだ撮影されていません。');
      return;
    }

    let imageData = null;
    let meta = { title: appInfo.name, note: appInfo.desc };

    if (appInfo.id === 'small-memory') {
      if (typeof frameWin.renderPageToCanvas === 'function' && typeof frameWin.getPage === 'function') {
        const page = frameWin.getPage();
        const canvas = frameWin.renderPageToCanvas(page);
        imageData = canvas?.toDataURL('image/jpeg', 0.94);
        const firstLine = String(page?.text || '').split(/\n/).find(Boolean);
        meta = { title: 'SMALL MEMORY', note: firstLine || '言葉を置く' };
      }
    } else if (appInfo.id === 'kaleidoscope') {
      const canvas = frameDoc.getElementById('stage') || frameWin.canvas;
      imageData = canvas?.toDataURL?.('image/jpeg', 0.94);
      meta = { title: '万華鏡', note: '視覚を反復させる' };
    } else if (appInfo.id === 'mandelbrot') {
      const canvas = frameDoc.getElementById('c') || frameWin.canvas;
      imageData = canvas?.toDataURL?.('image/jpeg', 0.94);
      meta = { title: 'Mandelbrot Explorer', note: 'Fractal view' };
    } else if (appInfo.id === 'kirei') {
      const canvas = frameDoc.getElementById('afterCanvas') || frameDoc.querySelector('canvas');
      imageData = canvas?.toDataURL?.('image/jpeg', 0.92);
      meta = { title: 'Kirei Filter', note: '整え後の画像' };
      if (!imageData && typeof frameWin.downloadAfter === 'function') {
        frameWin.downloadAfter();
        flashUseInRoom('Added');
        return;
      }
    } else if (appInfo.id === 'haiku') {
      if (typeof frameWin.saveJpeg === 'function') {
        await frameWin.saveJpeg();
        flashUseInRoom('Added');
        return;
      }
    } else if (appInfo.id === '904') {
      if (typeof frameWin.exportJpegCard === 'function') {
        await frameWin.exportJpegCard();
        flashUseInRoom('Added');
        return;
      }
    } else if (appInfo.id === 'hokago') {
      const saveBtn = frameDoc.getElementById('saveImageBtn');
      if (saveBtn) {
        saveBtn.click();
        flashUseInRoom('Added');
        return;
      }
    } else if (appInfo.id === 'fortune') {
      commitRoomAppExperience(roomIndex, appInfo, {
        title: '100％星占い',
        note: 'Roomから開いて、その日の運勢を占えます'
      });
      flashUseInRoom('Added');
      return;
    }

    if (imageData) {
      commitRoomImage(roomIndex, imageData, meta);
      flashUseInRoom('Added');
      return;
    }

    if (await finishUseInRoomIfSucceeded(roomIndex, beforeUseSignature)) return;

    const guidance = {
      'small-memory': 'SMALL MEMORYに文章を入れてから、もう一度 USE IN ROOM を押してください。',
      mandelbrot: 'マンデルブローが描画されてから、もう一度 USE IN ROOM を押してください。',
      kaleidoscope: '万華鏡は先に写真を選ぶかカメラで撮影してから、USE IN ROOM を押してください。',
      loop: 'Loopは先にカメラで3秒撮影してから、USE IN ROOM を押してください。',
      hokago: '放課後カメラは先に撮影または写真選択をしてから、USE IN ROOM を押してください。'
    };
    alert(guidance[appInfo.id] || 'まだ Room に入れられる画像がありません。先に生成・撮影してから、もう一度 USE IN ROOM を押してください。');
  } catch (error) {
    console.error(error);
    if (await finishUseInRoomIfSucceeded(roomIndex, beforeUseSignature)) return;
    alert('Room への反映に失敗しました。');
  }
}

function flashUseInRoom(text) {
  if (!useInRoomButton) return;
  const old = useInRoomButton.textContent;
  useInRoomButton.textContent = text;
  useInRoomButton.disabled = true;
  setTimeout(() => {
    useInRoomButton.textContent = old;
    useInRoomButton.disabled = false;
  }, 900);
}

function chooseFormat(count) {
  state.format = count;
  state.rooms = createRooms(count);
  resetInteractionModes();
  setScreen('editor');
  render();
}

function resetInteractionModes() {
  swapSourceIndex = null;
  removingMode = false;
  arrangingMode = false;
  draggedRoomIndex = null;
  swapModeButton.textContent = 'Arrange';
  removeButton.textContent = 'Remove';
}

function render() {
  if (!state.format) return;
  formatLabel.textContent = `${state.format} Room${state.format > 1 ? 's' : ''}`;
  const grid = document.createElement('div');
  grid.className = `room-grid rooms-${state.format}`;

  state.rooms.forEach((room, index) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'room-card';
    if (!room.appId) card.classList.add('empty');
    if (room.appId && appById(room.appId)?.locked) card.classList.add('ai');
    const isRoomAppExperience = !!room.appExperience || room.appId === 'fortune';
    if (room.appId) card.classList.add(`app-${room.appId}`);
    if (isRoomAppExperience) card.classList.add('app-experience');
    if (swapSourceIndex === index) card.classList.add('swap-selected');
    if (arrangingMode) card.classList.add('arrange-ready');
    card.dataset.index = String(index);
    card.draggable = arrangingMode;
    const roomPoster = room.posterData || room.imageData || '';
    card.style.backgroundImage = '';
    if (roomPoster && !isRoomAppExperience) {
      card.classList.add('has-image');
    } else {
      card.classList.remove('has-image');
    }
    if (room.videoData) {
      card.classList.add('has-video');
    } else {
      card.classList.remove('has-video');
    }
    card.addEventListener('click', () => handleRoomClick(index));
    card.addEventListener('dragstart', (event) => {
      if (!arrangingMode) { event.preventDefault(); return; }
      draggedRoomIndex = index;
      card.classList.add('dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(index));
    });
    card.addEventListener('dragover', (event) => {
      if (!arrangingMode || draggedRoomIndex === null) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    });
    card.addEventListener('drop', (event) => {
      if (!arrangingMode || draggedRoomIndex === null || draggedRoomIndex === index) return;
      event.preventDefault();
      [state.rooms[draggedRoomIndex], state.rooms[index]] = [state.rooms[index], state.rooms[draggedRoomIndex]];
      draggedRoomIndex = null;
      render();
    });
    card.addEventListener('dragend', () => {
      draggedRoomIndex = null;
      render();
    });

    if (!room.appId) {
      card.innerHTML = `
        <div class="room-number">Room ${index + 1}</div>
        <div class="room-placeholder">Add App</div>
      `;
    } else {
      const appInfo = appById(room.appId);
      const displayNoteRaw = room.note || room.title || appInfo.desc || '';
      const displayNote = displayNoteRaw === appInfo.name ? '' : displayNoteRaw;
      const isAppExperience = !!room.appExperience || appInfo.id === 'fortune';
      const mediaHtml = (!isAppExperience && (room.videoData || roomPoster))
        ? `<div class="room-media ${room.videoData ? 'is-video' : 'is-image'}">${room.videoData ? `<video class="room-video" src="${room.videoData}" ${room.posterData ? `poster="${room.posterData}"` : ''} muted loop playsinline autoplay preload="metadata"></video>` : `<img class="room-image" src="${roomPoster}" alt="Room ${index + 1}">`}${room.videoData ? '<div class="room-play">▶</div>' : ''}</div>`
        : '';
      const badgeHtml = isAppExperience
        ? '<div class="room-badge">Open App</div>'
        : (appInfo.locked ? '<div class="room-badge"><span class="lock-mark">🔒</span>Locked</div>' : '<div class="room-badge">Public</div>');
      const appDecoHtml = isAppExperience && appInfo.id === 'fortune'
        ? '<div class="fortune-top-deco" aria-hidden="true"><span>☾</span><span>✦</span><span>♡</span></div>'
        : '';
      card.innerHTML = `
        ${mediaHtml}
        ${appDecoHtml}
        <div class="room-overlay">
          <div class="room-number">Room ${index + 1}</div>
          <div class="room-app">${appInfo.name}</div>
          ${badgeHtml}
          ${displayNote ? `<div class="room-note">${escapeHtml(displayNote)}</div>` : ''}
          ${isAppExperience ? '<div class="room-action-hint">Tap to play</div>' : ''}
        </div>
      `;
      const mediaTarget = card.querySelector('.room-media');
      if (mediaTarget) {
        mediaTarget.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (arrangingMode || removingMode) return;
          openRoomPreview(index);
        });
      }
    }

    grid.appendChild(card);
  });
  canvasWrap.innerHTML = '';
  canvasWrap.appendChild(grid);
  saveState();
}

function openRoomPreview(index) {
  const room = state.rooms[index];
  if (!room) return;
  const popup = window.open('', '_blank');
  if (!popup) {
    alert('プレビューを開けませんでした。ポップアップを許可してください。');
    return;
  }
  const title = `Room ${index + 1}`;
  const media = room.videoData
    ? `<video src="${room.videoData}" ${room.posterData ? `poster="${room.posterData}"` : ''} controls autoplay muted loop playsinline style="max-width:100%;max-height:100%;border-radius:20px;background:#000;"></video>`
    : `<img src="${room.posterData || room.imageData || ''}" alt="${title}" style="max-width:100%;max-height:100%;border-radius:20px;display:block;">`;
  popup.document.open();
  popup.document.write(`<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
html,body{margin:0;height:100%;background:#111;color:#fff;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;}
.wrap{min-height:100%;display:grid;place-items:center;padding:24px;box-sizing:border-box;}
.stage{display:grid;gap:14px;justify-items:center;max-width:min(96vw,1080px);width:100%;}
.label{font-size:14px;letter-spacing:.08em;color:rgba(255,255,255,.7);}
</style>
</head>
<body>
  <div class="wrap">
    <div class="stage">
      <div class="label">${title}</div>
      ${media}
    </div>
  </div>
</body>
</html>`);
  popup.document.close();
}
function handleRoomClick(index) {
  if (arrangingMode) return;

  if (removingMode) {
    state.rooms[index] = blankRoom(index);
    render();
    return;
  }

  pendingRoomIndex = index;
  const room = state.rooms[index];
  if (room.appId) {
    const appInfo = appById(room.appId);
    const hasRoomAsset = Boolean(room.imageData || room.posterData || room.videoData);
    if ((room.appExperience || appInfo?.id === 'fortune' || !hasRoomAsset) && appInfo?.path) {
      pendingApp = appInfo;
      openEmbeddedApp(appInfo);
      return;
    }
    openRoomActions(index);
  } else {
    openAppPicker(index);
  }
}

function openRoomActions(index) {
  pendingRoomIndex = index;
  const room = state.rooms[index];
  pendingApp = appById(room.appId);
  choiceTitle.textContent = pendingApp.name;
  newButton.textContent = 'Edit';
  libraryPickButton.textContent = 'Change';
  saveRoomJpegButton.classList.remove('hidden');
  removeRoomButton.classList.remove('hidden');
  choiceDialog.showModal();
}

function openAppPicker(index) {
  pendingRoomIndex = index;
  pickerRoomLabel.textContent = `Room ${index + 1}`;
  appList.innerHTML = '';
  APPS.forEach(appInfo => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `app-item${appInfo.locked ? ' ai' : ''}`;
    btn.innerHTML = `
      <div class="app-name"><strong>${appInfo.name}</strong>${appInfo.locked ? '<span class="room-badge">🔒 AI</span>' : ''}</div>
      <div class="app-copy">${appInfo.desc}</div>
    `;
    btn.addEventListener('click', () => selectApp(appInfo));
    appList.appendChild(btn);
  });
  appPickerDialog.showModal();
}

function selectApp(appInfo) {
  pendingApp = appInfo;
  appPickerDialog.close();
  if (appInfo.locked && !unlocked) {
    passwordInput.value = '';
    passwordError.classList.add('hidden');
    passwordDialog.showModal();
    return;
  }
  buildNewRoom();
}

function openEditorForRoom() {
  const room = state.rooms[pendingRoomIndex];
  editorTitle.textContent = `Room ${pendingRoomIndex + 1}`;
  editorAppLabel.textContent = appById(room.appId).name;
  roomTitleInput.value = room.title || '';
  roomNoteInput.value = room.note || '';
  editorDialog.showModal();
}

function saveCurrentRoomEdit() {
  const room = state.rooms[pendingRoomIndex];
  room.title = roomTitleInput.value.trim();
  room.note = roomNoteInput.value.trim();
  room.createdAt = room.createdAt || new Date().toISOString();
  room.source = room.source || 'new';
  upsertLibrary(room);
  editorDialog.close();
  render();
}

function upsertLibrary(room) {
  const entry = {
    id: room.id,
    appId: room.appId,
    title: room.title,
    note: room.note,
    imageData: room.imageData || null,
    posterData: room.posterData || null,
    videoData: room.videoData && String(room.videoData).length < 1600000 ? room.videoData : null,
    appExperience: !!room.appExperience || room.appId === 'fortune',
    createdAt: room.createdAt || new Date().toISOString(),
  };
  const idx = library.findIndex(item => item.id === entry.id);
  if (idx >= 0) library[idx] = entry;
  else library.unshift(entry);
  saveLibrary();
}

function openLibrary(appId) {
  libraryTitle.textContent = `${appById(appId).name} Library`;
  const items = library.filter(item => item.appId === appId);
  libraryList.innerHTML = '';
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'library-item';
    empty.innerHTML = '<div class="library-copy">まだ保存された素材がありません。</div>';
    libraryList.appendChild(empty);
  } else {
    items.forEach(item => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'library-item';
      btn.innerHTML = `
        <div><strong>${escapeHtml(item.title || appById(item.appId).name)}</strong></div>
        <div class="library-copy">${escapeHtml(item.note || 'No note')}</div>
        <div class="library-meta"><span>${new Date(item.createdAt).toLocaleString('ja-JP')}</span></div>
      `;
      btn.addEventListener('click', () => {
        state.rooms[pendingRoomIndex] = {
          id: crypto.randomUUID ? crypto.randomUUID() : `room-${Date.now()}-${pendingRoomIndex}`,
          appId: item.appId,
          title: item.title,
          note: item.note,
          imageData: item.imageData || null,
          posterData: item.posterData || null,
          videoData: item.videoData || null,
          appExperience: !!item.appExperience || item.appId === 'fortune',
          createdAt: item.createdAt,
          source: 'library',
        };
        libraryDialog.close();
        choiceDialog.close();
        render();
      });
      libraryList.appendChild(btn);
    });
  }
  libraryDialog.showModal();
}

function openGlobalLibrary() {
  libraryTitle.textContent = 'Global Library';
  libraryList.innerHTML = '';
  if (!library.length) {
    const empty = document.createElement('div');
    empty.className = 'library-item';
    empty.innerHTML = '<div class="library-copy">まだ保存された素材がありません。</div>';
    libraryList.appendChild(empty);
  } else {
    library.forEach(item => {
      const div = document.createElement('div');
      div.className = 'library-item';
      div.innerHTML = `
        <div><strong>${escapeHtml(item.title || appById(item.appId).name)}</strong></div>
        <div class="library-copy">${escapeHtml(item.note || 'No note')}</div>
        <div class="library-meta"><span>${appById(item.appId).name}</span><span>${new Date(item.createdAt).toLocaleString('ja-JP')}</span></div>
      `;
      libraryList.appendChild(div);
    });
  }
  libraryDialog.showModal();
}

function buildNewRoom() {
  state.rooms[pendingRoomIndex] = {
    id: crypto.randomUUID ? crypto.randomUUID() : `room-${Date.now()}-${pendingRoomIndex}`,
    appId: pendingApp.id,
    title: pendingApp.name,
    note: pendingApp.desc,
    createdAt: new Date().toISOString(),
    source: 'new',
    imageData: null,
    posterData: null,
    videoData: null,
    appExperience: pendingApp.id === 'fortune',
  };
  choiceDialog.close();
  render();
  if (pendingApp.path) openEmbeddedApp(pendingApp);
  else openEditorForRoom();
}

function unlockAi() {
  if (!AI_PASSWORD) {
    passwordError.textContent = '公開版ではAI用の合言葉は入れていません。GitHub公開用の安全状態です。';
    passwordError.classList.remove('hidden');
    return;
  }
  if (passwordInput.value !== AI_PASSWORD) {
    passwordError.textContent = '合言葉が違います。';
    passwordError.classList.remove('hidden');
    return;
  }
  unlocked = true;
  localStorage.setItem(UNLOCK_KEY, '1');
  passwordDialog.close();
  if (pendingApp && pendingRoomIndex !== null && pendingRoomIndex !== undefined) {
    buildNewRoom();
  }
}


function removeCurrentRoomFromDialog() {
  if (pendingRoomIndex === null) return;
  state.rooms[pendingRoomIndex] = blankRoom(pendingRoomIndex);
  choiceDialog.close();
  render();
}

function dataUrlToImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

async function saveCurrentRoomJpeg() {
  if (pendingRoomIndex === null) return;
  const room = state.rooms[pendingRoomIndex];
  if (!room || !room.appId) return;

  const appInfo = appById(room.appId);
  const size = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { alpha: false });

  const roomPreview = room.posterData || room.imageData;
  if (roomPreview) {
    try {
      const img = await dataUrlToImage(roomPreview);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      const side = Math.min(img.naturalWidth || img.width, img.naturalHeight || img.height);
      const sx = ((img.naturalWidth || img.width) - side) / 2;
      const sy = ((img.naturalHeight || img.height) - side) / 2;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
      const filename = `room-${pendingRoomIndex + 1}-${room.appId}-${Date.now()}.jpg`;
      canvas.toBlob((blob) => {
        if (blob) downloadBlob(blob, filename);
      }, 'image/jpeg', 0.94);
      choiceDialog.close();
      return;
    } catch (e) {}
  }

  const isAi = !!appInfo.locked;
  if (isAi) {
    const grad = ctx.createLinearGradient(0, 0, 0, size);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, '#f2eee5');
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = '#ffffff';
  }
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 3;
  roundRect(ctx, 18, 18, size - 36, size - 36, 40);
  ctx.stroke();

  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.font = '500 34px -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif';
  ctx.fillText(`Room ${pendingRoomIndex + 1}`, 72, 110);

  ctx.fillStyle = 'rgba(0,0,0,0.82)';
  ctx.font = '600 62px -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif';
  wrapText(ctx, appInfo.name, 72, 220, size - 144, 76, 3);

  if (appInfo.locked) {
    drawBadge(ctx, '🔒 Locked', 72, size - 170);
  } else {
    drawBadge(ctx, 'Public', 72, size - 170);
  }

  const copy = room.title || room.note || appInfo.desc || '';
  ctx.fillStyle = 'rgba(0,0,0,0.62)';
  ctx.font = '400 40px -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif';
  wrapText(ctx, copy, 72, 360, size - 144, 56, 8);

  const filename = `room-${pendingRoomIndex + 1}-${room.appId}-${Date.now()}.jpg`;
  canvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, filename);
  }, 'image/jpeg', 0.94);

  choiceDialog.close();
}

function drawBadge(ctx, text, x, y) {
  ctx.save();
  ctx.font = '500 30px -apple-system, BlinkMacSystemFont, Helvetica, Arial, sans-serif';
  const paddingX = 22;
  const paddingY = 14;
  const width = ctx.measureText(text).width + paddingX * 2;
  const height = 52;
  ctx.fillStyle = 'rgba(0,0,0,0.05)';
  roundRect(ctx, x, y, width, height, 26);
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillText(text, x + paddingX, y + 35);
  ctx.restore();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const words = String(text).split(/\s+/);
  let line = '';
  let lineCount = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y + lineCount * lineHeight);
      line = words[i];
      lineCount += 1;
      if (lineCount >= maxLines - 1) break;
    } else {
      line = test;
    }
  }
  if (lineCount < maxLines) {
    let finalLine = line;
    if (ctx.measureText(finalLine).width > maxWidth) {
      while (finalLine.length && ctx.measureText(finalLine + '…').width > maxWidth) {
        finalLine = finalLine.slice(0, -1);
      }
      finalLine += '…';
    }
    ctx.fillText(finalLine, x, y + lineCount * lineHeight);
  }
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function exportJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `mothership-${Date.now()}.json`);
}

function exportGiftPayload() {
  return {
    app: 'A massage to you!',
    format: state.format,
    createdAt: new Date().toISOString(),
    rooms: (state.rooms || []).map((room, index) => {
      const appInfo = appById(room.appId) || {};
      return {
        index,
        appId: room.appId || null,
        appName: appInfo.name || room.title || '',
        locked: !!appInfo.locked,
        title: room.title || appInfo.name || '',
        note: room.note || appInfo.desc || '',
        imageData: room.imageData || null,
        posterData: room.posterData || room.imageData || null,
        videoData: room.videoData && String(room.videoData).length < 1600000 ? room.videoData : null,
        appExperience: !!room.appExperience || room.appId === 'fortune',
        appUrl: (room.appExperience || room.appId === 'fortune') && appInfo.path ? appExperienceUrl(appInfo) : '',
      };
    }),
  };
}

function makeGiftHtml() {
  const payload = exportGiftPayload();
  const safeJson = JSON.stringify(payload).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#f5f5f2">
<title>A massage to you!</title>
<style>
:root{--bg:#f5f5f2;--card:#fff;--text:rgba(0,0,0,.82);--muted:rgba(0,0,0,.46);--line:rgba(0,0,0,.09);--shadow:0 10px 30px rgba(0,0,0,.06);--ai:#f2eee5;}
*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",Helvetica,Arial,sans-serif;}body{min-height:100vh;}
.shell{width:min(980px,100%);margin:0 auto;padding:calc(22px + env(safe-area-inset-top)) 16px calc(28px + env(safe-area-inset-bottom));}
.header{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:20px}.brand{font-size:14px;letter-spacing:.16em;color:var(--muted)}.meta{font-size:12px;color:var(--muted);text-align:right;line-height:1.5}
.hero{background:rgba(255,255,255,.52);border:1px solid var(--line);border-radius:24px;padding:18px;margin-bottom:14px;box-shadow:var(--shadow)}h1{margin:0 0 8px;font-size:clamp(26px,5vw,42px);letter-spacing:.04em}.lead{margin:0;color:var(--muted);line-height:1.65}
.room-grid{display:grid;gap:12px}.rooms-1{grid-template-columns:1fr;max-width:540px;margin:0 auto}.rooms-3,.rooms-9{grid-template-columns:repeat(3,1fr)}
.room{position:relative;aspect-ratio:1;border:1px solid var(--line);border-radius:20px;background:var(--card);box-shadow:var(--shadow);overflow:hidden;display:grid;align-content:end;padding:14px;min-width:0}.room.ai{background:linear-gradient(180deg,#fff 0%,var(--ai) 100%)}.room.empty{align-content:center;justify-items:center;color:var(--muted)}.room.app-room{background:radial-gradient(circle at 24% 18%,rgba(255,255,255,.95),rgba(242,238,229,.92) 42%,rgba(218,211,196,.8));cursor:pointer}.room.app-fortune{border-color:rgba(196,152,199,.32);background:linear-gradient(145deg,#fff7fb 0%,#fff6df 44%,#eee9ff 100%)}.room.app-fortune:before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 22% 18%,rgba(255,255,255,.92) 0 9%,transparent 10%),radial-gradient(circle at 72% 22%,rgba(255,219,243,.68) 0 12%,transparent 13%),radial-gradient(circle at 78% 78%,rgba(212,204,255,.7) 0 16%,transparent 17%);pointer-events:none}.fortune-top-deco{position:absolute;left:14px;top:14px;right:64px;display:flex;gap:7px;align-items:center;color:#9d6ca4;font-size:18px;z-index:1}.fortune-top-deco span{display:grid;place-items:center;width:24px;height:24px;border-radius:999px;background:rgba(255,255,255,.58);box-shadow:0 6px 16px rgba(127,94,120,.12)}.room.app-fortune .badge{background:rgba(255,255,255,.56);color:#8b627f;border:1px solid rgba(255,255,255,.68)}.app-mark{position:absolute;right:14px;top:14px;width:42px;height:42px;border-radius:999px;background:rgba(255,255,255,.66);display:grid;place-items:center;font-size:20px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.72);color:#9d6ca4}.app-room .overlay{align-self:end}.app-room .hint{font-size:12px;color:var(--muted)}
.media{position:absolute;inset:0;z-index:0;background:#111}.media img,.media video{width:100%;height:100%;object-fit:cover;display:block}.room.has-media{padding:0;background:#111;cursor:zoom-in}.room.has-media:before{content:"";position:absolute;inset:0;z-index:1;background:linear-gradient(to top,rgba(0,0,0,.58),rgba(0,0,0,.13) 52%,rgba(0,0,0,.04));pointer-events:none}.overlay{position:relative;z-index:2;display:grid;gap:6px;padding:14px}.has-media .overlay{align-self:end}.has-media .number,.has-media .name,.has-media .note{color:#fff}.number{font-size:12px;color:var(--muted)}.name{font-size:16px;line-height:1.25}.note{font-size:12px;line-height:1.35;color:var(--muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.badge{display:inline-flex;width:fit-content;padding:5px 9px;border-radius:999px;background:rgba(0,0,0,.05);font-size:11px;color:var(--muted)}.has-media .badge{background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.22);color:#fff}.play{position:absolute;right:14px;top:14px;z-index:3;width:42px;height:42px;display:grid;place-items:center;border-radius:999px;background:rgba(0,0,0,.42);border:1px solid rgba(255,255,255,.22);color:#fff;backdrop-filter:blur(4px)}
.viewer{position:fixed;inset:0;background:rgba(0,0,0,.74);z-index:20;display:none;place-items:center;padding:18px}.viewer.open{display:grid}.viewer-card{position:relative;width:min(92vw,900px);aspect-ratio:1;background:#111;border-radius:24px;overflow:hidden;box-shadow:0 24px 90px rgba(0,0,0,.34)}.viewer-card.is-app{width:min(96vw,780px);height:min(88vh,940px);aspect-ratio:auto;background:#f5f5f2}.viewer-card img,.viewer-card video{width:100%;height:100%;object-fit:contain;display:block}.viewer-card iframe{width:100%;height:100%;border:0;background:#f5f5f2}.close{position:absolute;right:12px;top:12px;z-index:4;width:42px;height:42px;border:1px solid rgba(255,255,255,.25);border-radius:999px;background:rgba(255,255,255,.9);font-size:28px;line-height:1;cursor:pointer}
.footer{margin-top:18px;color:var(--muted);font-size:12px;line-height:1.6;text-align:center}@media(max-width:740px){.room-grid{gap:8px}.room{border-radius:16px}.overlay{padding:10px}.name{font-size:13px}.note{font-size:11px}.hero{border-radius:20px}}
</style>
</head>
<body>
<div class="shell">
  <header class="header"><div class="brand">Mothership</div><div id="meta" class="meta"></div></header>
  <section class="hero"><h1>A massage to you!</h1><p class="lead">送られてきた作品や画像を見たり、Room内のアプリを開いて体験できます。</p></section>
  <main id="rooms"></main>
  <div class="footer">Generated by Mothership</div>
</div>
<div id="viewer" class="viewer" aria-hidden="true"><div class="viewer-card"><button id="close" class="close" type="button" aria-label="Close">×</button><div id="viewerStage"></div></div></div>
<script id="payload" type="application/json">${safeJson}</script>
<script>
const payload = JSON.parse(document.getElementById('payload').textContent);
const roomsEl = document.getElementById('rooms');
const metaEl = document.getElementById('meta');
const viewer = document.getElementById('viewer');
const viewerStage = document.getElementById('viewerStage');
const closeBtn = document.getElementById('close');
function esc(v){return String(v || '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#039;");}
function render(){
  const count = Number(payload.format) || (payload.rooms || []).length || 1;
  roomsEl.className = 'room-grid rooms-' + count;
  metaEl.textContent = count + ' Room' + (count > 1 ? 's' : '');
  roomsEl.innerHTML = (payload.rooms || []).map((room, i) => {
    const poster = room.posterData || room.imageData || '';
    const isAppRoom = !!room.appExperience && !!room.appUrl;
    const media = room.videoData
      ? '<div class="media"><video src="' + room.videoData + '" ' + (poster ? 'poster="' + poster + '" ' : '') + 'muted loop playsinline autoplay preload="metadata"></video></div><div class="play">▶</div>'
      : (poster ? '<div class="media"><img src="' + poster + '" alt="Room ' + (i + 1) + '"></div>' : '');
    const badge = room.appId ? '<div class="badge">' + (isAppRoom ? 'Open App' : (room.locked ? '🔒 Locked' : 'Public')) + '</div>' : '';
    const note = room.note && room.note !== room.appName ? '<div class="note">' + esc(room.note) + '</div>' : '';
    const appClass = room.appId ? ('app-' + String(room.appId).replace(/[^a-z0-9_-]/gi, '')) : '';
    const appDeco = isAppRoom && room.appId === 'fortune' ? '<div class="fortune-top-deco" aria-hidden="true"><span>☾</span><span>✦</span><span>♡</span></div>' : '';
    const content = room.appId
      ? appDeco + (isAppRoom ? '<div class="app-mark">✦</div>' : media) + '<div class="overlay"><div class="number">Room ' + (i + 1) + '</div><div class="name">' + esc(room.appName || room.title || 'Room') + '</div>' + badge + note + (isAppRoom ? '<div class="hint">Tap to open</div>' : '') + '</div>'
      : '<div class="number">Room ' + (i + 1) + '</div><div>Empty</div>';
    return '<button class="room ' + appClass + ' ' + (room.locked ? 'ai ' : '') + (isAppRoom ? 'app-room ' : '') + ((poster || room.videoData) && !isAppRoom ? 'has-media' : '') + (!room.appId ? ' empty' : '') + '" type="button" data-index="' + i + '">' + content + '</button>';
  }).join('');
  roomsEl.querySelectorAll('.room.has-media,.room.app-room').forEach(button => {
    button.addEventListener('click', () => openViewer(Number(button.dataset.index)));
  });
}
function openViewer(index){
  const room = payload.rooms[index];
  if (!room) return;
  const card = viewer.querySelector('.viewer-card');
  card.classList.toggle('is-app', !!room.appExperience && !!room.appUrl);
  if (room.appExperience && room.appUrl) {
    viewerStage.innerHTML = '<iframe src="' + esc(room.appUrl) + '" title="' + esc(room.appName || room.title || 'App') + '" allow="camera; microphone; clipboard-read; clipboard-write"></iframe>';
  } else {
    viewerStage.innerHTML = room.videoData
      ? '<video src="' + room.videoData + '" ' + (room.posterData ? 'poster="' + room.posterData + '" ' : '') + 'controls autoplay muted loop playsinline></video>'
      : '<img src="' + (room.posterData || room.imageData || '') + '" alt="Room ' + (index + 1) + '">';
  }
  viewer.classList.add('open');
  viewer.setAttribute('aria-hidden','false');
}
function closeViewer(){const card=viewer.querySelector('.viewer-card');card.classList.remove('is-app');viewer.classList.remove('open');viewer.setAttribute('aria-hidden','true');viewerStage.innerHTML='';}
closeBtn.addEventListener('click', closeViewer);
viewer.addEventListener('click', e => { if (e.target === viewer) closeViewer(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeViewer(); });
render();
</script>
</body>
</html>`;
}

function buildGiftHtmlBlob() {
  if (!state.format || !Array.isArray(state.rooms)) {
    alert('先に Room の形式を選んでください。');
    return null;
  }
  const hasRoom = state.rooms.some(room => room.appId || room.imageData || room.posterData || room.videoData);
  if (!hasRoom) {
    alert('HTML に入れる Room がまだありません。');
    return null;
  }
  const html = makeGiftHtml();
  const filename = `mothership-${Date.now()}.html`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  return { blob, filename };
}

function downloadHtml() {
  const gift = buildGiftHtmlBlob();
  if (!gift) return;
  downloadBlob(gift.blob, gift.filename);
}

async function sendHtml() {
  const gift = buildGiftHtmlBlob();
  if (!gift) return;
  let file = null;
  try {
    file = new File([gift.blob], gift.filename, { type: 'text/html' });
  } catch {
    downloadBlob(gift.blob, gift.filename);
    return;
  }
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
      await navigator.share({
        files: [file],
        title: 'A massage to you!',
        text: 'Mothership HTML',
      });
      return;
    }
  } catch (error) {
    if (error?.name === 'AbortError') return;
  }
  downloadBlob(gift.blob, gift.filename);
}



window.addEventListener('message', (event) => {
  const payload = event?.data;
  if (!payload || !payload.type) return;
  const roomIndex = Number.isInteger(payload.roomIndex) ? payload.roomIndex : activeEmbeddedRoomIndex;
  if (payload.type === 'mothership:image' && payload.imageData) {
    commitRoomImage(roomIndex, payload.imageData, payload);
    if (roomIndex === activeEmbeddedRoomIndex) flashUseInRoom('Added');
  } else if (payload.type === 'mothership:video' && payload.videoData) {
    commitRoomVideo(roomIndex, payload.videoData, payload.posterData, payload);
    if (roomIndex === activeEmbeddedRoomIndex) flashUseInRoom('Added');
  }
});

function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      if (!parsed || !Array.isArray(parsed.rooms) || !parsed.format) throw new Error('invalid');
      state = parsed;
      resetInteractionModes();
      setScreen('editor');
      render();
    } catch {
      alert('JSON を読み込めませんでした。');
    }
  };
  reader.readAsText(file);
}

function dataUrlToBlob(dataUrl) {
  const [meta, data] = dataUrl.split(',');
  const mime = /data:([^;]+)/.exec(meta)?.[1] || 'image/jpeg';
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function escapeHtml(value) {
  return (value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

document.querySelectorAll('[data-format]').forEach(btn => {
  btn.addEventListener('click', () => chooseFormat(Number(btn.dataset.format)));
});

homeButton.addEventListener('click', () => setScreen('home'));
appBackButton.addEventListener('click', returnFromAppRoom);
useInRoomButton.addEventListener('click', useCurrentAppInRoom);
changeFormatButton.addEventListener('click', () => setScreen('home'));
swapModeButton.addEventListener('click', () => {
  removingMode = false;
  removeButton.textContent = 'Remove';
  arrangingMode = !arrangingMode;
  draggedRoomIndex = null;
  swapSourceIndex = null;
  swapModeButton.textContent = arrangingMode ? 'Done' : 'Arrange';
  render();
});
removeButton.addEventListener('click', () => {
  swapSourceIndex = null;
  swapModeButton.textContent = 'Swap';
  removingMode = !removingMode;
  removeButton.textContent = removingMode ? 'Tap Room' : 'Remove';
});
clearButton.addEventListener('click', () => {
  if (confirm('現在の room 配置を消しますか？')) {
    state.rooms = createRooms(state.format);
    resetInteractionModes();
    render();
  }
});
libraryButton.addEventListener('click', openGlobalLibrary);
downloadHtmlButton.addEventListener('click', downloadHtml);
sendHtmlButton.addEventListener('click', sendHtml);
exportButton.addEventListener('click', exportJson);
importInput.addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  if (file) importJson(file);
  importInput.value = '';
});
newButton.addEventListener('click', () => {
  if (newButton.textContent === 'Edit') {
    choiceDialog.close();
    if (pendingApp?.path) openEmbeddedApp(pendingApp);
    else openEditorForRoom();
  } else {
    buildNewRoom();
  }
});
libraryPickButton.addEventListener('click', () => {
  if (libraryPickButton.textContent === 'Change') {
    choiceDialog.close();
    openAppPicker(pendingRoomIndex);
  } else {
    openLibrary(pendingApp.id);
  }
});
saveRoomJpegButton.addEventListener('click', saveCurrentRoomJpeg);
removeRoomButton.addEventListener('click', removeCurrentRoomFromDialog);
saveRoomButton.addEventListener('click', saveCurrentRoomEdit);
unlockButton.addEventListener('click', unlockAi);
passwordInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    unlockAi();
  }
});

if (state.screen === 'app' && state.format) setScreen('editor');
else if (state.screen === 'editor' && state.format) setScreen('editor');
else setScreen('home');
render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
