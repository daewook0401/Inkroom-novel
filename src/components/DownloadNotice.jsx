function DownloadNotice({ message, onClose }) {
  return (
    <div className="download-notice" role="status" aria-live="polite">
      <span>{message}</span>
      <button type="button" onClick={onClose} aria-label="알림 닫기">×</button>
    </div>
  );
}

export { DownloadNotice };

