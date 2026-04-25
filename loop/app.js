const EMBED_MODE = new URLSearchParams(location.search).get('embed') === '1';
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
function notifyMothershipVideo(videoData, posterData, meta = {}) {
  try {
    window.__mothershipLastVideoData = videoData;
    window.__mothershipLastPosterData = posterData || null;
    window.__mothershipLastVideoMeta = meta || {};
    if (window.parent && window.parent !== window && videoData) {
      window.parent.postMessage({ type: 'mothership:video', roomIndex: Number.isFinite(EMBED_ROOM_INDEX) && EMBED_ROOM_INDEX >= 0 ? EMBED_ROOM_INDEX : undefined, videoData, posterData, ...meta }, '*');
    }
  } catch (e) {}
}
const RECORD_MS = 3000;
const FPS = 30;

const statusEl = document.getElementById('status');
const openCameraBtn = document.getElementById('openCameraBtn');
const recordBtn = document.getElementById('recordBtn');
const retakeBtn = document.getElementById('retakeBtn');
const rearCameraBtn = document.getElementById('rearCameraBtn');
const frontCameraBtn = document.getElementById('frontCameraBtn');
const saveWebmBtn = document.getElementById('saveWebmBtn');
const saveJpegBtn = document.getElementById('saveJpegBtn');
const viewer = document.getElementById('viewer');
const overlay = document.getElementById('overlay');
const liveVideo = document.getElementById('liveVideo');
const playbackVideo = document.getElementById('playbackVideo');
const recordingBadge = document.getElementById('recordingBadge');
const recordingCountdown = document.getElementById('recordingCountdown');
const workCanvas = document.getElementById('workCanvas');
const chips = [...document.querySelectorAll('.chip')];

function applyEmbedUi() {
  if (!EMBED_MODE) return;
  if (saveWebmBtn) saveWebmBtn.textContent = 'Use Loop';
  if (saveJpegBtn) saveJpegBtn.style.display = 'none';
}


let stream = null;
let mediaRecorder = null;
let chunks = [];
let recordTimer = null;
let countdownTimer = null;
let capturedBlob = null;
let capturedURL = null;
let selectedFilter = 'original';
let currentFacing = 'environment';

function setStatus(text) {
  statusEl.textContent = text;
}

function updateButtons() {
  const hasStream = !!stream;
  const hasCapture = !!capturedBlob;
  recordBtn.disabled = !hasStream || mediaRecorder?.state === 'recording';
  retakeBtn.disabled = !hasCapture && !hasStream;
  saveWebmBtn.disabled = !hasCapture;
  saveJpegBtn.disabled = !hasCapture;
  rearCameraBtn.classList.toggle('active-cam', currentFacing === 'environment');
  frontCameraBtn.classList.toggle('active-cam', currentFacing === 'user');
}

function stopStream() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
}

async function openCamera(forceFacing = currentFacing) {
  try {
    stopStream();
    if (capturedURL) {
      URL.revokeObjectURL(capturedURL);
      capturedURL = null;
    }
    capturedBlob = null;
    playbackVideo.pause();
    playbackVideo.classList.add('hidden');
    liveVideo.classList.remove('hidden');
    overlay.classList.add('hidden');
    currentFacing = forceFacing;
    setStatus(currentFacing === 'user' ? 'Opening front camera...' : 'Opening rear camera...');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('getUserMedia is not available');
    }
    const constraintAttempts = [
      {
        video: {
          facingMode: { ideal: currentFacing },
          width: { ideal: 1080 },
          height: { ideal: 1080 }
        },
        audio: false
      },
      {
        video: {
          width: { ideal: 1080 },
          height: { ideal: 1080 }
        },
        audio: false
      },
      { video: true, audio: false }
    ];
    let lastError = null;
    for (const constraints of constraintAttempts) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (!stream) throw lastError || new Error('camera unavailable');

    liveVideo.srcObject = stream;
    await liveVideo.play();
    setStatus(currentFacing === 'user' ? 'Front camera ready' : 'Rear camera ready');
  } catch (err) {
    console.error(err);
    overlay.classList.remove('hidden');
    setStatus('Camera error');
    const denied = err && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
    alert(denied
      ? 'カメラ許可がブロックされています。ブラウザのサイト設定でカメラを許可してください。'
      : 'カメラを開けませんでした。別のカメラ設定で再試行しましたが失敗しました。HTTPS環境とカメラ許可を確認してください。');
  } finally {
    applyEmbedUi();
updateButtons();
  }
}

