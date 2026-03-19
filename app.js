const NARRATIVE_MAX_CHARS = 500;
const EMPTY_PLACEHOLDER = "Not provided";
const PDF_WORKSPACE_WIDTH = 612;
const PDF_WORKSPACE_HEIGHT = 792;
const SHEET_CONTENT_WIDTH = 512;
const AI_CONFIG = window.COMMITTEE_AI_CONFIG || {};
const DRAFT_API_URL = String(AI_CONFIG.draftApiUrl || "").trim();
const TURNSTILE_SITE_KEY = String(AI_CONFIG.turnstileSiteKey || "").trim();
const TRANSCRIPT_MAX_CHARS = Number(AI_CONFIG.transcriptMaxChars) || 250000;
const TRANSCRIPT_ACCEPTED_EXTENSIONS = Array.isArray(AI_CONFIG.transcriptAcceptedExtensions)
  ? AI_CONFIG.transcriptAcceptedExtensions.map((value) => String(value || "").toLowerCase())
  : [".txt", ".md"];
const EMBEDDED_ASSETS = window.__EMBEDDED_ASSETS__ || {};
const LOGO_ASSET_PATH = EMBEDDED_ASSETS.logo7sage || "./assets/logo-7sage-b2r2.svg";
const PDF_FOOTER_TEXT =
  "If you have any questions, email collegeprep@7sage.com, or visit college.7sage.com";

// Reader roster: compact display with one school tag per reader.
const READER_PROFILES = [
  {
    fullName: "Jenn Kott",
    firstName: "Jenn",
    aliases: ["Jenn Kott", "Jen Kott", "Jennifer Kott", "Jen", "Jenn", "Jennifer"],
    headshotUrl: EMBEDDED_ASSETS.jenKottHeadshot || "./assets/jen-kott.png",
    school: "S.C.A.D.",
  },
  {
    fullName: "Jake Baska",
    firstName: "Jake",
    aliases: ["Jake Baska", "Jacob Baska", "Jacob", "Jake"],
    headshotUrl: EMBEDDED_ASSETS.jakeBaskaHeadshot || "./assets/jake-baska.jpeg",
    school: "Notre Dame",
  },
  {
    fullName: "Kamil Brown",
    firstName: "Kamil",
    aliases: ["Kamil Brown", "Kamil"],
    headshotUrl: EMBEDDED_ASSETS.kamilBrownHeadshot || "./assets/kamil-brown.png",
    school: "UPenn",
  },
  {
    fullName: "Lexi Kaider",
    firstName: "Lexi",
    aliases: ["Lexi Kaider", "Lexi"],
    headshotUrl: "",
    school: "Wesleyan",
  },
];

const READER_BY_NAME = new Map(READER_PROFILES.map((profile) => [profile.fullName, profile]));

const FIELD_METADATA = [
  { key: "studentName", label: "Student Name", pillLabel: "Name", inputId: "studentName", kind: "meta" },
  { key: "satAct", label: "SAT/ACT", inputId: "examScore", kind: "meta" },
  { key: "gpa", label: "GPA", pillLabel: "GPA", inputId: "gpa", kind: "meta" },
  { key: "targetSchool", label: "Target School", pillLabel: "School", inputId: "targetSchool", kind: "meta" },
  { key: "reader1", label: "Reader 1", inputId: "reader1", kind: "reader" },
  { key: "reader2", label: "Reader 2", inputId: "reader2", kind: "reader" },
  { key: "reader3", label: "Reader 3", inputId: "reader3", kind: "reader" },
  {
    key: "strengths",
    label: "Strengths",
    previewLabel: "Strengths",
    inputId: "strengths",
    kind: "narrative",
    isNarrative: true,
    counterId: "strengthsCount",
  },
  {
    key: "weaknesses",
    label: "Potential Weaknesses",
    previewLabel: "Potential Weaknesses",
    inputId: "weaknesses",
    kind: "narrative",
    isNarrative: true,
    counterId: "weaknessesCount",
  },
  {
    key: "opportunities",
    label: "Opportunities for Improvement",
    previewLabel: "Opportunities for Improvement",
    inputId: "opportunities",
    kind: "narrative",
    isNarrative: true,
    counterId: "opportunitiesCount",
  },
  {
    key: "keyTakeaways",
    label: "Suggested Next Steps",
    previewLabel: "Suggested Next Steps",
    inputId: "keyTakeaways",
    kind: "narrative",
    isNarrative: true,
    counterId: "keyTakeawaysCount",
  },
];

const SECTION_STYLES = {
  strengths: {
    cssClass: "section-strengths",
    headerColor: [247, 245, 243],
    borderColor: [147, 217, 208],
    titleTextColor: [38, 178, 161],
  },
  weaknesses: {
    cssClass: "section-weaknesses",
    headerColor: [247, 245, 243],
    borderColor: [251, 184, 181],
    titleTextColor: [247, 113, 107],
  },
  opportunities: {
    cssClass: "section-opportunities",
    headerColor: [247, 245, 243],
    borderColor: [150, 194, 208],
    titleTextColor: [45, 132, 160],
  },
  keyTakeaways: {
    cssClass: "section-keyTakeaways",
    headerColor: [239, 199, 109],
    borderColor: [238, 188, 83],
  },
};

