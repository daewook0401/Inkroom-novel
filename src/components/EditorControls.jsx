import { useEffect, useState } from "react";

function ControlGroup({ title, children, className = "" }) {
  return (
    <div className={`control-group ${className}`} aria-label={title}>
      <span className="control-group-title">{title}</span>
      {children}
    </div>
  );
}

export function EditorHeader({ project, stats, onUpdateProject, StatsGrid }) {
  return (
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
  );
}

export function ChapterToolbar({
  chapter,
  progress,
  editorFontSize,
  minFontSize,
  maxFontSize,
  fontFamilies,
  paper,
  defaultPaper,
  indentPt,
  onUpdateChapter,
  onChangeFontSize,
  onChangePaper,
  onRefreshFonts,
  onChangeTextIndent,
}) {
  return (
    <div className="chapter-toolbar">
      <ControlGroup title="문서" className="document-controls">
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
        <div className="goal-meter" aria-label="챕터 목표 진행률">
          <span style={{ width: `${progress}%` }} />
        </div>
      </ControlGroup>

      <ControlGroup title="글꼴" className="font-controls">
        <div className="font-size-control" aria-label="글자 크기">
          <button type="button" onClick={() => onChangeFontSize(-1)} disabled={editorFontSize <= minFontSize}>-</button>
          <strong>{editorFontSize}pt</strong>
          <button type="button" onClick={() => onChangeFontSize(1)} disabled={editorFontSize >= maxFontSize}>+</button>
        </div>
        <label className="toolbar-font-control">
          <span>폰트</span>
          <select
            value={paper.fontFamily || defaultPaper.fontFamily}
            onChange={(event) => onChangePaper({ fontFamily: event.target.value })}
          >
            {fontFamilies.map((font) => (
              <option key={font} value={font}>{font}</option>
            ))}
          </select>
        </label>
        <button type="button" className="text-button font-refresh-button" onClick={onRefreshFonts}>폰트 읽기</button>
        <label className="indent-control">
          <span>들여쓰기</span>
          <input
            type="number"
            min="0"
            step="1"
            value={indentPt}
            onChange={(event) => onChangeTextIndent(event.target.value)}
          />
          <span>pt</span>
        </label>
      </ControlGroup>

      <ControlGroup title="보기" className="view-controls">
        <button
          type="button"
          className={`text-button paper-toggle ${paper.enabled ? "active" : ""}`}
          onClick={() => onChangePaper({ enabled: !paper.enabled })}
        >
          미리 보기
        </button>
      </ControlGroup>
    </div>
  );
}

export function PaperSettingsPanel({
  paper,
  paperDimensions,
  paperPresets,
  marginUnits,
  defaultPaper,
  minZoom,
  maxZoom,
  marginToUnit,
  onApplyPaperSize,
  onChangePaper,
  onChangeDimension,
  onChangeMargin,
  onStepZoom,
  onChangeZoomPercent,
}) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (paper.enabled) setOpen(true);
  }, [paper.enabled]);

  if (!paper.enabled) return null;

  return (
    <section className={`paper-settings-panel ${open ? "open" : ""}`} aria-label="편집 용지 설정">
      <button type="button" className="paper-settings-toggle" onClick={() => setOpen((value) => !value)}>
        용지 설정
        <span>{open ? "접기" : "열기"}</span>
      </button>

      <div className="paper-toolbar">
        <label className="paper-size-control">
          용지
          <select value={paper.size} onChange={(event) => onApplyPaperSize(event.target.value)}>
            {Object.entries(paperPresets).map(([value, preset]) => (
              <option key={value} value={value}>{preset.label}</option>
            ))}
            <option value="custom">사용자 지정</option>
          </select>
        </label>
        <label>
          단위
          <select
            value={paper.marginUnit || defaultPaper.marginUnit}
            onChange={(event) => onChangePaper({ marginUnit: event.target.value, dimensionUnit: event.target.value })}
          >
            {Object.entries(marginUnits).map(([value, unit]) => (
              <option key={value} value={value}>{unit.label}</option>
            ))}
          </select>
        </label>
        <label>
          폭
          <input
            type="number"
            min="0"
            step="0.5"
            value={marginToUnit(paperDimensions.width, paper.dimensionUnit || paper.marginUnit)}
            onChange={(event) => onChangeDimension("width", event.target.value)}
          />
        </label>
        <label>
          길이
          <input
            type="number"
            min="0"
            step="0.5"
            value={marginToUnit(paperDimensions.height, paper.dimensionUnit || paper.marginUnit)}
            onChange={(event) => onChangeDimension("height", event.target.value)}
          />
        </label>
        <label>
          위
          <input type="number" min="0" step="0.5" value={marginToUnit(paper.margins.top, paper.marginUnit)} onChange={(event) => onChangeMargin("top", event.target.value)} />
        </label>
        <label>
          아래
          <input type="number" min="0" step="0.5" value={marginToUnit(paper.margins.bottom, paper.marginUnit)} onChange={(event) => onChangeMargin("bottom", event.target.value)} />
        </label>
        <label>
          왼쪽
          <input type="number" min="0" step="0.5" value={marginToUnit(paper.margins.left, paper.marginUnit)} onChange={(event) => onChangeMargin("left", event.target.value)} />
        </label>
        <label>
          오른쪽
          <input type="number" min="0" step="0.5" value={marginToUnit(paper.margins.right, paper.marginUnit)} onChange={(event) => onChangeMargin("right", event.target.value)} />
        </label>
        <label>
          줄간격
          <input
            type="number"
            min="1.2"
            max="2.4"
            step="0.1"
            value={paper.lineHeight}
            onChange={(event) => onChangePaper({ lineHeight: Number(event.target.value || defaultPaper.lineHeight) })}
          />
        </label>
        <div className="paper-zoom-control" aria-label="용지 배율">
          <span>배율</span>
          <button type="button" onClick={() => onStepZoom(-0.1)} disabled={(paper.zoom || defaultPaper.zoom) <= minZoom}>-</button>
          <input
            type="number"
            min={Math.round(minZoom * 100)}
            max={Math.round(maxZoom * 100)}
            step="5"
            value={Math.round((paper.zoom || defaultPaper.zoom) * 100)}
            onChange={(event) => onChangeZoomPercent(event.target.value)}
            aria-label="용지 배율 퍼센트"
          />
          <span>%</span>
          <button type="button" onClick={() => onStepZoom(0.1)} disabled={(paper.zoom || defaultPaper.zoom) >= maxZoom}>+</button>
        </div>
      </div>
    </section>
  );
}
