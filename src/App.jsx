import { NavLink, Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { loadDesktopState, saveDesktopState } from "./desktopDb.js";

const STORAGE_KEY = "inkroom:react:v3";
const PREVIOUS_KEYS = ["inkroom:react:v2", "inkroom:react:v1", "inkroom:v1"];
const SETTINGS_SECTIONS = [
  { id: "characters", title: "캐릭터", type: "cards" },
  { id: "world", title: "설정 노트", type: "cards" },
  { id: "beats", title: "플롯 보드", type: "cards" },
  { id: "relationships", title: "관계도", type: "relationships" },
];
const PAPER_PRESETS = {
  a4: { label: "A4", width: 794, height: 1123 },
  b5: { label: "B5", width: 665, height: 940 },
};
const DEFAULT_PAPER = {
  enabled: false,
  size: "a4",
  margins: { top: 54, right: 58, bottom: 54, left: 58 },
  marginUnit: "px",
  fontFamily: "Iowan Old Style",
  lineHeight: 1.8,
  zoom: 0.85,
};
const FALLBACK_FONTS = [
  "Iowan Old Style",
  "Georgia",
  "Nanum Myeongjo",
  "Malgun Gothic",
  "Arial",
  "serif",
];
const MARGIN_UNITS = {
  px: { label: "px", factor: 1 },
  mm: { label: "mm", factor: 96 / 25.4 },
  pt: { label: "pt", factor: 96 / 72 },
};
const ptToPx = (pt) => pt * (96 / 72);

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
      paper: {
        ...paper,
        size: PAPER_PRESETS[paper.size] ? paper.size : DEFAULT_PAPER.size,
        marginUnit: MARGIN_UNITS[paper.marginUnit] ? paper.marginUnit : DEFAULT_PAPER.marginUnit,
        fontFamily:
          typeof paper.fontFamily === "string" && paper.fontFamily.trim()
            ? paper.fontFamily
            : DEFAULT_PAPER.fontFamily,
        lineHeight: clampNumber(paper.lineHeight, 1.2, 2.4, DEFAULT_PAPER.lineHeight),
        zoom: clampNumber(paper.zoom, 0.35, 1.25, DEFAULT_PAPER.zoom),
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

export default function App() {
  const [state, setState] = useState(loadInitialState);
  const [saveStatus, setSaveStatus] = useState("저장됨");
  const [dialog, setDialog] = useState(null);
  const [notice, setNotice] = useState(null);
  const [draggedChapterId, setDraggedChapterId] = useState(null);
  const [focusMode, setFocusMode] = useState(false);
  const [query, setQuery] = useState("");
  const fileInputRef = useRef(null);

  const activeProject =
    state.projects.find((project) => project.id === state.activeProjectId) || state.projects[0];
  const activeChapter =
    activeProject?.chapters.find((chapter) => chapter.id === activeProject.activeChapterId) ||
    activeProject?.chapters[0];

  const stats = useMemo(() => {
    if (!activeProject || !activeChapter) return { today: 0, total: 0, chapter: 0, chapters: 0, cards: 0 };
    const total = activeProject.chapters.reduce((sum, chapter) => sum + countText(chapter.body), 0);
    return {
      today: activeProject.stats?.[todayKey()] || 0,
      total,
      chapter: countText(activeChapter.body),
      chapters: activeProject.chapters.length,
      cards: activeProject.characters.length + activeProject.world.length + activeProject.beats.length,
    };
  }, [activeProject, activeChapter]);

  const searchResults = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text || !activeProject) return [];
    return activeProject.chapters
      .map((chapter) => {
        const haystack = `${chapter.title}\n${chapter.body}`.toLowerCase();
        const index = haystack.indexOf(text);
        if (index < 0) return null;
        const plain = `${chapter.title}\n${chapter.body}`;
        const start = Math.max(0, index - 42);
        const end = Math.min(plain.length, index + text.length + 72);
        return { chapter, preview: plain.slice(start, end).replace(/\s+/g, " ") };
      })
      .filter(Boolean);
  }, [activeProject, query]);

  useEffect(() => {
    let cancelled = false;
    loadDesktopState()
      .then((desktopState) => {
        if (!cancelled && desktopState) setState(normalizeState(desktopState));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSaveStatus("저장 중");
    const timer = window.setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      saveDesktopState(state).catch(() => {});
      setSaveStatus("저장됨");
    }, 220);
    return () => window.clearTimeout(timer);
  }, [state]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const setProjects = (updater) => {
    setState((current) => {
      const projects = updater(current.projects, current);
      const activeProjectId = projects.some((project) => project.id === current.activeProjectId)
        ? current.activeProjectId
        : projects[0]?.id;
      return { ...current, projects, activeProjectId };
    });
  };

  const updateProject = (patch) => {
    setProjects((projects, current) =>
      projects.map((project) =>
        project.id === current.activeProjectId ? { ...project, ...patch, updatedAt: now() } : project,
      ),
    );
  };

  const updateChapter = (patch) => {
    setProjects((projects, current) =>
      projects.map((project) => {
        if (project.id !== current.activeProjectId) return project;
        return {
          ...project,
          updatedAt: now(),
          chapters: project.chapters.map((chapter) =>
            chapter.id === project.activeChapterId ? { ...chapter, ...patch, updatedAt: now() } : chapter,
          ),
        };
      }),
    );
  };

  const updateBody = (body) => {
    setProjects((projects, current) =>
      projects.map((project) => {
        if (project.id !== current.activeProjectId) return project;
        const chapter = project.chapters.find((item) => item.id === project.activeChapterId);
        const delta = Math.max(0, countText(body) - countText(chapter?.body || ""));
        return {
          ...project,
          updatedAt: now(),
          stats: { ...(project.stats || {}), [todayKey()]: (project.stats?.[todayKey()] || 0) + delta },
          chapters: project.chapters.map((item) =>
            item.id === project.activeChapterId ? { ...item, body, updatedAt: now() } : item,
          ),
        };
      }),
    );
  };

  const updatePreferences = (patch) => {
    setState((current) => ({
      ...current,
      preferences: {
        ...(current.preferences || {}),
        ...patch,
      },
    }));
  };

  const createProject = () => {
    const project = sampleProject();
    project.title = "새 작품";
    project.logline = "한 줄 로그라인을 적어보세요.";
    project.chapters[0].title = "소제목";
    project.chapters[0].body = "";
    project.characters = [];
    project.world = [];
    project.beats = [];
    project.relationships = [];
    setState((current) => ({ ...current, activeProjectId: project.id, projects: [project, ...current.projects] }));
  };

  const createChapter = () => {
    const chapter = {
      id: uid("chapter"),
      title: "소제목",
      goal: 0,
      body: "",
      createdAt: now(),
      updatedAt: now(),
    };
    updateProject({ activeChapterId: chapter.id, chapters: [...activeProject.chapters, chapter] });
  };

  const selectProject = (projectId) => setState((current) => ({ ...current, activeProjectId: projectId }));
  const selectChapter = (chapterId) => updateProject({ activeChapterId: chapterId });

  const deleteProject = () => {
    if (!activeProject || state.projects.length < 2) return;
    setState((current) => {
      const removed = current.projects.find((project) => project.id === current.activeProjectId);
      const projects = current.projects.filter((project) => project.id !== current.activeProjectId);
      return {
        ...current,
        activeProjectId: projects[0]?.id,
        projects,
        trash: { ...current.trash, projects: [{ ...removed, deletedAt: now() }, ...current.trash.projects] },
      };
    });
  };

  const deleteChapter = () => {
    if (!activeProject || !activeChapter || activeProject.chapters.length < 2) return;
    setState((current) => ({
      ...current,
      projects: current.projects.map((project) => {
        if (project.id !== current.activeProjectId) return project;
        const chapters = project.chapters.filter((chapter) => chapter.id !== project.activeChapterId);
        return { ...project, activeChapterId: chapters[0]?.id, chapters, updatedAt: now() };
      }),
      trash: {
        ...current.trash,
        chapters: [
          { ...activeChapter, projectId: activeProject.id, projectTitle: activeProject.title, deletedAt: now() },
          ...current.trash.chapters,
        ],
      },
    }));
  };

  const restoreProject = (projectId) => {
    setState((current) => {
      const item = current.trash.projects.find((project) => project.id === projectId);
      if (!item) return current;
      const { deletedAt, ...project } = item;
      return {
        ...current,
        activeProjectId: project.id,
        projects: [normalizeProject(project), ...current.projects],
        trash: { ...current.trash, projects: current.trash.projects.filter((project) => project.id !== projectId) },
      };
    });
  };

  const restoreChapter = (chapterId) => {
    setState((current) => {
      const item = current.trash.chapters.find((chapter) => chapter.id === chapterId);
      if (!item) return current;
      const projectExists = current.projects.some((project) => project.id === item.projectId);
      if (!projectExists) return current;
      const { deletedAt, projectId, projectTitle, ...chapter } = item;
      return {
        ...current,
        activeProjectId: projectId,
        projects: current.projects.map((project) =>
          project.id === projectId
            ? { ...project, activeChapterId: chapter.id, chapters: [...project.chapters, chapter], updatedAt: now() }
            : project,
        ),
        trash: { ...current.trash, chapters: current.trash.chapters.filter((chapter) => chapter.id !== chapterId) },
      };
    });
  };

  const reorderChapter = (targetChapterId) => {
    if (!draggedChapterId || draggedChapterId === targetChapterId) return;
    setProjects((projects, current) =>
      projects.map((project) => {
        if (project.id !== current.activeProjectId) return project;
        const chapters = [...project.chapters];
        const from = chapters.findIndex((chapter) => chapter.id === draggedChapterId);
        const to = chapters.findIndex((chapter) => chapter.id === targetChapterId);
        if (from < 0 || to < 0) return project;
        const [moved] = chapters.splice(from, 1);
        chapters.splice(to, 0, moved);
        return { ...project, chapters, updatedAt: now() };
      }),
    );
    setDraggedChapterId(null);
  };

  const saveCard = () => {
    if (!dialog) return;
    const payload = {
      id: dialog.id || uid(dialog.type),
      name: dialog.name.trim() || "이름 없음",
      note: dialog.note.trim(),
    };
    setProjects((projects, current) =>
      projects.map((project) => {
        if (project.id !== current.activeProjectId) return project;
        const exists = project[dialog.type].some((item) => item.id === dialog.id);
        return {
          ...project,
          updatedAt: now(),
          [dialog.type]: exists
            ? project[dialog.type].map((item) => (item.id === dialog.id ? payload : item))
            : [payload, ...project[dialog.type]],
        };
      }),
    );
    setDialog(null);
  };

  const deleteCard = () => {
    if (!dialog?.id) return;
    setProjects((projects, current) =>
      projects.map((project) =>
        project.id === current.activeProjectId
          ? {
              ...project,
              updatedAt: now(),
              [dialog.type]: project[dialog.type].filter((item) => item.id !== dialog.id),
              relationships:
                dialog.type === "characters"
                  ? project.relationships.filter((item) => item.from !== dialog.id && item.to !== dialog.id)
                  : project.relationships,
            }
          : project,
      ),
    );
    setDialog(null);
  };

  const saveRelationship = (relationship) => {
    setProjects((projects, current) =>
      projects.map((project) => {
        if (project.id !== current.activeProjectId) return project;
        const exists = project.relationships.some((item) => item.id === relationship.id);
        return {
          ...project,
          updatedAt: now(),
          relationships: exists
            ? project.relationships.map((item) => (item.id === relationship.id ? relationship : item))
            : [relationship, ...project.relationships],
        };
      }),
    );
  };

  const deleteRelationship = (relationshipId) => {
    updateProject({ relationships: activeProject.relationships.filter((item) => item.id !== relationshipId) });
  };

  const notifyDownload = (filename) => {
    setNotice({ id: uid("notice"), message: `${filename} 다운로드를 준비했습니다.` });
  };

  const exportProject = (format) => {
    if (!activeProject) return;
    if (format === "json") {
      const filename = `${slug(activeProject.title)}.inkroom.json`;
      downloadText(filename, JSON.stringify(state, null, 2), "application/json");
      notifyDownload(filename);
      return;
    }

    if (format === "txt") {
      const selection = window.prompt(
        "다운로드할 화수를 입력하세요.\n예: 1 / 1,3,5 / 2-4\n비워두면 전체 챕터를 다운로드합니다.",
        "",
      );
      if (selection === null) return;

      const chapters = parseChapterSelection(selection, activeProject.chapters);
      if (!chapters.length) {
        window.alert("선택된 챕터가 없습니다. 화수를 다시 확인해주세요.");
        return;
      }

      const suffix = selection.trim() ? `-${selection.trim().replace(/\s+/g, "").replace(/,/g, "_")}` : "";
      const filename = `${slug(activeProject.title)}${suffix}.txt`;
      downloadText(
        filename,
        projectToTxt(activeProject, chapters),
        "text/plain;charset=utf-8",
      );
      notifyDownload(filename);
      return;
    }

    const filename = `${slug(activeProject.title)}.md`;
    downloadText(filename, projectToMarkdown(activeProject), "text/markdown;charset=utf-8");
    notifyDownload(filename);
  };

  const importBackup = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setState(normalizeState(JSON.parse(text)));
    } catch {
      window.alert("백업 파일을 불러오지 못했습니다.");
    } finally {
      event.target.value = "";
    }
  };

  if (!activeProject || !activeChapter) return null;

  return (
    <div className={`app-shell ${focusMode ? "focus-mode" : ""}`}>
      <LibraryPanel
        activeProject={activeProject}
        projects={state.projects}
        draggedChapterId={draggedChapterId}
        onCreateProject={createProject}
        onSelectProject={selectProject}
        onDeleteProject={deleteProject}
        onCreateChapter={createChapter}
        onSelectChapter={selectChapter}
        onDeleteChapter={deleteChapter}
        onDragChapter={setDraggedChapterId}
        onDropChapter={reorderChapter}
      />

      <main className="workspace-panel">
        {focusMode && (
          <button className="focus-exit-button" onClick={() => setFocusMode(false)}>
            집중 해제
          </button>
        )}
        <TopNav
          saveStatus={saveStatus}
          focusMode={focusMode}
          onToggleFocus={() => setFocusMode((value) => !value)}
          onExport={exportProject}
          onImport={() => fileInputRef.current?.click()}
        />
        <input className="hidden-input" ref={fileInputRef} type="file" accept=".json" onChange={importBackup} />
        <Routes>
          <Route
            path="/write"
            element={
              <WritingView
                project={activeProject}
                chapter={activeChapter}
                stats={stats}
                saveStatus={saveStatus}
                query={query}
                searchResults={searchResults}
                editorFontSize={state.preferences?.editorFontSize || 19}
                paper={state.preferences?.paper || DEFAULT_PAPER}
                onQuery={setQuery}
                onSelectChapter={selectChapter}
                onUpdateProject={updateProject}
                onUpdateChapter={updateChapter}
                onUpdateBody={updateBody}
                onUpdatePreferences={updatePreferences}
              />
            }
          />
          <Route path="/settings" element={<Navigate to="/settings/characters" replace />} />
          <Route
            path="/settings/:sectionId"
            element={
              <SettingsView
                project={activeProject}
                onNewCard={(type) => setDialog({ type, id: null, name: "", note: "" })}
                onOpenCard={(type, item) => setDialog({ type, id: item.id, name: item.name, note: item.note })}
                onSaveRelationship={saveRelationship}
                onDeleteRelationship={deleteRelationship}
              />
            }
          />
          <Route
            path="/stats"
            element={
              <StatsView
                project={activeProject}
                stats={stats}
                trash={state.trash}
                onRestoreProject={restoreProject}
                onRestoreChapter={restoreChapter}
              />
            }
          />
          <Route path="*" element={<Navigate to="/write" replace />} />
        </Routes>
      </main>

      {dialog && (
        <CardDialog
          dialog={dialog}
          onChange={setDialog}
          onClose={() => setDialog(null)}
          onSave={saveCard}
          onDelete={deleteCard}
        />
      )}

      {notice && <DownloadNotice message={notice.message} onClose={() => setNotice(null)} />}
    </div>
  );
}