const PDF_THEME = {
  pageBackground: [252, 252, 252],
  headerBackground: [235, 242, 251],
  headerText: [0, 0, 0],
  headerAccentA: [38, 178, 161],
  headerAccentB: [45, 132, 160],
  headerAccentC: [239, 199, 109],
  badgeFill: [247, 208, 113],
  badgeText: [16, 35, 63],
  metaFill: [255, 255, 255],
  metaBorder: [205, 209, 216],
  readerCardFill: [255, 255, 255],
  bodyText: [27, 32, 38],
  mutedText: [122, 129, 142],
  footerText: [34, 40, 48],
  cardBorder: [205, 209, 216],
};

const META_FIELD_KEYS = FIELD_METADATA.filter((field) => field.kind === "meta").map(
  (field) => field.key
);
const READER_FIELD_KEYS = FIELD_METADATA.filter((field) => field.kind === "reader").map(
  (field) => field.key
);
const NARRATIVE_FIELD_KEYS = FIELD_METADATA.filter((field) => field.kind === "narrative").map(
  (field) => field.key
);

const FIELD_BY_KEY = new Map(FIELD_METADATA.map((field) => [field.key, field]));

const formState = {
  studentName: "",
  examType: "SAT",
  satAct: "",
  gpa: "",
  targetSchool: "",
  reader1: READER_PROFILES[0].fullName,
  reader2: READER_PROFILES[1].fullName,
  reader3: READER_PROFILES[2].fullName,
  strengths: "",
  weaknesses: "",
  opportunities: "",
  keyTakeaways: "",
};

const previewContent = document.getElementById("previewContent");
const statusEl = document.getElementById("status");
const transcriptFileInput = document.getElementById("transcriptFile");
const transcriptMetaEl = document.getElementById("transcriptMeta");
const turnstileWrapEl = document.getElementById("turnstileWrap");
const turnstileContainerEl = document.getElementById("turnstileContainer");
const generateDraftsBtn = document.getElementById("generateDraftsBtn");
const generatePdfBtn = document.getElementById("generatePdfBtn");
let pdfLogoCache = null;
let pdfLogoLoadPromise = null;
let turnstileWidgetId = null;
let turnstileToken = "";
const transcriptState = {
  fileName: "",
  text: "",
};

function setStatus(message) {
  statusEl.textContent = message;
}

function clampNarrative(value) {
  return String(value || "").trim().slice(0, NARRATIVE_MAX_CHARS);
}

function getNarrativeValueMap(source = formState) {
  return {
    strengths: String(source.strengths || ""),
    weaknesses: String(source.weaknesses || ""),
    opportunities: String(source.opportunities || ""),
    keyTakeaways: String(source.keyTakeaways || ""),
  };
}

function getEmptyNarrativeKeys() {
  return NARRATIVE_FIELD_KEYS.filter((key) => !String(formState[key] || "").trim());
}

function formatCharCount(length) {
  return `${length.toLocaleString()} chars`;
}

function updateTranscriptMeta() {
  if (!transcriptMetaEl) return;
  if (!transcriptState.text) {
    transcriptMetaEl.textContent = "No transcript uploaded.";
    return;
  }

  const label = transcriptState.fileName || "Transcript";
  transcriptMetaEl.textContent = `${label} loaded (${formatCharCount(transcriptState.text.length)}).`;
}

function getFileExtension(fileName) {
  const value = String(fileName || "").toLowerCase();
  const index = value.lastIndexOf(".");
  if (index <= 0 || index === value.length - 1) return "";
  return value.slice(index);
}

function isAcceptedTranscriptFile(file) {
  if (!file) return false;
  const extension = getFileExtension(file.name);
  if (!TRANSCRIPT_ACCEPTED_EXTENSIONS.includes(extension)) return false;
  const mime = String(file.type || "").toLowerCase();
  if (!mime) return true;
  return mime.startsWith("text/") || mime.includes("markdown");
}

async function onTranscriptFileChange(event) {
  const file = event?.target?.files?.[0];
  if (!file) {
    transcriptState.fileName = "";
    transcriptState.text = "";
    updateTranscriptMeta();
    return;
  }

  if (!isAcceptedTranscriptFile(file)) {
    transcriptState.fileName = "";
    transcriptState.text = "";
    if (transcriptFileInput) {
      transcriptFileInput.value = "";
    }
    updateTranscriptMeta();
    setStatus("Transcript must be a .txt or .md file.");
    return;
  }

  const raw = await file.text();
  const normalized = String(raw || "").replace(/\r\n/g, "\n");
  const trimmed = normalized.slice(0, TRANSCRIPT_MAX_CHARS);
  transcriptState.fileName = file.name;
  transcriptState.text = trimmed;
  updateTranscriptMeta();

  if (normalized.length > TRANSCRIPT_MAX_CHARS) {
    setStatus(`Transcript was truncated to ${formatCharCount(TRANSCRIPT_MAX_CHARS)}.`);
  } else {
    setStatus("Transcript uploaded. You can generate drafts now.");
  }
}

