import { useState, useEffect } from "react";

export function usePersistentPreferences<T>(key: string, initialValue: T): [T, (val: T) => void] {
  const [preference, setPreference] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(preference));
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, preference]);

  return [preference, setPreference];
}
