const RATING_KEYS = ["passionCuriosity", "academicAbility", "initiativeLeadership", "impactContribution"];
const RATING_LABELS = {
  passionCuriosity: "Passion / Curiosity",
  academicAbility: "Academic Ability",
  initiativeLeadership: "Initiative / Leadership",
  impactContribution: "Impact / Contribution",
};
const PDF = {
  width: 612, height: 792, margin: 40, headerHeight: 58,
  summaryWidth: 506, summaryTextHeight: 338,
  reviewerTextWidth: 484, reviewerTextHeight: 176,
};

function createBlankReport() {
  return {
    student: { name: "", testType: "SAT", testScore: "", gpa: "", targetSchool: "" },
    reviewers: [1, 2, 3].map(() => ({
      name: "",
      ratings: { passionCuriosity: 0, academicAbility: 0, initiativeLeadership: 0, impactContribution: 0 },
      comment: "",
    })),
    consultantSummary: "",
  };
}

let report = createBlankReport();
let lastFit = { summary: true, reviewers: [true, true, true] };

const workspace = document.getElementById("workspace");
const reviewerEditors = document.getElementById("reviewerEditors");
const previewPages = document.getElementById("previewPages");
const exportPdfButton = document.getElementById("exportPdf");
const fitAlert = document.getElementById("fitAlert");

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
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
    <div class="ratings-grid">${RATING_KEYS.map((key) => `<div class="rating-row"><span class="rating-label">${RATING_LABELS[key]}</span><div class="star-input" role="radiogroup" aria-label="${escapeHtml(RATING_LABELS[key])}">${[5,4,3,2,1].map((rating) => `<input data-path="reviewers.${index}.ratings.${key}" id="r${number}-${key}-${rating}" name="r${number}-${key}" type="radio" value="${rating}" ${reviewer.ratings[key] === rating ? "checked" : ""}><label for="r${number}-${key}-${rating}" aria-label="${rating} star${rating === 1 ? "" : "s"}"></label>`).join("")}</div></div>`).join("")}</div>
    <label class="textarea-field"><span>Reviewer comment</span><textarea data-path="reviewers.${index}.comment" rows="10" placeholder="Enter this reviewer’s complete feedback...">${escapeHtml(reviewer.comment)}</textarea><span class="field-meta"><span data-count="reviewers.${index}.comment">${reviewer.comment.length} characters</span></span></label>
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
  workspace.hidden = false; render();
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
  return Array.from({ length: 5 }, (_, index) => index + 1 <= rounded ? "<span></span>" : index + .5 === rounded ? '<span class="star-half"></span>' : '<span class="star-empty"></span>').join("");
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
    const lines = lineCount(doc, reviewer.comment, PDF.reviewerTextWidth);
    const height = lines * 11.35;
    return height <= PDF.reviewerTextHeight;
  });
  return { summary: summaryHeight <= PDF.summaryTextHeight, reviewers };
}

function missingRequiredFields() {
  let missing = 0;
  Object.values(report.student).forEach((value) => { if (!String(value || "").trim()) missing += 1; });
  report.reviewers.forEach((reviewer) => {
    if (!String(reviewer.name || "").trim()) missing += 1;
    RATING_KEYS.forEach((key) => { if (Number(reviewer.ratings[key]) < 1) missing += 1; });
    if (!String(reviewer.comment || "").trim()) missing += 1;
  });
  if (!String(report.consultantSummary || "").trim()) missing += 1;
  return missing;
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
  const missing = missingRequiredFields();
  exportPdfButton.disabled = problems.length > 0 || missing > 0;
  fitAlert.classList.toggle("error", problems.length > 0 || missing > 0);
  fitAlert.textContent = problems.length
    ? `Shorten ${problems.join(", ")} before exporting.`
    : missing > 0
      ? `Complete all fields before exporting (${missing} remaining).`
      : "All content fits the fixed two-page report.";
}

