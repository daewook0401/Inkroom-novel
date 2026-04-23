const STORAGE_KEY = "inkroom:react:v3";
const PREVIOUS_KEYS = ["inkroom:react:v2", "inkroom:react:v1", "inkroom:v1"];
const SETTINGS_SECTIONS = [
  { id: "characters", title: "캐릭터", type: "cards" },
  { id: "world", title: "설정 노트", type: "cards" },
  { id: "beats", title: "플롯 보드", type: "cards" },
  { id: "relationships", title: "관계도", type: "relationships" },
];
const MM_TO_PX = 96 / 25.4;
const PT_TO_PX = 96 / 72;
const DEFAULT_PRINT_MARGINS = {
  top: 14.3 * MM_TO_PX,
  right: 15.3 * MM_TO_PX,
  bottom: 14.3 * MM_TO_PX,
  left: 15.3 * MM_TO_PX,
};
const PAPER_PRESETS = {
  a4: {
    label: "A4",
    width: 210 * MM_TO_PX,
    height: 297 * MM_TO_PX,
    margins: DEFAULT_PRINT_MARGINS,
  },
  b4: {
    label: "B4",
    width: 257 * MM_TO_PX,
    height: 364 * MM_TO_PX,
    margins: DEFAULT_PRINT_MARGINS,
  },
  b5: {
    label: "B5",
    width: 182 * MM_TO_PX,
    height: 257 * MM_TO_PX,
    margins: DEFAULT_PRINT_MARGINS,
  },
  kakao: {
    label: "카카오페이지",
    width: 72 * MM_TO_PX,
    height: 109.8 * MM_TO_PX,
    margins: {
      top: 10 * MM_TO_PX,
      right: 8 * MM_TO_PX,
      bottom: 10 * MM_TO_PX,
      left: 8 * MM_TO_PX,
    },
    textIndent: 10 * PT_TO_PX,
    previewFontSize: 10,
    lineHeightCorrection: 0.95,
  },
};
const DEFAULT_PAPER = {
  enabled: false,
  size: "a4",
  dimensions: { width: PAPER_PRESETS.a4.width, height: PAPER_PRESETS.a4.height },
  margins: DEFAULT_PRINT_MARGINS,
  marginUnit: "mm",
  dimensionUnit: "mm",
  textIndent: 0,
  fontFamily: "Iowan Old Style",
  previewFontSize: 19,
  lineHeight: 1.8,
  zoom: 0.85,
};
const MIN_EDITOR_FONT_SIZE = 5;
const MAX_EDITOR_FONT_SIZE = 30;
const MIN_PAPER_ZOOM = 0.35;
const MAX_PAPER_ZOOM = 2.5;
const FALLBACK_FONTS = [
  "Iowan Old Style",
  "Georgia",
  "Nanum Myeongjo",
  "Malgun Gothic",
  "Arial",
  "serif",
];
const DEFAULT_SYSTEM_PREFERENCES = {
  downloadDirectory: "",
  backupDirectory: "",
  availableFonts: FALLBACK_FONTS,
};
const MARGIN_UNITS = {
  px: { label: "px", factor: 1 },
  mm: { label: "mm", factor: 96 / 25.4 },
  pt: { label: "pt", factor: PT_TO_PX },
};
const ptToPx = (pt) => pt * PT_TO_PX;

