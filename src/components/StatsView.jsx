import { countText } from "../lib/inkroomCore.js";

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

export { StatsView, StatsGrid };
