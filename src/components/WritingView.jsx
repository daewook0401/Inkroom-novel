import { useEffect, useMemo, useRef, useState } from "react";
import { ChapterTitleRow, ChapterToolbar, EditorHeader, PaperSettingsPanel } from "./EditorControls.jsx";
import { usePaperColumns } from "../hooks/usePaperColumns.js";
import {
  DEFAULT_PAPER,
  MARGIN_UNITS,
  MAX_EDITOR_FONT_SIZE,
  MAX_PAPER_ZOOM,
  MIN_EDITOR_FONT_SIZE,
  MIN_PAPER_ZOOM,
  PAPER_PRESETS,
  clampNumber,
  countText,
  dimensionFromUnit,
  fontStack,
  getPaperDimensions,
  getPaperPreset,
  lengthFromUnit,
  marginFromUnit,
  marginToUnit,
  ptToPx,
} from "../lib/inkroomCore.js";
import { StatsGrid } from "./StatsView.jsx";
function WritingView({
  project,
  chapter,
  stats,
  saveStatus,
  editorFontSize,
  paper,
  onUpdateProject,
  onUpdateChapter,
  onUpdateBody,
  onUpdatePreferences,
}) {
  const progress = chapter.goal > 0 ? Math.min(100, Math.round((countText(chapter.body) / chapter.goal) * 100)) : 0;
  const changeFontSize = (delta) => {
    const nextSize = Math.max(MIN_EDITOR_FONT_SIZE, Math.min(MAX_EDITOR_FONT_SIZE, editorFontSize + delta));
    onUpdatePreferences({ editorFontSize: nextSize });
  };
  const editorFontPx = ptToPx(editorFontSize);
  const previewFontSize = paper.previewFontSize || DEFAULT_PAPER.previewFontSize;
  const paperDimensions = getPaperDimensions(paper);
  const changePaper = (patch) => {
    onUpdatePreferences({
      paper: {
        ...paper,
        ...patch,
        dimensions: {
          ...(paper.dimensions || DEFAULT_PAPER.dimensions),
          ...(patch.dimensions || {}),
        },
        margins: {
          ...(paper.margins || DEFAULT_PAPER.margins),
          ...(patch.margins || {}),
        },
      },
    });
  };
  const applyPaperSize = (size) => {
    const preset = PAPER_PRESETS[size];
    if (!preset) {
      changePaper({ size: "custom" });
      return;
    }
    const nextPaper = {
      ...paper,
      size,
      dimensions: { width: preset.width, height: preset.height },
      margins: preset.margins ? preset.margins : paper.margins,
      textIndent: typeof preset.textIndent === "number" ? preset.textIndent : paper.textIndent,
      previewFontSize: typeof preset.previewFontSize === "number" ? preset.previewFontSize : paper.previewFontSize,
      ...(preset.margins ? { marginUnit: "mm", dimensionUnit: "mm" } : {}),
    };
    onUpdatePreferences({ paper: nextPaper });
  };
  const changeDimension = (side, value) => {
    const unit = paper.dimensionUnit || paper.marginUnit || DEFAULT_PAPER.dimensionUnit;
    changePaper({
      size: "custom",
      dimensions: {
        [side]: dimensionFromUnit(value, unit, DEFAULT_PAPER.dimensions[side]),
      },
    });
  };
  const changeMargin = (side, value) => {
    changePaper({
      size: "custom",
      margins: {
        [side]: marginFromUnit(value, paper.marginUnit || DEFAULT_PAPER.marginUnit, DEFAULT_PAPER.margins[side]),
      },
    });
  };
  const changeTextIndent = (value) => {
    changePaper({
      textIndent: lengthFromUnit(value, "pt", 0, 240, DEFAULT_PAPER.textIndent),
    });
  };
  const stepZoom = (delta) => {
    changePaper({
      zoom: clampNumber((paper.zoom || DEFAULT_PAPER.zoom) + delta, MIN_PAPER_ZOOM, MAX_PAPER_ZOOM, DEFAULT_PAPER.zoom),
    });
  };
  const changeZoomPercent = (value) => {
    changePaper({
      zoom: clampNumber(Number(value) / 100, MIN_PAPER_ZOOM, MAX_PAPER_ZOOM, DEFAULT_PAPER.zoom),
    });
  };
  const paperColumns = usePaperColumns({
    enabled: paper.enabled,
    pageWidth: paperDimensions.width,
    zoom: paper.zoom || DEFAULT_PAPER.zoom,
  });
  const paperStyle = {
    "--paper-width": `${paperDimensions.width}px`,
    "--paper-height": `${paperDimensions.height}px`,
    "--paper-margin-top": `${paper.margins.top}px`,
    "--paper-margin-right": `${paper.margins.right}px`,
    "--paper-margin-bottom": `${paper.margins.bottom}px`,
    "--paper-margin-left": `${paper.margins.left}px`,
    "--paper-line-height": paper.lineHeight,
    "--manuscript-text-indent": `${paper.textIndent || 0}px`,
    "--editor-font-family": fontStack(paper.fontFamily),
    "--paper-zoom": paper.zoom,
    "--paper-scaled-width": `${paperDimensions.width * paper.zoom}px`,
    "--paper-scaled-height": `${paperDimensions.height * paper.zoom}px`,
    "--paper-columns": paperColumns.columns,
  };

  return (
    <section className={`editor-panel ${paper.enabled ? "paper-enabled" : ""}`}>
      <EditorHeader project={project} stats={stats} onUpdateProject={onUpdateProject} StatsGrid={StatsGrid} />
      <ChapterTitleRow chapter={chapter} onUpdateChapter={onUpdateChapter} />

      <ChapterToolbar
        chapter={chapter}
        progress={progress}
        editorFontSize={editorFontSize}
        minFontSize={MIN_EDITOR_FONT_SIZE}
        maxFontSize={MAX_EDITOR_FONT_SIZE}
        paper={paper}
        indentPt={marginToUnit(paper.textIndent || 0, "pt")}
        onUpdateChapter={onUpdateChapter}
        onChangeFontSize={changeFontSize}
        onChangeTextIndent={changeTextIndent}
      />

      <PaperSettingsPanel
        paper={paper}
        paperDimensions={paperDimensions}
        paperPresets={PAPER_PRESETS}
        marginUnits={MARGIN_UNITS}
        defaultPaper={DEFAULT_PAPER}
        minZoom={MIN_PAPER_ZOOM}
        maxZoom={MAX_PAPER_ZOOM}
        minFontSize={MIN_EDITOR_FONT_SIZE}
        maxFontSize={MAX_EDITOR_FONT_SIZE}
        previewFontSize={previewFontSize}
        marginToUnit={marginToUnit}
        onApplyPaperSize={applyPaperSize}
        onChangePaper={(patch) => {
          if (typeof patch.lineHeight !== "undefined") {
            changePaper({ lineHeight: clampNumber(patch.lineHeight, 1.2, 2.4, DEFAULT_PAPER.lineHeight) });
            return;
          }
          changePaper(patch);
        }}
        onChangePreviewFontSize={(value) =>
          changePaper({
            previewFontSize: clampNumber(value, MIN_EDITOR_FONT_SIZE, MAX_EDITOR_FONT_SIZE, DEFAULT_PAPER.previewFontSize),
          })
        }
        onChangeDimension={changeDimension}
        onChangeMargin={changeMargin}
        onStepZoom={stepZoom}
        onChangeZoomPercent={changeZoomPercent}
      />

      <div ref={paperColumns.ref} className={`writing-canvas ${paper.enabled ? "paper-mode" : ""}`} style={paperStyle}>
        {paper.enabled ? (
          <PagedPaperPreview
            body={chapter.body}
            paper={paper}
            editorFontSize={previewFontSize}
            editorFontFamily={paper.fontFamily}
          />
        ) : (
          <RichManuscript
            body={chapter.body}
            fontSizePx={editorFontPx}
            fontFamily={paper.fontFamily}
            textIndent={paper.textIndent || 0}
            onUpdateBody={onUpdateBody}
          />
        )}
      </div>
    </section>
  );
}

