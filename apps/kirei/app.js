const EMBEDDED_UNLOCK = new URLSearchParams(location.search).get('embed') === '1' && localStorage.getItem('mothership_ai_unlock_v1') === '1';
const EMBED_ROOM_INDEX = Number(new URLSearchParams(location.search).get('room') || -1);
function notifyMothershipImage(imageData, meta = {}) {
  try {
    window.__mothershipLastImageData = imageData;
    window.__mothershipLastImageMeta = meta || {};
    if (window.parent && window.parent !== window && imageData) {
      window.parent.postMessage({ type: 'mothership:image', roomIndex: Number.isFinite(EMBED_ROOM_INDEX) && EMBED_ROOM_INDEX >= 0 ? EMBED_ROOM_INDEX : undefined, imageData, ...meta }, '*');
    }
  } catch (e) {}
}
const fileInput = document.getElementById('fileInput');
const dropzone = document.getElementById('dropzone');
const uploadPanel = document.getElementById('uploadPanel');
const keywordInput = document.getElementById('keywordInput');
const keywordLockButton = document.getElementById('keywordLockButton');
const keywordResetButton = document.getElementById('keywordResetButton');
const keywordStatus = document.getElementById('keywordStatus');
const analyzeButton = document.getElementById('analyzeButton');
const beforeAfterButton = document.getElementById('beforeAfterButton');
const downloadButton = document.getElementById('downloadButton');
const strengthSlider = document.getElementById('strengthSlider');
const strengthValue = document.getElementById('strengthValue');
const categoryBadge = document.getElementById('categoryBadge');
const statusText = document.getElementById('statusText');
const analysisSummary = document.getElementById('analysisSummary');
const analysisGrid = document.getElementById('analysisGrid');
const beforeCanvas = document.getElementById('beforeCanvas');
const afterCanvas = document.getElementById('afterCanvas');

const beforeCtx = beforeCanvas.getContext('2d');
const afterCtx = afterCanvas.getContext('2d');

let currentImage = null;
let currentImageDataUrl = '';
let aiResult = null;
let showOnlyAfter = false;
let isAuthenticated = false;

const installButton = document.getElementById('installButton');
const installHint = document.getElementById('installHint');
let deferredInstallPrompt = null;

function isStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function updateInstallUi() {
  if (!installButton || !installHint) return;

  if (isStandaloneMode()) {
    installButton.hidden = true;
    installButton.disabled = true;
    installHint.textContent = 'ホーム画面に追加済みです。';
    return;
  }

  if (deferredInstallPrompt) {
    installButton.hidden = false;
    installButton.disabled = false;
    installHint.textContent = 'この端末ではアプリのように追加できます。';
    return;
  }

  installButton.hidden = true;
  installButton.disabled = true;
  installHint.textContent = isIOS()
    ? 'iPhone / iPad は共有メニューから「ホーム画面に追加」を使ってください。'
    : 'インストール可能になるとここに案内が出ます。';
}

async function installPwa() {
  if (!deferredInstallPrompt) {
    updateInstallUi();
    return;
  }

  deferredInstallPrompt.prompt();
  const result = await deferredInstallPrompt.userChoice;
  if (result?.outcome !== 'accepted') {
    installHint.textContent = 'あとで追加したくなったら、もう一度お試しください。';
  }
  deferredInstallPrompt = null;
  updateInstallUi();
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  updateInstallUi();
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  updateInstallUi();
});

installButton?.addEventListener('click', installPwa);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.warn('service worker registration failed', error);
    });
  });
}

const neutralParams = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
  blur: 0,
  warmth: 0,
};

function setStatus(text) {
  statusText.textContent = text;
}