function DownloadNotice({ message, onClose }) {
  return (
    <div className="download-notice" role="status" aria-live="polite">
      <span>{message}</span>
      <button type="button" onClick={onClose} aria-label="알림 닫기">×</button>
    </div>
  );
}

function TopNav({ saveStatus, focusMode, onToggleFocus, onExport, onImport }) {
  const location = useLocation();
  const settingsActive = location.pathname.startsWith("/settings");

  return (
    <nav className="top-nav">
      <div className="route-tabs">
        <NavLink to="/write">집필</NavLink>
        <NavLink to="/settings/characters" className={settingsActive ? "active" : undefined}>설정</NavLink>
        <NavLink to="/stats">통계</NavLink>
      </div>
      <div className="toolbar-actions">
        <span className={`save-state ${saveStatus === "저장 중" ? "dirty" : ""}`}>{saveStatus}</span>
        <button className="text-button" onClick={() => onExport("md")}>Markdown</button>
        <button className="text-button" onClick={() => onExport("txt")}>TXT</button>
        <button className="text-button" onClick={() => onExport("json")}>백업</button>
        <button className="text-button" onClick={onImport}>불러오기</button>
        <button className="primary-button" onClick={onToggleFocus}>
          {focusMode ? "집중 해제" : "집중 모드"}
        </button>
      </div>
    </nav>
  );
}