const now = () => new Date().toISOString();
const todayKey = () => new Date().toISOString().slice(0, 10);
const countText = (text) => [...(text || "").replace(/\s/g, "")].length;
const uid = (prefix) => {
  const value =
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${value}`;
};

function sampleProject() {
  const chapterId = uid("chapter");
  return {
    id: uid("project"),
    title: "환영합니다",
    logline: "Inkroom에서 첫 작품을 시작해보세요.",
    createdAt: now(),
    updatedAt: now(),
    activeChapterId: chapterId,
    stats: { [todayKey()]: 0 },
    chapters: [
      {
        id: chapterId,
        title: "시작하기",
        goal: 0,
        body:
          "이곳은 원고를 쓰는 공간입니다.\n\n" +
          "왼쪽에서 작품과 챕터를 만들고, 위쪽의 설정 화면에서 캐릭터와 세계관을 정리할 수 있습니다.\n\n" +
          "새 작품을 만들면 이 안내 문구 없이 빈 원고로 시작합니다.",
        createdAt: now(),
        updatedAt: now(),
      },
    ],
    characters: [],
    world: [],
    beats: [],
    relationships: [],
  };
}

function normalizeProject(project) {
  const fallback = sampleProject();
  const chapters = project.chapters?.length ? project.chapters : fallback.chapters;
  return {
    ...project,
    id: project.id || uid("project"),
    title: project.title || "제목 없음",
    logline: project.logline || "",
    activeChapterId: project.activeChapterId || chapters[0]?.id,
    stats: project.stats || {},
    chapters: chapters.map((chapter) => ({
      id: chapter.id || uid("chapter"),
      title: chapter.title || "소제목",
      body: chapter.body || "",
      goal: Number(chapter.goal || 0),
      createdAt: chapter.createdAt || now(),
      updatedAt: chapter.updatedAt || now(),
    })),
    characters: project.characters || [],
    world: project.world || [],
    beats: project.beats || [],
    relationships: project.relationships || [],
    createdAt: project.createdAt || now(),
    updatedAt: project.updatedAt || now(),
  };
}

function normalizeState(raw) {
  const fallback = sampleProject();
  const base = raw && Array.isArray(raw.projects) ? raw : { activeProjectId: fallback.id, projects: [fallback] };
  const projects = (base.projects.length ? base.projects : [fallback]).map(normalizeProject);
  const paper = {
    ...DEFAULT_PAPER,
    ...(base.preferences?.paper || {}),
    dimensions: {
      ...DEFAULT_PAPER.dimensions,
      ...(base.preferences?.paper?.dimensions || {}),
    },
    margins: {
      ...DEFAULT_PAPER.margins,
      ...(base.preferences?.paper?.margins || {}),
    },
  };
  return {
    activeProjectId: projects.some((project) => project.id === base.activeProjectId)
      ? base.activeProjectId
      : projects[0].id,
    projects,
    preferences: {
      editorFontSize: Number(base.preferences?.editorFontSize || 19),
      system: {
        ...DEFAULT_SYSTEM_PREFERENCES,
        ...(base.preferences?.system || {}),
        downloadDirectory:
          typeof base.preferences?.system?.downloadDirectory === "string"
            ? base.preferences.system.downloadDirectory
            : DEFAULT_SYSTEM_PREFERENCES.downloadDirectory,
        backupDirectory:
          typeof base.preferences?.system?.backupDirectory === "string"
            ? base.preferences.system.backupDirectory
            : DEFAULT_SYSTEM_PREFERENCES.backupDirectory,
        availableFonts:
          Array.isArray(base.preferences?.system?.availableFonts) && base.preferences.system.availableFonts.length
            ? [...new Set(base.preferences.system.availableFonts.filter(Boolean))]
            : DEFAULT_SYSTEM_PREFERENCES.availableFonts,
      },
      paper: {
        ...paper,
        size: PAPER_PRESETS[paper.size] || paper.size === "custom" ? paper.size : DEFAULT_PAPER.size,
        marginUnit: MARGIN_UNITS[paper.marginUnit] ? paper.marginUnit : DEFAULT_PAPER.marginUnit,
        dimensionUnit: MARGIN_UNITS[paper.dimensionUnit]
          ? paper.dimensionUnit
          : MARGIN_UNITS[paper.marginUnit]
            ? paper.marginUnit
            : DEFAULT_PAPER.dimensionUnit,
        fontFamily:
          typeof paper.fontFamily === "string" && paper.fontFamily.trim()
            ? paper.fontFamily
            : DEFAULT_PAPER.fontFamily,
        previewFontSize: clampNumber(
          paper.previewFontSize ?? base.preferences?.editorFontSize,
          MIN_EDITOR_FONT_SIZE,
          MAX_EDITOR_FONT_SIZE,
          DEFAULT_PAPER.previewFontSize,
        ),
        lineHeight: clampNumber(paper.lineHeight, 1.2, 2.4, DEFAULT_PAPER.lineHeight),
        zoom: clampNumber(paper.zoom, MIN_PAPER_ZOOM, MAX_PAPER_ZOOM, DEFAULT_PAPER.zoom),
        textIndent: clampNumber(paper.textIndent, 0, 240, DEFAULT_PAPER.textIndent),
        dimensions: {
          width: clampNumber(paper.dimensions.width, 160, 2400, DEFAULT_PAPER.dimensions.width),
          height: clampNumber(paper.dimensions.height, 160, 3200, DEFAULT_PAPER.dimensions.height),
        },
        margins: {
          top: clampNumber(paper.margins.top, 20, 140, DEFAULT_PAPER.margins.top),
          right: clampNumber(paper.margins.right, 20, 140, DEFAULT_PAPER.margins.right),
          bottom: clampNumber(paper.margins.bottom, 20, 140, DEFAULT_PAPER.margins.bottom),
          left: clampNumber(paper.margins.left, 20, 140, DEFAULT_PAPER.margins.left),
        },
      },
    },
    trash: {
      projects: base.trash?.projects || [],
      chapters: base.trash?.chapters || [],
    },
  };
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function marginToUnit(px, unit) {
  return Math.round((px / (MARGIN_UNITS[unit]?.factor || 1)) * 10) / 10;
}

function marginFromUnit(value, unit, fallbackPx) {
  const factor = MARGIN_UNITS[unit]?.factor || 1;
  return clampNumber(Number(value) * factor, 20, 140, fallbackPx);
}

function dimensionFromUnit(value, unit, fallbackPx) {
  const factor = MARGIN_UNITS[unit]?.factor || 1;
  return clampNumber(Number(value) * factor, 160, 3200, fallbackPx);
}

function lengthFromUnit(value, unit, minPx, maxPx, fallbackPx) {
  const factor = MARGIN_UNITS[unit]?.factor || 1;
  return clampNumber(Number(value) * factor, minPx, maxPx, fallbackPx);
}

function getPaperDimensions(paper) {
  if (paper.size === "custom") return paper.dimensions || DEFAULT_PAPER.dimensions;
  return PAPER_PRESETS[paper.size] || PAPER_PRESETS.a4;
}

function getPaperPreset(paper) {
  return PAPER_PRESETS[paper.size] || null;
}

function fontStack(fontFamily) {
  const safeFont = (fontFamily || DEFAULT_PAPER.fontFamily).replace(/"/g, '\\"');
  return `"${safeFont}", "Nanum Myeongjo", serif`;
}

async function loadLocalFontFamilies() {
  if (typeof globalThis.queryLocalFonts !== "function") return FALLBACK_FONTS;
  const fonts = await globalThis.queryLocalFonts();
  const families = fonts.map((font) => font.family).filter(Boolean);
  return [...new Set([...families, ...FALLBACK_FONTS])].sort((a, b) => a.localeCompare(b));
}

function loadInitialState() {
  for (const key of [STORAGE_KEY, ...PREVIOUS_KEYS]) {
    const saved = localStorage.getItem(key);
    if (!saved) continue;
    try {
      return normalizeState(JSON.parse(saved));
    } catch {
      localStorage.removeItem(key);
    }
  }
  return normalizeState(null);
}

function downloadText(filename, content, type) {
  const blob = new Blob([content], { type });
  downloadBlob(filename, blob);
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function slug(text) {
  return (text || "inkroom")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 64);
}

function projectToMarkdown(project) {
  const chapters = project.chapters
    .map((chapter, index) => `## ${chapter.title || `소제목 ${index + 1}`}\n\n${chapter.body || ""}`)
    .join("\n\n");
  const characters = project.characters.map((item) => `- **${item.name}**: ${item.note || ""}`).join("\n");
  const world = project.world.map((item) => `- **${item.name}**: ${item.note || ""}`).join("\n");
  const beats = project.beats.map((item) => `- **${item.name}**: ${item.note || ""}`).join("\n");
  const relationships = project.relationships
    .map((item) => {
      const from = project.characters.find((character) => character.id === item.from)?.name || "알 수 없음";
      const to = project.characters.find((character) => character.id === item.to)?.name || "알 수 없음";
      return `- ${from} -> ${to}: ${item.label || "관계"}`;
    })
    .join("\n");

  return `# ${project.title || "제목 없음"}\n\n${project.logline || ""}\n\n${chapters}\n\n---\n\n## 캐릭터\n\n${characters || "- 없음"}\n\n## 설정\n\n${world || "- 없음"}\n\n## 플롯\n\n${beats || "- 없음"}\n\n## 관계\n\n${relationships || "- 없음"}\n`;
}

