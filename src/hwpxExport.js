import JSZip from "jszip";

const MIMETYPE = "application/hwp+zip";
const PX_TO_HWP_UNIT = 7200 / 96;
const BASE_HWPX_URL = "/hwpx/base.hwpx";

const DEFAULT_DIMENSIONS = {
  width: 210 * (96 / 25.4),
  height: 297 * (96 / 25.4),
};

const DEFAULT_MARGINS = {
  top: 14.3 * (96 / 25.4),
  right: 15.3 * (96 / 25.4),
  bottom: 14.3 * (96 / 25.4),
  left: 15.3 * (96 / 25.4),
};

function escapeXml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function pxToHwpUnit(value, fallback) {
  const number = Number(value);
  const safeValue = Number.isFinite(number) ? number : fallback;
  return Math.round(safeValue * PX_TO_HWP_UNIT);
}

function fontSizeToHwp(value) {
  const number = Number(value);
  return Math.round((Number.isFinite(number) ? number : 10) * 100);
}

function normalizeFontFamily(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "Iowan Old Style";
}

function paragraphXml(text, id, charPrIDRef = 0) {
  const content = text.length ? `<hp:t>${escapeXml(text)}</hp:t>` : "<hp:t/>";
  return `<hp:p id="${id}" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${charPrIDRef}">${content}</hp:run><hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="0" horzpos="0" horzsize="10000" flags="393216"/></hp:linesegarray></hp:p>`;
}

function projectParagraphs(project) {
  const paragraphs = [];
  project.chapters.forEach((chapter, index) => {
    if (index > 0) paragraphs.push("");
    paragraphs.push(chapter.title || `소제목 ${index + 1}`);
    paragraphs.push("");
    String(chapter.body || "")
      .split(/\r?\n/)
      .forEach((line) => paragraphs.push(line));
  });
  return paragraphs.length ? paragraphs : [project.title || ""];
}

function patchBaseParagraph(headerXml, patcher) {
  return headerXml.replace(/<hh:paraPr id="0"[\s\S]*?<\/hh:paraPr>/, (block) => patcher(block));
}

