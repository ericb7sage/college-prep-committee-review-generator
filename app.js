const RATING_KEYS = ["passionCuriosity", "academicAbility", "initiativeLeadership", "impactContribution"];
const RATING_LABELS = {
  passionCuriosity: "Passion / Curiosity",
  academicAbility: "Academic Ability",
  initiativeLeadership: "Initiative / Leadership",
  impactContribution: "Impact / Contribution",
};
const QUESTION_KEYS = ["unansweredQuestions", "campusFit", "distinctiveness"];
const QUESTION_LABELS = {
  unansweredQuestions: "Unanswered questions",
  campusFit: "Thriving on campus",
  distinctiveness: "Distinctiveness",
};
const QUESTION_PROMPTS = {
  unansweredQuestions: "Do you have unanswered questions? What would you like to know more about?",
  campusFit: "Can you picture this applicant thriving on your campus?",
  distinctiveness: "Did you learn enough to distinguish this applicant from students with identical scores and GPAs?",
};
const STUDENT_COLUMNS = ["student_name", "test_type", "test_score", "gpa", "target_school"];
const REVIEWER_SUFFIXES = [
  "name", "passion_curiosity_rating", "academic_ability_rating",
  "initiative_leadership_rating", "impact_contribution_rating",
  "unanswered_questions", "campus_fit", "distinctiveness",
];
const REQUIRED_COLUMNS = [
  ...STUDENT_COLUMNS,
  ...[1, 2, 3].flatMap((number) => REVIEWER_SUFFIXES.map((suffix) => `reviewer_${number}_${suffix}`)),
];
const PDF = {
  width: 612, height: 792, margin: 40, headerHeight: 58,
  summaryWidth: 506, summaryTextHeight: 338,
  reviewerTextWidth: 484, reviewerTextHeight: 176,
};

let report = null;
let importedReport = null;
let lastFit = { summary: true, reviewers: [true, true, true] };

const importView = document.getElementById("importView");
const workspace = document.getElementById("workspace");
const csvFile = document.getElementById("csvFile");
const importErrors = document.getElementById("importErrors");
const reviewerEditors = document.getElementById("reviewerEditors");
const previewPages = document.getElementById("previewPages");
const exportPdfButton = document.getElementById("exportPdf");
const fitAlert = document.getElementById("fitAlert");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const source = String(text || "").replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field.length === 0) quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
    else field += char;
  }
  if (quoted) throw new Error("The CSV contains an unclosed quoted value.");
  if (field.length || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
  return rows.filter((values) => values.some((value) => String(value).trim() !== ""));
}