function RichManuscript({ body, fontSizePx, fontFamily, textIndent, onUpdateBody }) {
  const editorRef = useRef(null);
  const lastBodyRef = useRef(body || "");

  const writeBodyToEditor = (value) => {
    const editor = editorRef.current;
    if (!editor) return;
    const lines = String(value || "").split("\n");
    editor.replaceChildren(
      ...lines.map((line) => {
        const block = document.createElement("div");
        block.className = "manuscript-line";
        if (line) {
          block.textContent = line;
        } else {
          block.append(document.createElement("br"));
        }
        return block;
      }),
    );
  };

  const readEditorBody = () => {
    const editor = editorRef.current;
    if (!editor) return "";
    const blocks = Array.from(editor.children);
    if (!blocks.length) return editor.innerText.replace(/\n$/, "");
    return blocks.map((block) => block.innerText.replace(/\n$/, "")).join("\n");
  };

  useEffect(() => {
    const nextBody = body || "";
    const editor = editorRef.current;
    if (!editor) return;
    if (document.activeElement === editor && lastBodyRef.current === nextBody) return;
    if (lastBodyRef.current === nextBody && editor.children.length) return;
    writeBodyToEditor(nextBody);
    lastBodyRef.current = nextBody;
  }, [body]);

  const handleInput = () => {
    const nextBody = readEditorBody();
    lastBodyRef.current = nextBody;
    onUpdateBody(nextBody);
  };

  const handlePaste = (event) => {
    event.preventDefault();
    const text = event.clipboardData?.getData("text/plain") || "";
    document.execCommand("insertText", false, text);
  };

  return (
    <div
      ref={editorRef}
      className="manuscript rich-manuscript"
      contentEditable
      suppressContentEditableWarning
      spellCheck="false"
      aria-label="본문"
      style={{
        fontSize: `${fontSizePx}px`,
        fontFamily: fontStack(fontFamily),
        "--manuscript-text-indent": `${textIndent}px`,
      }}
      onInput={handleInput}
      onPaste={handlePaste}
    />
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

function textUnit(char) {
  return char.charCodeAt(0) < 128 ? 0.55 : 1;
}

function getPaperTextMetrics(paper, fontSizePt) {
  const fontSize = ptToPx(fontSizePt);
  const dimensions = getPaperDimensions(paper);
  const margins = paper.margins || DEFAULT_PAPER.margins;
  const preset = getPaperPreset(paper);
  const contentWidth = Math.max(120, dimensions.width - margins.left - margins.right);
  const contentHeight = Math.max(160, dimensions.height - margins.top - margins.bottom);
  const indentUnits = Math.max(0, (paper.textIndent || 0) / (fontSize * 0.9));
  const charsPerLine = Math.max(8, Math.floor(contentWidth / (fontSize * 0.9)));
  const lineHeightCorrection = preset?.lineHeightCorrection || 1;
  return {
    charsPerLine,
    firstLineChars: Math.max(4, Math.floor(charsPerLine - indentUnits)),
    linesPerPage: Math.max(4, Math.floor(contentHeight / (fontSize * paper.lineHeight * lineHeightCorrection))),
  };
}

function paginateText(text, paper, fontSizePt) {
  const { charsPerLine, firstLineChars, linesPerPage } = getPaperTextMetrics(paper, fontSizePt);
  const pages = [""];
  let pageIndex = 0;
  let lineUnits = 0;
  let usedLines = 1;
  let paragraphLineIndex = 0;

  const startNextPage = (continuesParagraph = false) => {
    if (pages[pageIndex] === "") return;
    pages.push("");
    pageIndex += 1;
    lineUnits = 0;
    usedLines = 1;
    paragraphLineIndex = continuesParagraph ? Math.max(1, paragraphLineIndex) : 0;
  };
  const currentLineLimit = () => (paragraphLineIndex === 0 ? firstLineChars : charsPerLine);

  for (const char of text || "") {
    if (char === "\n") {
      pages[pageIndex] += char;
      lineUnits = 0;
      usedLines += 1;
      paragraphLineIndex = 0;
      if (usedLines > linesPerPage) startNextPage(false);
      continue;
    }

    const unit = textUnit(char);
    if (lineUnits + unit > currentLineLimit()) {
      lineUnits = 0;
      usedLines += 1;
      paragraphLineIndex += 1;
      if (usedLines > linesPerPage) startNextPage(true);
    }

    pages[pageIndex] += char;
    lineUnits += unit;
  }

  return pages.length ? pages : [""];
}

function getVisualLines(text, charsPerLine, firstLineChars = charsPerLine, startsParagraph = true) {
  const lines = [{ start: 0, end: 0, indented: startsParagraph }];
  let lineStart = 0;
  let lineUnits = 0;
  let paragraphLineIndex = startsParagraph ? 0 : 1;
  const currentLineLimit = () => (paragraphLineIndex === 0 ? firstLineChars : charsPerLine);

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "\n") {
      lines[lines.length - 1].end = index;
      lines.push({ start: index + 1, end: index + 1, indented: true });
      lineStart = index + 1;
      lineUnits = 0;
      paragraphLineIndex = 0;
      continue;
    }

    const unit = textUnit(char);
    if (lineUnits + unit > currentLineLimit() && index > lineStart) {
      lines[lines.length - 1].end = index;
      lines.push({ start: index, end: index, indented: false });
      lineStart = index;
      lineUnits = 0;
      paragraphLineIndex += 1;
    }

    lineUnits += unit;
    lines[lines.length - 1].end = index + 1;
  }

  return lines;
}