function initTurnstileWidget() {
  if (!turnstileWrapEl || !turnstileContainerEl) return;
  if (!TURNSTILE_SITE_KEY) {
    turnstileWrapEl.hidden = true;
    return;
  }

  turnstileWrapEl.hidden = false;
  const tryRender = () => {
    if (turnstileWidgetId !== null) return;
    if (!window.turnstile?.render) {
      window.setTimeout(tryRender, 250);
      return;
    }

    turnstileWidgetId = window.turnstile.render(turnstileContainerEl, {
      sitekey: TURNSTILE_SITE_KEY,
      theme: "light",
      callback: (token) => {
        turnstileToken = String(token || "");
      },
      "expired-callback": () => {
        turnstileToken = "";
      },
      "error-callback": () => {
        turnstileToken = "";
      },
    });
  };

  tryRender();
}

function buildDraftRequestPayload(emptyKeys) {
  const examType = String(formState.examType || "SAT").toUpperCase();
  const examScore = String(formState.satAct || "").trim();
  return {
    context: {
      studentName: String(formState.studentName || ""),
      satAct: examScore ? `${examType} ${examScore}` : "",
      examType,
      gpa: String(formState.gpa || ""),
      targetSchool: String(formState.targetSchool || ""),
      reader1: String(formState.reader1 || ""),
      reader2: String(formState.reader2 || ""),
      reader3: String(formState.reader3 || ""),
    },
    transcript: {
      fileName: transcriptState.fileName,
      text: transcriptState.text,
    },
    existingNarratives: getNarrativeValueMap(),
    options: {
      mode: "fill_empty_only",
      targetKeys: emptyKeys,
      maxChars: NARRATIVE_MAX_CHARS,
    },
    turnstileToken: turnstileToken || "",
  };
}

function applyDraftsToForm(drafts, targetKeys) {
  let filledCount = 0;

  targetKeys.forEach((key) => {
    const field = FIELD_BY_KEY.get(key);
    if (!field) return;
    if (String(formState[key] || "").trim()) return;

    const value = clampNarrative(drafts?.[key] || "");
    if (!value) return;

    const input = document.getElementById(field.inputId);
    if (!input) return;
    input.value = value;
    syncInputToState(field);
    filledCount += 1;
  });

  return filledCount;
}

async function generateDrafts() {
  if (!generateDraftsBtn) return;
  if (!DRAFT_API_URL) {
    setStatus("Draft API URL is not configured. Set COMMITTEE_AI_CONFIG.draftApiUrl in config.js.");
    return;
  }

  if (!transcriptState.text.trim()) {
    setStatus("Upload a Zoom transcript (.txt or .md) before generating drafts.");
    return;
  }

  if (TURNSTILE_SITE_KEY && !turnstileToken) {
    setStatus("Complete the verification challenge before generating drafts.");
    return;
  }

  const emptyKeys = getEmptyNarrativeKeys();
  if (!emptyKeys.length) {
    setStatus("All narrative fields already have text. Clear a field to generate a draft.");
    return;
  }

  const originalLabel = generateDraftsBtn.textContent;
  generateDraftsBtn.disabled = true;
  generateDraftsBtn.textContent = "Generating...";
  setStatus("Generating drafts from transcript...");

  try {
    const response = await fetch(DRAFT_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildDraftRequestPayload(emptyKeys)),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.message || `Draft generation failed (${response.status}).`);
    }

    const filledCount = applyDraftsToForm(data?.drafts || {}, emptyKeys);
    renderPreview();

    if (filledCount > 0) {
      setStatus(`Drafted ${filledCount} field(s). Review and edit before exporting PDF.`);
    } else {
      setStatus("No draft text was returned for empty fields.");
    }

    if (turnstileWidgetId !== null && window.turnstile?.reset) {
      window.turnstile.reset(turnstileWidgetId);
      turnstileToken = "";
    }
  } catch (error) {
    const detail = String(error?.message || "unknown error").slice(0, 220);
    setStatus(`Draft generation failed. ${detail}`);
  } finally {
    generateDraftsBtn.disabled = false;
    generateDraftsBtn.textContent = originalLabel || "Generate Drafts";
  }
}

function getDisplayValue(value) {
  const normalized = String(value || "").trim();
  return normalized ? normalized : EMPTY_PLACEHOLDER;
}

function sanitizeFileName(value) {
  const base = String(value || "")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return base ? base.slice(0, 120) : "committee-review";
}

function getReaderProfile(name) {
  return READER_BY_NAME.get(String(name || "").trim()) || null;
}

function getInitials(profile) {
  if (!profile) return "?";
  const parts = String(profile.fullName || "")
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0][0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] || "" : "";
  return `${first}${last}`.toUpperCase() || "?";
}

function resolveAssetUrl(path) {
  return new URL(String(path || ""), window.location.href).href;
}

function isRemoteHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function ensurePdfLogoData() {
  if (pdfLogoCache) return Promise.resolve(pdfLogoCache);
  if (pdfLogoLoadPromise) return pdfLogoLoadPromise;

  pdfLogoLoadPromise = new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      try {
        const width = image.naturalWidth || 1;
        const height = image.naturalHeight || 1;
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d");
        if (!context) {
          resolve(null);
          return;
        }
        context.drawImage(image, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/png");
        pdfLogoCache = { dataUrl, aspectRatio: width / height };
        resolve(pdfLogoCache);
      } catch (_error) {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = resolveAssetUrl(LOGO_ASSET_PATH);
  }).finally(() => {
    pdfLogoLoadPromise = null;
  });

  return pdfLogoLoadPromise;
}

