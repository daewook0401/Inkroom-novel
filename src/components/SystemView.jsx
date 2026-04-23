function SystemView({
  system,
  currentFontFamily,
  onPickDirectory,
  onClearDirectory,
  onRefreshFonts,
  onChangeDefaultFont,
  isDesktopRuntime,
}) {
  const availableFonts = [...new Set([currentFontFamily, ...(system.availableFonts || [])].filter(Boolean))];

  return (
    <section className="system-page">
      <div className="system-grid">
        <SystemCard
          title="다운로드 폴더"
          description="Markdown, TXT, HWPX 같은 일반 내보내기 파일이 저장될 위치입니다."
          path={system.downloadDirectory}
          actionLabel="폴더 지정"
          onAction={() => onPickDirectory("downloadDirectory")}
          onClear={() => onClearDirectory("downloadDirectory")}
          disabled={!isDesktopRuntime}
        />

        <SystemCard
          title="백업 폴더"
          description="Inkroom 백업 JSON 저장과 불러오기에 우선 사용할 위치입니다."
          path={system.backupDirectory}
          actionLabel="폴더 지정"
          onAction={() => onPickDirectory("backupDirectory")}
          onClear={() => onClearDirectory("backupDirectory")}
          disabled={!isDesktopRuntime}
        />

        <section className="system-card system-font-card">
          <div className="system-card-head">
            <div>
              <strong>로컬 폰트</strong>
              <p>기기에서 읽은 글꼴 목록을 갱신하고 기본 집필 글꼴을 정합니다.</p>
            </div>
            <button type="button" className="text-button" onClick={onRefreshFonts}>
              폰트 읽기
            </button>
          </div>

          <label className="system-font-select">
            <span>기본 집필 글꼴</span>
            <select value={currentFontFamily} onChange={(event) => onChangeDefaultFont(event.target.value)}>
              {availableFonts.map((font) => (
                <option key={font} value={font}>
                  {font}
                </option>
              ))}
            </select>
          </label>

          <div className="font-chip-list" aria-label="읽어온 로컬 폰트 목록">
            {availableFonts.map((font) => (
              <span key={font} className="font-chip">
                {font}
              </span>
            ))}
          </div>
        </section>
      </div>

      {!isDesktopRuntime && (
        <p className="system-note">폴더 지정은 데스크톱 앱에서 사용할 수 있고, 웹에서는 브라우저 다운로드 방식을 계속 사용합니다.</p>
      )}
    </section>
  );
}

function SystemCard({ title, description, path, actionLabel, onAction, onClear, disabled }) {
  return (
    <section className="system-card">
      <div className="system-card-head">
        <div>
          <strong>{title}</strong>
          <p>{description}</p>
        </div>
        <button type="button" className="text-button" onClick={onAction} disabled={disabled}>
          {actionLabel}
        </button>
      </div>

      <div className={`system-path-box ${path ? "filled" : ""}`}>
        {path || "아직 지정된 폴더가 없습니다."}
      </div>

      {path && (
        <div className="system-card-actions">
          <button type="button" className="text-button" onClick={onClear}>
            지우기
          </button>
        </div>
      )}
    </section>
  );
}

export { SystemView };
