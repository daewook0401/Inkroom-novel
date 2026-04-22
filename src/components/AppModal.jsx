import { useEffect, useRef, useState } from "react";

export function AppModal({ modal, onResolve }) {
  const [value, setValue] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (!modal) return;
    setValue(modal.defaultValue || "");
    window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select?.();
    }, 0);
  }, [modal]);

  if (!modal) return null;

  const confirmText = modal.confirmText || "확인";
  const cancelText = modal.cancelText || "취소";

  const submitText = (event) => {
    event.preventDefault();
    onResolve(value);
  };

  return (
    <div className="app-modal-backdrop" role="presentation">
      <section className="app-modal" role="dialog" aria-modal="true" aria-labelledby="app-modal-title">
        <header>
          <h2 id="app-modal-title">{modal.title}</h2>
          {modal.message && <p>{modal.message}</p>}
        </header>

        {modal.kind === "text" && (
          <form className="app-modal-form" onSubmit={submitText}>
            {modal.label && <label htmlFor="app-modal-input">{modal.label}</label>}
            <input
              id="app-modal-input"
              ref={inputRef}
              value={value}
              placeholder={modal.placeholder || ""}
              onChange={(event) => setValue(event.target.value)}
            />
            <div className="app-modal-actions">
              <button type="button" className="text-button" onClick={() => onResolve(null)}>
                {cancelText}
              </button>
              <button type="submit" className="primary-button">
                {confirmText}
              </button>
            </div>
          </form>
        )}

        {modal.kind === "choice" && (
          <>
            <div className="app-modal-choice-list">
              {modal.choices.map((choice) => (
                <button
                  key={choice.value}
                  type="button"
                  className="app-modal-choice"
                  onClick={() => onResolve(choice.value)}
                >
                  <strong>{choice.label}</strong>
                  {choice.description && <span>{choice.description}</span>}
                </button>
              ))}
            </div>
            <div className="app-modal-actions">
              <button type="button" className="text-button" onClick={() => onResolve(null)}>
                {cancelText}
              </button>
            </div>
          </>
        )}

        {modal.kind === "message" && (
          <div className="app-modal-actions">
            <button type="button" className="primary-button" onClick={() => onResolve(true)} autoFocus>
              {confirmText}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