function updateCounter(counterId, length) {
  const counter = document.getElementById(counterId);
  if (!counter) return;
  counter.textContent = `${length}/${NARRATIVE_MAX_CHARS}`;
}

function populateReaderSelects() {
  READER_FIELD_KEYS.forEach((key) => {
    const field = FIELD_BY_KEY.get(key);
    const select = document.getElementById(field.inputId);
    if (!select) return;

    select.innerHTML = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select Reader";
    select.appendChild(placeholder);

    READER_PROFILES.forEach((profile) => {
      const option = document.createElement("option");
      option.value = profile.fullName;
      option.textContent = profile.fullName;
      select.appendChild(option);
    });

    select.value = formState[key] || "";
  });
}

function syncInputToState(field) {
  const input = document.getElementById(field.inputId);
  if (!input) return;

  let value = input.value;
  if (field.isNarrative && value.length > NARRATIVE_MAX_CHARS) {
    value = value.slice(0, NARRATIVE_MAX_CHARS);
    input.value = value;
  }

  formState[field.key] = value;

  if (field.isNarrative && field.counterId) {
    updateCounter(field.counterId, value.length);
  }
}

function bindFormInputs() {
  FIELD_METADATA.forEach((field) => {
    const input = document.getElementById(field.inputId);
    if (!input) return;

    if (field.isNarrative) {
      input.maxLength = NARRATIVE_MAX_CHARS;
    }

    syncInputToState(field);

    const isSelect = input.tagName.toLowerCase() === "select";
    const eventName = isSelect ? "change" : "input";
    input.addEventListener(eventName, () => {
      syncInputToState(field);
      renderPreview();
    });
  });
}

function bindExamTypeToggle() {
  const radios = [...document.querySelectorAll('input[name="examType"]')];
  if (!radios.length) return;

  const syncType = () => {
    const selected = radios.find((radio) => radio.checked);
    const normalized = String(selected?.value || "SAT").toUpperCase();
    formState.examType = normalized === "ACT" ? "ACT" : "SAT";
    renderPreview();
  };

  radios.forEach((radio) => {
    radio.addEventListener("change", syncType);
  });

  syncType();
}

function getMetaPillLabel(key) {
  const field = FIELD_BY_KEY.get(key);
  if (key === "satAct") {
    return String(formState.examType || "SAT").toUpperCase() === "ACT" ? "ACT" : "SAT";
  }
  return field?.pillLabel || field?.label || key;
}

function createMetaPill(key) {
  const value = getDisplayValue(formState[key]);
  const pill = document.createElement("div");
  pill.className = "meta-pill";

  const labelEl = document.createElement("p");
  labelEl.className = "meta-pill-label";
  labelEl.textContent = getMetaPillLabel(key);

  const valueEl = document.createElement("p");
  valueEl.className = "meta-pill-value";
  valueEl.textContent = value;
  if (value === EMPTY_PLACEHOLDER) {
    valueEl.classList.add("is-empty");
  }

  pill.appendChild(labelEl);
  pill.appendChild(valueEl);
  return pill;
}

function createReaderCard(readerKey) {
  const profile = getReaderProfile(formState[readerKey]);

  const card = document.createElement("article");
  card.className = "reader-card";

  const top = document.createElement("div");
  top.className = "reader-top";

  const avatar = document.createElement("div");
  avatar.className = "reader-avatar";
  if (profile?.headshotUrl) {
    const img = document.createElement("img");
    img.src = resolveAssetUrl(profile.headshotUrl);
    img.alt = profile.fullName;
    img.loading = "eager";
    if (isRemoteHttpUrl(profile.headshotUrl)) {
      img.crossOrigin = "anonymous";
      img.referrerPolicy = "no-referrer";
    }
    img.addEventListener("error", () => {
      console.warn("Headshot failed to load:", profile.headshotUrl);
      avatar.replaceChildren();
      const initials = document.createElement("span");
      initials.className = "reader-initials";
      initials.textContent = getInitials(profile);
      avatar.appendChild(initials);
    });
    avatar.appendChild(img);
  } else {
    const initials = document.createElement("span");
    initials.className = "reader-initials";
    initials.textContent = getInitials(profile);
    avatar.appendChild(initials);
  }

  const name = document.createElement("p");
  name.className = "reader-name";
  name.textContent = profile ? profile.fullName : "Select Reader";
  if (!profile) {
    name.classList.add("is-empty");
  }

  const school = document.createElement("p");
  school.className = "reader-school";
  school.textContent = profile ? profile.school : "School";
  if (!profile) {
    school.classList.add("is-empty");
  }

  const copy = document.createElement("div");
  copy.className = "reader-copy";
  copy.appendChild(name);
  copy.appendChild(school);

  top.appendChild(avatar);
  top.appendChild(copy);

  card.appendChild(top);
  return card;
}

function createNarrativeSection(key) {
  const field = FIELD_BY_KEY.get(key);
  const value = getDisplayValue(formState[key]);
  const style = SECTION_STYLES[key];

  const section = document.createElement("section");
  section.className = `sheet-section ${style.cssClass}`;

  const title = document.createElement("h3");
  title.className = "sheet-section-title";
  title.textContent = field.previewLabel || field.label;

  const body = document.createElement("p");
  body.className = "sheet-section-body";
  body.textContent = value;
  if (value === EMPTY_PLACEHOLDER) {
    body.classList.add("is-empty");
  }

  section.appendChild(title);
  section.appendChild(body);
  return section;
}

