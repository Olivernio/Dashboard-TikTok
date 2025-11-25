"use client"

import { StatsCards } from "@/components/dashboard/stats-cards"
import { EventsChart } from "@/components/dashboard/events-chart"
import { DonationsList } from "@/components/dashboard/donations-list"
import { ChatView } from "@/components/chat/chat-view"
import { RealtimeStats } from "@/components/dashboard/realtime-stats"
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { useQuery } from "@tanstack/react-query"

export default function DashboardPage() {
  const searchParams = useSearchParams()
  const [selectedStreamId, setSelectedStreamId] = useState<string | undefined>(
    searchParams.get("stream_id") || undefined
  )

  const { data: stream } = useQuery({
    queryKey: ["stream", selectedStreamId],
    queryFn: async () => {
      if (!selectedStreamId) return null
      const res = await fetch(`/api/streams/${selectedStreamId}`)
      return res.json()
    },
    enabled: !!selectedStreamId,
  })

  const isLive = stream && !stream.ended_at

  useEffect(() => {
    const streamId = searchParams.get("stream_id")
    setSelectedStreamId(streamId || undefined)
  }, [searchParams])

  return (
    <div className="container mx-auto py-6 space-y-6">
      <RealtimeStats streamId={selectedStreamId} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            {selectedStreamId
              ? stream
                ? `Stream: ${stream.title || "Sin título"} ${isLive ? "(En Vivo)" : ""}`
                : "Vista del stream seleccionado"
              : "Vista general de todos los streams"}
          </p>
        </div>
      </div>

      <StatsCards streamId={selectedStreamId} />

      <div className="grid gap-6 md:grid-cols-2">
        <EventsChart streamId={selectedStreamId} />
        <DonationsList streamId={selectedStreamId} />
      </div>

      {selectedStreamId && (
        <ChatView streamId={selectedStreamId} isLive={isLive} />
      )}
    </div>
  )
}