function setCategory(text) {
  categoryBadge.textContent = text;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function interpolate(a, b, t) {
  return a + (b - a) * t;
}

function updateLockState() {
  uploadPanel.classList.toggle('locked', !isAuthenticated);
  fileInput.disabled = !isAuthenticated;
  dropzone.classList.toggle('disabled', !isAuthenticated);
  keywordInput.disabled = isAuthenticated;
  keywordLockButton.disabled = isAuthenticated || !keywordInput.value.trim();
  keywordResetButton.disabled = !isAuthenticated;

  if (isAuthenticated) {
    keywordInput.value = '';
    keywordInput.placeholder = '認証済み';
    keywordStatus.textContent = '認証済みです。この端末では次回から自動で使えます。';
    setStatus(currentImage ? '画像を読み込みました' : '画像を入れてください');
    analyzeButton.disabled = !currentImageDataUrl;
  } else {
    keywordInput.placeholder = 'キーワードを入力';
    keywordStatus.textContent = 'キーワード自体は画面に表示しません。';
    analyzeButton.disabled = true;
    beforeAfterButton.disabled = !currentImage;
    downloadButton.disabled = !currentImage;
    setStatus('先に認証してください');
  }
}

function resetAnalysisView() {
  analysisSummary.textContent = 'まだ解析していません。';
  analysisGrid.innerHTML = `
    <div><dt>主役</dt><dd>-</dd></div>
    <div><dt>補正方針</dt><dd>-</dd></div>
    <div><dt>おすすめ</dt><dd>-</dd></div>
    <div><dt>注意点</dt><dd>-</dd></div>
  `;
}

function computeAppliedParams() {
  if (!aiResult) return neutralParams;
  const t = Number(strengthSlider.value) / 100;
  const p = aiResult.params || neutralParams;
  return {
    brightness: interpolate(1, p.brightness ?? 1, t),
    contrast: interpolate(1, p.contrast ?? 1, t),
    saturation: interpolate(1, p.saturation ?? 1, t),
    blur: interpolate(0, p.blur ?? 0, t),
    warmth: interpolate(0, p.warmth ?? 0, t),
  };
}

function fitCanvas(canvas, img) {
  const maxWidth = 1400;
  const scale = Math.min(1, maxWidth / img.width);
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
}

function drawBefore() {
  if (!currentImage) return;
  fitCanvas(beforeCanvas, currentImage);
  beforeCtx.clearRect(0, 0, beforeCanvas.width, beforeCanvas.height);
  beforeCtx.drawImage(currentImage, 0, 0, beforeCanvas.width, beforeCanvas.height);
}

function applyWarmth(ctx, width, height, amount) {
  if (!amount) return;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const redBoost = amount * 36;
  const blueCut = amount * 28;
  const greenAdjust = amount * 8;

  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp(data[i] + redBoost, 0, 255);
    data[i + 1] = clamp(data[i + 1] + greenAdjust, 0, 255);
    data[i + 2] = clamp(data[i + 2] - blueCut, 0, 255);
  }

  ctx.putImageData(imageData, 0, 0);
}

function drawAfter() {
  if (!currentImage) return;
  fitCanvas(afterCanvas, currentImage);
  const params = computeAppliedParams();

  afterCtx.clearRect(0, 0, afterCanvas.width, afterCanvas.height);
  afterCtx.filter = `brightness(${params.brightness}) contrast(${params.contrast}) saturate(${params.saturation}) blur(${params.blur}px)`;
  afterCtx.drawImage(currentImage, 0, 0, afterCanvas.width, afterCanvas.height);
  afterCtx.filter = 'none';
  applyWarmth(afterCtx, afterCanvas.width, afterCanvas.height, params.warmth);

  if (showOnlyAfter) {
    beforeCanvas.parentElement.style.display = 'none';
    afterCanvas.parentElement.style.gridColumn = '1 / -1';
  } else {
    beforeCanvas.parentElement.style.display = '';
    afterCanvas.parentElement.style.gridColumn = '';
  }
}

function renderAll() {
  drawBefore();
  drawAfter();
}

function updateStrengthLabel() {
  strengthValue.textContent = `${strengthSlider.value}%`;
}

