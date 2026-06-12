import { useEffect, useState, useCallback } from 'react';

export function useSpacebarBlinkControl(optionsLength: number, isActive: boolean) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const moveToNext = useCallback(() => {
    if (!isActive || optionsLength === 0) return;
    setCurrentIndex((prev) => (prev + 1) % optionsLength);
  }, [isActive, optionsLength]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        moveToNext();
      }
    };

    if (isActive) {
      window.addEventListener('keydown', handleKeyDown);
    }
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActive, moveToNext]);

  // Reset index if options change significantly
  useEffect(() => {
    if (currentIndex >= optionsLength && optionsLength > 0) {
      setCurrentIndex(0);
    }
  }, [optionsLength, currentIndex]);

  return { currentIndex, setCurrentIndex, moveToNext };
}
