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
const PASSWORD_STORAGE_KEY = "code904_password";
const state = {
  mode: "object",
  imageDataUrl: "",
  generated: null,
  stream: null,
  scanning: false,
  backend: "checking",
  sharedPassword: "",
  unlocked: false,
};

function applyEmbedUi() {
  if (!EMBEDDED_UNLOCK) return;
  const txtBtn = document.getElementById('export-txt');
  const jsonBtn = document.getElementById('export-json');
  if (txtBtn) txtBtn.style.display = 'none';
  if (jsonBtn) jsonBtn.style.display = 'none';
}

const els = {
  authOverlay: document.getElementById("auth-overlay"),
  authForm: document.getElementById("auth-form"),
  passwordInput: document.getElementById("password-input"),
  rememberPassword: document.getElementById("remember-password"),
  authError: document.getElementById("auth-error"),
  authSmall: document.getElementById("auth-small"),
  appShell: document.getElementById("app-shell"),
  lockButton: document.getElementById("lock-button"),
  fileInput: document.getElementById("file-input"),
  cameraStart: document.getElementById("camera-start"),
  cameraCapture: document.getElementById("camera-capture"),
  cameraStop: document.getElementById("camera-stop"),
  modeButtons: Array.from(document.querySelectorAll(".mode-button")),
  scanButton: document.getElementById("scan-button"),
  exportTxt: document.getElementById("export-txt"),
  exportJson: document.getElementById("export-json"),
  exportJpeg: document.getElementById("export-jpeg"),
  resetButton: document.getElementById("reset-button"),
  previewImage: document.getElementById("preview-image"),
  previewVideo: document.getElementById("preview-video"),
  previewEmpty: document.getElementById("preview-empty"),
  previewSurface: document.getElementById("preview-surface"),
  scanFlash: document.getElementById("scan-flash"),
  captureBottom: document.getElementById("capture-bottom"),
  tapHint: document.getElementById("tap-hint"),
  progressFill: document.getElementById("progress-fill"),
  statusEn: document.getElementById("status-en"),
  statusJp: document.getElementById("status-jp"),
  hudStatus: document.getElementById("hud-status"),
  timecode: document.getElementById("timecode"),
  hudTime2: document.getElementById("hud-timecode-2"),
  errorBox: document.getElementById("error-box"),
  outputPlaceholder: document.getElementById("output-placeholder"),
  outputSections: document.getElementById("output-sections"),
  diagList: document.getElementById("diag-list"),
  noticeEn: document.getElementById("notice-en"),
  noticeJp: document.getElementById("notice-jp"),
  modeNoteEn: document.getElementById("mode-note-en"),
  modeNoteJp: document.getElementById("mode-note-jp"),
  cameraTip: document.getElementById("camera-tip"),
  hudMode: document.getElementById("hud-mode"),
  hudSignal: document.getElementById("hud-signal"),
  backendNote: document.getElementById("backend-note"),
};

const modeNotes = {
  object: {
    modeHud: "OBJECT MANUAL / 物体説明",
    noteEn: "OBJECT MODE ACTIVE. SEMANTIC STABILITY NOT GUARANTEED.",
    noteJp: "物体モード有効。意味の安定性は保証されません。",
  },
  subject: {
    modeHud: "SUBJECT LOG / 被写体記録",
    noteEn: "HUMAN SUBJECT DETECTED. IDENTITY ANALYSIS DISABLED.",
    noteJp: "人物主対象を検出。個人識別解析は無効です。",
  }
};

function setStatus(en, jp) {
  els.statusEn.textContent = en;
  els.statusJp.textContent = jp;
  els.hudStatus.textContent = en;
}

function setBackendNote(text) {
  els.backendNote.textContent = text;
}

function setError(message) {
  if (!message) {
    els.errorBox.classList.add("hidden");
    els.errorBox.textContent = "";
    return;
  }
  els.errorBox.textContent = message;
  els.errorBox.classList.remove("hidden");
}

function setAuthError(message) {
  if (!message) {
    els.authError.classList.add("hidden");
    els.authError.textContent = "";
    return;
  }
  els.authError.textContent = message;
  els.authError.classList.remove("hidden");
}

