"use client"

import { useEffect, useState, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { MessageSquare, Search, Send, ArrowDown, Lock, Unlock } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { formatInTimeZone } from "date-fns-tz"
import { useSettingsStore } from "@/store/use-settings-store"
import { UserChatModal } from "@/components/chat/user-chat-modal"

interface ChatViewProps {
  streamId?: string
  isLive?: boolean
}

export function ChatView({ streamId, isLive = false }: ChatViewProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [events, setEvents] = useState<any[]>([])
  const [lastFetchTime, setLastFetchTime] = useState<Date>(new Date())
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [autoScroll, setAutoScroll] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const timezone = useSettingsStore((state) => state.timezone)

  // Obtener información del stream para detectar si está activo
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

  // Determinar si es stream activo (prioridad: prop isLive > stream.is_active > stream.ended_at)
  const isActiveStream = isLive || stream?.is_active || stream?.ended_at === null

  // MODO BATCH: Cargar todos los eventos de una vez para streams históricos
  const { data: batchEvents, isLoading: isLoadingBatch } = useQuery({
    queryKey: ["chat-events-batch", streamId],
    queryFn: async () => {
      if (!streamId || isActiveStream) return []
      // Para streams históricos, cargar más eventos (hasta 1000)
      const res = await fetch(`/api/events?stream_id=${streamId}&event_type=comment&limit=1000&include=user`)
      return res.json()
    },
    enabled: !!streamId && !isActiveStream,
  })

  // MODO TIEMPO REAL: Carga inicial para streams activos
  const { data: initialEvents, isLoading: isLoadingInitial } = useQuery({
    queryKey: ["chat-events-initial", streamId],
    queryFn: async () => {
      if (!streamId || !isActiveStream) return []
      // Para streams activos, cargar últimos 100 eventos
      const res = await fetch(`/api/events?stream_id=${streamId}&event_type=comment&limit=100&include=user`)
      return res.json()
    },
    enabled: !!streamId && isActiveStream,
  })

  // Actualizar eventos cuando cambian los datos batch o iniciales
  useEffect(() => {
    if (batchEvents && !isActiveStream) {
      // Ordenar por fecha (más antiguos primero, más nuevos al final)
      const sorted = [...batchEvents].sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
      setEvents(sorted)
      setLastFetchTime(new Date())
    } else if (initialEvents && isActiveStream) {
      // Ordenar por fecha (más antiguos primero, más nuevos al final)
      const sorted = [...initialEvents].sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
      setEvents(sorted)
      setLastFetchTime(new Date())
    }
  }, [batchEvents, initialEvents, isActiveStream])

  // MODO TIEMPO REAL: Polling solo para streams activos usando parámetro "since"
  useEffect(() => {
    if (!isActiveStream || !streamId) return

    const interval = setInterval(() => {
      // Solo obtener eventos nuevos desde el último fetch
      const since = lastFetchTime.toISOString()
      fetch(`/api/events?stream_id=${streamId}&event_type=comment&since=${since}&limit=50&include=user`)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.length > 0) {
            // Agregar solo eventos nuevos (no duplicados)
            setEvents((prev) => {
              const existingIds = new Set(prev.map((e: any) => e.id))
              const newEvents = data.filter((e: any) => !existingIds.has(e.id))
              if (newEvents.length > 0) {
                // Agregar nuevos eventos al final y ordenar por fecha
                const updated = [...prev, ...newEvents]
                  .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                  .slice(-500) // Mantener máximo 500 eventos (los más recientes)
                setLastFetchTime(new Date())
                return updated
              }
              return prev
            })
            // Auto-scroll to bottom cuando hay nuevos mensajes (solo si auto-scroll está activado y está en el fondo)
            if (autoScroll && isAtBottom) {
              setTimeout(() => {
                scrollToBottom()
              }, 100)
            }
          }
        })
        .catch((err) => console.error("Error fetching events:", err))
    }, 2000) // Poll cada 2 segundos para chat en tiempo real

    return () => {
      clearInterval(interval)
    }
  }, [isActiveStream, streamId, lastFetchTime])

  // Función para hacer scroll al fondo
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    setIsAtBottom(true)
  }

  // Detectar si el usuario está en el fondo del scroll
  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100 // 100px de margen
      setIsAtBottom(isNearBottom)
    }

    container.addEventListener("scroll", handleScroll)
    // Verificar posición inicial
    handleScroll()

    return () => {
      container.removeEventListener("scroll", handleScroll)
    }
  }, [])

  // Auto-scroll cuando hay nuevos eventos (solo si auto-scroll está activado)
  useEffect(() => {
    if (autoScroll && isAtBottom && events.length > 0) {
      scrollToBottom()
    }
  }, [events.length, autoScroll, isAtBottom])

  // Filtrar eventos y mantener orden (más antiguos arriba, más nuevos abajo)
  const filteredEvents = events
    .filter((event) => {
      if (!searchTerm) return true
      const term = searchTerm.toLowerCase()
      return (
        event.content?.toLowerCase().includes(term) ||
        event.users?.username?.toLowerCase().includes(term) ||
        event.users?.display_name?.toLowerCase().includes(term)
      )
    })
    // Asegurar que estén ordenados por fecha (más antiguos primero)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  const isLoading = isLoadingBatch || isLoadingInitial

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            <h3 className="font-semibold">Chat</h3>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground text-sm">Cargando chat...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-4 py-3">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="h-5 w-5" />
          <h3 className="font-semibold">
            Chat {isLive && <span className="text-sm font-normal text-green-500">● En Vivo</span>}
          </h3>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar en el chat..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 h-9 text-sm"
          />
        </div>
      </div>
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-2 space-y-2 relative"
      >
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
                      <button
                        onClick={() => event.users?.id && setSelectedUserId(event.users.id)}
                        className="font-semibold text-sm hover:underline cursor-pointer text-left"
                      >
                        {event.users?.display_name || event.users?.username || "Usuario desconocido"}
                      </button>
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
            <div className="text-center py-8 text-muted-foreground text-sm">
              {searchTerm ? "No se encontraron mensajes" : "No hay mensajes en el chat"}
            </div>
          )}
          
          {/* Botones de control de scroll */}
          <div className="absolute bottom-4 right-4 flex flex-col gap-2">
            {!isAtBottom && (
              <Button
                onClick={scrollToBottom}
                size="icon"
                className="h-9 w-9 rounded-full shadow-lg"
                title="Ir al final del chat"
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
            )}
            <Button
              onClick={() => setAutoScroll(!autoScroll)}
              size="icon"
              variant={autoScroll ? "default" : "secondary"}
              className="h-9 w-9 rounded-full shadow-lg"
              title={autoScroll ? "Desactivar auto-scroll" : "Activar auto-scroll"}
            >
              {autoScroll ? (
                <Unlock className="h-4 w-4" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
            </Button>
          </div>
      </div>
      
      {/* Modal de usuario */}
      <UserChatModal
        userId={selectedUserId}
        streamId={streamId || null}
        isOpen={!!selectedUserId}
        onClose={() => setSelectedUserId(null)}
      />
    </div>
  )
}