function validateAndBuildReport(text) {
  const errors = [];
  let rows;
  try { rows = parseCsv(text); }
  catch (error) { return { errors: [error.message] }; }
  if (!rows.length) return { errors: ["The CSV is empty."] };
  const headers = rows[0].map((header) => header.trim());
  const duplicates = headers.filter((header, index) => header && headers.indexOf(header) !== index);
  if (duplicates.length) errors.push(`Duplicate column header: ${[...new Set(duplicates)].join(", ")}.`);
  const missing = REQUIRED_COLUMNS.filter((column) => !headers.includes(column));
  if (missing.length) errors.push(`Missing required column${missing.length === 1 ? "" : "s"}: ${missing.join(", ")}.`);
  const unknown = headers.filter((column) => column && !REQUIRED_COLUMNS.includes(column));
  if (unknown.length) errors.push(`Unknown column${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}. Use the provided template exactly.`);
  if (rows.length - 1 !== 1) errors.push(`Expected exactly one data row; found ${Math.max(0, rows.length - 1)}.`);
  if (errors.length) return { errors };
  if (rows[1].length > headers.length) errors.push("The data row contains more values than the header row.");
  const values = Object.fromEntries(headers.map((header, index) => [header, String(rows[1][index] ?? "").trim()]));
  REQUIRED_COLUMNS.forEach((column) => { if (!values[column]) errors.push(`${column}: value is required.`); });
  const testType = values.test_type.toUpperCase();
  if (values.test_type && !["SAT", "ACT"].includes(testType)) errors.push("test_type: use SAT or ACT.");
  for (let number = 1; number <= 3; number += 1) {
    for (const suffix of REVIEWER_SUFFIXES.filter((item) => item.endsWith("_rating"))) {
      const column = `reviewer_${number}_${suffix}`;
      const rating = Number(values[column]);
      if (values[column] && (!Number.isFinite(rating) || rating < 1 || rating > 5)) {
        errors.push(`${column}: rating must be a number from 1 to 5.`);
      }
    }
  }
  if (errors.length) return { errors };
  const reviewers = [1, 2, 3].map((number) => ({
    name: values[`reviewer_${number}_name`],
    ratings: {
      passionCuriosity: Number(values[`reviewer_${number}_passion_curiosity_rating`]),
      academicAbility: Number(values[`reviewer_${number}_academic_ability_rating`]),
      initiativeLeadership: Number(values[`reviewer_${number}_initiative_leadership_rating`]),
      impactContribution: Number(values[`reviewer_${number}_impact_contribution_rating`]),
    },
    answers: {
      unansweredQuestions: values[`reviewer_${number}_unanswered_questions`],
      campusFit: values[`reviewer_${number}_campus_fit`],
      distinctiveness: values[`reviewer_${number}_distinctiveness`],
    },
  }));
  return { report: {
    student: { name: values.student_name, testType, testScore: values.test_score, gpa: values.gpa, targetSchool: values.target_school },
    reviewers, consultantSummary: "",
  }};
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildTemplate(example = false) {
  const values = Object.fromEntries(REQUIRED_COLUMNS.map((column) => [column, ""]));
  if (example) {
    Object.assign(values, { student_name: "Jordan Rivera", test_type: "SAT", test_score: "1480", gpa: "3.9 unweighted", target_school: "Example University" });
    for (let number = 1; number <= 3; number += 1) {
      Object.assign(values, {
        [`reviewer_${number}_name`]: ["Alex Morgan", "Taylor Chen", "Sam Okafor"][number - 1],
        [`reviewer_${number}_passion_curiosity_rating`]: String(3 + (number % 3)),
        [`reviewer_${number}_academic_ability_rating`]: "4",
        [`reviewer_${number}_initiative_leadership_rating`]: String(number === 2 ? 5 : 4),
        [`reviewer_${number}_impact_contribution_rating`]: "4",
        [`reviewer_${number}_unanswered_questions`]: "I would like to understand more about how Jordan’s interest developed over time.",
        [`reviewer_${number}_campus_fit`]: "Yes. Jordan appears collaborative, intellectually engaged, and ready to contribute.",
        [`reviewer_${number}_distinctiveness`]: "The connection between community work and academic interests created a memorable through-line.",
      });
    }
  }
  return `${REQUIRED_COLUMNS.join(",")}\r\n${REQUIRED_COLUMNS.map((column) => csvEscape(values[column])).join(",")}\r\n`;
}

function setDownloadLink(element, content) {
  element.href = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
}

function showImportErrors(errors) {
  importErrors.hidden = !errors.length;
  importErrors.innerHTML = errors.length ? `<strong>We couldn’t import this CSV.</strong><ul>${errors.map((error) => `<li>${escapeHtml(error)}</li>`).join("")}</ul>` : "";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

async function handleFile(file) {
  if (!file) return;
  if (!/\.csv$/i.test(file.name) && file.type !== "text/csv") { showImportErrors(["Choose a .csv file."]); return; }
  const result = validateAndBuildReport(await file.text());
  if (result.errors) { showImportErrors(result.errors); return; }
  showImportErrors([]);
  report = result.report;
  importedReport = structuredClone(result.report);
  openWorkspace();
}

function getPath(object, path) { return path.split(".").reduce((value, key) => value?.[key], object); }
function setPath(object, path, value) {
  const keys = path.split("."); let cursor = object;
  keys.slice(0, -1).forEach((key) => { cursor = cursor[key]; });
  cursor[keys.at(-1)] = value;
}

function reviewerEditorHtml(reviewer, index) {
  const number = index + 1;
  return `<fieldset class="reviewer-fieldset"><legend>Reviewer ${number}</legend>
    <label><span>Reviewer name</span><input data-path="reviewers.${index}.name" type="text" value="${escapeHtml(reviewer.name)}"></label>
    <div class="ratings-grid">${RATING_KEYS.map((key) => `<div class="rating-row"><span class="rating-label">${RATING_LABELS[key]}</span><div class="star-input" role="radiogroup" aria-label="${escapeHtml(RATING_LABELS[key])}">${[5,4,3,2,1].map((rating) => `<input data-path="reviewers.${index}.ratings.${key}" id="r${number}-${key}-${rating}" name="r${number}-${key}" type="radio" value="${rating}" ${reviewer.ratings[key] === rating ? "checked" : ""}><label for="r${number}-${key}-${rating}" aria-label="${rating} star${rating === 1 ? "" : "s"}">★</label>`).join("")}</div></div>`).join("")}</div>
    <div class="review-questions">${QUESTION_KEYS.map((key) => `<label class="textarea-field"><span>${escapeHtml(QUESTION_PROMPTS[key])}</span><textarea data-path="reviewers.${index}.answers.${key}" rows="4">${escapeHtml(reviewer.answers[key])}</textarea><span class="field-meta"><span data-count="reviewers.${index}.answers.${key}">${reviewer.answers[key].length} characters</span></span></label>`).join("")}</div>
    <span class="field-meta"><span>Combined reviewer box</span><span data-fit="reviewer-${index}" class="fit-badge">Fits</span></span>
  </fieldset>`;
}

function openWorkspace() {
  reviewerEditors.innerHTML = report.reviewers.map(reviewerEditorHtml).join("");
  document.querySelectorAll("[data-path]").forEach((input) => {
    const value = getPath(report, input.dataset.path);
    if (input.type === "radio") input.checked = Number(input.value) === Number(value);
    else input.value = value;
    input.addEventListener(input.type === "radio" || input.tagName === "SELECT" ? "change" : "input", onEditorInput);
  });
  importView.hidden = true; workspace.hidden = false; render();
}

function onEditorInput(event) {
  const input = event.currentTarget;
  setPath(report, input.dataset.path, input.type === "radio" ? Number(input.value) : input.value);
  updateCount(input.dataset.path);
  render();
}

function updateCount(path) {
  const counter = document.querySelector(`[data-count="${path}"]`);
  if (counter) counter.textContent = `${String(getPath(report, path) || "").length} characters`;
}

function averageRatings() {
  return Object.fromEntries(RATING_KEYS.map((key) => [key, report.reviewers.reduce((sum, reviewer) => sum + Number(reviewer.ratings[key]), 0) / 3]));
}
function roundedHalf(value) { return Math.round(Number(value) * 2) / 2; }
function starsHtml(value) {
  const rounded = roundedHalf(value);
  return Array.from({ length: 5 }, (_, index) => index + 1 <= rounded ? "<span>★</span>" : index + .5 === rounded ? '<span class="star-half">★</span>' : '<span class="star-empty">★</span>').join("");
}

function createMeasureDoc() { return new window.jspdf.jsPDF({ unit: "pt", format: "letter", orientation: "portrait" }); }
function lineCount(doc, text, width) { return doc.splitTextToSize(String(text || ""), width).length; }
function calculateFit() {
  if (!window.jspdf?.jsPDF) return { summary: true, reviewers: [true, true, true] };
  const doc = createMeasureDoc();
  doc.setFont("helvetica", "normal"); doc.setFontSize(10.5);
  const summaryLines = String(report.consultantSummary || "") ? lineCount(doc, report.consultantSummary, PDF.summaryWidth - 24) : 0;
  const summaryHeight = summaryLines * 15.75;
  doc.setFontSize(8.6);
  const reviewers = report.reviewers.map((reviewer) => {
    const lines = QUESTION_KEYS.reduce((sum, key) => sum + lineCount(doc, reviewer.answers[key], PDF.reviewerTextWidth), 0);
    const height = lines * 11.35 + QUESTION_KEYS.length * 17;
    return height <= PDF.reviewerTextHeight;
  });
  return { summary: summaryHeight <= PDF.summaryTextHeight, reviewers };
}

function updateFitUi() {
  lastFit = calculateFit();
  const problems = [];
  if (!lastFit.summary) problems.push("overall summary");
  lastFit.reviewers.forEach((fits, index) => { if (!fits) problems.push(`Reviewer ${index + 1}`); });
  document.querySelectorAll("[data-fit]").forEach((badge) => {
    const fits = badge.dataset.fit === "summary" ? lastFit.summary : lastFit.reviewers[Number(badge.dataset.fit.split("-")[1])];
    badge.textContent = fits ? "Fits" : "Too long"; badge.classList.toggle("overflow", !fits);
  });
  exportPdfButton.disabled = problems.length > 0;
  fitAlert.classList.toggle("error", problems.length > 0);
  fitAlert.textContent = problems.length ? `Shorten ${problems.join(", ")} before exporting.` : "All content fits the fixed two-page report.";
}

function reportHeader(pageTitle) {
  return `<header class="report-header"><img src="./assets/logo-7sage-b2r2.svg" alt="7Sage"><h3>${pageTitle}</h3></header>`;
}
function footerHtml(page) { return `<p class="page-footer">7Sage College Admissions · Committee Review · Page ${page} of 2</p>`; }
function previewHtml() {
  const averages = averageRatings();
  const meta = [["Student", report.student.name], [report.student.testType, report.student.testScore], ["GPA", report.student.gpa], ["School", report.student.targetSchool]];
  const pageOne = `<article class="pdf-page">${reportHeader("Admissions Committee Review")}<div class="page-body"><div class="meta-grid">${meta.map(([label,value]) => `<div class="meta-card"><b>${escapeHtml(label)}</b><span>${escapeHtml(value)}</span></div>`).join("")}</div><h4 class="ratings-title">Committee Ratings</h4><div class="rating-cards">${RATING_KEYS.map((key) => `<div class="rating-card"><p>${RATING_LABELS[key]}</p><div class="stars" aria-label="${roundedHalf(averages[key])} out of 5">${starsHtml(averages[key])}</div></div>`).join("")}</div><section class="summary-box"><div class="box-title">Overall Summary</div><div class="summary-copy">${escapeHtml(report.consultantSummary) || "Add the consultant’s overall summary in the editor."}</div></section></div>${footerHtml(1)}</article>`;
  const pageTwo = `<article class="pdf-page page-two">${reportHeader("Reviewer Perspectives")}<div class="page-body">${report.reviewers.map((reviewer) => `<section class="review-box"><h3 class="reviewer-name">${escapeHtml(reviewer.name)}</h3><div class="review-copy">${QUESTION_KEYS.map((key) => `<h4>${QUESTION_LABELS[key]}</h4><p>${escapeHtml(reviewer.answers[key])}</p>`).join("")}</div></section>`).join("")}</div>${footerHtml(2)}</article>`;
  return pageOne + pageTwo;
}
function render() { previewPages.innerHTML = previewHtml(); updateFitUi(); }

function sanitizeFilename(value) { return String(value || "committee-review").replace(/[<>:"/\\|?*\x00-\x1f]/g, "").trim().slice(0, 100) || "committee-review"; }
function drawHeader(doc, title, logo) {
  doc.setFillColor(234,242,251); doc.rect(0,0,PDF.width,PDF.headerHeight,"F");
  if (logo) doc.addImage(logo, "PNG", PDF.margin, 17, 82, 27);
  else { doc.setFont("helvetica","bold"); doc.setFontSize(20); doc.setTextColor(21,35,60); doc.text("7Sage",PDF.margin,36); }
  doc.setFont("times","bold"); doc.setFontSize(18); doc.setTextColor(21,35,60); doc.text(title,PDF.width-PDF.margin,35,{align:"right"});
}
function drawFooter(doc, page) {
  doc.setDrawColor(226,230,235); doc.line(PDF.margin,768,PDF.width-PDF.margin,768);
  doc.setFont("helvetica","normal"); doc.setFontSize(7); doc.setTextColor(108,117,130); doc.text(`7Sage College Admissions · Committee Review · Page ${page} of 2`,PDF.width/2,780,{align:"center"});
}
function drawStarPath(doc, x, y, radius, color, fraction) {
  const points = Array.from({length:10},(_,index)=>{const angle=-Math.PI/2+index*Math.PI/5;const r=index%2===0?radius:radius*.43;return [x+Math.cos(angle)*r,y+Math.sin(angle)*r];});
  const lines = points.slice(1).map((point,index)=>[point[0]-points[index][0],point[1]-points[index][1]]);
  doc.setDrawColor(205,211,220); doc.setFillColor(213,218,226); doc.lines(lines,points[0][0],points[0][1],[1,1],"FD",true);
  if (fraction > 0) {
    doc.saveGraphicsState(); doc.rect(x-radius-1,y-radius-1,(radius*2+2)*fraction,radius*2+2).clip().discardPath();
    doc.setDrawColor(...color); doc.setFillColor(...color); doc.lines(lines,points[0][0],points[0][1],[1,1],"FD",true); doc.restoreGraphicsState();
  }
}
function drawStars(doc, value, x, y) {
  const rounded = roundedHalf(value);
  for (let i=0;i<5;i+=1) drawStarPath(doc,x+i*25,y,9,[229,173,47],Math.max(0,Math.min(1,rounded-i)));
}
function drawPageOne(doc, logo) {
  drawHeader(doc,"Admissions Committee Review",logo);
  const meta = [["STUDENT",report.student.name,148],[report.student.testType,report.student.testScore,72],["GPA",report.student.gpa,72],["SCHOOL",report.student.targetSchool,216]];
  let x=PDF.margin; const y=76;
  meta.forEach(([label,value,width])=>{doc.setFillColor(255);doc.setDrawColor(213,218,226);doc.roundedRect(x,y,width,38,7,7,"FD");doc.setFont("helvetica","bold");doc.setFontSize(6.5);doc.setTextColor(104,115,134);doc.text(label,x+8,y+12);doc.setFont("helvetica","normal");doc.setFontSize(9);doc.setTextColor(27,32,38);const clipped=doc.splitTextToSize(String(value),width-16)[0]||"";doc.text(clipped,x+8,y+27);x+=width+8;});
  doc.setFont("times","bold");doc.setFontSize(13);doc.setTextColor(21,35,60);doc.text("Committee Ratings",PDF.width/2,142,{align:"center"});
  const averages=averageRatings(); const cards=[[40,158],[310,158],[40,222],[310,222]];
  RATING_KEYS.forEach((key,index)=>{const [cx,cy]=cards[index];doc.setFillColor(255);doc.setDrawColor(213,218,226);doc.roundedRect(cx,cy,262,54,8,8,"FD");doc.setFont("helvetica","bold");doc.setFontSize(9);doc.setTextColor(27,32,38);doc.text(RATING_LABELS[key],cx+14,cy+18);drawStars(doc,averages[key],cx+22,cy+38);});
  doc.setFillColor(255);doc.setDrawColor(201,209,220);doc.roundedRect(40,294,532,447,10,10,"FD");doc.setFillColor(243,200,111);doc.roundedRect(40,294,532,32,10,10,"F");doc.rect(40,310,532,16,"F");doc.setFont("times","bold");doc.setFontSize(12);doc.setTextColor(21,35,60);doc.text("Overall Summary",52,315);
  doc.setFont("helvetica","normal");doc.setFontSize(10.5);doc.setTextColor(27,32,38);const lines=doc.splitTextToSize(report.consultantSummary||"",508);doc.text(lines,52,346,{lineHeightFactor:1.5}); drawFooter(doc,1);
}
function drawPageTwo(doc, logo) {
  drawHeader(doc,"Reviewer Perspectives",logo); doc.setFont("helvetica","normal");doc.setFontSize(8.6);
  report.reviewers.forEach((reviewer,index)=>{const x=40,y=73+index*226,w=532,h=214;doc.setFillColor(255);doc.setDrawColor(207,214,223);doc.roundedRect(x,y,w,h,9,9,"FD");doc.setFillColor(237,243,250);doc.roundedRect(x,y,w,27,9,9,"F");doc.rect(x,y+13,w,14,"F");doc.setFont("times","bold");doc.setFontSize(12);doc.setTextColor(21,35,60);doc.text(reviewer.name,x+11,y+18);let cursor=y+42;QUESTION_KEYS.forEach((key)=>{doc.setFont("helvetica","bold");doc.setFontSize(8);doc.setTextColor(45,132,160);doc.text(QUESTION_LABELS[key],x+11,cursor);cursor+=10;doc.setFont("helvetica","normal");doc.setFontSize(8.6);doc.setTextColor(27,32,38);const lines=doc.splitTextToSize(reviewer.answers[key],484);doc.text(lines,x+11,cursor,{lineHeightFactor:1.32});cursor+=lines.length*11.35+7;});}); drawFooter(doc,2);
}
async function logoPng() {
  return new Promise((resolve)=>{const image=new Image();image.onload=()=>{const canvas=document.createElement("canvas");canvas.width=240;canvas.height=81;const ctx=canvas.getContext("2d");ctx.drawImage(image,0,0,240,81);resolve(canvas.toDataURL("image/png"));};image.onerror=()=>resolve(null);image.src="./assets/logo-7sage-b2r2.svg";});
}
async function exportPdf() {
  updateFitUi(); if (exportPdfButton.disabled) return;
  if (!window.jspdf?.jsPDF) { fitAlert.className="fit-alert error";fitAlert.textContent="The PDF library did not load. Refresh and try again.";return; }
  exportPdfButton.disabled=true;exportPdfButton.textContent="Building PDF…";let failed=false;
  try {
    const doc=createMeasureDoc(); const logo=await logoPng(); drawPageOne(doc,logo);doc.addPage();drawPageTwo(doc,logo);
    doc.setProperties({title:`Committee Review - ${report.student.name}`,subject:"7Sage admissions committee review",creator:"7Sage Committee Review Generator"});
    const url=URL.createObjectURL(doc.output("blob")); const link=document.createElement("a");
    document.getElementById("generatedPdfDownload")?.remove();
    link.id="generatedPdfDownload";link.hidden=true;link.href=url;link.download=`${sanitizeFilename(report.student.name)}-committee-review.pdf`;
    document.body.appendChild(link);link.click();
    window.setTimeout(()=>{link.remove();URL.revokeObjectURL(url);},30000);
  } catch (error) {
    failed=true;console.error("PDF export failed",error);fitAlert.className="fit-alert error";fitAlert.textContent="PDF export failed. Refresh the page and try again.";
  }
  finally { exportPdfButton.textContent="Export PDF";if(failed)exportPdfButton.disabled=false;else updateFitUi(); }
}

csvFile.addEventListener("change",(event)=>handleFile(event.target.files[0]));
const dropZone=document.getElementById("dropZone");
["dragenter","dragover"].forEach((name)=>dropZone.addEventListener(name,(event)=>{event.preventDefault();dropZone.classList.add("dragging");}));
["dragleave","drop"].forEach((name)=>dropZone.addEventListener(name,(event)=>{event.preventDefault();dropZone.classList.remove("dragging");}));
dropZone.addEventListener("drop",(event)=>handleFile(event.dataTransfer.files[0]));
document.getElementById("replaceCsv").addEventListener("click",()=>{if(!confirm("Replace this report? Unsaved edits will be lost."))return;workspace.hidden=true;importView.hidden=false;csvFile.value="";showImportErrors([]);});
document.getElementById("resetReport").addEventListener("click",()=>{if(!confirm("Reset every field to its imported value?"))return;report=structuredClone(importedReport);openWorkspace();});
exportPdfButton.addEventListener("click",exportPdf);
setDownloadLink(document.getElementById("downloadTemplate"),buildTemplate(false));
setDownloadLink(document.getElementById("downloadExample"),buildTemplate(true));