function updateTimecode() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const ff = String(Math.floor(now.getMilliseconds() / 10)).padStart(2, "0");
  const tc = `${hh}:${mm}:${ss}:${ff}`;
  els.timecode.textContent = tc;
  els.hudTime2.textContent = tc;
}
setInterval(updateTimecode, 100);
updateTimecode();

function formatFileStamp(date = new Date()) {
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

function setCaptureUi(active) {
  const live = !!active;
  els.previewSurface.classList.toggle("camera-live", live);
  els.captureBottom.disabled = !live;
  els.cameraCapture.disabled = !live;
  els.tapHint.classList.toggle("hidden", !live);
}

function triggerScanFlash() {
  els.scanFlash.classList.remove("hidden");
  els.scanFlash.classList.remove("active");
  void els.scanFlash.offsetWidth;
  els.scanFlash.classList.add("active");
  window.setTimeout(() => {
    els.scanFlash.classList.remove("active");
    els.scanFlash.classList.add("hidden");
  }, 480);
}

function clearPreview() {
  els.previewImage.src = "";
  els.previewImage.classList.add("hidden");
  els.previewVideo.classList.add("hidden");
  els.previewEmpty.classList.remove("hidden");
  els.hudSignal.textContent = state.unlocked ? "NO SIGNAL / 入力待機" : "LOCKED / ロック中";
  els.cameraTip.textContent = state.unlocked
    ? "Load or capture an image. / 画像を読込または撮影してください。"
    : "Unlock first. / 先に解錠してください。";
  setCaptureUi(false);
}

function showImage(url) {
  els.previewImage.src = url;
  els.previewImage.classList.remove("hidden");
  els.previewVideo.classList.add("hidden");
  els.previewEmpty.classList.add("hidden");
  els.hudSignal.textContent = "TARGET FRAME / 対象画像";
  els.cameraTip.textContent = "Ready for scan. / 走査可能です。";
  setCaptureUi(false);
}

function showVideo() {
  els.previewVideo.classList.remove("hidden");
  els.previewImage.classList.add("hidden");
  els.previewEmpty.classList.add("hidden");
  els.hudSignal.textContent = "LIVE CAMERA / ライブ映像";
  els.cameraTip.textContent = "Tap screen or press shutter to capture. / 画面タップまたは下のシャッターで撮影してください。";
  setCaptureUi(true);
}

function updateMode(mode) {
  state.mode = mode;
  const modeMeta = modeNotes[mode];
  els.hudMode.textContent = modeMeta.modeHud;
  els.modeNoteEn.textContent = modeMeta.noteEn;
  els.modeNoteJp.textContent = modeMeta.noteJp;
  els.modeButtons.forEach(btn => btn.classList.toggle("active", btn.dataset.mode === mode));
  if (state.unlocked) {
    setStatus("MODE READY", mode === "object" ? "物体モード準備完了" : "人物モード準備完了");
  }
}

function resetOutput() {
  state.generated = null;
  els.outputSections.innerHTML = "";
  els.outputPlaceholder.classList.remove("hidden");
  els.exportTxt.disabled = true;
  els.exportJson.disabled = true;
  els.exportJpeg.disabled = true;
  els.noticeEn.textContent = state.unlocked ? "Ready." : "Locked.";
  els.noticeJp.textContent = state.unlocked ? "準備完了。" : "ロック中。";
  renderDiagnostics([]);
}

function renderDiagnostics(items) {
  els.diagList.innerHTML = "";
  for (const item of items) {
    const row = document.createElement("div");
    row.className = "diag-item";
    row.innerHTML = `
      <div>
        <div class="en">${escapeHtml(item.en)}</div>
        <div class="jp">${escapeHtml(item.jp)}</div>
      </div>
      <div class="status">OK</div>
    `;
    els.diagList.appendChild(row);
  }
}

function renderResult(result) {
  state.generated = result;
  els.outputPlaceholder.classList.add("hidden");
  els.outputSections.innerHTML = "";
  (result.sections || []).forEach((section, index) => {
    const wrapper = document.createElement("article");
    wrapper.className = "output-section";
    wrapper.innerHTML = `
      <div class="label">${escapeHtml(section.label_en || `ENTRY ${index + 1}`)} / ${escapeHtml(section.label_jp || "記述")}</div>
      <div class="en">${escapeHtml(section.en || "")}</div>
      <div class="jp">${escapeHtml(section.jp || "")}</div>
    `;
    els.outputSections.appendChild(wrapper);
  });
  els.noticeEn.textContent = result.notice_en || "Generated.";
  els.noticeJp.textContent = result.notice_jp || "生成完了。";
  renderDiagnostics(result.diagnostics || []);
  els.exportTxt.disabled = false;
  els.exportJson.disabled = false;
  els.exportJpeg.disabled = false;
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function optimizeImageDataUrl(dataUrl, maxSide = 1280, quality = 0.88) {
  const img = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });

  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  const longest = Math.max(width, height);
  const scale = longest > maxSide ? maxSide / longest : 1;
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  triggerScanFlash();
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
  return canvas.toDataURL("image/jpeg", quality);
}