function PaperTextPreview({ page, charsPerLine, firstLineChars, startsParagraph, style }) {
  const lines = getVisualLines(page, charsPerLine, firstLineChars, startsParagraph);
  return (
    <div className="paper-text-preview" aria-hidden="true" style={style}>
      {lines.map((line, index) => (
        <div className={`paper-preview-line${line.indented ? " indented" : ""}`} key={index}>
          {page.slice(line.start, line.end) || "\u00a0"}
        </div>
      ))}
    </div>
  );
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
  const [wholeSelection, setWholeSelection] = useState(false);
  const calculatedPages = paginateText(body, paper, editorFontSize);
  const pages = composingRef.current && frozenPagesRef.current ? frozenPagesRef.current : calculatedPages;
  const { charsPerLine, firstLineChars, linesPerPage } = getPaperTextMetrics(paper, editorFontSize);
  const editorFontPx = ptToPx(editorFontSize);
  const lineHeightPx = editorFontPx * paper.lineHeight * (getPaperPreset(paper)?.lineHeightCorrection || 1);
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
  const pageStartsParagraph = (index) => index === 0 || body[pageStarts[index] - 1] === "\n";
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
    const visualLines = getVisualLines(target.value, charsPerLine, firstLineChars, pageStartsParagraph(targetIndex));
    const line = pickVisualLineForEdge(target.value, visualLines, pendingFocus.edge);
    const position = getOffsetAtVisualColumn(target.value, line, pendingFocus.column);
    target.setSelectionRange(position, position);
  };
  const queueFocus = (focus) => {
    pendingFocusRef.current = focus;
    window.requestAnimationFrame(applyPendingFocus);
  };
  const copyWholeDocument = () => {
    if (!navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(body).catch(() => {});
  };
  const replaceWholeDocument = (value) => {
    setWholeSelection(false);
    pendingFocusRef.current = { offset: value.length, bias: "next" };
    onUpdateBody(value);
  };
  const clearWholeSelection = () => {
    if (wholeSelection) setWholeSelection(false);
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
    const key = event.key.toLowerCase();

    if ((event.ctrlKey || event.metaKey) && key === "a") {
      event.preventDefault();
      setWholeSelection(true);
      window.requestAnimationFrame(() => {
        pageRefs.current.forEach((element) => {
          if (!element) return;
          element.setSelectionRange(0, element.value.length);
        });
        event.currentTarget.focus();
      });
      return;
    }

    if (wholeSelection) {
      if ((event.ctrlKey || event.metaKey) && key === "c") {
        event.preventDefault();
        copyWholeDocument();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && key === "x") {
        event.preventDefault();
        copyWholeDocument();
        replaceWholeDocument("");
        return;
      }

      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        replaceWholeDocument("");
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        replaceWholeDocument("\n");
        return;
      }

      if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        replaceWholeDocument(event.key);
        return;
      }

      if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
        clearWholeSelection();
      }
    }

    const selectionStart = event.currentTarget.selectionStart;
    const selectionEnd = event.currentTarget.selectionEnd;
    const pageLines = getVisualLines(page, charsPerLine, firstLineChars, pageStartsParagraph(index));
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

    const pageLines = getVisualLines(page, charsPerLine, firstLineChars, pageStartsParagraph(index));
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
  const handlePagePaste = (event) => {
    if (!wholeSelection) return;
    event.preventDefault();
    replaceWholeDocument(event.clipboardData?.getData("text/plain") || "");
  };

  useEffect(() => {
    applyPendingFocus();
  });
  const handleCompositionStart = () => {
    clearWholeSelection();
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
          <div className={`paper-page${wholeSelection ? " whole-selected" : ""}`}>
            <div className="page-number">{index + 1}</div>
            <PaperTextPreview
              page={page}
              charsPerLine={charsPerLine}
              firstLineChars={firstLineChars}
              startsParagraph={pageStartsParagraph(index)}
              style={{
                fontSize: `${editorFontPx}px`,
                fontFamily: fontStack(editorFontFamily),
                "--page-line-height-px": `${lineHeightPx}px`,
              }}
            />
            <textarea
              className="paged-manuscript"
              spellCheck="false"
              aria-label={`본문 ${index + 1}쪽`}
              value={page}
              style={{
                fontSize: `${editorFontPx}px`,
                fontFamily: fontStack(editorFontFamily),
                "--page-text-lines": Math.max(
                  1,
                  getVisualLines(page, charsPerLine, firstLineChars, pageStartsParagraph(index)).length,
                ),
                "--page-line-height-px": `${lineHeightPx}px`,
              }}
              ref={(element) => {
                pageRefs.current[index] = element;
              }}
              onMouseDown={clearWholeSelection}
              onChange={(event) => updatePage(index, event.target.value, event)}
              onKeyDown={(event) => handlePageKeyDown(event, index, page)}
              onKeyUp={(event) => handlePageKeyUp(event, index, page)}
              onPaste={handlePagePaste}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={(event) => handleCompositionEnd(event, index)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function renderPaperEditorPage(element, page, startsParagraph) {
  const paragraphs = String(page || "").split("\n");
  element.replaceChildren(
    ...paragraphs.map((paragraph, index) => {
      const block = document.createElement("div");
      block.className = `paper-edit-paragraph${index === 0 && !startsParagraph ? " continuation" : ""}`;
      if (paragraph) {
        block.textContent = paragraph;
      } else {
        block.append(document.createElement("br"));
      }
      return block;
    }),
  );
}

function readPaperEditorPage(element) {
  if (!element) return "";
  const blocks = Array.from(element.children);
  if (!blocks.length) return element.innerText.replace(/\n$/, "");
  return blocks.map((block) => block.innerText.replace(/\n$/, "")).join("\n");
}

function PaperPageEditor({
  page,
  index,
  startsParagraph,
  editorFontPx,
  editorFontFamily,
  onFocusPage,
  onUpdatePage,
}) {
  const editorRef = useRef(null);
  const lastPageRef = useRef(page || "");

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const nextPage = page || "";
    if (document.activeElement === editor) return;
    if (lastPageRef.current === nextPage && editor.children.length) return;
    renderPaperEditorPage(editor, nextPage, startsParagraph);
    lastPageRef.current = nextPage;
  }, [page, startsParagraph]);

  const handleInput = () => {
    const nextPage = readPaperEditorPage(editorRef.current);
    lastPageRef.current = nextPage;
    onUpdatePage(index, nextPage);
  };

  const handlePaste = (event) => {
    event.preventDefault();
    document.execCommand("insertText", false, event.clipboardData?.getData("text/plain") || "");
  };

  const handleBlur = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const nextPage = page || "";
    if (lastPageRef.current === nextPage && editor.children.length) return;
    renderPaperEditorPage(editor, nextPage, startsParagraph);
    lastPageRef.current = nextPage;
  };

  return (
    <div
      ref={editorRef}
      className="paged-manuscript paper-rich-manuscript"
      contentEditable
      suppressContentEditableWarning
      spellCheck="false"
      aria-label={`본문 ${index + 1}쪽`}
      style={{
        fontSize: `${editorFontPx}px`,
        fontFamily: fontStack(editorFontFamily),
      }}
      onFocus={() => onFocusPage(index)}
      onBlur={handleBlur}
      onInput={handleInput}
      onPaste={handlePaste}
    />
  );
}