function renderPreview() {
  const sheet = document.createElement("article");
  sheet.className = "review-sheet";

  const header = document.createElement("header");
  header.className = "sheet-header";

  const brand = document.createElement("div");
  brand.className = "brand-lockup";
  const logo = document.createElement("img");
  logo.className = "brand-logo";
  logo.src = resolveAssetUrl(LOGO_ASSET_PATH);
  logo.alt = "7Sage";
  logo.loading = "eager";
  brand.appendChild(logo);

  const title = document.createElement("h2");
  title.className = "sheet-title";
  title.textContent = "Admissions Committee Review";

  const headerInline = document.createElement("div");
  headerInline.className = "sheet-header-inline";
  headerInline.appendChild(brand);
  headerInline.appendChild(title);
  header.appendChild(headerInline);

  const metaRow = document.createElement("section");
  metaRow.className = "sheet-meta-row";
  META_FIELD_KEYS.forEach((key) => {
    metaRow.appendChild(createMetaPill(key));
  });

  const readersWrap = document.createElement("section");
  readersWrap.className = "sheet-readers";

  const readersTitle = document.createElement("h3");
  readersTitle.className = "sheet-readers-title";
  readersTitle.textContent = "Your Readers";

  const readersRow = document.createElement("div");
  readersRow.className = "sheet-readers-row";
  READER_FIELD_KEYS.forEach((key) => {
    readersRow.appendChild(createReaderCard(key));
  });

  readersWrap.appendChild(readersTitle);
  readersWrap.appendChild(readersRow);

  const sectionsWrap = document.createElement("section");
  sectionsWrap.className = "sheet-sections";
  NARRATIVE_FIELD_KEYS.forEach((key) => {
    sectionsWrap.appendChild(createNarrativeSection(key));
  });

  const footer = document.createElement("p");
  footer.className = "sheet-footer";
  footer.textContent = PDF_FOOTER_TEXT;

  sheet.appendChild(header);
  sheet.appendChild(metaRow);
  sheet.appendChild(readersWrap);
  sheet.appendChild(sectionsWrap);
  sheet.appendChild(footer);

  previewContent.replaceChildren(sheet);
}

function ensurePdfLibAvailable() {
  const hasPdf = Boolean(window.jspdf?.jsPDF);
  if (!hasPdf) {
    setStatus("PDF library failed to load. Refresh and try again.");
    return false;
  }
  return true;
}

function getPdfLayout(doc) {
  const pageWidth = PDF_WORKSPACE_WIDTH;
  const pageHeight = PDF_WORKSPACE_HEIGHT;
  const pagePaddingX = (pageWidth - SHEET_CONTENT_WIDTH) / 2;
  const contentWidth = SHEET_CONTENT_WIDTH;
  const headerHeight = 48;
  const metaY = 60;
  const metaHeight = 36;
  const readersTitleY = 102;
  const readerCardsY = 110;
  const readerCardWidth = 162;
  const readerCardHeight = 62;
  const readerCardGap = 10;
  const sectionsStartY = 186;
  const sectionGap = 10;
  const defaultSectionHeight = 118;
  const sectionHeaderHeight = 27;
  const sectionBodyPadding = 9;
  const sectionLineHeight = 12;
  const sectionStackBottom =
    sectionsStartY + defaultSectionHeight * NARRATIVE_FIELD_KEYS.length + sectionGap * 3;

  return {
    pageWidth,
    pageHeight,
    pagePaddingX,
    contentWidth,
    headerHeight,
    metaY,
    metaHeight,
    readersTitleY,
    readerCardsY,
    readerCardWidth,
    readerCardHeight,
    readerCardGap,
    sectionsStartY,
    sectionGap,
    defaultSectionHeight,
    sectionHeaderHeight,
    sectionBodyPadding,
    sectionLineHeight,
    continuationSectionHeight: sectionStackBottom - sectionsStartY,
    footerY: pageHeight - 24,
  };
}

function truncateTextToWidth(doc, text, maxWidth) {
  const value = String(text || "");
  if (doc.getTextWidth(value) <= maxWidth) {
    return value;
  }

  const suffix = "...";
  let low = 0;
  let high = value.length;
  let best = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = `${value.slice(0, mid)}${suffix}`;
    if (doc.getTextWidth(candidate) <= maxWidth) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const clipped = value.slice(0, best).trimEnd();
  return clipped ? `${clipped}${suffix}` : suffix;
}

