export function CommandBar({ saveStatus, focusMode, onToggleFocus, onExport, onImport }) {
  return (
    <nav className="top-nav" aria-label="문서 명령">
      <div className="command-group command-save">
        <span className={`save-state ${saveStatus === "저장 중" ? "dirty" : ""}`}>{saveStatus}</span>
      </div>
      <div className="toolbar-actions">
        <button className="text-button" onClick={() => onExport("md")}>Markdown</button>
        <button className="text-button" onClick={() => onExport("txt")}>TXT</button>
        <button className="text-button" onClick={() => onExport("hwpx")}>HWPX</button>
        <button className="text-button" onClick={() => onExport("json")}>백업</button>
        <button className="text-button" onClick={onImport}>불러오기</button>
        <button className="primary-button" onClick={onToggleFocus}>
          {focusMode ? "집중 해제" : "집중 모드"}
        </button>
      </div>
    </nav>
  );
}
