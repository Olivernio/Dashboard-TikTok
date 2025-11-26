"use client"

import { useState } from "react"
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
import { Eye } from "lucide-react"

interface ViewersChartProps {
  streamId?: string
  hours?: number
}

export function ViewersChart({ streamId, hours: initialHours = 24 }: ViewersChartProps) {
  const [hours, setHours] = useState(initialHours)
  const { data, isLoading } = useQuery({
    queryKey: ["viewer-history", streamId, hours],
    queryFn: async () => {
      if (!streamId) return []
      const res = await fetch(
        `/api/viewer-history?stream_id=${streamId}&hours=${hours}&group_by=minute`
      )
      if (!res.ok) return []
      return res.json()
    },
    enabled: !!streamId,
    refetchInterval: 10000, // Actualizar cada 10 segundos
  })

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

  if (!streamId) {
    return null
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Evolución de Espectadores
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

  const chartData =
    data?.map((item: any) => ({
      time: format(new Date(item.time), "HH:mm", { locale: es }),
      viewers: item.viewer_count || 0,
      max: item.max_viewers || 0,
      min: item.min_viewers || 0,
    })) || []

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Evolución de Espectadores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            {isActiveStream
              ? "Esperando datos de espectadores..."
              : "No hay datos de espectadores disponibles"}
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
            <Eye className="h-5 w-5" />
            Evolución de Espectadores
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
              dataKey="viewers"
              stroke="#8884d8"
              fill="#8884d8"
              fillOpacity={0.3}
              name="Espectadores"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

