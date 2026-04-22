import { countText } from "../lib/inkroomCore.js";
function LibraryPanel({
  libraryOpen,
  activeProject,
  projects,
  draggedChapterId,
  onToggleLibrary,
  onCreateProject,
  onSelectProject,
  onDeleteProject,
  onCreateChapter,
  onSelectChapter,
  onDeleteChapter,
  onDragChapter,
  onDropChapter,
  query,
  searchResults,
  onQuery,
}) {
  return (
    <aside className="library-panel" aria-label="작품과 챕터">
      <div className="library-header">
        <button
          type="button"
          className="sidebar-toggle-button"
          aria-label={libraryOpen ? "작품 패널 닫기" : "작품 패널 열기"}
          title={libraryOpen ? "작품 패널 닫기" : "작품 패널 열기"}
          onClick={onToggleLibrary}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      <section className="panel-section">
        <div className="section-header">
          <span>작품</span>
          <div className="section-header-actions">
            <span className="count-pill">{projects.length}</span>
            <button type="button" className="text-button" onClick={onCreateProject}>추가</button>
          </div>
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
        <SearchBox
          className="chapter-search"
          query={query}
          results={searchResults}
          onQuery={onQuery}
          onSelectChapter={onSelectChapter}
        />
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

function SearchBox({ className = "", query, results, onQuery, onSelectChapter }) {
  return (
    <div className={`search-panel ${className}`.trim()}>
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

export { LibraryPanel };

