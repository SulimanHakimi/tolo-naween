'use client';

import { useEffect } from 'react';

// iOS Safari ignores `user-scalable=no`, so pinch, double-tap and trackpad-pinch
// zoom have to be cancelled by hand. Renders nothing.
export default function NoZoom() {
  useEffect(() => {
    // Pinch zoom on iOS Safari.
    const onGesture = (e) => { e.preventDefault(); };

    // Pinch zoom on browsers that fire multi-touch touchmove instead.
    const onTouchMove = (e) => {
      if (e.touches.length > 1) e.preventDefault();
    };

    // Double-tap zoom. Form fields keep native behaviour so double-tap can still
    // select a word while editing.
    let lastTouchEnd = 0;
    const onTouchEnd = (e) => {
      const now = Date.now();
      const editable = e.target.closest?.('input, textarea, select, [contenteditable="true"]');
      if (!editable && now - lastTouchEnd <= 300) e.preventDefault();
      lastTouchEnd = now;
    };

    // Ctrl/Cmd + wheel — trackpad pinch and mouse-wheel zoom on desktop.
    const onWheel = (e) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    };

    // Ctrl/Cmd with + - 0 — keyboard zoom on desktop. `code` is checked as well as
    // `key`, because the numpad +/- report differently across layouts and would
    // otherwise slip through.
    const ZOOM_KEYS = ['+', '=', '-', '_', '0'];
    const ZOOM_CODES = ['NumpadAdd', 'NumpadSubtract', 'Numpad0', 'Digit0', 'Equal', 'Minus'];
    const onKeyDown = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (ZOOM_KEYS.includes(e.key) || ZOOM_CODES.includes(e.code)) e.preventDefault();
    };

    const opts = { passive: false };
    document.addEventListener('gesturestart', onGesture, opts);
    document.addEventListener('gesturechange', onGesture, opts);
    document.addEventListener('gestureend', onGesture, opts);
    document.addEventListener('touchmove', onTouchMove, opts);
    document.addEventListener('touchend', onTouchEnd, opts);
    window.addEventListener('wheel', onWheel, opts);
    window.addEventListener('keydown', onKeyDown, opts);

    return () => {
      document.removeEventListener('gesturestart', onGesture, opts);
      document.removeEventListener('gesturechange', onGesture, opts);
      document.removeEventListener('gestureend', onGesture, opts);
      document.removeEventListener('touchmove', onTouchMove, opts);
      document.removeEventListener('touchend', onTouchEnd, opts);
      window.removeEventListener('wheel', onWheel, opts);
      window.removeEventListener('keydown', onKeyDown, opts);
    };
  }, []);

  return null;
}
