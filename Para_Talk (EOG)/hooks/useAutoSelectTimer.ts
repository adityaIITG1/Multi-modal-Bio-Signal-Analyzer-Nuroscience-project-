import { useEffect, useState, useRef } from 'react';

export function useAutoSelectTimer(currentIndex: number, onSelect: () => void, isActive: boolean, delayMs = 2000) {
  const [progress, setProgress] = useState(0);
  const onSelectRef = useRef(onSelect);
  const hasFiredRef = useRef(false);

  // Always keep the latest callback without triggering effect re-runs
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!isActive) {
      setProgress(0);
      return;
    }

    setProgress(0);
    hasFiredRef.current = false;
    const intervalTime = 50;
    const step = (intervalTime / delayMs) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          return 100;
        }
        return prev + step;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [currentIndex, isActive, delayMs]);

  useEffect(() => {
    if (progress >= 100 && !hasFiredRef.current) {
      hasFiredRef.current = true;
      // Small timeout to allow UI update
      setTimeout(() => {
        if (onSelectRef.current) onSelectRef.current();
      }, 10);
    }
  }, [progress]);

  return progress;
}