function patchHeaderXml(templateHeader, { fontFamily, fontSize, lineHeight }) {
  const font = escapeXml(fontFamily);
  const height = fontSizeToHwp(fontSize);
  const lineSpacing = Math.round((Number(lineHeight) || 1.8) * 100);
  const patchedHeader = templateHeader
    .replace(/face="[^"]+"/g, `face="${font}"`)
    .replace(/(<hh:charPr id="0"[^>]*height=")\d+(")/, `$1${height}$2`);

  return patchBaseParagraph(patchedHeader, (block) =>
    block
      .replace(/(<hh:align horizontal=")[^"]+(")/, "$1LEFT$2")
      .replace(/(<hh:lineSpacing type="PERCENT" value=")\d+(")/g, `$1${lineSpacing}$2`),
  );
}

function patchHeaderParagraphIndent(templateHeader, textIndent) {
  const indent = pxToHwpUnit(textIndent || 0, 0);
  return patchBaseParagraph(templateHeader, (block) =>
    block.replace(/<hc:intent value="-?\d+" unit="HWPUNIT"\/>/g, `<hc:intent value="${indent}" unit="HWPUNIT"/>`),
  );
}

function patchFirstParagraph(firstParagraph, { width, height, marginLeft, marginRight, marginTop, marginBottom }) {
  return firstParagraph
    .replace(/(<hp:pagePr\b[^>]*\bwidth=")\d+(")/, `$1${width}$2`)
    .replace(/(<hp:pagePr\b[^>]*\bheight=")\d+(")/, `$1${height}$2`)
    .replace(/(<hp:margin\b[^>]*\bheader=")-?\d+(")/, "$10$2")
    .replace(/(<hp:margin\b[^>]*\bfooter=")-?\d+(")/, "$10$2")
    .replace(/(<hp:margin\b[^>]*\bgutter=")-?\d+(")/, "$10$2")
    .replace(/(<hp:margin\b[^>]*\bleft=")\d+(")/, `$1${marginLeft}$2`)
    .replace(/(<hp:margin\b[^>]*\bright=")\d+(")/, `$1${marginRight}$2`)
    .replace(/(<hp:margin\b[^>]*\btop=")\d+(")/, `$1${marginTop}$2`)
    .replace(/(<hp:margin\b[^>]*\bbottom=")\d+(")/, `$1${marginBottom}$2`);
}

function splitTemplateSection(templateSection) {
  const firstParagraph = templateSection.match(/<hp:p[\s\S]*?<\/hp:p>/)?.[0] || "";
  const openTag = templateSection.match(/<hs:sec\b[^>]*>/)?.[0] || "";
  const closeTag = "</hs:sec>";
  return { openTag, firstParagraph, closeTag };
}

function sectionXml(project, paper, templateSection) {
  const dimensions = paper.dimensions || DEFAULT_DIMENSIONS;
  const margins = paper.margins || DEFAULT_MARGINS;
  const width = pxToHwpUnit(dimensions.width, DEFAULT_DIMENSIONS.width);
  const height = pxToHwpUnit(dimensions.height, DEFAULT_DIMENSIONS.height);
  const marginLeft = pxToHwpUnit(margins.left, DEFAULT_MARGINS.left);
  const marginRight = pxToHwpUnit(margins.right, DEFAULT_MARGINS.right);
  const marginTop = pxToHwpUnit(margins.top, DEFAULT_MARGINS.top);
  const marginBottom = pxToHwpUnit(margins.bottom, DEFAULT_MARGINS.bottom);
  const { openTag, firstParagraph, closeTag } = splitTemplateSection(templateSection);
  const sectionStart = openTag || `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><hs:sec xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section">`;
  const leadingParagraph = patchFirstParagraph(firstParagraph, {
    width,
    height,
    marginLeft,
    marginRight,
    marginTop,
    marginBottom,
  });
  const body = projectParagraphs(project)
    .map((line, index) => paragraphXml(line, 1000000000 + index))
    .join("");

  return `${sectionStart}
${leadingParagraph}
${body}
${closeTag}`;
}

function previewText(project) {
  return projectParagraphs(project).join("\n").slice(0, 4096);
}

async function loadBaseTemplate() {
  const response = await fetch(BASE_HWPX_URL);
  if (!response.ok) throw new Error("HWPX base template could not be loaded.");
  return JSZip.loadAsync(await response.arrayBuffer());
}

async function copyTemplateToZip(templateZip) {
  const output = new JSZip();
  const entries = [];
  templateZip.forEach((path, file) => {
    if (!file.dir) entries.push({ path, file });
  });

  const mimetype = templateZip.file("mimetype");
  output.file("mimetype", mimetype ? await mimetype.async("string") : MIMETYPE, { compression: "STORE" });

  for (const { path, file } of entries) {
    if (path === "mimetype") continue;
    output.file(path, await file.async("arraybuffer"), { compression: "DEFLATE" });
  }
  return output;
}

export async function createHwpxBlob(project, preferences = {}) {
  const paper = preferences.paper || {};
  const fontFamily = normalizeFontFamily(paper.fontFamily);
  const fontSize = preferences.editorFontSize || 10;
  const lineHeight = paper.lineHeight || 1.8;
  const textIndent = paper.textIndent || 0;
  const templateZip = await loadBaseTemplate();
  const zip = await copyTemplateToZip(templateZip);
  const templateHeader = await templateZip.file("Contents/header.xml").async("string");
  const templateSection = await templateZip.file("Contents/section0.xml").async("string");

  const header = patchHeaderParagraphIndent(
    patchHeaderXml(templateHeader, { fontFamily, fontSize, lineHeight }),
    textIndent,
  );
  zip.file("Contents/header.xml", header, { compression: "DEFLATE" });
  zip.file("Contents/section0.xml", sectionXml(project, paper, templateSection), { compression: "DEFLATE" });
  zip.file("Preview/PrvText.txt", previewText(project), { compression: "DEFLATE" });

  return zip.generateAsync({
    type: "blob",
    mimeType: MIMETYPE,
    compression: "DEFLATE",
  });
}