function beginCountdown() {
  const startedAt = performance.now();
  recordingCountdown.textContent = '3.0';
  recordingBadge.classList.remove('hidden');
  countdownTimer = setInterval(() => {
    const elapsed = performance.now() - startedAt;
    const remain = Math.max(0, RECORD_MS - elapsed);
    recordingCountdown.textContent = (remain / 1000).toFixed(1);
  }, 80);
}

function stopCountdown() {
  clearInterval(countdownTimer);
  countdownTimer = null;
  recordingBadge.classList.add('hidden');
}

function releaseCapturedURL() {
  if (capturedURL) {
    URL.revokeObjectURL(capturedURL);
    capturedURL = null;
  }
}

async function startRecord() {
  if (!stream) return;
  chunks = [];
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm;codecs=vp8';

  mediaRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 3_000_000 });
  mediaRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) chunks.push(event.data);
  };
  mediaRecorder.onstop = async () => {
    stopCountdown();
    capturedBlob = new Blob(chunks, { type: mimeType });
    releaseCapturedURL();
    capturedURL = URL.createObjectURL(capturedBlob);
    playbackVideo.src = capturedURL;
    liveVideo.classList.add('hidden');
    playbackVideo.classList.remove('hidden');
    try {
      await playbackVideo.play();
    } catch (e) {
      console.warn(e);
    }
    setStatus('Loop ready');
    updateButtons();
  };

  mediaRecorder.start();
  setStatus('Recording...');
  beginCountdown();
  updateButtons();
  recordTimer = setTimeout(() => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
  }, RECORD_MS);
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function getFilterCss(name) {
  switch (name) {
    case 'bw': return 'grayscale(1) contrast(1.02)';
    case 'soft': return 'saturate(0.85) brightness(1.04) blur(0.35px)';
    case 'contrast': return 'contrast(1.28) saturate(1.04)';
    case 'warm': return 'sepia(0.24) saturate(1.14) hue-rotate(-10deg) brightness(1.03)';
    case 'cool': return 'saturate(0.92) hue-rotate(14deg) contrast(1.03) brightness(1.02)';
    default: return 'none';
  }
}

async function ensurePlaybackReady() {
  if (!capturedBlob) return false;
  if (playbackVideo.readyState < 2) {
    await new Promise(resolve => {
      const onLoaded = () => {
        playbackVideo.removeEventListener('loadeddata', onLoaded);
        resolve();
      };
      playbackVideo.addEventListener('loadeddata', onLoaded);
    });
  }
  return true;
}


async function createPosterData() {
  const ok = await ensurePlaybackReady();
  if (!ok) return null;
  const vw = playbackVideo.videoWidth || 1080;
  const vh = playbackVideo.videoHeight || 1080;
  const side = Math.min(vw, vh);
  workCanvas.width = 1536;
  workCanvas.height = 1536;
  const ctx = workCanvas.getContext('2d');
  ctx.save();
  ctx.clearRect(0, 0, workCanvas.width, workCanvas.height);
  ctx.filter = getFilterCss(selectedFilter);
  const sx = (vw - side) / 2;
  const sy = (vh - side) / 2;
  ctx.drawImage(playbackVideo, sx, sy, side, side, 0, 0, workCanvas.width, workCanvas.height);
  ctx.restore();
  return workCanvas.toDataURL('image/jpeg', 0.94);
}


function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function waitForSeek(video, time = 0) {
  return new Promise(resolve => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      video.removeEventListener('seeked', finish);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(finish, 280);
    video.addEventListener('seeked', finish, { once: true });
    try { video.currentTime = time; } catch (e) { finish(); }
  });
}