function drawMetaPills(doc, layout) {
  const pillGap = 10;
  const widths = [162, 72, 72, 176];
  const totalRowWidth = widths.reduce((sum, width) => sum + width, 0) + pillGap * 3;
  const rowStartX = layout.pagePaddingX + (layout.contentWidth - totalRowWidth) / 2;

  let x = rowStartX;
  META_FIELD_KEYS.forEach((key, index) => {
    const label = getMetaPillLabel(key);
    const width = widths[index];
    const value = getDisplayValue(formState[key]);
    const maxTextWidth = width - 12;

    doc.setFillColor(...PDF_THEME.metaFill);
    doc.setDrawColor(...PDF_THEME.metaBorder);
    doc.roundedRect(x, layout.metaY, width, layout.metaHeight, 8, 8, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(95, 106, 123);
    const labelText = truncateTextToWidth(doc, String(label).toUpperCase(), maxTextWidth);
    doc.text(labelText, x + 7, layout.metaY + 11);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...(value === EMPTY_PLACEHOLDER ? PDF_THEME.mutedText : PDF_THEME.bodyText));
    const text = truncateTextToWidth(doc, value, maxTextWidth);
    doc.text(text, x + 7, layout.metaY + 24);

    x += width + pillGap;
  });
}

function drawReaderCards(doc, layout) {
  doc.setFont("times", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(0, 0, 0);
  doc.text("Your Readers", layout.pageWidth / 2, layout.readersTitleY, { align: "center" });

  const totalRowWidth = layout.readerCardWidth * 3 + layout.readerCardGap * 2;
  const rowStartX = layout.pagePaddingX + (layout.contentWidth - totalRowWidth) / 2;
  READER_FIELD_KEYS.forEach((key, index) => {
    const profile = getReaderProfile(formState[key]);
    const cardWidth = layout.readerCardWidth;
    const cardX = rowStartX + index * (cardWidth + layout.readerCardGap);
    const cardY = layout.readerCardsY;
    doc.setFillColor(...PDF_THEME.readerCardFill);
    doc.setDrawColor(...PDF_THEME.cardBorder);
    doc.setLineWidth(1.2);
    doc.roundedRect(cardX, cardY, cardWidth, layout.readerCardHeight, 8, 8, "FD");

    const avatarDiameter = 28;
    const avatarRadius = avatarDiameter / 2;
    const avatarX = cardX + 24;
    const avatarY = cardY + 20;
    doc.setFillColor(0, 0, 0);
    doc.circle(avatarX, avatarY, avatarRadius, "F");

    const initials = getInitials(profile);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(250, 252, 255);
    doc.text(initials, avatarX, avatarY + 3, { align: "center" });

    doc.setFont("times", "bold");
    doc.setFontSize(9.3);
    doc.setTextColor(...PDF_THEME.bodyText);
    const nameText = profile ? profile.fullName : "Select Reader";
    const nameLine = truncateTextToWidth(doc, nameText, cardWidth - 66);
    doc.text(nameLine, cardX + 52, cardY + 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.7);
    doc.setTextColor(84, 97, 115);
    const schoolText = profile ? profile.school : "School";
    const schoolLine = truncateTextToWidth(doc, schoolText, cardWidth - 66);
    doc.text(schoolLine, cardX + 52, cardY + 34);
  });
}

function drawPageChrome(doc, layout, logoData) {
  doc.setFillColor(...PDF_THEME.pageBackground);
  doc.rect(0, 0, layout.pageWidth, layout.pageHeight, "F");

  doc.setFillColor(...PDF_THEME.headerBackground);
  doc.rect(0, 0, layout.pageWidth, layout.headerHeight, "F");
  const bandY = layout.headerHeight - 3;
  const third = layout.pageWidth / 3;
  doc.setFillColor(...PDF_THEME.headerAccentA);
  doc.rect(0, bandY, third, 3, "F");
  doc.setFillColor(...PDF_THEME.headerAccentB);
  doc.rect(third, bandY, third, 3, "F");
  doc.setFillColor(...PDF_THEME.headerAccentC);
  doc.rect(third * 2, bandY, third, 3, "F");

  const headerCenterX = layout.pagePaddingX + layout.contentWidth / 2;
  const headerLineY = 30;
  const logoHeight = 24;
  let logoWidth = 78;

  if (logoData?.aspectRatio && Number.isFinite(logoData.aspectRatio)) {
    logoWidth = Math.max(40, Math.min(180, logoHeight * logoData.aspectRatio));
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.setTextColor(...PDF_THEME.headerText);
  const brandText = "Admissions Committee Review";
  const brandGap = 7;
  const brandTextWidth = doc.getTextWidth(brandText);
  const brandTotalWidth = logoWidth + brandGap + brandTextWidth;
  const brandStartX = headerCenterX - brandTotalWidth / 2;
  const badgeY = Math.round(headerLineY - 18);

  if (logoData?.dataUrl) {
    doc.addImage(logoData.dataUrl, "PNG", brandStartX, badgeY, logoWidth, logoHeight);
  } else {
    const badgeW = 94;
    doc.setFillColor(...PDF_THEME.badgeFill);
    doc.roundedRect(brandStartX, badgeY, badgeW, logoHeight, 8, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(...PDF_THEME.badgeText);
    doc.text("7sage", brandStartX + 7, badgeY + 17);
    logoWidth = badgeW;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.setTextColor(...PDF_THEME.headerText);
  doc.text(brandText, brandStartX + logoWidth + brandGap, headerLineY - 14);

  drawMetaPills(doc, layout);
  drawReaderCards(doc, layout);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.setTextColor(...PDF_THEME.footerText);
  doc.text(PDF_FOOTER_TEXT, layout.pageWidth / 2, layout.footerY, { align: "center" });
}

function buildWrappedLines(doc, text, maxWidth) {
  const rawLines = String(text || "").split(/\r?\n/);
  const wrapped = [];

  rawLines.forEach((line) => {
    if (!line) {
      wrapped.push("");
      return;
    }
    const chunks = doc.splitTextToSize(line, maxWidth);
    if (!chunks.length) {
      wrapped.push(line);
      return;
    }
    chunks.forEach((chunk) => wrapped.push(String(chunk)));
  });

  return wrapped.length ? wrapped : [""];
}

function drawSectionBlock(doc, layout, sectionKey, lines, startIndex, y, height, isContinuation) {
  const style = SECTION_STYLES[sectionKey];
  const field = FIELD_BY_KEY.get(sectionKey);
  const sectionTitleBase = field.previewLabel || field.label;
  const sectionTitle = isContinuation ? `${sectionTitleBase} (cont.)` : sectionTitleBase;

  doc.setDrawColor(...style.borderColor);
  doc.setLineWidth(1.2);
  doc.roundedRect(layout.pagePaddingX, y, layout.contentWidth, height, 8, 8, "S");

  doc.setFillColor(...style.headerColor);
  doc.roundedRect(layout.pagePaddingX, y, layout.contentWidth, layout.sectionHeaderHeight, 8, 8, "F");
  doc.setFillColor(...PDF_THEME.pageBackground);
  doc.rect(
    layout.pagePaddingX + 0.8,
    y + layout.sectionHeaderHeight - 4,
    layout.contentWidth - 1.6,
    5,
    "F"
  );

  doc.setFont("times", "bold");
  doc.setFontSize(13.5);
  const titleTextColor = style.titleTextColor || [0, 0, 0];
  doc.setTextColor(...titleTextColor);
  doc.text(sectionTitle, layout.pagePaddingX + layout.contentWidth / 2, y + 19, { align: "center" });

  const bodyTop = y + layout.sectionHeaderHeight + layout.sectionBodyPadding;
  const availableBodyHeight = height - layout.sectionHeaderHeight - layout.sectionBodyPadding * 2;
  const maxLines = Math.max(0, Math.floor(availableBodyHeight / layout.sectionLineHeight));
  const bodyMaxWidth = layout.contentWidth - layout.sectionBodyPadding * 2;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...PDF_THEME.bodyText);

  let consumed = 0;
  while (consumed < maxLines && startIndex + consumed < lines.length) {
    const line = lines[startIndex + consumed];
    const safe = line ? line : " ";
    doc.text(safe, layout.pagePaddingX + layout.sectionBodyPadding, bodyTop + consumed * layout.sectionLineHeight, {
      maxWidth: bodyMaxWidth,
    });
    consumed += 1;
  }

  return consumed;
}

async function waitForImages(root) {
  if (!root) return;
  const images = [...root.querySelectorAll("img")];
  if (!images.length) return;

  await Promise.all(
    images.map((image) => {
      if (image.complete && image.naturalWidth > 0) return Promise.resolve();
      return new Promise((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          resolve();
        };
        image.addEventListener("load", finish, { once: true });
        image.addEventListener("error", finish, { once: true });
        if (typeof image.decode === "function") {
          image.decode().then(finish).catch(() => {});
        }
        setTimeout(finish, 1600);
      });
    })
  );
}

function inlineCloneImagesFromSource(sourceRoot, cloneRoot) {
  const sourceImages = [...sourceRoot.querySelectorAll("img")];
  const cloneImages = [...cloneRoot.querySelectorAll("img")];
  const count = Math.min(sourceImages.length, cloneImages.length);

  for (let i = 0; i < count; i += 1) {
    const sourceImage = sourceImages[i];
    const cloneImage = cloneImages[i];
    if (!sourceImage || !cloneImage) continue;
    if (!sourceImage.complete || sourceImage.naturalWidth <= 0 || sourceImage.naturalHeight <= 0) continue;

    try {
      const canvas = document.createElement("canvas");
      canvas.width = sourceImage.naturalWidth;
      canvas.height = sourceImage.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) continue;
      context.drawImage(sourceImage, 0, 0);
      cloneImage.src = canvas.toDataURL("image/png");
    } catch (_error) {
      // Keep original src when inlining fails.
    }
  }
}

async function capturePreviewSheetToImage() {
  const sourceSheet = previewContent.querySelector(".review-sheet");
  if (!sourceSheet) {
    throw new Error("No preview sheet available.");
  }

  const hasHtmlToImage = typeof window.htmlToImage?.toPng === "function";
  const hasHtml2Canvas = typeof window.html2canvas === "function";
  if (!hasHtmlToImage && !hasHtml2Canvas) {
    throw new Error("No preview capture library available.");
  }

  const staging = document.createElement("div");
  staging.style.position = "fixed";
  staging.style.left = "-10000px";
  staging.style.top = "0";
  staging.style.width = `${PDF_WORKSPACE_WIDTH}px`;
  staging.style.height = `${PDF_WORKSPACE_HEIGHT}px`;
  staging.style.overflow = "hidden";
  staging.style.pointerEvents = "none";
  staging.style.opacity = "1";
  staging.style.zIndex = "-1";

  const clone = sourceSheet.cloneNode(true);
  clone.classList.add("pdf-export-root");
  clone.style.width = `${PDF_WORKSPACE_WIDTH}px`;
  clone.style.height = `${PDF_WORKSPACE_HEIGHT}px`;
  clone.style.maxWidth = "none";
  clone.style.maxHeight = "none";
  clone.style.margin = "0";
  staging.appendChild(clone);
  document.body.appendChild(staging);

  try {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await waitForImages(sourceSheet);
    inlineCloneImagesFromSource(sourceSheet, clone);
    await waitForImages(clone);

    const isFileProtocol = window.location.protocol === "file:";

    let html2CanvasError = null;
    if (hasHtml2Canvas) {
      try {
        const canvas = await window.html2canvas(clone, {
          scale: 2,
          useCORS: !isFileProtocol,
          allowTaint: isFileProtocol,
          backgroundColor: "#fcfcfc",
          width: PDF_WORKSPACE_WIDTH,
          height: PDF_WORKSPACE_HEIGHT,
          windowWidth: PDF_WORKSPACE_WIDTH,
          windowHeight: PDF_WORKSPACE_HEIGHT,
          x: 0,
          y: 0,
          scrollX: 0,
          scrollY: 0,
          logging: false,
        });
        return canvas.toDataURL("image/png");
      } catch (error) {
        html2CanvasError = error;
      }
    }

    let htmlToImageError = null;
    if (hasHtmlToImage) {
      try {
        return await window.htmlToImage.toPng(clone, {
          pixelRatio: 2,
          cacheBust: !isFileProtocol,
          backgroundColor: "#fcfcfc",
          width: PDF_WORKSPACE_WIDTH,
          height: PDF_WORKSPACE_HEIGHT,
          canvasWidth: PDF_WORKSPACE_WIDTH,
          canvasHeight: PDF_WORKSPACE_HEIGHT,
        });
      } catch (error) {
        htmlToImageError = error;
      }
    }

    const html2Message = html2CanvasError?.message || "not attempted";
    const htmlToImageMessage = htmlToImageError?.message || "not attempted";
    throw new Error(
      `Preview capture failed. html2canvas: ${html2Message}. html-to-image: ${htmlToImageMessage}.`
    );

  } finally {
    staging.remove();
  }
}

async function generatePdfWithManualFallback() {
  const doc = new window.jspdf.jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: [PDF_WORKSPACE_WIDTH, PDF_WORKSPACE_HEIGHT],
  });
  const layout = getPdfLayout(doc);
  const logoData = await ensurePdfLogoData();

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const sectionStates = NARRATIVE_FIELD_KEYS.map((key) => ({
    key,
    lines: buildWrappedLines(
      doc,
      getDisplayValue(formState[key]),
      layout.contentWidth - layout.sectionBodyPadding * 2
    ),
    index: 0,
  }));

  drawPageChrome(doc, layout, logoData);
  let sectionY = layout.sectionsStartY;
  sectionStates.forEach((state) => {
    const consumed = drawSectionBlock(
      doc,
      layout,
      state.key,
      state.lines,
      state.index,
      sectionY,
      layout.defaultSectionHeight,
      false
    );
    state.index += consumed;
    sectionY += layout.defaultSectionHeight + layout.sectionGap;
  });

  sectionStates.forEach((state) => {
    while (state.index < state.lines.length) {
      doc.addPage([PDF_WORKSPACE_WIDTH, PDF_WORKSPACE_HEIGHT], "portrait");
      drawPageChrome(doc, layout, logoData);
      const consumed = drawSectionBlock(
        doc,
        layout,
        state.key,
        state.lines,
        state.index,
        layout.sectionsStartY,
        layout.continuationSectionHeight,
        true
      );

      if (consumed <= 0) break;
      state.index += consumed;
    }
  });

  return doc;
}

