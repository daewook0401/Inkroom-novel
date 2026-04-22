import { NavLink, useParams } from "react-router-dom";
import { useState } from "react";
import { SETTINGS_SECTIONS, uid } from "../lib/inkroomCore.js";

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

export { SettingsView };
