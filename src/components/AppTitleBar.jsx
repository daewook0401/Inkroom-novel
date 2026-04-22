import { NavLink, useLocation } from "react-router-dom";
import { getCurrentWindow } from "@tauri-apps/api/window";

const RESIZE_HANDLES = [
  ["North", "n"],
  ["South", "s"],
  ["West", "w"],
  ["East", "e"],
  ["NorthWest", "nw"],
  ["NorthEast", "ne"],
  ["SouthWest", "sw"],
  ["SouthEast", "se"],
];

function getAppWindow() {
  try {
    return getCurrentWindow();
  } catch {
    return null;
  }
}

function WindowButton({ label, title, onClick, className = "" }) {
  return (
    <button type="button" className={`window-button ${className}`} title={title} onClick={onClick}>
      {label}
    </button>
  );
}

function WindowResizeHandles({ appWindow }) {
  if (!appWindow) return null;

  return (
    <div className="window-resize-layer" aria-hidden="true">
      {RESIZE_HANDLES.map(([direction, edge]) => (
        <div
          key={direction}
          className={`window-resize-handle ${edge}`}
          onMouseDown={(event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            void appWindow.startResizeDragging(direction).catch(() => {});
          }}
        />
      ))}
    </div>
  );
}

export function AppTitleBar({ focusMode }) {
  const location = useLocation();
  const settingsActive = location.pathname.startsWith("/settings");
  const appWindow = getAppWindow();

  const startDragging = (event) => {
    if (!appWindow || event.button !== 0) return;
    if (event.target.closest("button, a, input, select, textarea")) return;
    event.preventDefault();
    void appWindow.startDragging().catch(() => {});
  };

  const toggleMaximize = (event) => {
    if (event?.target?.closest("button, a, input, select, textarea")) return;
    void appWindow?.toggleMaximize().catch(() => {});
  };

  return (
    <>
      <header
        className={`app-titlebar ${focusMode ? "focus-titlebar" : ""}`}
        onMouseDown={startDragging}
        onDoubleClick={toggleMaximize}
      >
        <div className="titlebar-brand">
          <span className="titlebar-icon" aria-hidden="true">I</span>
          <strong>Inkroom</strong>
        </div>

        {!focusMode && (
          <nav className="titlebar-tabs" aria-label="주요 화면">
            <NavLink to="/write">집필</NavLink>
            <NavLink to="/settings/characters" className={settingsActive ? "active" : undefined}>설정</NavLink>
            <NavLink to="/stats">통계</NavLink>
          </nav>
        )}

        <div className="titlebar-spacer" />

        <div className="window-controls">
          <WindowButton label="-" title="최소화" onClick={() => void appWindow?.minimize().catch(() => {})} />
          <WindowButton label="□" title="최대화" onClick={() => void appWindow?.toggleMaximize().catch(() => {})} />
          <WindowButton label="×" title="닫기" className="close" onClick={() => void appWindow?.close().catch(() => {})} />
        </div>
      </header>
      <WindowResizeHandles appWindow={appWindow} />
    </>
  );
}