function download(filename, content, mime) {
  const needsBom = typeof content === "string" && /^text\/plain/.test(mime);
  const payload = needsBom ? ["\ufeff", content] : [content];
  const blob = new Blob(payload, { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportTxt() {
  if (!state.generated) return;
  const lines = [
    "CODE 904",
    "MALFUNCTION",
    "MEAN SLIPPER",
    "",
    `MODE: ${state.mode.toUpperCase()}`,
    "",
  ];
  for (const [i, section] of (state.generated.sections || []).entries()) {
    lines.push(`${i + 1}. ${section.label_en || "ENTRY"} / ${section.label_jp || "記述"}`);
    lines.push(section.en || "");
    lines.push(section.jp || "");
    lines.push("");
  }
  lines.push(state.generated.notice_en || "");
  lines.push(state.generated.notice_jp || "");
  download(`code-904-${state.mode}-${formatFileStamp()}.txt`, lines.join("\n"), "text/plain;charset=utf-8");
}

function exportJson() {
  if (!state.generated) return;
  download(
    `code-904-${state.mode}-${formatFileStamp()}.json`,
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      mode: state.mode,
      result: state.generated,
    }, null, 2),
    "application/json;charset=utf-8"
  );
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  if (!words.length) return y;
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      y += lineHeight;
      line = word;
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
  return y;
}

function wrapCanvasTextClamp(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  if (!words.length) return y;
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);

  const visible = lines.slice(0, maxLines);
  if (lines.length > maxLines && visible.length) {
    let tail = visible[visible.length - 1];
    while (tail.length > 1 && ctx.measureText(`${tail}…`).width > maxWidth) {
      tail = tail.slice(0, -1);
    }
    visible[visible.length - 1] = `${tail}…`;
  }

  for (const item of visible) {
    ctx.fillText(item, x, y);
    y += lineHeight;
  }
  return y;
}

