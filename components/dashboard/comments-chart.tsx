"use client"

import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { MessageSquare } from "lucide-react"

interface CommentsChartProps {
  streamId?: string
  streamerId?: string
}

export function CommentsChart({ streamId, streamerId }: CommentsChartProps) {
  const [hours, setHours] = useState(24)

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

  const { data, isLoading } = useQuery({
    queryKey: ["comments-chart", streamId, streamerId, hours],
    queryFn: async () => {
      let url = `/api/events?event_type=comment&limit=10000`
      if (streamId) {
        url += `&stream_id=${streamId}`
      } else if (streamerId) {
        url += `&streamer_id=${streamerId}`
      }
      const res = await fetch(url)
      if (!res.ok) {
        throw new Error(`Failed to fetch comments: ${res.statusText}`)
      }
      const jsonData = await res.json()
      return Array.isArray(jsonData) ? jsonData : []
    },
    refetchInterval: (streamId && !isActiveStream) ? false : 5000,
  })

  // Agrupar comentarios por hora
  const chartData = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) return []

    const now = new Date()
    const startTime = new Date(now.getTime() - hours * 60 * 60 * 1000)
    
    // Filtrar comentarios dentro del rango de horas
    const filteredComments = data.filter((comment: any) => {
      const commentDate = new Date(comment.created_at)
      return commentDate >= startTime
    })

    // Agrupar por hora
    const grouped: Record<string, number> = {}
    filteredComments.forEach((comment: any) => {
      const date = new Date(comment.created_at)
      date.setMinutes(0, 0, 0)
      const hourKey = date.toISOString()
      grouped[hourKey] = (grouped[hourKey] || 0) + 1
    })

    // Generar todas las horas del rango
    const result: Array<{ time: string; comentarios: number }> = []
    const current = new Date(startTime)
    current.setMinutes(0, 0, 0)
    
    while (current <= now) {
      const hourKey = current.toISOString()
      result.push({
        time: format(current, "HH:mm", { locale: es }),
        comentarios: grouped[hourKey] || 0,
      })
      current.setHours(current.getHours() + 1)
    }

    return result
  }, [data, hours])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Comentarios en el Tiempo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            Cargando...
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Comentarios en el Tiempo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            {isActiveStream 
              ? "Esperando comentarios..." 
              : "No hay comentarios para mostrar"}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="space-y-4">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Comentarios en el Tiempo
          </CardTitle>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Rango de tiempo:</span>
              <span className="font-semibold">{hours} {hours === 1 ? 'hora' : 'horas'}</span>
            </div>
            <Slider
              min={1}
              max={168}
              step={1}
              value={hours}
              onValueChange={setHours}
              className="w-full"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>1h</span>
              <span>24h</span>
              <span>48h</span>
              <span>72h</span>
              <span>168h (7d)</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Area
              type="monotone"
              dataKey="comentarios"
              stroke="#8884d8"
              fill="#8884d8"
              fillOpacity={0.3}
              name="Comentarios"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

