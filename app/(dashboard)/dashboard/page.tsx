"use client"

import { StatsCards } from "@/components/dashboard/stats-cards"
import { CommentsChart } from "@/components/dashboard/comments-chart"
import { DonationsList } from "@/components/dashboard/donations-list"
import { JoinsList } from "@/components/dashboard/joins-list"
import { SharesList } from "@/components/dashboard/shares-list"
import { ViewersChart } from "@/components/dashboard/viewers-chart"
import { ChatView } from "@/components/chat/chat-view"
import { RealtimeStats } from "@/components/dashboard/realtime-stats"
import { CollapsibleSidebar } from "@/components/dashboard/collapsible-sidebar"
import { StreamSelector } from "@/components/dashboard/stream-selector"
import { useSearchParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"

export default function DashboardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selectedStreamId, setSelectedStreamId] = useState<string | undefined>(
    searchParams.get("stream_id") || undefined
  )
  const [selectedStreamerId, setSelectedStreamerId] = useState<string | undefined>(
    searchParams.get("streamer_id") || undefined
  )
  const [hasAutoSelected, setHasAutoSelected] = useState(false)

  // Obtener todos los streams para encontrar el stream de hoy
  const { data: allStreams } = useQuery({
    queryKey: ["streams-for-auto-select"],
    queryFn: async () => {
      const res = await fetch("/api/streams")
      return res.json()
    },
  })

  // Lógica para encontrar el stream de hoy (más reciente activo o más reciente de hoy)
  useEffect(() => {
    // Solo auto-seleccionar si no hay parámetros en la URL y aún no se ha auto-seleccionado
    if (!searchParams.get("stream_id") && !searchParams.get("streamer_id") && !hasAutoSelected && allStreams) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // Buscar streams activos primero (ended_at === null)
      const activeStreams = allStreams.filter((s: any) => !s.ended_at)
      
      if (activeStreams.length > 0) {
        // Si hay streams activos, tomar el más reciente
        const mostRecentActive = activeStreams.sort((a: any, b: any) => 
          new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
        )[0]
        
        const params = new URLSearchParams()
        params.set("stream_id", mostRecentActive.id)
        if (mostRecentActive.streamer_id) {
          params.set("streamer_id", mostRecentActive.streamer_id)
        }
        router.push(`/dashboard?${params.toString()}`)
        setHasAutoSelected(true)
        return
      }

      // Si no hay activos, buscar streams de hoy (started_at >= hoy 00:00)
      const todayStreams = allStreams.filter((s: any) => {
        const streamDate = new Date(s.started_at)
        streamDate.setHours(0, 0, 0, 0)
        return streamDate.getTime() === today.getTime()
      })

      if (todayStreams.length > 0) {
        // Tomar el más reciente de hoy
        const mostRecentToday = todayStreams.sort((a: any, b: any) => 
          new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
        )[0]
        
        const params = new URLSearchParams()
        params.set("stream_id", mostRecentToday.id)
        if (mostRecentToday.streamer_id) {
          params.set("streamer_id", mostRecentToday.streamer_id)
        }
        router.push(`/dashboard?${params.toString()}`)
        setHasAutoSelected(true)
        return
      }

      // Si no hay streams de hoy, marcar como auto-seleccionado para no intentar de nuevo
      setHasAutoSelected(true)
    }
  }, [allStreams, searchParams, hasAutoSelected, router])

  const { data: stream } = useQuery({
    queryKey: ["stream", selectedStreamId],
    queryFn: async () => {
      if (!selectedStreamId) return null
      const res = await fetch(`/api/streams/${selectedStreamId}`)
      return res.json()
    },
    enabled: !!selectedStreamId,
  })

  // Obtener todos los stream_ids (principal + partes) para queries agregadas
  const allStreamIds = stream?.parts && stream.parts.length > 0
    ? [stream.id, ...stream.parts.map((p: any) => p.id)]
    : selectedStreamId
    ? [selectedStreamId]
    : undefined

  const isLive = stream && !stream.ended_at

  useEffect(() => {
    const streamId = searchParams.get("stream_id")
    const streamerId = searchParams.get("streamer_id")
    setSelectedStreamId(streamId || undefined)
    setSelectedStreamerId(streamerId || undefined)
  }, [searchParams])

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar izquierdo colapsable */}
      <CollapsibleSidebar>
        <StreamSelector />
      </CollapsibleSidebar>

      {/* Contenido principal */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <div className="border-b px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                {selectedStreamId
                  ? stream
                    ? `Stream: ${stream.title || "Sin título"} ${isLive ? "(En Vivo)" : ""}`
                    : "Vista del stream seleccionado"
                  : selectedStreamerId
                  ? "Vista del streamer seleccionado"
                  : "Vista general de todos los streams"}
              </p>
            </div>
            <RealtimeStats streamId={selectedStreamId} />
          </div>
        </div>

        {/* Contenido scrollable */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            <StatsCards streamId={selectedStreamId} streamerId={selectedStreamerId} />
            
            <div className="grid gap-6 md:grid-cols-2">
              <CommentsChart streamId={selectedStreamId} streamerId={selectedStreamerId} />
              <DonationsList streamId={selectedStreamId} streamerId={selectedStreamerId} />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <JoinsList streamId={selectedStreamId} streamerId={selectedStreamerId} />
              <SharesList streamId={selectedStreamId} streamerId={selectedStreamerId} />
            </div>

            {selectedStreamId && (
              <ViewersChart streamId={selectedStreamId} />
            )}
          </div>
        </div>
      </div>

      {/* Chat a la derecha (estilo Twitch) */}
      {selectedStreamId && (
        <div className="w-80 border-l bg-background flex flex-col flex-shrink-0">
          <ChatView streamId={selectedStreamId} isLive={isLive} />
        </div>
      )}
    </div>
  )
}
