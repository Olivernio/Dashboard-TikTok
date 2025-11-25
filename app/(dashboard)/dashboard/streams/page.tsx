"use client"

import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Video, Search, Play, Clock, Users, Gift, MessageSquare } from "lucide-react"
import { formatInTimeZone } from "date-fns-tz"
import { format, formatDistance } from "date-fns"
import { es } from "date-fns/locale"
import { useSettingsStore } from "@/store/use-settings-store"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

export default function StreamsPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedStreamer, setSelectedStreamer] = useState<string>("all")
  const timezone = useSettingsStore((state) => state.timezone)
  const router = useRouter()

  const { data: streams, isLoading: streamsLoading } = useQuery({
    queryKey: ["streams"],
    queryFn: async () => {
      const res = await fetch("/api/streams")
      return res.json()
    },
    refetchInterval: 10000,
  })

  const { data: streamers } = useQuery({
    queryKey: ["streamers"],
    queryFn: async () => {
      const res = await fetch("/api/streamers")
      return res.json()
    },
  })

  const filteredStreams = streams?.filter((stream: any) => {
    const matchesSearch =
      !searchTerm ||
      stream.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      stream.streamers?.username?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStreamer =
      selectedStreamer === "all" || stream.streamer_id === selectedStreamer

    return matchesSearch && matchesStreamer
  })

  const handleSelectStream = (streamId: string) => {
    router.push(`/dashboard?stream_id=${streamId}`)
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

  if (streamsLoading) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardContent className="py-12">
            <div className="text-center">Cargando streams...</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Streams</h1>
          <p className="text-muted-foreground">
            Lista de todos los directos registrados
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            Streams Registrados ({filteredStreams?.length || 0})
          </CardTitle>
          <div className="flex gap-4 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por título o streamer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={selectedStreamer}
              onChange={(e) => setSelectedStreamer(e.target.value)}
              className="px-4 py-2 rounded-md border border-input bg-background"
            >
              <option value="all">Todos los streamers</option>
              {streamers?.map((streamer: any) => (
                <option key={streamer.id} value={streamer.id}>
                  {streamer.display_name || streamer.username}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredStreams && filteredStreams.length > 0 ? (
              filteredStreams.map((stream: any) => {
                const isLive = !stream.ended_at
                return (
                  <div
                    key={stream.id}
                    className={cn(
                      "flex items-center gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer",
                      isLive && "border-green-500 bg-green-500/10"
                    )}
                    onClick={() => handleSelectStream(stream.id)}
                  >
                    <div className="flex-shrink-0">
                      {stream.streamers?.profile_image_url ? (
                        <img
                          src={stream.streamers.profile_image_url}
                          alt={stream.streamers.username}
                          className="w-16 h-16 rounded-full"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                          <Video className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-lg">
                          {stream.title || "Stream sin título"}
                        </h3>
                        {isLive && (
                          <span className="px-2 py-1 text-xs font-semibold bg-green-500 text-white rounded">
                            EN VIVO
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        @{stream.streamers?.username || "unknown"}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          <span>
                            {formatInTimeZone(
                              new Date(stream.started_at),
                              timezone,
                              "PPp",
                              { locale: es }
                            )}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Play className="h-4 w-4" />
                          <span>{getStreamDuration(stream)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <div className="flex items-center gap-1 text-muted-foreground mb-1">
                          <MessageSquare className="h-4 w-4" />
                          <span className="font-semibold">{stream.total_events || 0}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">Eventos</div>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center gap-1 text-muted-foreground mb-1">
                          <Gift className="h-4 w-4" />
                          <span className="font-semibold">{stream.total_donations || 0}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">Donaciones</div>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center gap-1 text-muted-foreground mb-1">
                          <Users className="h-4 w-4" />
                          <span className="font-semibold">{stream.total_follows || 0}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">Follows</div>
                      </div>
                    </div>
                    <Button variant="outline" onClick={(e) => {
                      e.stopPropagation()
                      handleSelectStream(stream.id)
                    }}>
                      Ver Detalles
                    </Button>
                  </div>
                )
              })
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No se encontraron streams
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

