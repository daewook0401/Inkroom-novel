import { useEffect, useRef, useState } from "react";

export function getResponsiveMode(width) {
  if (width < 760) return "compact";
  if (width < 1180) return "medium";
  return "wide";
}

export function useResponsiveMode() {
  const ref = useRef(null);
  const [mode, setMode] = useState(() =>
    typeof window === "undefined" ? "wide" : getResponsiveMode(window.innerWidth),
  );

  useEffect(() => {
    const target = ref.current;
    if (!target || typeof ResizeObserver === "undefined") return undefined;

    const observer = new ResizeObserver(([entry]) => {
      setMode(getResponsiveMode(entry.contentRect.width));
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return { ref, mode };
}
