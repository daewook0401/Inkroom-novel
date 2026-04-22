import { Navigate, Route, Routes } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { loadDesktopState, saveDesktopState } from "./desktopDb.js";
import { createHwpxBlob } from "./hwpxExport.js";
import { AppTitleBar } from "./components/AppTitleBar.jsx";
import { CardDialog } from "./components/CardDialog.jsx";
import { CommandBar } from "./components/CommandBar.jsx";
import { DownloadNotice } from "./components/DownloadNotice.jsx";
import { LibraryPanel } from "./components/LibraryPanel.jsx";
import { SettingsView } from "./components/SettingsView.jsx";
import { StatsView } from "./components/StatsView.jsx";
import { WritingView } from "./components/WritingView.jsx";
import { useResponsiveMode } from "./hooks/useResponsiveMode.js";
import {
  DEFAULT_PAPER,
  STORAGE_KEY,
  countText,
  downloadBlob,
  downloadText,
  loadInitialState,
  normalizeState,
  now,
  parseChapterSelection,
  projectToMarkdown,
  projectToTxt,
  sampleProject,
  slug,
  todayKey,
  uid,
} from "./lib/inkroomCore.js";

export default function App() {
  const responsive = useResponsiveMode();
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
    setNotice({ id: uid("notice"), message: `${filename} 다운로드 완료했습니다.` });
  };

  const exportProject = async (format) => {
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

    if (format === "hwpx") {
      const scope = window.prompt(
        "HWPX로 다운로드할 범위를 선택하세요.\n1: 지금 보는 화수\n2: 전체 작품",
        "1",
      );
      if (scope === null) return;
      const currentOnly = scope.trim() !== "2";
      const chapters = currentOnly && activeChapter ? [activeChapter] : activeProject.chapters;
      const suffix = currentOnly && activeChapter ? `-${slug(activeChapter.title || "current")}` : "";
      const filename = `${slug(activeProject.title)}${suffix}.hwpx`;
      const blob = await createHwpxBlob({ ...activeProject, chapters }, state.preferences || {});
      downloadBlob(filename, blob);
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
    <div ref={responsive.ref} className={`app-window layout-${responsive.mode} ${focusMode ? "focus-mode" : ""}`}>
      <AppTitleBar focusMode={focusMode} />
      <div className="app-shell">
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
        query={query}
        searchResults={searchResults}
        onQuery={setQuery}
      />

      <main className="workspace-panel">
        {focusMode && (
          <button className="focus-exit-button" onClick={() => setFocusMode(false)}>
            집중 해제
          </button>
        )}
        <CommandBar
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
                editorFontSize={state.preferences?.editorFontSize || 19}
                paper={state.preferences?.paper || DEFAULT_PAPER}
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
      </div>

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