async function exportJpegCard() {
  if (!state.generated || !state.imageDataUrl) return;

  const width = 1600;
  const height = 900;
  const leftW = Math.round(width * 0.575);
  const rightX = leftW + 52;
  const rightW = width - rightX - 60;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    setError("JPEG生成に失敗しました。/ Failed to create JPEG.");
    return;
  }

  ctx.fillStyle = "#020403";
  ctx.fillRect(0, 0, width, height);

  const img = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = state.imageDataUrl;
  }).catch(() => null);

  if (img) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const scale = Math.max(leftW / iw, height / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (leftW - dw) / 2;
    const dy = (height - dh) / 2;
    ctx.save();
    ctx.filter = "grayscale(1) contrast(1.16) brightness(0.74)";
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  }

  const grad = ctx.createRadialGradient(width * 0.3, height * 0.45, 40, width * 0.5, height * 0.5, width * 0.65);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.46)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "rgba(31,110,79,0.95)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(leftW, 0);
  ctx.lineTo(leftW, height);
  ctx.stroke();

  ctx.fillStyle = "rgba(114,247,188,0.12)";
  for (let y = 0; y < height; y += 4) {
    ctx.fillRect(0, y, width, 1);
  }

  ctx.strokeStyle = "rgba(103,240,183,0.6)";
  ctx.strokeRect(leftW * 0.12, height * 0.18, leftW * 0.25, height * 0.24);
  ctx.strokeStyle = "rgba(103,240,183,0.45)";
  ctx.strokeRect(leftW * 0.72, height * 0.31, leftW * 0.16, leftW * 0.16);
  const cx = leftW / 2;
  const cy = height / 2;
  ctx.strokeStyle = "rgba(103,240,183,0.65)";
  ctx.strokeRect(cx - 20, cy - 20, 40, 40);
  ctx.beginPath();
  ctx.moveTo(cx, cy - 20); ctx.lineTo(cx, cy + 20);
  ctx.moveTo(cx - 20, cy); ctx.lineTo(cx + 20, cy);
  ctx.stroke();

  ctx.fillStyle = "#93ffd7";
  ctx.font = '18px "Lucida Console", "Courier New", monospace';
  ctx.fillText("CODE 904", 28, 34);
  ctx.fillText(new Date().toTimeString().slice(0,8), width - 156, 34);
  ctx.font = '68px "Lucida Console", "Courier New", monospace';
  ctx.fillStyle = "#e2fff4";
  ctx.fillText("MALFUNCTION", 28, 102);
  ctx.font = '28px "Lucida Console", "Courier New", monospace';
  ctx.fillStyle = "#93ffd7";
  ctx.fillText("MEAN SLIPPER", 30, 138);
  ctx.font = '22px "Lucida Console", "Courier New", monospace';
  ctx.fillText(els.hudStatus.textContent || "MALFUNCTION DETECTED", 28, height - 22);

  const headerY = 34;
  const headerH = 96;
  const outputY = 146;
  const outputH = 520;
  const footerY = 690;
  const footerH = 138;

  ctx.fillStyle = "rgba(0,0,0,0.42)";
  ctx.fillRect(rightX - 16, headerY, rightW + 8, headerH);
  ctx.strokeStyle = "rgba(35,90,67,0.95)";
  ctx.strokeRect(rightX - 16, headerY, rightW + 8, headerH);
  ctx.fillStyle = "#8efed1";
  ctx.font = '16px "Lucida Console", "Courier New", monospace';
  ctx.fillText(state.mode === "subject" ? "SUBJECT LOG / 被写体記録" : "OBJECT MANUAL / 物体説明", rightX, 60);
  ctx.fillStyle = "#bcfee4";
  ctx.font = '15px "Arial Narrow", "Helvetica Neue", Helvetica, Arial, sans-serif';
  wrapCanvasTextClamp(ctx, modeNotes[state.mode].noteEn, rightX, 88, rightW - 18, 18, 2);
  wrapCanvasTextClamp(ctx, modeNotes[state.mode].noteJp, rightX, 126, rightW - 18, 18, 1);

  ctx.fillStyle = "rgba(0,0,0,0.34)";
  ctx.fillRect(rightX - 16, outputY, rightW + 8, outputH);
  ctx.strokeStyle = "rgba(35,90,67,0.95)";
  ctx.strokeRect(rightX - 16, outputY, rightW + 8, outputH);
  ctx.fillStyle = "#8efed1";
  ctx.font = '16px "Lucida Console", "Courier New", monospace';
  ctx.fillText("INSTRUCTION OUTPUT / 説明出力", rightX, 174);

  const sections = state.generated.sections || [];
  const cardSections = sections.slice(0, 3);
  const slotTop = 206;
  const slotHeight = 126;
  const slotWidth = rightW - 12;

  cardSections.forEach((section, index) => {
    const blockY = slotTop + (slotHeight * index);
    ctx.fillStyle = "#7ef9c3";
    ctx.font = '11px "Lucida Console", "Courier New", monospace';
    ctx.fillText(`${section.label_en || `ENTRY ${index + 1}`} / ${section.label_jp || "記述"}`, rightX, blockY);

    ctx.fillStyle = "#e6fff6";
    ctx.font = '18px "Arial Narrow", "Helvetica Neue", Helvetica, Arial, sans-serif';
    wrapCanvasTextClamp(ctx, section.en || "", rightX, blockY + 24, slotWidth, 24, 2);

    ctx.fillStyle = "#a3f8d2";
    ctx.font = '15px "Arial Narrow", "Helvetica Neue", Helvetica, Arial, sans-serif';
    wrapCanvasTextClamp(ctx, section.jp || "", rightX, blockY + 76, slotWidth, 20, 2);

    if (index < 2) {
      ctx.strokeStyle = "rgba(23,60,45,0.95)";
      ctx.beginPath();
      ctx.moveTo(rightX, blockY + slotHeight - 12);
      ctx.lineTo(rightX + rightW - 8, blockY + slotHeight - 12);
      ctx.stroke();
    }
  });

  if (sections.length > cardSections.length) {
    const omittedCount = sections.length - cardSections.length;
    const omittedY = outputY + outputH - 52;
    ctx.strokeStyle = "rgba(23,60,45,0.95)";
    ctx.beginPath();
    ctx.moveTo(rightX, omittedY - 18);
    ctx.lineTo(rightX + rightW - 8, omittedY - 18);
    ctx.stroke();
    ctx.fillStyle = "#7ef9c3";
    ctx.font = '12px "Lucida Console", "Courier New", monospace';
    ctx.fillText("STATIC LOSS / 静電欠落", rightX, omittedY);
    ctx.fillStyle = "#b1fddf";
    ctx.font = '14px "Arial Narrow", "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.fillText(`${omittedCount} ENTRY DISSOLVED INTO STATIC.`, rightX, omittedY + 22);
    ctx.fillText(`${omittedCount}件の追加記述は走査ノイズへ溶解しました。`, rightX, omittedY + 42);
  }

  const footerDiagnostics = (state.mode === "subject" ? [
    { en: "SUBJECT LOG", jp: "被写体記録" },
    { en: "SOCIAL DRIFT", jp: "社会的ずれ" },
  ] : [
    { en: "OBJECT STATUS", jp: "対象状態" },
    { en: "MEANING DRIFT", jp: "意味のずれ" },
  ]);

  const footerBoxW = (rightW - 12) / 2;
  footerDiagnostics.forEach((item, idx) => {
    const x = rightX + idx * (footerBoxW + 12);
    ctx.fillStyle = "rgba(0,0,0,0.26)";
    ctx.fillRect(x, footerY, footerBoxW, footerH);
    ctx.strokeStyle = "rgba(35,90,67,0.95)";
    ctx.strokeRect(x, footerY, footerBoxW, footerH);
    ctx.fillStyle = "#7ff8c0";
    ctx.font = '11px "Lucida Console", "Courier New", monospace';
    wrapCanvasTextClamp(ctx, item.en, x + 12, footerY + 18, footerBoxW - 24, 14, 2);
    ctx.fillStyle = "#b1fddf";
    ctx.font = '14px "Arial Narrow", "Helvetica Neue", Helvetica, Arial, sans-serif';
    wrapCanvasTextClamp(ctx, item.jp, x + 12, footerY + 82, footerBoxW - 24, 16, 2);
  });

  const previewUrl = canvas.toDataURL("image/jpeg", 0.94);
  notifyMothershipImage(previewUrl, { title: "904", note: state.mode === 'subject' ? 'SUBJECT' : 'OBJECT' });
  if (EMBED_MODE || EMBEDDED_UNLOCK) return;
  canvas.toBlob((blob) => {
    if (!blob) {
      setError("JPEG生成に失敗しました。/ Failed to create JPEG.");
      return;
    }
    download(`code-904-${state.mode}-card-${formatFileStamp()}.jpg`, blob, "image/jpeg");
  }, "image/jpeg", 0.94);
}

