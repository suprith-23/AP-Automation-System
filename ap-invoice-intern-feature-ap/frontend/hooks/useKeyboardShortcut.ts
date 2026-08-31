import { useEffect } from "react";

type KeyCombo = {
  key: string;
  ctrlOrCmd?: boolean;
  shift?: boolean;
  alt?: boolean;
};

export function useKeyboardShortcut(combo: KeyCombo, callback: (e: KeyboardEvent) => void) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for modifier keys
      const hasCtrlOrCmd = combo.ctrlOrCmd ? (event.ctrlKey || event.metaKey) : !(event.ctrlKey || event.metaKey);
      const hasShift = combo.shift ? event.shiftKey : !event.shiftKey;
      const hasAlt = combo.alt ? event.altKey : !event.altKey;

      if (event.key.toLowerCase() === combo.key.toLowerCase() && hasCtrlOrCmd && hasShift && hasAlt) {
        event.preventDefault();
        callback(event);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [combo, callback]);
}
