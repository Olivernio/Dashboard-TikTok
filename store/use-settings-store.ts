import { create } from "zustand"
import { persist } from "zustand/middleware"

interface SettingsState {
  timezone: string
  setTimezone: (timezone: string) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      timezone: "America/Santiago",
      setTimezone: (timezone) => set({ timezone }),
    }),
    {
      name: "settings-storage",
    }
  )
)