function setAnalysis(result) {
  analysisSummary.textContent = result.summary || '解析できませんでした。';
  analysisGrid.innerHTML = `
    <div><dt>主役</dt><dd>${result.subject || '-'}</dd></div>
    <div><dt>補正方針</dt><dd>${result.direction || '-'}</dd></div>
    <div><dt>おすすめ</dt><dd>${result.recommendation || '-'}</dd></div>
    <div><dt>注意点</dt><dd>${result.caution || '-'}</dd></div>
  `;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

async function useFile(file) {
  if (!isAuthenticated) {
    setStatus('先に認証してください');
    return;
  }
  if (!file || !file.type.startsWith('image/')) return;
  currentImageDataUrl = await readFileAsDataUrl(file);
  currentImage = await loadImage(currentImageDataUrl);
  aiResult = null;
  setCategory('未解析');
  setStatus('画像を読み込みました');
  resetAnalysisView();
  renderAll();
  analyzeButton.disabled = false;
  beforeAfterButton.disabled = false;
  downloadButton.disabled = false;
}

async function analyzeImage() {
  if (!currentImageDataUrl || !isAuthenticated) return;

  analyzeButton.disabled = true;
  setStatus('AIが内容を判断しています…');

  try {
    const response = await fetch('/api/kirei/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(EMBEDDED_UNLOCK ? {'x-mothership-embed':'1'} : {}) },
      body: JSON.stringify({ imageDataUrl: currentImageDataUrl }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.error || 'AI解析に失敗しました。');
    }

    aiResult = data;
    setCategory(data.categoryLabel || data.category || '解析済み');
    setStatus('AIが補正方針を返しました');
    setAnalysis(data);
    renderAll();
  } catch (error) {
    console.error(error);
    setStatus(error.message || 'エラーが発生しました');
  } finally {
    analyzeButton.disabled = false;
  }
}

function downloadAfter() {
  if (!currentImage) return;
  const link = document.createElement('a');
  const previewUrl = afterCanvas.toDataURL('image/jpeg', 0.92);
  notifyMothershipImage(previewUrl, { title: 'Kirei Filter', note: '整え後の画像' });
  if (EMBED_MODE || EMBEDDED_UNLOCK) return;
  link.href = previewUrl;
  link.download = 'kirei-filter-output.jpg';
  link.click();
}

async function fetchAuthStatus() {
  try {
    const response = await fetch('/api/kirei/auth-status', { cache: 'no-store' });
    const data = await response.json();
    isAuthenticated = Boolean(data?.authenticated);
  } catch (error) {
    console.warn('auth status failed', error);
    isAuthenticated = false;
  }
}

async function login() {
  const value = keywordInput.value.trim();
  if (!value) return;

  keywordLockButton.disabled = true;
  keywordStatus.textContent = '認証しています…';

  try {
    const response = await fetch('/api/kirei/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(EMBEDDED_UNLOCK ? {'x-mothership-embed':'1'} : {}) },
      body: JSON.stringify({ keyword: value }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error || '認証に失敗しました。');
    }
    isAuthenticated = true;
    keywordInput.value = '';
    resetAnalysisView();
    updateLockState();
  } catch (error) {
    keywordStatus.textContent = error.message || '認証に失敗しました。';
    keywordInput.focus();
    keywordInput.select();
  } finally {
    keywordLockButton.disabled = isAuthenticated || !keywordInput.value.trim();
  }
}

async function logout() {
  keywordResetButton.disabled = true;
  try {
    await fetch('/api/kirei/logout', { method: 'POST' });
  } catch (error) {
    console.warn('logout failed', error);
  }
  isAuthenticated = false;
  keywordInput.disabled = false;
  keywordInput.value = '';
  keywordInput.focus();
  updateLockState();
  resetAnalysisView();
}

keywordInput.addEventListener('input', () => {
  keywordLockButton.disabled = isAuthenticated || !keywordInput.value.trim();
});

keywordInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') login();
});

keywordLockButton.addEventListener('click', login);
keywordResetButton.addEventListener('click', logout);

fileInput.addEventListener('change', async (event) => {
  const [file] = event.target.files || [];
  if (file) await useFile(file);
});

['dragenter', 'dragover'].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    if (!isAuthenticated) return;
    dropzone.classList.add('dragover');
  });
});

['dragleave', 'drop'].forEach((eventName) => {
  dropzone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropzone.classList.remove('dragover');
  });
});

dropzone.addEventListener('drop', async (event) => {
  if (!isAuthenticated) {
    setStatus('先に認証してください');
    return;
  }
  const [file] = event.dataTransfer.files || [];
  if (file) await useFile(file);
});

strengthSlider.addEventListener('input', () => {
  updateStrengthLabel();
  drawAfter();
});

analyzeButton.addEventListener('click', analyzeImage);
downloadButton.addEventListener('click', downloadAfter);
beforeAfterButton.addEventListener('click', () => {
  showOnlyAfter = !showOnlyAfter;
  drawAfter();
});

updateStrengthLabel();
resetAnalysisView();
updateInstallUi();

if (EMBEDDED_UNLOCK) {
  isAuthenticated = true;
  const panel = document.querySelector('.keyword-panel');
  if (panel) panel.style.display = 'none';
} else {
  await fetchAuthStatus();
}
updateLockState();


window.__mothershipGetAsset = async function () {
  if (!currentImage || !afterCanvas || !afterCanvas.width || !afterCanvas.height) return null;
  const imageData = afterCanvas.toDataURL('image/jpeg', 0.92);
  return { kind: 'image', imageData, title: 'Kirei Filter', note: '整え後の画像' };
};