function LibraryPanel({
  activeProject,
  projects,
  draggedChapterId,
  onCreateProject,
  onSelectProject,
  onDeleteProject,
  onCreateChapter,
  onSelectChapter,
  onDeleteChapter,
  onDragChapter,
  onDropChapter,
}) {
  return (
    <aside className="library-panel" aria-label="작품과 챕터">
      <div className="brand-row">
        <div>
          <h1>Inkroom</h1>
          <p>소설 집필 워크벤치</p>
        </div>
        <button className="icon-button" onClick={onCreateProject} title="새 작품">+</button>
      </div>

      <section className="panel-section">
        <div className="section-header">
          <span>작품</span>
          <span className="count-pill">{projects.length}</span>
        </div>
        <div className="project-list">
          {projects.map((project) => (
            <button
              className={`project-item ${project.id === activeProject.id ? "active" : ""}`}
              key={project.id}
              onClick={() => onSelectProject(project.id)}
            >
              <strong>{project.title || "제목 없음"}</strong>
              <span>{project.chapters.length}개 챕터</span>
            </button>
          ))}
        </div>
        <button className="danger-outline-button wide-button" onClick={onDeleteProject} disabled={projects.length < 2}>
          작품 삭제
        </button>
      </section>

      <section className="panel-section chapters-section">
        <div className="section-header">
          <span>챕터</span>
          <button className="text-button" onClick={onCreateChapter}>추가</button>
        </div>
        <div className="chapter-list">
          {activeProject.chapters.map((chapter, index) => (
            <button
              className={`chapter-item ${chapter.id === activeProject.activeChapterId ? "active" : ""} ${
                draggedChapterId === chapter.id ? "dragging" : ""
              }`}
              draggable
              key={chapter.id}
              onClick={() => onSelectChapter(chapter.id)}
              onDragStart={() => onDragChapter(chapter.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => onDropChapter(chapter.id)}
            >
              <strong>{chapter.title || `소제목 ${index + 1}`}</strong>
              <span>{countText(chapter.body).toLocaleString()}자 · 드래그로 정렬</span>
            </button>
          ))}
        </div>
        <button
          className="danger-outline-button wide-button"
          onClick={onDeleteChapter}
          disabled={activeProject.chapters.length < 2}
        >
          챕터 삭제
        </button>
      </section>
    </aside>
  );
}

function WritingView({
  project,
  chapter,
  stats,
  saveStatus,
  query,
  searchResults,
  editorFontSize,
  paper,
  onQuery,
  onSelectChapter,
  onUpdateProject,
  onUpdateChapter,
  onUpdateBody,
  onUpdatePreferences,
}) {
  const progress = chapter.goal > 0 ? Math.min(100, Math.round((countText(chapter.body) / chapter.goal) * 100)) : 0;
  const [fontFamilies, setFontFamilies] = useState(() =>
    [...new Set([paper.fontFamily, ...FALLBACK_FONTS])].filter(Boolean),
  );
  const changeFontSize = (delta) => {
    const nextSize = Math.max(14, Math.min(30, editorFontSize + delta));
    onUpdatePreferences({ editorFontSize: nextSize });
  };
  const editorFontPx = ptToPx(editorFontSize);
  const paperPreset = PAPER_PRESETS[paper.size] || PAPER_PRESETS.a4;
  const changePaper = (patch) => {
    onUpdatePreferences({
      paper: {
        ...paper,
        ...patch,
        margins: {
          ...(paper.margins || DEFAULT_PAPER.margins),
          ...(patch.margins || {}),
        },
      },
    });
  };
  const changeMargin = (side, value) => {
    changePaper({
      margins: {
        [side]: marginFromUnit(value, paper.marginUnit || DEFAULT_PAPER.marginUnit, DEFAULT_PAPER.margins[side]),
      },
    });
  };
  const paperStyle = {
    "--paper-width": `${paperPreset.width}px`,
    "--paper-height": `${paperPreset.height}px`,
    "--paper-margin-top": `${paper.margins.top}px`,
    "--paper-margin-right": `${paper.margins.right}px`,
    "--paper-margin-bottom": `${paper.margins.bottom}px`,
    "--paper-margin-left": `${paper.margins.left}px`,
    "--paper-line-height": paper.lineHeight,
    "--editor-font-family": fontStack(paper.fontFamily),
    "--paper-zoom": paper.zoom,
    "--paper-scaled-width": `${paperPreset.width * paper.zoom}px`,
    "--paper-scaled-height": `${paperPreset.height * paper.zoom}px`,
  };
  const refreshFonts = async () => {
    try {
      const families = await loadLocalFontFamilies();
      setFontFamilies(families);
    } catch {
      setFontFamilies([...new Set([paper.fontFamily, ...FALLBACK_FONTS])].filter(Boolean));
    }
  };

  return (
    <section className={`editor-panel ${paper.enabled ? "paper-enabled" : ""}`}>
      <header className="editor-header">
        <div className="project-meta">
          <input
            className="title-input"
            aria-label="작품 제목"
            value={project.title}
            onChange={(event) => onUpdateProject({ title: event.target.value })}
          />
          <input
            className="logline-input"
            aria-label="로그라인"
            value={project.logline}
            onChange={(event) => onUpdateProject({ logline: event.target.value })}
          />
        </div>
        <StatsGrid stats={stats} />
      </header>

      <div className="chapter-toolbar">
        <input
          className="chapter-title-input"
          aria-label="챕터 제목"
          value={chapter.title}
          onChange={(event) => onUpdateChapter({ title: event.target.value })}
        />
        <label className="goal-control">
          목표
          <input
            type="number"
            min="0"
            step="100"
            value={chapter.goal || 0}
            onChange={(event) => onUpdateChapter({ goal: Number(event.target.value || 0) })}
          />
        </label>
        <div className="font-size-control" aria-label="글자 크기">
          <span>글자</span>
          <button type="button" onClick={() => changeFontSize(-1)} disabled={editorFontSize <= 14}>-</button>
          <strong>{editorFontSize}pt</strong>
          <button type="button" onClick={() => changeFontSize(1)} disabled={editorFontSize >= 30}>+</button>
        </div>
        <button
          type="button"
          className={`text-button paper-toggle ${paper.enabled ? "active" : ""}`}
          onClick={() => changePaper({ enabled: !paper.enabled })}
        >
          용지
        </button>
        <div className="goal-meter" aria-label="챕터 목표 진행률">
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className={`save-state ${saveStatus === "저장 중" ? "dirty" : ""}`}>{saveStatus}</div>
      </div>

      {paper.enabled && (
        <div className="paper-toolbar" aria-label="편집 용지 설정">
          <label>
            용지
            <select value={paper.size} onChange={(event) => changePaper({ size: event.target.value })}>
              {Object.entries(PAPER_PRESETS).map(([value, preset]) => (
                <option key={value} value={value}>{preset.label}</option>
              ))}
            </select>
          </label>
          <label className="font-family-control">
            폰트
            <select
              value={paper.fontFamily || DEFAULT_PAPER.fontFamily}
              onChange={(event) => changePaper({ fontFamily: event.target.value })}
            >
              {fontFamilies.map((font) => (
                <option key={font} value={font}>{font}</option>
              ))}
            </select>
          </label>
          <button type="button" className="text-button" onClick={refreshFonts}>읽기</button>
          <label>
            단위
            <select value={paper.marginUnit || DEFAULT_PAPER.marginUnit} onChange={(event) => changePaper({ marginUnit: event.target.value })}>
              {Object.entries(MARGIN_UNITS).map(([value, unit]) => (
                <option key={value} value={value}>{unit.label}</option>
              ))}
            </select>
          </label>
          <label>
            위
            <input type="number" min="0" step="0.5" value={marginToUnit(paper.margins.top, paper.marginUnit)} onChange={(event) => changeMargin("top", event.target.value)} />
          </label>
          <label>
            아래
            <input type="number" min="0" step="0.5" value={marginToUnit(paper.margins.bottom, paper.marginUnit)} onChange={(event) => changeMargin("bottom", event.target.value)} />
          </label>
          <label>
            왼쪽
            <input type="number" min="0" step="0.5" value={marginToUnit(paper.margins.left, paper.marginUnit)} onChange={(event) => changeMargin("left", event.target.value)} />
          </label>
          <label>
            오른쪽
            <input type="number" min="0" step="0.5" value={marginToUnit(paper.margins.right, paper.marginUnit)} onChange={(event) => changeMargin("right", event.target.value)} />
          </label>
          <label>
            줄간격
            <input
              type="number"
              min="1.2"
              max="2.4"
              step="0.1"
              value={paper.lineHeight}
              onChange={(event) => changePaper({ lineHeight: clampNumber(event.target.value, 1.2, 2.4, DEFAULT_PAPER.lineHeight) })}
            />
          </label>
          <div className="paper-zoom-control" aria-label="용지 배율">
            <span>배율</span>
            <button
              type="button"
              onClick={() => changePaper({ zoom: clampNumber((paper.zoom || DEFAULT_PAPER.zoom) - 0.1, 0.35, 1.25, DEFAULT_PAPER.zoom) })}
              disabled={(paper.zoom || DEFAULT_PAPER.zoom) <= 0.35}
            >
              -
            </button>
            <input
              type="number"
              min="35"
              max="125"
              step="5"
              value={Math.round((paper.zoom || DEFAULT_PAPER.zoom) * 100)}
              onChange={(event) => {
                const zoom = clampNumber(Number(event.target.value) / 100, 0.35, 1.25, DEFAULT_PAPER.zoom);
                changePaper({ zoom });
              }}
              aria-label="용지 배율 퍼센트"
            />
            <span>%</span>
            <button
              type="button"
              onClick={() => changePaper({ zoom: clampNumber((paper.zoom || DEFAULT_PAPER.zoom) + 0.1, 0.35, 1.25, DEFAULT_PAPER.zoom) })}
              disabled={(paper.zoom || DEFAULT_PAPER.zoom) >= 1.25}
            >
              +
            </button>
          </div>
        </div>
      )}

      <div className={`writing-canvas ${paper.enabled ? "paper-mode" : ""}`} style={paperStyle}>
        <SearchBox query={query} results={searchResults} onQuery={onQuery} onSelectChapter={onSelectChapter} />
        {paper.enabled ? (
          <PagedManuscript
            body={chapter.body}
            paper={paper}
            editorFontSize={editorFontSize}
            editorFontFamily={paper.fontFamily}
            onUpdateBody={onUpdateBody}
          />
        ) : (
          <textarea
            className="manuscript"
            spellCheck="false"
            aria-label="본문"
            value={chapter.body}
            style={{ fontSize: `${editorFontPx}px`, fontFamily: fontStack(paper.fontFamily) }}
            onChange={(event) => onUpdateBody(event.target.value)}
          />
        )}
      </div>
    </section>
  );
}

function SearchBox({ query, results, onQuery, onSelectChapter }) {
  return (
    <div className="search-panel">
      <input placeholder="원고 검색..." value={query} onChange={(event) => onQuery(event.target.value)} />
      {query.trim() && (
        <div className="search-results">
          {results.length === 0 && <span>검색 결과가 없습니다</span>}
          {results.map((result) => (
            <button key={result.chapter.id} onClick={() => onSelectChapter(result.chapter.id)}>
              <strong>{result.chapter.title}</strong>
              <span>{result.preview}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function textUnit(char) {
  return char.charCodeAt(0) < 128 ? 0.55 : 1;
}

function getPaperTextMetrics(paper, fontSizePt) {
  const fontSize = ptToPx(fontSizePt);
  const preset = PAPER_PRESETS[paper.size] || PAPER_PRESETS.a4;
  const margins = paper.margins || DEFAULT_PAPER.margins;
  const contentWidth = Math.max(120, preset.width - margins.left - margins.right);
  const contentHeight = Math.max(160, preset.height - margins.top - margins.bottom);
  return {
    charsPerLine: Math.max(8, Math.floor(contentWidth / (fontSize * 0.9))),
    linesPerPage: Math.max(4, Math.floor(contentHeight / (fontSize * paper.lineHeight))),
  };
}

function paginateText(text, paper, fontSizePt) {
  const { charsPerLine, linesPerPage } = getPaperTextMetrics(paper, fontSizePt);
  const pages = [""];
  let pageIndex = 0;
  let lineUnits = 0;
  let usedLines = 1;

  const startNextPage = () => {
    if (pages[pageIndex] === "") return;
    pages.push("");
    pageIndex += 1;
    lineUnits = 0;
    usedLines = 1;
  };

  for (const char of text || "") {
    if (char === "\n") {
      pages[pageIndex] += char;
      lineUnits = 0;
      usedLines += 1;
      if (usedLines > linesPerPage) startNextPage();
      continue;
    }

    const unit = textUnit(char);
    if (lineUnits + unit > charsPerLine) {
      lineUnits = 0;
      usedLines += 1;
      if (usedLines > linesPerPage) startNextPage();
    }

    pages[pageIndex] += char;
    lineUnits += unit;
  }

  return pages.length ? pages : [""];
}

function getVisualLines(text, charsPerLine) {
  const lines = [{ start: 0, end: 0 }];
  let lineStart = 0;
  let lineUnits = 0;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "\n") {
      lines[lines.length - 1].end = index;
      lines.push({ start: index + 1, end: index + 1 });
      lineStart = index + 1;
      lineUnits = 0;
      continue;
    }

    const unit = textUnit(char);
    if (lineUnits + unit > charsPerLine && index > lineStart) {
      lines[lines.length - 1].end = index;
      lines.push({ start: index, end: index });
      lineStart = index;
      lineUnits = 0;
    }

    lineUnits += unit;
    lines[lines.length - 1].end = index + 1;
  }

  return lines;
}

function getVisualLineIndex(lines, offset) {
  let index = 0;
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    if (offset >= lines[lineIndex].start) index = lineIndex;
  }
  return index;
}

function getLastMeaningfulLineIndex(text, lines) {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (text.slice(lines[index].start, lines[index].end).trim().length > 0) return index;
  }
  return 0;
}

function getMeaningfulTextEnd(text) {
  const match = text.match(/\s*$/);
  return match ? text.length - match[0].length : text.length;
}

function getVisualColumn(text, line, offset) {
  let column = 0;
  for (let index = line.start; index < Math.min(offset, line.end); index += 1) {
    column += textUnit(text[index]);
  }
  return column;
}

function getOffsetAtVisualColumn(text, line, column) {
  let currentColumn = 0;
  for (let index = line.start; index < line.end; index += 1) {
    const nextColumn = currentColumn + textUnit(text[index]);
    if (nextColumn > column) return index;
    currentColumn = nextColumn;
  }
  return line.end;
}

function pickVisualLineForEdge(text, lines, edge) {
  if (edge === "start") return lines[0];
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (text.slice(lines[index].start, lines[index].end).trim().length > 0) return lines[index];
  }
  return lines[lines.length - 1];
}

function PagedManuscript({ body, paper, editorFontSize, editorFontFamily, onUpdateBody }) {
  const composingRef = useRef(false);
  const frozenPagesRef = useRef(null);
  const [, forceCompositionRender] = useState(0);
  const calculatedPages = paginateText(body, paper, editorFontSize);
  const pages = composingRef.current && frozenPagesRef.current ? frozenPagesRef.current : calculatedPages;
  const { charsPerLine, linesPerPage } = getPaperTextMetrics(paper, editorFontSize);
  const editorFontPx = ptToPx(editorFontSize);
  const lineHeightPx = editorFontPx * paper.lineHeight;
  const pageStarts = pages.reduce((starts, page, index) => {
    starts.push(index === 0 ? 0 : starts[index - 1] + pages[index - 1].length);
    return starts;
  }, []);
  const pageRefs = useRef([]);
  const pendingFocusRef = useRef(null);
  const arrowIntentRef = useRef(null);
  const updatePage = (index, value, event) => {
    const activeElement = pageRefs.current[index];
    const isComposing = composingRef.current || event?.nativeEvent?.isComposing;
    const nextOffset = !isComposing && activeElement ? pageStarts[index] + activeElement.selectionStart : null;
    const nextPages = [...pages];
    nextPages[index] = value;
    if (isComposing) frozenPagesRef.current = nextPages;
    if (nextOffset !== null) pendingFocusRef.current = { offset: nextOffset, bias: "next" };
    onUpdateBody(nextPages.join(""));
  };
  const pageEnd = (index) => pageStarts[index] + (pages[index]?.length || 0);
  const caretToGlobal = (index, offset) => pageStarts[index] + offset;
  const resolveGlobalCaret = (offset, bias = "current") => {
    const safeOffset = Math.max(0, Math.min(offset, body.length));
    const index = pages.findIndex((page, pageIndex) => {
      const start = pageStarts[pageIndex];
      const end = pageEnd(pageIndex);
      if (bias === "next" && pageIndex > 0 && safeOffset === start) return true;
      if (bias === "previous" && safeOffset === end) return true;
      return safeOffset >= start && safeOffset < end;
    });
    const pageIndex = index === -1 ? pages.length - 1 : index;
    return { index: pageIndex, offset: safeOffset - pageStarts[pageIndex] };
  };
  const applyPendingFocus = () => {
    if (composingRef.current) return;
    const pendingFocus = pendingFocusRef.current;
    if (pendingFocus === null) return;
    pendingFocusRef.current = null;

    if (Number.isFinite(pendingFocus?.pageIndex)) {
      const targetIndex = Math.max(0, Math.min(pendingFocus.pageIndex, pageRefs.current.length - 1));
      const target = pageRefs.current[targetIndex];
      if (!target) return;
      target.focus();
      const requestedOffset = pendingFocus.pageOffset ?? 0;
      const offset =
        pendingFocus.trimEnd && requestedOffset >= target.value.length
          ? getMeaningfulTextEnd(target.value)
          : Math.max(0, Math.min(requestedOffset, target.value.length));
      target.setSelectionRange(offset, offset);
      return;
    }

    if (typeof pendingFocus === "number" || Number.isFinite(pendingFocus?.offset)) {
      const targetCaret =
        typeof pendingFocus === "number"
          ? resolveGlobalCaret(pendingFocus)
          : resolveGlobalCaret(pendingFocus.offset, pendingFocus.bias);
      const target = pageRefs.current[targetCaret.index];
      if (!target) return;
      target.focus();
      target.setSelectionRange(targetCaret.offset, targetCaret.offset);
      return;
    }

    const target = pageRefs.current[Math.max(0, Math.min(pendingFocus.index, pageRefs.current.length - 1))];
    if (!target) return;
    target.focus();
    const visualLines = getVisualLines(target.value, charsPerLine);
    const line = pickVisualLineForEdge(target.value, visualLines, pendingFocus.edge);
    const position = getOffsetAtVisualColumn(target.value, line, pendingFocus.column);
    target.setSelectionRange(position, position);
  };
  const queueFocus = (focus) => {
    pendingFocusRef.current = focus;
    window.requestAnimationFrame(applyPendingFocus);
  };
  const focusPageAtColumn = (index, column, edge) => {
    queueFocus({ index, column, edge });
  };
  const rememberArrowIntent = (event, index) => {
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    arrowIntentRef.current = {
      key: event.key,
      index,
      start: event.currentTarget.selectionStart,
      end: event.currentTarget.selectionEnd,
    };
  };
  const handlePageKeyDown = (event, index, page) => {
    if (composingRef.current || event.nativeEvent?.isComposing) return;
    const selectionStart = event.currentTarget.selectionStart;
    const selectionEnd = event.currentTarget.selectionEnd;
    const pageLines = getVisualLines(page, charsPerLine);
    const lineIndex = getVisualLineIndex(pageLines, selectionStart);
    const line = pageLines[lineIndex];
    const visualColumn = getVisualColumn(page, line, selectionStart);
    const lastMeaningfulLineIndex = getLastMeaningfulLineIndex(page, pageLines);
    const isLastVisualLine = lineIndex >= lastMeaningfulLineIndex;
    const meaningfulEnd = getMeaningfulTextEnd(page);
    const inTrailingWhitespace = selectionStart > meaningfulEnd;
    const atMeaningfulEnd = selectionStart >= meaningfulEnd && selectionEnd >= meaningfulEnd;

    if (inTrailingWhitespace && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      event.currentTarget.setSelectionRange(meaningfulEnd, meaningfulEnd);
      return;
    }

    if (event.key === "ArrowDown" && isLastVisualLine) {
      event.preventDefault();
      if (index < pages.length - 1) focusPageAtColumn(index + 1, visualColumn, "start");
      return;
    }

    if (event.key === "ArrowRight" && atMeaningfulEnd) {
      event.preventDefault();
      if (index < pages.length - 1) queueFocus({ pageIndex: index + 1, pageOffset: 0 });
      return;
    }

    if (event.key === "ArrowLeft" && selectionStart === 0 && selectionEnd === 0 && index > 0) {
      event.preventDefault();
      queueFocus({ pageIndex: index - 1, pageOffset: pages[index - 1].length, trimEnd: true });
      return;
    }

    rememberArrowIntent(event, index);

    const leadingWhitespaceSelected = index > 0 && selectionStart === selectionEnd && /^\s*$/.test(page.slice(0, selectionStart));
    if (event.key === "Delete" && selectionStart === selectionEnd && selectionStart === page.length && index < pages.length - 1) {
      event.preventDefault();
      const globalCaret = caretToGlobal(index, selectionStart);
      if (globalCaret >= body.length) return;
      const nextBody = `${body.slice(0, globalCaret)}${body.slice(globalCaret + 1)}`;
      pendingFocusRef.current = { offset: globalCaret, bias: "previous" };
      onUpdateBody(nextBody);
      return;
    }

    if (event.key !== "Backspace" || !leadingWhitespaceSelected) return;

    event.preventDefault();
    const globalCaret = caretToGlobal(index, selectionStart);
    if (globalCaret <= 0) return;
    const nextBody = `${body.slice(0, globalCaret - 1)}${body.slice(globalCaret)}`;
    pendingFocusRef.current = { offset: globalCaret - 1, bias: "previous" };
    onUpdateBody(nextBody);
  };
  const handlePageKeyUp = (event, index, page) => {
    if (composingRef.current || event.nativeEvent?.isComposing) return;
    const intent = arrowIntentRef.current;
    if (!intent || intent.index !== index || intent.key !== event.key) return;
    arrowIntentRef.current = null;

    const stayed =
      event.currentTarget.selectionStart === intent.start && event.currentTarget.selectionEnd === intent.end;
    if (!stayed) return;

    const pageLines = getVisualLines(page, charsPerLine);
    const lineIndex = getVisualLineIndex(pageLines, event.currentTarget.selectionStart);
    const line = pageLines[lineIndex];
    const visualColumn = getVisualColumn(page, line, event.currentTarget.selectionStart);

    if (event.key === "ArrowRight" && event.currentTarget.selectionStart === page.length && index < pages.length - 1) {
      queueFocus({ pageIndex: index + 1, pageOffset: 0 });
      return;
    }

    if (event.key === "ArrowLeft" && event.currentTarget.selectionStart === 0 && index > 0) {
      queueFocus({ pageIndex: index - 1, pageOffset: pages[index - 1].length, trimEnd: true });
      return;
    }

    if (event.key === "ArrowDown" && lineIndex === pageLines.length - 1 && index < pages.length - 1) {
      focusPageAtColumn(index + 1, visualColumn, "start");
      return;
    }

    if (event.key === "ArrowUp" && lineIndex === 0 && index > 0) {
      focusPageAtColumn(index - 1, visualColumn, "end");
    }
  };

  useEffect(() => {
    applyPendingFocus();
  });
  const handleCompositionStart = () => {
    composingRef.current = true;
    frozenPagesRef.current = [...pages];
    pendingFocusRef.current = null;
  };
  const handleCompositionEnd = (event, index) => {
    const globalCaret = pageStarts[index] + event.currentTarget.selectionStart;
    composingRef.current = false;
    frozenPagesRef.current = null;
    pendingFocusRef.current = { offset: globalCaret, bias: "next" };
    forceCompositionRender((value) => value + 1);
    window.requestAnimationFrame(applyPendingFocus);
  };

  return (
    <div className="paper-pages" aria-label="페이지 원고">
      {pages.map((page, index) => (
        <div className="paper-page-frame" key={index}>
          <div className="paper-page">
            <div className="page-number">{index + 1}</div>
            <textarea
              className="paged-manuscript"
              spellCheck="false"
              aria-label={`본문 ${index + 1}쪽`}
              value={page}
              style={{
                fontSize: `${editorFontPx}px`,
                fontFamily: fontStack(editorFontFamily),
                "--page-text-lines": Math.max(1, getVisualLines(page, charsPerLine).length),
                "--page-line-height-px": `${lineHeightPx}px`,
              }}
              ref={(element) => {
                pageRefs.current[index] = element;
              }}
              onChange={(event) => updatePage(index, event.target.value, event)}
              onKeyDown={(event) => handlePageKeyDown(event, index, page)}
              onKeyUp={(event) => handlePageKeyUp(event, index, page)}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={(event) => handleCompositionEnd(event, index)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function SettingsView({ project, onNewCard, onOpenCard, onSaveRelationship, onDeleteRelationship }) {
  const { sectionId } = useParams();
  const activeSection =
    SETTINGS_SECTIONS.find((section) => section.id === sectionId) || SETTINGS_SECTIONS[0];

  return (
    <section className="settings-page">
      <nav className="settings-subnav" aria-label="설정 분류">
        {SETTINGS_SECTIONS.map((section) => (
          <NavLink key={section.id} to={`/settings/${section.id}`}>
            <strong>{section.title}</strong>
            <span>{settingCount(project, section.id).toLocaleString()}</span>
          </NavLink>
        ))}
      </nav>

      <div className="settings-content">
        {activeSection.type === "relationships" ? (
          <RelationshipPanel
            characters={project.characters}
            relationships={project.relationships}
            onSave={onSaveRelationship}
            onDelete={onDeleteRelationship}
          />
        ) : (
          <CardSection
            section={activeSection}
            items={project[activeSection.id]}
            onNewCard={onNewCard}
            onOpenCard={onOpenCard}
          />
        )}
      </div>
    </section>
  );
}

function settingCount(project, sectionId) {
  if (sectionId === "relationships") return project.relationships.length;
  return project[sectionId]?.length || 0;
}

function CardSection({ section, items, onNewCard, onOpenCard }) {
  return (
    <div className="settings-column full-settings-column">
      <div className="section-header">
        <span>{section.title}</span>
        <button className="text-button" onClick={() => onNewCard(section.id)}>추가</button>
      </div>
      <div className={section.id === "beats" ? "beat-list" : "card-list"}>
        {items.map((item) => (
          <button
            className={section.id === "beats" ? "beat-card" : "info-card"}
            key={item.id}
            onClick={() => onOpenCard(section.id, item)}
          >
            <strong>{item.name || "이름 없음"}</strong>
            <p>{item.note || "메모 없음"}</p>
          </button>
        ))}
        {items.length === 0 && <p className="empty-note">아직 카드가 없습니다.</p>}
      </div>
    </div>
  );
}

function RelationshipPanel({ characters, relationships, onSave, onDelete }) {
  const [draft, setDraft] = useState({ from: "", to: "", label: "" });
  const canCreate = characters.length >= 2 && draft.from && draft.to && draft.from !== draft.to;
  const nameOf = (id) => characters.find((character) => character.id === id)?.name || "알 수 없음";
  const positioned = characters.map((character, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(characters.length, 1) - Math.PI / 2;
    return {
      ...character,
      x: 140 + Math.cos(angle) * 95,
      y: 125 + Math.sin(angle) * 82,
    };
  });

  return (
    <div className="settings-column relation-column">
      <div className="section-header">
        <span>관계도</span>
      </div>
      <div className="relationship-form">
        <select value={draft.from} onChange={(event) => setDraft({ ...draft, from: event.target.value })}>
          <option value="">시작 인물</option>
          {characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}
        </select>
        <select value={draft.to} onChange={(event) => setDraft({ ...draft, to: event.target.value })}>
          <option value="">대상 인물</option>
          {characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}
        </select>
        <input placeholder="관계 설명" value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value })} />
        <button
          className="primary-button"
          disabled={!canCreate}
          onClick={() => {
            onSave({ id: uid("rel"), from: draft.from, to: draft.to, label: draft.label || "관계" });
            setDraft({ from: "", to: "", label: "" });
          }}
        >
          추가
        </button>
      </div>
      <svg className="relationship-graph" viewBox="0 0 280 250" role="img" aria-label="캐릭터 관계도">
        {relationships.map((rel) => {
          const from = positioned.find((item) => item.id === rel.from);
          const to = positioned.find((item) => item.id === rel.to);
          if (!from || !to) return null;
          return <line key={rel.id} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />;
        })}
        {positioned.map((character) => (
          <g key={character.id}>
            <circle cx={character.x} cy={character.y} r="26" />
            <text x={character.x} y={character.y + 4}>{character.name.slice(0, 10)}</text>
          </g>
        ))}
      </svg>
      <div className="relationship-list">
        {relationships.map((rel) => (
          <div className="trash-row" key={rel.id}>
            <span>{nameOf(rel.from)} {"->"} {nameOf(rel.to)}: {rel.label}</span>
            <button className="text-button" onClick={() => onDelete(rel.id)}>삭제</button>
          </div>
        ))}
        {relationships.length === 0 && <p className="empty-note">아직 관계가 없습니다.</p>}
      </div>
    </div>
  );
}

function StatsView({ project, stats, trash, onRestoreProject, onRestoreChapter }) {
  const longest = [...project.chapters].sort((a, b) => countText(b.body) - countText(a.body))[0];
  const goalTotal = project.chapters.reduce((sum, chapter) => sum + Number(chapter.goal || 0), 0);
  return (
    <section className="stats-view">
      <div className="stats-board">
        <Metric label="오늘 작성" value={`${stats.today.toLocaleString()}자`} />
        <Metric label="전체 원고" value={`${stats.total.toLocaleString()}자`} />
        <Metric label="목표 달성" value={goalTotal ? `${Math.round((stats.total / goalTotal) * 100)}%` : "목표 없음"} />
        <Metric label="설정 카드" value={`${stats.cards.toLocaleString()}`} />
      </div>

      <div className="report-grid">
        <article className="report-panel">
          <h2>작품 요약</h2>
          <p>{project.logline || "로그라인이 비어 있습니다."}</p>
          <p>가장 긴 챕터: {longest?.title || "없음"} · {countText(longest?.body).toLocaleString()}자</p>
        </article>
        <article className="report-panel">
          <h2>휴지통</h2>
          <TrashList title="작품" items={trash.projects} getName={(item) => item.title || "제목 없음"} onRestore={onRestoreProject} />
          <TrashList
            title="챕터"
            items={trash.chapters}
            getName={(item) => `${item.projectTitle || "작품"} / ${item.title || "제목 없는 챕터"}`}
            onRestore={onRestoreChapter}
          />
        </article>
      </div>
    </section>
  );
}

function TrashList({ title, items, getName, onRestore }) {
  return (
    <div className="trash-group">
      <h3>{title}</h3>
      {items.length === 0 && <p className="empty-note">복구할 항목이 없습니다.</p>}
      {items.map((item) => (
        <div className="trash-row" key={item.id}>
          <span>{getName(item)}</span>
          <button className="text-button" onClick={() => onRestore(item.id)}>복구</button>
        </div>
      ))}
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric-card">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function StatsGrid({ stats }) {
  return (
    <div className="stats-grid" aria-label="집필 통계">
      <div><strong>{stats.today.toLocaleString()}</strong><span>오늘</span></div>
      <div><strong>{stats.total.toLocaleString()}</strong><span>전체</span></div>
      <div><strong>{stats.chapter.toLocaleString()}</strong><span>챕터</span></div>
    </div>
  );
}

function CardDialog({ dialog, onChange, onClose, onSave, onDelete }) {
  const labels = { characters: "캐릭터", world: "설정 노트", beats: "플롯 카드" };
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="dialog" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <h2>{labels[dialog.type]}</h2>
        <label>
          <span>이름</span>
          <input autoFocus value={dialog.name} onChange={(event) => onChange({ ...dialog, name: event.target.value })} />
        </label>
        <label>
          <span>메모</span>
          <textarea value={dialog.note} onChange={(event) => onChange({ ...dialog, note: event.target.value })} />
        </label>
        <div className="dialog-actions">
          {dialog.id && <button className="danger-button" onClick={onDelete}>삭제</button>}
          <button className="ghost-button" onClick={onClose}>취소</button>
          <button className="primary-button" onClick={onSave}>저장</button>
        </div>
      </section>
    </div>
  );
}