async function loadFile(file) {
  const reader = new FileReader();
  const dataUrl = await new Promise((resolve, reject) => {
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const optimized = await optimizeImageDataUrl(dataUrl);
  state.imageDataUrl = optimized;
  showImage(optimized);
  resetOutput();
  setStatus("TARGET LOADED", "対象読込完了");
  els.scanButton.disabled = false;
}

async function startCamera() {
  if (!state.unlocked) {
    openAuth();
    return;
  }
  setError("");
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("このブラウザではカメラが利用できません。/ Camera is not available in this browser.");
    }
    stopCamera();
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
    state.stream = stream;
    els.previewVideo.srcObject = stream;
    await els.previewVideo.play();
    showVideo();
    els.cameraCapture.disabled = false;
    els.cameraStop.disabled = false;
    setStatus("CAMERA READY", "カメラ準備完了");
  } catch (error) {
    console.error(error);
    setError(error.message || "カメラを開始できませんでした。/ Could not start camera.");
  }
}

function stopCamera() {
  if (state.stream) {
    state.stream.getTracks().forEach(track => track.stop());
    state.stream = null;
  }
  els.previewVideo.pause();
  els.previewVideo.srcObject = null;
  els.cameraCapture.disabled = true;
  els.cameraStop.disabled = true;
}