function projectToTxt(project, chapters = project.chapters) {
  return chapters
    .map((chapter, index) => `${chapter.title || `소제목 ${index + 1}`}\n\n${chapter.body || ""}`)
    .join("\n\n\n");
}

function parseChapterSelection(input, chapters) {
  const text = input.trim();
  if (!text) return chapters;

  const indexes = new Set();
  for (const part of text.split(",")) {
    const token = part.trim();
    if (!token) continue;

    const range = token.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      const min = Math.min(start, end);
      const max = Math.max(start, end);
      for (let value = min; value <= max; value += 1) indexes.add(value - 1);
      continue;
    }

    const number = Number(token);
    if (Number.isInteger(number)) indexes.add(number - 1);
  }

  return [...indexes]
    .sort((a, b) => a - b)
    .filter((index) => index >= 0 && index < chapters.length)
    .map((index) => chapters[index]);
}
export {
  STORAGE_KEY,
  PREVIOUS_KEYS,
  SETTINGS_SECTIONS,
  MM_TO_PX,
  PT_TO_PX,
  DEFAULT_PRINT_MARGINS,
  PAPER_PRESETS,
  DEFAULT_PAPER,
  MIN_EDITOR_FONT_SIZE,
  MAX_EDITOR_FONT_SIZE,
  MIN_PAPER_ZOOM,
  MAX_PAPER_ZOOM,
  FALLBACK_FONTS,
  DEFAULT_SYSTEM_PREFERENCES,
  MARGIN_UNITS,
  ptToPx,
  now,
  todayKey,
  countText,
  uid,
  sampleProject,
  normalizeProject,
  normalizeState,
  clampNumber,
  marginToUnit,
  marginFromUnit,
  dimensionFromUnit,
  lengthFromUnit,
  getPaperDimensions,
  getPaperPreset,
  fontStack,
  loadLocalFontFamilies,
  loadInitialState,
  downloadText,
  downloadBlob,
  slug,
  projectToMarkdown,
  projectToTxt,
  parseChapterSelection,
};