function reportHeader(pageTitle) {
  return `<header class="report-header"><img src="./assets/logo-7sage-b2r2.svg" alt="7Sage"><h3>${pageTitle}</h3></header>`;
}
function footerHtml(page) { return `<p class="page-footer">7Sage College Prep · Committee Review · Page ${page} of 2</p>`; }
function previewHtml() {
  const averages = averageRatings();
  const meta = [["Student", report.student.name], [report.student.testType, report.student.testScore], ["GPA", report.student.gpa], ["School", report.student.targetSchool]];
  const pageOne = `<article class="pdf-page">${reportHeader("Admissions Committee Review")}<div class="page-body"><div class="meta-grid">${meta.map(([label,value]) => `<div class="meta-card"><b>${escapeHtml(label)}</b><span>${escapeHtml(value)}</span></div>`).join("")}</div><h4 class="ratings-title">Committee Ratings</h4><div class="rating-cards">${RATING_KEYS.map((key) => `<div class="rating-card"><p>${RATING_LABELS[key]}</p><div class="stars" aria-label="${roundedHalf(averages[key])} out of 5">${starsHtml(averages[key])}</div></div>`).join("")}</div><section class="summary-box"><div class="box-title">Overall Summary</div><div class="summary-copy">${escapeHtml(report.consultantSummary) || "Add the consultant’s overall summary in the editor."}</div></section></div>${footerHtml(1)}</article>`;
  const pageTwo = `<article class="pdf-page page-two">${reportHeader("Reviewer Perspectives")}<div class="page-body">${report.reviewers.map((reviewer) => `<section class="review-box"><h3 class="reviewer-name">${escapeHtml(reviewer.name)}</h3><div class="review-copy"><p>${escapeHtml(reviewer.comment)}</p></div></section>`).join("")}</div>${footerHtml(2)}</article>`;
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
  doc.setFont("helvetica","normal"); doc.setFontSize(7); doc.setTextColor(108,117,130); doc.text(`7Sage College Prep · Committee Review · Page ${page} of 2`,PDF.width/2,780,{align:"center"});
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
  meta.forEach(([label,value,width])=>{doc.setFillColor(255);doc.setDrawColor(213,218,226);doc.roundedRect(x,y,width,38,7,7,"FD");doc.setFont("helvetica","bold");doc.setFontSize(6.5);doc.setTextColor(104,115,134);doc.text(label,x+8,y+12);doc.setFont("helvetica","normal");doc.setFontSize(10);doc.setTextColor(0,0,0);const clipped=doc.splitTextToSize(String(value),width-16)[0]||"";doc.text(clipped,x+8,y+27);x+=width+8;});
  doc.setFont("times","bold");doc.setFontSize(13);doc.setTextColor(21,35,60);doc.text("Committee Ratings",PDF.width/2,142,{align:"center"});
  const averages=averageRatings(); const cards=[[40,158],[310,158],[40,222],[310,222]];
  RATING_KEYS.forEach((key,index)=>{const [cx,cy]=cards[index];doc.setFillColor(255);doc.setDrawColor(213,218,226);doc.roundedRect(cx,cy,262,54,8,8,"FD");doc.setFont("helvetica","bold");doc.setFontSize(9);doc.setTextColor(27,32,38);doc.text(RATING_LABELS[key],cx+14,cy+18);drawStars(doc,averages[key],cx+22,cy+38);});
  doc.setFillColor(255);doc.setDrawColor(201,209,220);doc.roundedRect(40,294,532,447,10,10,"FD");doc.setFillColor(243,200,111);doc.roundedRect(40,294,532,32,10,10,"F");doc.rect(40,310,532,16,"F");doc.setFont("times","bold");doc.setFontSize(12);doc.setTextColor(21,35,60);doc.text("Overall Summary",52,315);
  doc.setFont("helvetica","normal");doc.setFontSize(10.5);doc.setTextColor(27,32,38);const lines=doc.splitTextToSize(report.consultantSummary||"",508);doc.text(lines,52,346,{lineHeightFactor:1.5}); drawFooter(doc,1);
}
function drawPageTwo(doc, logo) {
  drawHeader(doc,"Reviewer Perspectives",logo); doc.setFont("helvetica","normal");doc.setFontSize(8.6);
  report.reviewers.forEach((reviewer,index)=>{const x=40,y=73+index*226,w=532,h=214;doc.setFillColor(255);doc.setDrawColor(207,214,223);doc.roundedRect(x,y,w,h,9,9,"FD");doc.setFillColor(237,243,250);doc.roundedRect(x,y,w,27,9,9,"F");doc.rect(x,y+13,w,14,"F");doc.setFont("times","bold");doc.setFontSize(12);doc.setTextColor(21,35,60);doc.text(reviewer.name,x+11,y+18);doc.setFont("helvetica","normal");doc.setFontSize(8.6);doc.setTextColor(27,32,38);const lines=doc.splitTextToSize(reviewer.comment,484);doc.text(lines,x+11,y+43,{lineHeightFactor:1.32});}); drawFooter(doc,2);
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

document.getElementById("resetReport").addEventListener("click",()=>{if(!confirm("Clear every field in this report?"))return;report=createBlankReport();openWorkspace();});
exportPdfButton.addEventListener("click",exportPdf);
openWorkspace();
