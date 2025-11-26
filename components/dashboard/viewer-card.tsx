"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useQuery } from "@tanstack/react-query"
import { Eye } from "lucide-react"

interface ViewerCardProps {
  streamId?: string
}

export function ViewerCard({ streamId }: ViewerCardProps) {
  const { data: stream, isLoading } = useQuery({
    queryKey: ["stream", streamId],
    queryFn: async () => {
      if (!streamId) return null
      const res = await fetch(`/api/streams/${streamId}`)
      if (!res.ok) return null
      return res.json()
    },
    enabled: !!streamId,
    refetchInterval: 5000, // Actualizar cada 5 segundos si está activo
  })

  const isLive = stream && !stream.ended_at
  const viewerCount = stream?.viewer_count || 0

  if (!streamId) {
    return null
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Espectadores</CardTitle>
        <Eye className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {isLoading ? "-" : viewerCount.toLocaleString()}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {isLive ? "En vivo ahora" : "Último conteo"}
        </p>
      </CardContent>
    </Card>
  )
}