async function generatePdf() {
  if (!ensurePdfLibAvailable()) return;
  setStatus("Generating PDF from live preview...");

  try {
    const imageData = await capturePreviewSheetToImage();
    const doc = new window.jspdf.jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: [PDF_WORKSPACE_WIDTH, PDF_WORKSPACE_HEIGHT],
    });
    doc.addImage(
      imageData,
      "PNG",
      0,
      0,
      PDF_WORKSPACE_WIDTH,
      PDF_WORKSPACE_HEIGHT,
      undefined,
      "FAST"
    );

    const fileStem = sanitizeFileName(formState.studentName || "committee-review");
    doc.save(`${fileStem}-committee-review.pdf`);
    setStatus("PDF generated from live preview.");
  } catch (error) {
    console.error("Preview capture PDF export failed:", error);
    const detail = String(error?.message || "unknown capture error").slice(0, 220);
    setStatus(`PDF export failed. ${detail}`);
  }
}

if (transcriptFileInput) {
  transcriptFileInput.addEventListener("change", (event) => {
    onTranscriptFileChange(event).catch((error) => {
      console.error("Transcript upload failed:", error);
      setStatus("Could not read transcript file.");
    });
  });
}

if (generateDraftsBtn) {
  generateDraftsBtn.addEventListener("click", generateDrafts);
}

generatePdfBtn.addEventListener("click", generatePdf);

populateReaderSelects();
bindFormInputs();
bindExamTypeToggle();
renderPreview();
updateTranscriptMeta();
initTurnstileWidget();
