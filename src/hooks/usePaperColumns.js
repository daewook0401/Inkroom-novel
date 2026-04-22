import { useEffect, useRef, useState } from "react";

export function usePaperColumns({ enabled, pageWidth, zoom, gap = 22 }) {
  const ref = useRef(null);
  const [columns, setColumns] = useState(1);

  useEffect(() => {
    const target = ref.current;
    if (!target || !enabled || typeof ResizeObserver === "undefined") {
      setColumns(1);
      return undefined;
    }

    const updateColumns = (width) => {
      const scaledPageWidth = Math.max(1, pageWidth * zoom);
      const nextColumns = Math.max(1, Math.floor((width + gap) / (scaledPageWidth + gap)));
      setColumns(nextColumns);
    };

    const observer = new ResizeObserver(([entry]) => {
      updateColumns(entry.contentRect.width);
    });
    observer.observe(target);
    updateColumns(target.clientWidth || 0);
    return () => observer.disconnect();
  }, [enabled, gap, pageWidth, zoom]);

  return { ref, columns };
}