function waitMs(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function createCompactVideoData() {
  const ok = await ensurePlaybackReady();
  if (!ok || !capturedBlob) return null;

  if (!workCanvas.captureStream || !window.MediaRecorder) {
    return blobToDataURL(capturedBlob);
  }

  const vw = playbackVideo.videoWidth || 1080;
  const vh = playbackVideo.videoHeight || 1080;
  const side = Math.min(vw, vh);
  const size = 480;
  workCanvas.width = size;
  workCanvas.height = size;
  const ctx = workCanvas.getContext('2d', { alpha: false });
  const streamOut = workCanvas.captureStream(Math.min(FPS || 30, 24));
  const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
    .find(type => MediaRecorder.isTypeSupported(type)) || '';
  const options = mimeType ? { mimeType, videoBitsPerSecond: 1200000 } : { videoBitsPerSecond: 1200000 };
  const rec = new MediaRecorder(streamOut, options);
  const localChunks = [];

  rec.ondataavailable = event => {
    if (event.data && event.data.size > 0) localChunks.push(event.data);
  };

  const finished = new Promise(resolve => {
    rec.onstop = async () => {
      try {
        const blob = new Blob(localChunks, { type: rec.mimeType || 'video/webm' });
        resolve(await blobToDataURL(blob));
      } catch (error) {
        console.warn(error);
        resolve(null);
      } finally {
        streamOut.getTracks().forEach(track => track.stop());
      }
    };
    rec.onerror = () => {
      streamOut.getTracks().forEach(track => track.stop());
      resolve(null);
    };
  });

  const wasLoop = playbackVideo.loop;
  const wasMuted = playbackVideo.muted;
  let rafId = 0;
  const drawFrame = () => {
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, size, size);
    ctx.filter = getFilterCss(selectedFilter);
    const sx = (vw - side) / 2;
    const sy = (vh - side) / 2;
    try {
      ctx.drawImage(playbackVideo, sx, sy, side, side, 0, 0, size, size);
    } catch (e) {}
    ctx.restore();
    rafId = requestAnimationFrame(drawFrame);
  };

  try {
    playbackVideo.pause();
    await waitForSeek(playbackVideo, 0);
    playbackVideo.loop = true;
    playbackVideo.muted = true;
    rec.start(100);
    drawFrame();
    await playbackVideo.play();
    const durationMs = Math.max(700, Math.min(RECORD_MS || 3000, (playbackVideo.duration || 3) * 1000));
    await waitMs(durationMs);
  } catch (error) {
    console.warn(error);
  } finally {
    cancelAnimationFrame(rafId);
    try { playbackVideo.pause(); } catch (e) {}
    playbackVideo.loop = wasLoop;
    playbackVideo.muted = wasMuted;
    try { await waitForSeek(playbackVideo, 0); } catch (e) {}
    if (rec.state !== 'inactive') {
      try { rec.stop(); } catch (e) {}
    } else {
      streamOut.getTracks().forEach(track => track.stop());
    }
    try { playbackVideo.play().catch(() => {}); } catch (e) {}
  }

  const compact = await finished;
  return compact || blobToDataURL(capturedBlob);
}

async function saveJpeg() {
  const previewUrl = await createPosterData();
  if (!previewUrl) return;
  notifyMothershipImage(previewUrl, { title: 'Loop', note: selectedFilter });
  if (EMBED_MODE) return;
  const blob = await (await fetch(previewUrl)).blob();
  downloadBlob(blob, `loop-${Date.now()}.jpg`);
}

