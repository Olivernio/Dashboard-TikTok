"use client"

import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select } from "@/components/ui/select"
import { Video, User, Play, Clock } from "lucide-react"
import { formatInTimeZone } from "date-fns-tz"
import { formatDistance } from "date-fns"
import { es } from "date-fns/locale"
import { useSettingsStore } from "@/store/use-settings-store"
import { cn } from "@/lib/utils"
import { useRouter, useSearchParams } from "next/navigation"

export function StreamSelector() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const timezone = useSettingsStore((state) => state.timezone)
  
  const selectedStreamerId = searchParams.get("streamer_id") || undefined
  const selectedStreamId = searchParams.get("stream_id") || undefined

  // Obtener todos los streamers
  const { data: streamers } = useQuery({
    queryKey: ["streamers"],
    queryFn: async () => {
      const res = await fetch("/api/streamers")
      return res.json()
    },
  })

  // Obtener streams (filtrados por streamer si hay uno seleccionado)
  const { data: streams } = useQuery({
    queryKey: ["streams", selectedStreamerId],
    queryFn: async () => {
      const url = selectedStreamerId
        ? `/api/streams?streamer_id=${selectedStreamerId}`
        : "/api/streams"
      const res = await fetch(url)
      return res.json()
    },
  })

  const handleStreamerChange = (streamerId: string) => {
    const params = new URLSearchParams()
    if (streamerId && streamerId !== "all") {
      params.set("streamer_id", streamerId)
    }
    // Limpiar stream_id cuando cambia el streamer
    router.push(`/dashboard?${params.toString()}`)
  }

  const handleStreamSelect = (streamId: string) => {
    const params = new URLSearchParams()
    if (selectedStreamerId) {
      params.set("streamer_id", selectedStreamerId)
    }
    params.set("stream_id", streamId)
    router.push(`/dashboard?${params.toString()}`)
  }

  const getStreamDuration = (stream: any) => {
    if (!stream.ended_at) {
      return formatDistance(new Date(stream.started_at), new Date(), {
        locale: es,
        addSuffix: false,
      })
    }
    const start = new Date(stream.started_at)
    const end = new Date(stream.ended_at)
    const diff = end.getTime() - start.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m`
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="flex items-center gap-2">
          <Video className="h-5 w-5" />
          Seleccionar Streamer y Stream
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col space-y-4 min-h-0 overflow-hidden">
        {/* Selector de Streamer */}
        <div className="flex-shrink-0">
          <label className="text-sm font-medium mb-2 block flex items-center gap-2">
            <User className="h-4 w-4" />
            Streamer
          </label>
          <Select
            value={selectedStreamerId || "all"}
            onChange={(e) => handleStreamerChange(e.target.value)}
          >
            <option value="all">Todos los streamers</option>
            {streamers?.map((streamer: any) => (
              <option key={streamer.id} value={streamer.id}>
                {streamer.display_name || streamer.username}
              </option>
            ))}
          </Select>
        </div>

        {/* Lista de Streams */}
        <div className="flex-1 flex flex-col min-h-0">
          <label className="text-sm font-medium mb-2 block flex items-center gap-2 flex-shrink-0">
            <Play className="h-4 w-4" />
            Streams {selectedStreamerId && `(${streams?.length || 0})`}
          </label>
          <div className="flex-1 space-y-2 overflow-y-auto min-h-0">
            {streams && streams.length > 0 ? (
              streams.map((stream: any) => {
                const isLive = !stream.ended_at
                const isSelected = stream.id === selectedStreamId
                return (
                  <div
                    key={stream.id}
                    onClick={() => handleStreamSelect(stream.id)}
                    className={cn(
                      "flex items-center gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer",
                      isLive && "border-green-500 bg-green-500/10",
                      isSelected && "ring-2 ring-primary"
                    )}
                  >
                    <div className="flex-shrink-0">
                      {stream.streamers?.profile_image_url ? (
                        <img
                          src={stream.streamers.profile_image_url}
                          alt={stream.streamers.username}
                          className="w-12 h-12 rounded-full"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                          <Video className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-sm truncate">
                          {formatInTimeZone(
                            new Date(stream.started_at),
                            timezone,
                            "PP",
                            { locale: es }
                          )}
                        </h4>
                        <span className="text-sm text-muted-foreground">
                          {formatInTimeZone(
                            new Date(stream.started_at),
                            timezone,
                            "HH:mm",
                            { locale: es }
                          )}
                        </span>
                        {stream.part_count && stream.part_count > 1 && (
                          <span className="px-2 py-0.5 text-xs font-medium bg-blue-500/20 text-blue-700 dark:text-blue-300 rounded">
                            {stream.part_count} partes
                          </span>
                        )}
                        {isLive && (
                          <span className="px-2 py-0.5 text-xs font-semibold bg-green-500 text-white rounded">
                            EN VIVO
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        @{stream.streamers?.username || "unknown"}
                      </p>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {selectedStreamerId
                  ? "No hay streams para este streamer"
                  : "No hay streams disponibles"}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