function PagedPaperPreview({ body, paper, editorFontSize, editorFontFamily }) {
  const pages = paginateText(body, paper, editorFontSize);
  const { charsPerLine, firstLineChars } = getPaperTextMetrics(paper, editorFontSize);
  const editorFontPx = ptToPx(editorFontSize);
  const lineHeightPx = editorFontPx * paper.lineHeight * (getPaperPreset(paper)?.lineHeightCorrection || 1);
  const pageStarts = pages.reduce((starts, page, index) => {
    starts.push(index === 0 ? 0 : starts[index - 1] + pages[index - 1].length);
    return starts;
  }, []);
  const pageStartsParagraph = (index) => index === 0 || body[pageStarts[index] - 1] === "\n";

  return (
    <div className="paper-pages" aria-label="원고 미리 보기">
      {pages.map((page, index) => (
        <div className="paper-page-frame" key={index}>
          <div className="paper-page preview-only">
            <div className="page-number">{index + 1}</div>
            <PaperTextPreview
              page={page}
              charsPerLine={charsPerLine}
              firstLineChars={firstLineChars}
              startsParagraph={pageStartsParagraph(index)}
              style={{
                fontSize: `${editorFontPx}px`,
                fontFamily: fontStack(editorFontFamily),
                "--page-line-height-px": `${lineHeightPx}px`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function PagedPaperManuscript({ body, paper, editorFontSize, editorFontFamily, onUpdateBody }) {
  const pages = paginateText(body, paper, editorFontSize);
  const [focusedPage, setFocusedPage] = useState(null);
  const editorFontPx = ptToPx(editorFontSize);
  const pageStarts = pages.reduce((starts, page, index) => {
    starts.push(index === 0 ? 0 : starts[index - 1] + pages[index - 1].length);
    return starts;
  }, []);
  const pageStartsParagraph = (index) => index === 0 || body[pageStarts[index] - 1] === "\n";

  const updatePage = (index, value) => {
    const start = pageStarts[index] || 0;
    const end = start + (pages[index]?.length || 0);
    onUpdateBody(`${body.slice(0, start)}${value}${body.slice(end)}`);
  };

  return (
    <div className="paper-pages" aria-label="페이지 원고">
      {pages.map((page, index) => (
        <div className="paper-page-frame" key={index}>
          <div className={`paper-page${focusedPage === index ? " editing" : ""}`}>
            <div className="page-number">{index + 1}</div>
            <PaperPageEditor
              page={page}
              index={index}
              startsParagraph={pageStartsParagraph(index)}
              editorFontPx={editorFontPx}
              editorFontFamily={editorFontFamily}
              onFocusPage={setFocusedPage}
              onUpdatePage={updatePage}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export { WritingView };
