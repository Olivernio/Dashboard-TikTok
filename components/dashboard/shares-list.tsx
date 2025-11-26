"use client"

import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useState } from "react"
import { Share2, Search } from "lucide-react"
import { formatInTimeZone } from "date-fns-tz"
import { useSettingsStore } from "@/store/use-settings-store"
import { es } from "date-fns/locale"

interface SharesListProps {
  streamId?: string
  streamerId?: string
}

export function SharesList({ streamId, streamerId }: SharesListProps) {
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
    queryKey: ["shares", streamId, streamerId],
    queryFn: async () => {
      let url = "/api/events?event_type=share&limit=100"
      if (streamId) {
        url = `/api/events?event_type=share&stream_id=${streamId}&limit=100`
      } else if (streamerId) {
        url = `/api/events?event_type=share&streamer_id=${streamerId}&limit=100`
      }
      const res = await fetch(url)
      return res.json()
    },
    // Solo hacer refetch automático si es stream activo
    refetchInterval: (streamId && !isActiveStream) ? false : 5000,
  })

  const filteredShares = events?.filter((event: any) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      event.users?.username?.toLowerCase().includes(term) ||
      event.users?.display_name?.toLowerCase().includes(term) ||
      event.content?.toLowerCase().includes(term) ||
      event.metadata?.share_type?.toLowerCase().includes(term)
    )
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Compartidos</CardTitle>
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
          <Share2 className="h-5 w-5" />
          Compartidos ({filteredShares?.length || 0})
        </CardTitle>
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por usuario o tipo de compartido..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 max-h-[600px] overflow-y-auto">
          {filteredShares && filteredShares.length > 0 ? (
            filteredShares.map((event: any) => (
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
                    <Share2 className="h-6 w-6 text-muted-foreground" />
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
                    <div className="text-right">
                      <div className="flex items-center gap-2 text-sm font-medium text-primary">
                        <Share2 className="h-4 w-4" />
                        <span>{event.content || "Compartido"}</span>
                      </div>
                      {event.metadata?.share_type && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Tipo: {event.metadata.share_type}
                        </p>
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
              No hay compartidos para mostrar
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

