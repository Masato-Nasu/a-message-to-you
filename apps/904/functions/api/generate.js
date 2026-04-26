const OBJECT_LABELS = [
  ["PRIMARY FUNCTION", "主機能"],
  ["NOTICE", "注意"],
  ["STORAGE", "保管"],
  ["SYSTEM NOTE", "追記"],
  ["PROCEDURE", "手順"],
  ["CONDITION", "状態"],
];

const SUBJECT_LABELS = [
  ["SUBJECT LOG", "被写体記録"],
  ["PROXIMITY", "近接"],
  ["READING", "読解"],
  ["SOCIAL NOTE", "社会注記"],
  ["DISTANCE", "距離"],
  ["FRAME STATUS", "画面状態"],
];

const OBJECT_EN = [
  "PRIMARY FUNCTION: TEMPORARY ORDER STABILIZATION.",
  "WARNING: DO NOT OPERATE UNDER EXCESSIVE CERTAINTY.",
  "SURFACE CONDITION MAY ALTER INTERPRETIVE BALANCE.",
  "STORE AWAY FROM RAPID CONSENSUS AND DIRECT HEAT.",
  "THIS UNIT MAINTAINS RELATIONSHIPS WITHOUT GUARANTEEING PURPOSE.",
  "KEEP AWAY FROM FORCED EXPLANATION AND IMPROPER RESOLUTION.",
  "ATTACHMENT PRESSURE MAY CAUSE A DELAY IN PRACTICAL READING.",
  "MINOR SHIFTS IN SHAPE CAN CHANGE THE ENTIRE DECISION FIELD.",
  "INTENDED USE REMAINS FUNCTIONAL ONLY IN TEMPORARY AGREEMENT.",
  "EXCESSIVE CLEANLINESS MAY REDUCE ITS SYMBOLIC OUTPUT.",
  "THIS OBJECT APPEARS TO ORGANIZE SPACE BY QUIET OCCUPATION.",
  "UNDEFINED PURPOSE MAY INCREASE IF OBSERVED TOO DIRECTLY.",
];

const OBJECT_JP = [
  "主機能：一時的な秩序の安定化。",
  "警告：過度な確信のもとで操作しないでください。",
  "表面状態により解釈の均衡が変化する場合があります。",
  "急速な合意および直射熱源を避けて保管してください。",
  "本装置は用途を保証することなく関係性のみを保持します。",
  "過剰な説明および不適切な解像を避けてください。",
  "付着圧により実用的な読解が遅延する場合があります。",
  "形状の微小な変化が判断領域全体を変えることがあります。",
  "想定用途は暫定的な合意の中でのみ機能します。",
  "過度な清潔さは象徴的出力を低下させる場合があります。",
  "この物体は静かな占有によって空間を整理しているように見えます。",
  "あまり直接観測すると用途不明性が増加する場合があります。",
];

const SUBJECT_EN = [
  "SUBJECT APPROACHES OPTICAL BOUNDARY.",
  "STABLE DISTANCE COULD NOT BE MAINTAINED.",
  "EXCESSIVE FAMILIARITY MAY ALTER READING CONDITIONS.",
  "FACIAL PRESENCE DETECTED. IDENTITY ANALYSIS DISABLED.",
  "SOCIAL MALFUNCTION REMAINS WITHIN OBSERVABLE RANGE.",
  "READING CONDITIONS MAY CHANGE UNDER DIRECT INTIMACY.",
  "FRAME PRESSURE INDICATES UNSETTLED RELATIONAL DISTANCE.",
  "PERSONAL PRESENCE IS HIGH. JUDGMENT OUTPUT REMAINS LIMITED.",
  "THE IMAGE SUGGESTS CONTACT WITHOUT PROCEDURAL AGREEMENT.",
  "VOICE OR STRESS IS NOT VERIFIED. VISUAL RELATION ONLY.",
  "SUBJECT POSITION CAUSES A TEMPORARY FAILURE OF NEUTRAL SPACE.",
  "PROXIMITY MAY EXCEED STANDARD INTERPRETIVE TOLERANCE.",
];

