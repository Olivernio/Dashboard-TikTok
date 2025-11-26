"use client"

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
  Brush,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { format, subHours } from "date-fns"
import { es } from "date-fns/locale"

interface EventsChartProps {
  streamId?: string
  streamerId?: string
  hours?: number
}

export function EventsChart({ streamId, streamerId, hours = 24 }: EventsChartProps) {
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
    queryKey: ["events-chart", streamId, streamerId],
    queryFn: async () => {
      let url = `/api/events?group_by=hour`
      if (streamId) {
        url = `/api/events?stream_id=${streamId}&group_by=hour`
      } else if (streamerId) {
        url = `/api/events?streamer_id=${streamerId}&group_by=hour`
      }
      const res = await fetch(url)
      if (!res.ok) {
        throw new Error(`Failed to fetch events: ${res.statusText}`)
      }
      const jsonData = await res.json()
      // Asegurar que siempre retornamos un array
      return Array.isArray(jsonData) ? jsonData : []
    },
    // Actualizar más frecuentemente para streams activos (cada 5 segundos)
    // Para streams históricos, no hacer refetch automático
    refetchInterval: (streamId && !isActiveStream) ? false : 5000,
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Eventos en el Tiempo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            Cargando...
          </div>
        </CardContent>
      </Card>
    )
  }

  // Transform data for chart - asegurar que data es un array
  const chartData = Array.isArray(data) && data.length > 0 ? data.map((item: any) => {
    const date = new Date(item.hour)
    const now = new Date()
    const hoursDiff = (now.getTime() - date.getTime()) / (1000 * 60 * 60)
    
    // Determinar formato según el rango
    let timeFormat = "HH:mm"
    if (data && data.length > 24) {
      timeFormat = "dd/MM HH:mm"
    } else if (hoursDiff > 24) {
      timeFormat = "dd/MM HH:mm"
    } else if (data && data.length > 1) {
      // Si hay eventos de diferentes días, mostrar fecha
      const firstDate = new Date(data[0].hour)
      const lastDate = new Date(data[data.length - 1].hour)
      if (firstDate.toDateString() !== lastDate.toDateString()) {
        timeFormat = "dd/MM HH:mm"
      }
    }
    
    return {
      time: format(date, timeFormat, { locale: es }),
      comentarios: item.comments || 0,
      donaciones: item.donations || 0,
      follows: item.follows || 0,
    }
  }) : []
  
  // Mostrar mensaje si no hay datos
  if (!isLoading && (!data || !Array.isArray(data) || data.length === 0)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Eventos en el Tiempo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              {isActiveStream 
                ? "Esperando eventos..." 
                : "No hay eventos para mostrar"}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Eventos en el Tiempo</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Brush dataKey="time" height={30} />
            <Line
              type="monotone"
              dataKey="comentarios"
              stroke="#8884d8"
              name="Comentarios"
            />
            <Line
              type="monotone"
              dataKey="donaciones"
              stroke="#82ca9d"
              name="Donaciones"
            />
            <Line
              type="monotone"
              dataKey="follows"
              stroke="#ffc658"
              name="Follows"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

