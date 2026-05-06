import { createContext, useContext, useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";

import { DEFAULT_ATTENDANCE_SETTINGS, IS_ATTENDANCE_TEST_MODE } from "../constants";
import { db } from "../firebase";
import { normalizeAttendanceSettings } from "../utils";

const SettingsContext = createContext(undefined);
const STORAGE_KEY = "web_attendance_settings";
const SETTINGS_DOC_PATH = ["app_settings", "attendance"];

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_ATTENDANCE_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (IS_ATTENDANCE_TEST_MODE) {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        const parsed = stored ? JSON.parse(stored) : DEFAULT_ATTENDANCE_SETTINGS;
        setSettings(normalizeAttendanceSettings(parsed));
      } catch (error) {
        console.error("Error loading local attendance settings", error);
        setSettings(DEFAULT_ATTENDANCE_SETTINGS);
      } finally {
        setIsLoading(false);
      }

      return undefined;
    }

    setIsLoading(true);

    const unsubscribe = onSnapshot(
      doc(db, ...SETTINGS_DOC_PATH),
      (snapshot) => {
        const nextSettings = snapshot.exists()
          ? normalizeAttendanceSettings(snapshot.data())
          : DEFAULT_ATTENDANCE_SETTINGS;

        setSettings(nextSettings);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSettings));
        setIsLoading(false);
      },
      (error) => {
        console.error("Error loading attendance settings from Firestore", error);

        try {
          const stored = window.localStorage.getItem(STORAGE_KEY);
          if (stored) {
            setSettings(normalizeAttendanceSettings(JSON.parse(stored)));
          } else {
            setSettings(DEFAULT_ATTENDANCE_SETTINGS);
          }
        } catch (storageError) {
          console.error("Error loading local settings cache", storageError);
          setSettings(DEFAULT_ATTENDANCE_SETTINGS);
        } finally {
          setIsLoading(false);
        }
      }
    );

    return unsubscribe;
  }, []);

  async function saveSettings(nextSettings) {
    const normalized = normalizeAttendanceSettings(nextSettings);

    if (IS_ATTENDANCE_TEST_MODE) {
      setSettings(normalized);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      return normalized;
    }

    await setDoc(doc(db, ...SETTINGS_DOC_PATH), normalized, { merge: true });
    setSettings(normalized);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  }

  async function resetSettings() {
    return saveSettings(DEFAULT_ATTENDANCE_SETTINGS);
  }

  return (
    <SettingsContext.Provider
      value={{ isLoading, settings, saveSettings, resetSettings }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }

  return context;
}
