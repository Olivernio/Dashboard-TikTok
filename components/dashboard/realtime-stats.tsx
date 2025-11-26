"use client"

import { useEffect } from "react"
import { useQueryClient, useQuery } from "@tanstack/react-query"

interface RealtimeStatsProps {
  streamId?: string
}

export function RealtimeStats({ streamId }: RealtimeStatsProps) {
  const queryClient = useQueryClient()

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

  // Determinar si es stream activo
  const isActiveStream = stream?.is_active || stream?.ended_at === null

  useEffect(() => {
    // Solo hacer polling si es stream activo o si no hay streamId (dashboard global)
    // Para streams históricos, no hacer polling (datos estáticos)
    if (streamId && !isActiveStream) {
      return // No hacer polling para streams históricos
    }

    // Para desarrollo local, usamos polling en lugar de WebSockets
    // En producción con Supabase, puedes usar Realtime
    const interval = setInterval(() => {
      // Invalidar queries para refrescar datos
      queryClient.invalidateQueries({ queryKey: ["stats", streamId] })
      queryClient.invalidateQueries({ queryKey: ["events-chart", streamId] })
      queryClient.invalidateQueries({ queryKey: ["donations", streamId] })
      queryClient.invalidateQueries({ queryKey: ["streams"] })
      queryClient.invalidateQueries({ queryKey: ["chat-events-initial", streamId] })
    }, 3000) // Poll cada 3 segundos

    return () => {
      clearInterval(interval)
    }
  }, [queryClient, streamId, isActiveStream])

  return null // This component doesn't render anything
}

