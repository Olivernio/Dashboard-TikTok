"use client"

import { useEffect, useState, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { MessageSquare, Search, Send } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { formatInTimeZone } from "date-fns-tz"
import { useSettingsStore } from "@/store/use-settings-store"
import { supabase } from "@/lib/db"

interface ChatViewProps {
  streamId?: string
  isLive?: boolean
}

export function ChatView({ streamId, isLive = false }: ChatViewProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [events, setEvents] = useState<any[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const timezone = useSettingsStore((state) => state.timezone)

  // Fetch initial events
  const { data: initialEvents, isLoading } = useQuery({
    queryKey: ["chat-events", streamId],
    queryFn: async () => {
      if (!streamId) return []
      const res = await fetch(`/api/events?stream_id=${streamId}&event_type=comment&limit=100`)
      return res.json()
    },
    enabled: !!streamId,
  })

  useEffect(() => {
    if (initialEvents) {
      setEvents(initialEvents)
    }
  }, [initialEvents])

  // Set up realtime subscription for live streams
  useEffect(() => {
    if (!isLive || !streamId) return

    const channel = supabase
      .channel(`stream-${streamId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "events",
          filter: `stream_id=eq.${streamId}`,
        },
        (payload) => {
          // Fetch the full event with user data
          fetch(`/api/events?stream_id=${streamId}&limit=1`)
            .then((res) => res.json())
            .then((data) => {
              if (data && data[0]) {
                setEvents((prev) => [data[0], ...prev].slice(0, 200))
                // Auto-scroll to bottom
                setTimeout(() => {
                  messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
                }, 100)
              }
            })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [isLive, streamId])

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (isLive) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [events, isLive])

  const filteredEvents = events.filter((event) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      event.content?.toLowerCase().includes(term) ||
      event.users?.username?.toLowerCase().includes(term) ||
      event.users?.display_name?.toLowerCase().includes(term)
    )
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Chat
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">Cargando chat...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="flex flex-col h-[800px]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Chat {isLive && <span className="text-sm font-normal text-green-500">● En Vivo</span>}
        </CardTitle>
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar en el chat..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {filteredEvents.length > 0 ? (
            <>
              {filteredEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors"
                >
                  {event.users?.profile_image_url ? (
                    <img
                      src={event.users.profile_image_url}
                      alt={event.users.username}
                      className="w-10 h-10 rounded-full flex-shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-muted flex-shrink-0 flex items-center justify-center">
                      <span className="text-xs">
                        {event.users?.display_name?.[0] || event.users?.username?.[0] || "?"}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">
                        {event.users?.display_name || event.users?.username || "Usuario desconocido"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        @{event.users?.username || "unknown"}
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {formatInTimeZone(
                          new Date(event.created_at),
                          timezone,
                          "HH:mm",
                          { locale: es }
                        )}
                      </span>
                    </div>
                    <p className="text-sm mt-1 break-words">{event.content}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? "No se encontraron mensajes" : "No hay mensajes en el chat"}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