const SUBJECT_JP = [
  "被写体は視覚境界へ接近しています。",
  "安定した距離は維持されませんでした。",
  "過度な親近性は読解条件を変化させる場合があります。",
  "顔の存在を検出。個人識別解析は無効です。",
  "社会的誤作動は観測可能範囲内に留まっています。",
  "直接的な親密性のもとで読解条件が変化する場合があります。",
  "画面圧は未解決の関係距離を示しています。",
  "人物存在度が高いため判断出力は制限されます。",
  "この画像は手続きなき接近を示唆しています。",
  "音声や緊張は未検証です。視覚的関係のみ扱います。",
  "被写体位置により中立的な空間が一時的に失われています。",
  "近接が標準的な解釈許容範囲を超えている可能性があります。",
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function hashString(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pick(array, start, count) {
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(array[(start + i) % array.length]);
  }
  return result;
}

function buildFallback(mode, nonce = "", imageDataUrl = "") {
  const labels = mode === "subject" ? SUBJECT_LABELS : OBJECT_LABELS;
  const enPool = mode === "subject" ? SUBJECT_EN : OBJECT_EN;
  const jpPool = mode === "subject" ? SUBJECT_JP : OBJECT_JP;
  const seed = hashString(`${mode}:${nonce}:${imageDataUrl.slice(0, 180)}:${Date.now()}`);
  const start = seed % enPool.length;
  const linesEn = pick(enPool, start, 4);
  const linesJp = pick(jpPool, start, 4);
  const lineLabels = pick(labels, start, 4);
  const diagnostics = pick(
    mode === "subject"
      ? [
          ["SUBJECT LOG", "被写体記録"],
          ["PROXIMITY REPORT", "近接報告"],
          ["READING CONDITIONS", "読解条件"],
          ["SOCIAL MALFUNCTION", "社会的誤作動"],
        ]
      : [
          ["SCAN MODE", "走査モード"],
          ["OBJECT STATUS", "対象状態"],
          ["MEANING DRIFT", "意味のずれ"],
          ["SYSTEM STATUS", "システム状態"],
        ],
    start,
    4
  );

  return {
    title_en: "MALFUNCTION",
    title_jp: "誤作動",
    notice_en:
      mode === "subject"
        ? "HUMAN SUBJECT DETECTED. IDENTITY ANALYSIS DISABLED."
        : "OBJECT MODE ACTIVE. SEMANTIC STABILITY NOT GUARANTEED.",
    notice_jp:
      mode === "subject"
        ? "人物主対象を検出。個人識別解析は無効です。"
        : "物体モード有効。意味の安定性は保証されません。",
    sections: linesEn.map((en, index) => ({
      label_en: lineLabels[index][0],
      label_jp: lineLabels[index][1],
      en,
      jp: linesJp[index],
    })),
    diagnostics: diagnostics.map(([en, jp]) => ({ en, jp })),
  };
}

function stripFence(text) {
  const trimmed = String(text || "").trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  }
  return trimmed;
}

function normalizeResult(candidate, mode) {
  if (!candidate || typeof candidate !== "object") return null;
  const sections = Array.isArray(candidate.sections)
    ? candidate.sections
        .map((section) => ({
          label_en: String(section.label_en || section.labelEn || "").trim() || "ENTRY",
          label_jp: String(section.label_jp || section.labelJp || "").trim() || "記述",
          en: String(section.en || "").trim().toUpperCase(),
          jp: String(section.jp || "").trim(),
        }))
        .filter((section) => section.en && section.jp)
        .slice(0, 4)
    : [];

  const diagnostics = Array.isArray(candidate.diagnostics)
    ? candidate.diagnostics
        .map((item) => ({
          en: String(item.en || "").trim().toUpperCase(),
          jp: String(item.jp || "").trim(),
        }))
        .filter((item) => item.en && item.jp)
        .slice(0, 4)
    : [];

  if (!sections.length) return null;

  return {
    title_en: "MALFUNCTION",
    title_jp: "誤作動",
    notice_en: String(candidate.notice_en || candidate.noticeEn || "").trim() || (mode === "subject"
      ? "HUMAN SUBJECT DETECTED. IDENTITY ANALYSIS DISABLED."
      : "OBJECT MODE ACTIVE. SEMANTIC STABILITY NOT GUARANTEED."),
    notice_jp: String(candidate.notice_jp || candidate.noticeJp || "").trim() || (mode === "subject"
      ? "人物主対象を検出。個人識別解析は無効です。"
      : "物体モード有効。意味の安定性は保証されません。"),
    sections,
    diagnostics: diagnostics.length
      ? diagnostics
      : (mode === "subject"
        ? [
            { en: "SUBJECT LOG", jp: "被写体記録" },
            { en: "PROXIMITY REPORT", jp: "近接報告" },
            { en: "READING CONDITIONS", jp: "読解条件" },
            { en: "SOCIAL MALFUNCTION", jp: "社会的誤作動" },
          ]
        : [
            { en: "SCAN MODE", jp: "走査モード" },
            { en: "OBJECT STATUS", jp: "対象状態" },
            { en: "MEANING DRIFT", jp: "意味のずれ" },
            { en: "SYSTEM STATUS", jp: "システム状態" },
          ]),
  };
}

