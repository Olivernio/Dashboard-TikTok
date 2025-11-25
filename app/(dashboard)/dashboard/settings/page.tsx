"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select } from "@/components/ui/select"
import { useSettingsStore } from "@/store/use-settings-store"
import { useTheme } from "next-themes"
import { Settings, Moon, Sun, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"

const timezones = [
  { value: "America/Santiago", label: "Chile (Santiago)" },
  { value: "America/Mexico_City", label: "México (Ciudad de México)" },
  { value: "America/Argentina/Buenos_Aires", label: "Argentina (Buenos Aires)" },
  { value: "America/Lima", label: "Perú (Lima)" },
  { value: "America/Bogota", label: "Colombia (Bogotá)" },
  { value: "America/Caracas", label: "Venezuela (Caracas)" },
  { value: "America/New_York", label: "Estados Unidos (Nueva York)" },
  { value: "America/Los_Angeles", label: "Estados Unidos (Los Ángeles)" },
  { value: "Europe/Madrid", label: "España (Madrid)" },
  { value: "UTC", label: "UTC" },
]

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const timezone = useSettingsStore((state) => state.timezone)
  const setTimezone = useSettingsStore((state) => state.setTimezone)

  useEffect(() => {
    setMounted(true)
    // Try to detect user timezone
    try {
      const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      if (!timezone || timezone === "America/Santiago") {
        // Only set if not already configured or is default
        if (detectedTimezone && timezones.some(tz => tz.value === detectedTimezone)) {
          setTimezone(detectedTimezone)
        }
      }
    } catch (e) {
      // Fallback to default
      console.log("Could not detect timezone, using default")
    }
  }, [setTimezone, timezone])

  if (!mounted) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="py-12">
            <div className="text-center">Cargando...</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Configuración</h1>
          <p className="text-muted-foreground">
            Personaliza la apariencia y preferencias de la aplicación
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Theme Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Apariencia
            </CardTitle>
            <CardDescription>
              Elige entre tema claro u oscuro
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sun className="h-4 w-4" />
                <span>Tema Claro</span>
              </div>
              <Button
                variant={theme === "light" ? "default" : "outline"}
                onClick={() => setTheme("light")}
              >
                Activar
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Moon className="h-4 w-4" />
                <span>Tema Oscuro</span>
              </div>
              <Button
                variant={theme === "dark" ? "default" : "outline"}
                onClick={() => setTheme("dark")}
              >
                Activar
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <span>Sistema</span>
              </div>
              <Button
                variant={theme === "system" ? "default" : "outline"}
                onClick={() => setTheme("system")}
              >
                Activar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Timezone Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Zona Horaria
            </CardTitle>
            <CardDescription>
              Selecciona tu zona horaria para mostrar las fechas correctamente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <label htmlFor="timezone" className="text-sm font-medium">
                Zona Horaria
              </label>
              <select
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {timezones.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-2">
                Zona horaria actual: {timezone}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Información</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            • El tema se guarda automáticamente en tu navegador
          </p>
          <p>
            • La zona horaria se guarda localmente y se usa para mostrar todas las fechas
          </p>
          <p>
            • Si no se detecta tu zona horaria automáticamente, se usará Chile (Santiago) por defecto
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

