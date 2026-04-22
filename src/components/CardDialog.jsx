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

export { CardDialog };