function requirePassword(request, env) {
  const configuredPassword = String(env.APP_PASSWORD || "").trim();
  const incomingPassword = String(request.headers.get("x-app-password") || "").trim();
  return configuredPassword && incomingPassword && configuredPassword === incomingPassword;
}

function extractResponseText(payload) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }
  const outputs = Array.isArray(payload?.output) ? payload.output : [];
  const texts = [];
  for (const item of outputs) {
    const contents = Array.isArray(item?.content) ? item.content : [];
    for (const content of contents) {
      if (typeof content?.text === "string" && content.text.trim()) {
        texts.push(content.text);
      }
    }
  }
  return texts.join("\n").trim();
}

async function runOpenAI(env, mode, imageDataUrl) {
  if (!env.OPENAI_API_KEY) return null;

  const model = env.OPENAI_MODEL || "gpt-4.1-mini";
  const systemPrompt = [
    "You generate pseudo-manual text for a retro CRT PWA called CODE 904 / MALFUNCTION / MEAN SLIPPER.",
    "Return only valid JSON.",
    "English lines must be uppercase and concise.",
    "Japanese lines must be natural and concise.",
    "Dry, institutional, slightly uncanny tone.",
    "For subject mode, never identify a real person or infer age, ethnicity, health, attractiveness, or private traits.",
    "Describe only proximity, framing, tension, and observational conditions.",
    "For object mode, write plausible-but-useless instruction language for the visible object or scene.",
    'Schema: {"notice_en":"...","notice_jp":"...","sections":[{"label_en":"...","label_jp":"...","en":"...","jp":"..."}],"diagnostics":[{"en":"...","jp":"..."}]}'
  ].join(" ");

  const userText = mode === "subject"
    ? "Mode: subject. Produce four bilingual sections and four bilingual diagnostics. Focus on observational record, proximity, framing, and social malfunction."
    : "Mode: object. Produce four bilingual sections and four bilingual diagnostics. Focus on a plausible-but-useless manual for the visible object or scene.";

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      temperature: 1,
      max_output_tokens: 700,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: systemPrompt }],
        },
        {
          role: "user",
          content: [
            { type: "input_text", text: userText },
            { type: "input_image", image_url: imageDataUrl, detail: "low" },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${text}`);
  }

  const payload = await response.json();
  const raw = extractResponseText(payload);
  if (!raw) return null;
  try {
    return normalizeResult(JSON.parse(stripFence(raw)), mode);
  } catch {
    return null;
  }
}

export async function onRequestPost(context) {
  try {
    if (!requirePassword(context.request, context.env)) {
      return json({ ok: false, error: "Unauthorized." }, 401);
    }

    const body = await context.request.json().catch(() => ({}));
    const mode = body?.mode === "subject" ? "subject" : "object";
    const imageDataUrl = String(body?.imageDataUrl || "");
    const nonce = String(body?.nonce || "");

    if (!imageDataUrl.startsWith("data:image/")) {
      return json({ ok: false, error: "Image data URL is required." }, 400);
    }

    let result = null;
    let usedAI = false;
    let warning = "";

    try {
      result = await runOpenAI(context.env, mode, imageDataUrl);
      usedAI = Boolean(result);
    } catch (error) {
      warning = `OpenAI failed, fallback used. / OpenAI に失敗したためフォールバックを使用しました。 ${error?.message || ""}`.trim();
    }

    if (!result) {
      result = buildFallback(mode, nonce, imageDataUrl);
    }

    return json({
      ok: true,
      usedAI,
      model: context.env.OPENAI_MODEL || "gpt-4.1-mini",
      warning,
      result,
    });
  } catch (error) {
    return json({ ok: false, error: error?.message || "Generation failed." }, 500);
  }
}