function captureFrame() {
  if (!state.unlocked) {
    openAuth();
    return;
  }
  if (!els.previewVideo.videoWidth || !els.previewVideo.videoHeight) {
    setError("カメラ映像の準備がまだできていません。/ Camera is not ready yet.");
    return;
  }
  const canvas = document.createElement("canvas");
  canvas.width = els.previewVideo.videoWidth;
  canvas.height = els.previewVideo.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(els.previewVideo, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  optimizeImageDataUrl(dataUrl).then((optimized) => {
    state.imageDataUrl = optimized;
    stopCamera();
    showImage(optimized);
    resetOutput();
    setStatus("FRAME CAPTURED", "撮影完了");
    els.scanButton.disabled = false;
  }).catch(() => {
    setError("撮影画像の最適化に失敗しました。/ Failed to optimize captured image.");
  });
}

async function scan() {
  if (!state.unlocked) {
    openAuth();
    return;
  }
  if (!state.imageDataUrl || state.scanning) return;
  state.scanning = true;
  setError("");
  triggerScanFlash();
  resetOutput();
  setStatus("SCANNING", "走査中");
  els.scanButton.disabled = true;
  let progress = 0;
  els.progressFill.style.width = "0%";
  const progressTimer = setInterval(() => {
    progress = Math.min(progress + 4, 94);
    els.progressFill.style.width = `${progress}%`;
  }, 90);

  try {
    const response = await fetch("/api/904/generate", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-app-password": state.sharedPassword,
      },
      body: JSON.stringify({
        mode: state.mode,
        imageDataUrl: state.imageDataUrl,
        nonce: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (response.status === 401) {
      lockApp(true);
      throw new Error(payload.error || "認証が無効です。/ Authentication expired.");
    }
    if (!response.ok) {
      throw new Error(payload.error || "Generation failed.");
    }
    if (!payload.ok || !payload.result) {
      throw new Error(payload.error || "Generation failed.");
    }

    renderResult(payload.result);
    els.progressFill.style.width = "100%";
    setStatus("MALFUNCTION DETECTED", "誤作動を検出");
    setBackendNote(payload.usedAI
      ? `Backend: OpenAI ${payload.model || ""} / バックエンド: OpenAI`
      : "Backend: local fallback / バックエンド: ローカルフォールバック");
    if (payload.warning) {
      setError(payload.warning);
    }
  } catch (error) {
    console.error(error);
    setStatus("SCAN ERROR", "走査失敗");
    setError(error.message || "生成に失敗しました。/ Generation failed.");
  } finally {
    clearInterval(progressTimer);
    state.scanning = false;
    els.scanButton.disabled = !state.imageDataUrl;
    if (els.progressFill.style.width !== "100%") {
      els.progressFill.style.width = "0%";
    }
  }
}

async function checkBackend() {
  try {
    const res = await fetch("/api/904/health");
    const data = await res.json();
    state.backend = data.openaiConfigured ? "openai" : "fallback";
    setBackendNote(
      data.openaiConfigured
        ? `Backend: OpenAI ready (${data.model || "unknown model"}) / バックエンド: OpenAI 使用可`
        : "Backend: local fallback only / バックエンド: ローカルフォールバックのみ"
    );
  } catch (error) {
    console.warn(error);
    state.backend = "unknown";
    setBackendNote("Backend: health check failed / バックエンド確認失敗");
  }
}

async function verifyPassword(password) {
  const response = await fetch("/api/904/auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    throw new Error(data.error || "Password verification failed.");
  }
  return data;
}

function openAuth(prefill = "") {
  els.authOverlay.classList.remove("hidden");
  els.appShell.classList.add("app-locked");
  if (prefill) {
    els.passwordInput.value = prefill;
  }
  setTimeout(() => els.passwordInput.focus(), 0);
}

function unlockApp(password, remember) {
  state.unlocked = true;
  state.sharedPassword = password;
  els.authOverlay.classList.add("hidden");
  els.appShell.classList.remove("app-locked");
  setAuthError("");
  if (remember) {
    localStorage.setItem(PASSWORD_STORAGE_KEY, password);
  } else {
    localStorage.removeItem(PASSWORD_STORAGE_KEY);
  }
  updateMode(state.mode);
  resetOutput();
  clearPreview();
  setStatus("UNLOCKED", "解錠済み");
  els.noticeEn.textContent = "Ready.";
  els.noticeJp.textContent = "準備完了。";
  checkBackend();
}

function lockApp(clearStored = false) {
  state.unlocked = false;
  state.sharedPassword = "";
  stopCamera();
  setStatus("LOCKED", "認証待機中");
  setBackendNote("Backend: locked / バックエンド: ロック中");
  resetOutput();
  clearPreview();
  state.imageDataUrl = "";
  els.fileInput.value = "";
  els.scanButton.disabled = true;
  els.progressFill.style.width = "0%";
  if (clearStored) {
    localStorage.removeItem(PASSWORD_STORAGE_KEY);
  }
  openAuth();
}

els.authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = els.passwordInput.value.trim();
  if (!password) {
    setAuthError("合言葉を入力してください。/ Enter the password.");
    return;
  }
  setAuthError("");
  els.authSmall.textContent = "VERIFYING / 検証中";
  try {
    await verifyPassword(password);
    unlockApp(password, els.rememberPassword.checked);
    els.authSmall.textContent = "Access granted. / 通過しました。";
  } catch (error) {
    console.error(error);
    setAuthError(error.message || "認証に失敗しました。/ Authentication failed.");
    els.authSmall.textContent = "Access denied. / 通過できませんでした。";
  }
});

els.fileInput.addEventListener("change", async (event) => {
  if (!state.unlocked) {
    openAuth();
    return;
  }
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    await loadFile(file);
  } catch {
    setError("画像の読込に失敗しました。/ Failed to load image.");
  }
});

