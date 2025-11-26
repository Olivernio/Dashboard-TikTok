"use client"

import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useState } from "react"
import { Users, Search, Eye } from "lucide-react"
import { formatInTimeZone } from "date-fns-tz"
import { useSettingsStore } from "@/store/use-settings-store"
import { es } from "date-fns/locale"

interface JoinsListProps {
  streamId?: string
  streamerId?: string
}

export function JoinsList({ streamId, streamerId }: JoinsListProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const timezone = useSettingsStore((state) => state.timezone)

  // Obtener información del stream para determinar si está activo
  const { data: stream } = useQuery({
    queryKey: ["stream", streamId],
    queryFn: async () => {
      if (!streamId) return null
      const res = await fetch(`/api/streams/${streamId}`)
      if (!res.ok) return null
      return res.json()
    },
    enabled: !!streamId,
  })

  const isActiveStream = stream?.is_active || stream?.ended_at === null

  const { data: events, isLoading } = useQuery({
    queryKey: ["joins", streamId, streamerId],
    queryFn: async () => {
      let url = "/api/events?event_type=join&limit=100"
      if (streamId) {
        url = `/api/events?event_type=join&stream_id=${streamId}&limit=100`
      } else if (streamerId) {
        url = `/api/events?event_type=join&streamer_id=${streamerId}&limit=100`
      }
      const res = await fetch(url)
      return res.json()
    },
    // Solo hacer refetch automático si es stream activo
    refetchInterval: (streamId && !isActiveStream) ? false : 5000,
  })

  const filteredJoins = events?.filter((event: any) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      event.users?.username?.toLowerCase().includes(term) ||
      event.users?.display_name?.toLowerCase().includes(term) ||
      event.content?.toLowerCase().includes(term)
    )
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Usuarios que se Unieron</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">Cargando...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Usuarios que se Unieron ({filteredJoins?.length || 0})
        </CardTitle>
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por usuario..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 max-h-[600px] overflow-y-auto">
          {filteredJoins && filteredJoins.length > 0 ? (
            filteredJoins.map((event: any) => (
              <div
                key={event.id}
                className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                {event.users?.profile_image_url ? (
                  <img
                    src={event.users.profile_image_url}
                    alt={event.users.username}
                    className="w-12 h-12 rounded-full"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <Users className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">
                        {event.users?.display_name || event.users?.username || "Usuario desconocido"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        @{event.users?.username || "unknown"}
                      </p>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      {event.metadata?.viewer_count !== null && event.metadata?.viewer_count !== undefined && (
                        <div className="flex items-center gap-1 mb-1">
                          <Eye className="h-3 w-3" />
                          <span>{event.metadata.viewer_count.toLocaleString()} viewers</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    {event.users?.follower_count != null && typeof event.users.follower_count === 'number' && (
                      <span>{event.users.follower_count.toLocaleString()} seguidores</span>
                    )}
                    {event.users?.following_count != null && typeof event.users.following_count === 'number' && (
                      <span>{event.users.following_count.toLocaleString()} siguiendo</span>
                    )}
                    {event.users?.is_following_streamer && (
                      <span className="text-green-500">✓ Sigue al streamer</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatInTimeZone(
                      new Date(event.created_at),
                      timezone,
                      "PPpp",
                      { locale: es }
                    )}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No hay usuarios que se hayan unido para mostrar
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

