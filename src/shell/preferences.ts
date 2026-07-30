export interface AppPreferences {
  compactLayout: boolean;
  reduceMotion: boolean;
}

export const defaultPreferences: AppPreferences = { compactLayout: false, reduceMotion: false };

/**
 * Preferences are intentionally best-effort. Corrupt or older local storage must
 * never prevent the Studio UI from starting, so unsupported values fall back safely.
 */
export const loadPreferences = (): AppPreferences => {
  try {
    const parsed = JSON.parse(localStorage.getItem("jl-mixing-studio.preferences") ?? "null") as Partial<AppPreferences> | null;
    return {
      compactLayout: parsed?.compactLayout === true,
      reduceMotion: parsed?.reduceMotion === true,
    };
  } catch {
    return defaultPreferences;
  }
};