async function saveWebm() {
  const ok = await ensurePlaybackReady();
  if (!ok || !capturedBlob) return;

  if (EMBED_MODE) {
    const posterData = await createPosterData();
    const videoData = await createCompactVideoData();
    if (videoData) {
      notifyMothershipVideo(videoData, posterData, { title: 'Loop', note: selectedFilter || 'Original' });
      setStatus('Loop added to room');
      return true;
    }
    return false;
  }

  const vw = playbackVideo.videoWidth || 1080;
  const vh = playbackVideo.videoHeight || 1080;
  const side = Math.min(vw, vh);
  workCanvas.width = 720;
  workCanvas.height = 720;
  const ctx = workCanvas.getContext('2d', { alpha: false });
  const streamOut = workCanvas.captureStream(FPS);
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm;codecs=vp8';
  const rec = new MediaRecorder(streamOut, {
    mimeType,
    videoBitsPerSecond: 6_000_000
  });
  const localChunks = [];
  rec.ondataavailable = e => {
    if (e.data && e.data.size > 0) localChunks.push(e.data);
  };
  rec.onstop = () => {
    const blob = new Blob(localChunks, { type: mimeType });
    downloadBlob(blob, `loop-${Date.now()}.webm`);
    streamOut.getTracks().forEach(track => track.stop());
  };

  const durationMs = Math.max(500, Math.min(RECORD_MS, (playbackVideo.duration || 3) * 1000));
  let rafId = 0;
  const wasLoop = playbackVideo.loop;
  const wasMuted = playbackVideo.muted;

  const drawFrame = () => {
    ctx.save();
    ctx.clearRect(0, 0, workCanvas.width, workCanvas.height);
    ctx.filter = getFilterCss(selectedFilter);
    const sx = (vw - side) / 2;
    const sy = (vh - side) / 2;
    ctx.drawImage(playbackVideo, sx, sy, side, side, 0, 0, workCanvas.width, workCanvas.height);
    ctx.restore();
    rafId = requestAnimationFrame(drawFrame);
  };

  try {
    playbackVideo.pause();
    playbackVideo.currentTime = 0;
    await new Promise(resolve => {
      const done = () => {
        playbackVideo.removeEventListener('seeked', done);
        resolve();
      };
      playbackVideo.addEventListener('seeked', done, { once: true });
    });
  } catch (e) {}

  playbackVideo.loop = true;
  playbackVideo.muted = true;
  rec.start(100);
  drawFrame();

  try {
    await playbackVideo.play();
  } catch (e) {
    cancelAnimationFrame(rafId);
    rec.stop();
    streamOut.getTracks().forEach(track => track.stop());
    throw e;
  }

  setTimeout(() => {
    cancelAnimationFrame(rafId);
    playbackVideo.pause();
    playbackVideo.currentTime = 0;
    playbackVideo.loop = wasLoop;
    playbackVideo.muted = wasMuted;
    rec.stop();
    playbackVideo.play().catch(() => {});
  }, durationMs);
}

function selectFilter(filter) {
  selectedFilter = filter;
  viewer.className = `viewer ${filter}`;
  chips.forEach(chip => chip.classList.toggle('active', chip.dataset.filter === filter));
}

function resetToCamera() {
  if (capturedBlob) {
    releaseCapturedURL();
    capturedBlob = null;
  }
  playbackVideo.pause();
  playbackVideo.removeAttribute('src');
  playbackVideo.load();
  playbackVideo.classList.add('hidden');
  liveVideo.classList.remove('hidden');
  overlay.classList.toggle('hidden', !!stream);
  setStatus(stream ? (currentFacing === 'user' ? 'Front camera ready' : 'Rear camera ready') : 'Ready');
  updateButtons();
}

rearCameraBtn.addEventListener('click', async () => {
  currentFacing = 'environment';
  updateButtons();
  await openCamera('environment');
});
frontCameraBtn.addEventListener('click', async () => {
  currentFacing = 'user';
  updateButtons();
  await openCamera('user');
});
openCameraBtn.addEventListener('click', () => openCamera(currentFacing));
recordBtn.addEventListener('click', startRecord);
retakeBtn.addEventListener('click', async () => {
  clearTimeout(recordTimer);
  stopCountdown();
  if (!stream) await openCamera();
  resetToCamera();
});
saveJpegBtn.addEventListener('click', saveJpeg);
saveWebmBtn.addEventListener('click', saveWebm);
chips.forEach(chip => chip.addEventListener('click', () => selectFilter(chip.dataset.filter)));

window.addEventListener('beforeunload', stopStream);
window.addEventListener('load', () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(console.warn);
  }
});

selectFilter('original');
updateButtons();


window.__mothershipGetAsset = async function () {
  const ok = await ensurePlaybackReady();
  if (!ok || !capturedBlob) return null;
  const posterData = await createPosterData();
  const videoData = await createCompactVideoData();
  if (!videoData) return null;
  return { kind: 'video', videoData, posterData, title: 'Loop', note: selectedFilter || 'Original' };
};