els.modeButtons.forEach(button => {
  button.addEventListener("click", () => updateMode(button.dataset.mode));
});
els.cameraStart.addEventListener("click", startCamera);
els.cameraCapture.addEventListener("click", captureFrame);
els.captureBottom.addEventListener("click", captureFrame);
els.previewSurface.addEventListener("click", (event) => {
  if (!state.stream) return;
  if (event.target === els.captureBottom) return;
  captureFrame();
});
els.cameraStop.addEventListener("click", () => {
  stopCamera();
  if (state.imageDataUrl) {
    showImage(state.imageDataUrl);
  } else {
    clearPreview();
  }
  setStatus("CAMERA STOPPED", "カメラ停止");
});
els.scanButton.addEventListener("click", scan);
els.resetButton.addEventListener("click", () => {
  stopCamera();
  state.imageDataUrl = "";
  els.fileInput.value = "";
  resetOutput();
  clearPreview();
  els.scanButton.disabled = true;
  els.progressFill.style.width = "0%";
  setStatus(state.unlocked ? "IDLE" : "LOCKED", state.unlocked ? "待機中" : "認証待機中");
  setError("");
});
els.lockButton.addEventListener("click", () => lockApp(false));
els.exportTxt.addEventListener("click", exportTxt);
els.exportJson.addEventListener("click", exportJson);
els.exportJpeg.addEventListener("click", exportJpegCard);

updateMode("object");
renderDiagnostics([
  { en: "SCAN MODE", jp: "走査モード" },
  { en: "OBJECT STATUS", jp: "対象状態" },
  { en: "MEANING DRIFT", jp: "意味のずれ" },
  { en: "SYSTEM STATUS", jp: "システム状態" },
]);
clearPreview();
openAuth();
const savedPassword = localStorage.getItem(PASSWORD_STORAGE_KEY);
if (savedPassword) {
  els.passwordInput.value = savedPassword;
  verifyPassword(savedPassword)
    .then(() => unlockApp(savedPassword, true))
    .catch(() => {
      localStorage.removeItem(PASSWORD_STORAGE_KEY);
      openAuth();
    });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(console.warn);
  });
}


window.__mothershipGetAsset = async function () {
  window.__mothershipLastImageData = null;
  await exportJpegCard();
  if (!window.__mothershipLastImageData) return null;
  return {
    kind: 'image',
    imageData: window.__mothershipLastImageData,
    title: '904',
    note: state.mode === 'subject' ? 'SUBJECT' : 'OBJECT'
  };
};
