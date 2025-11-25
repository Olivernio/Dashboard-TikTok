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
  hours?: number
}

export function EventsChart({ streamId, hours = 24 }: EventsChartProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["events-chart", streamId, hours],
    queryFn: async () => {
      const url = streamId
        ? `/api/events?stream_id=${streamId}&group_by=hour&hours=${hours}`
        : `/api/events?group_by=hour&hours=${hours}`
      const res = await fetch(url)
      return res.json()
    },
    refetchInterval: 10000,
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

  // Transform data for chart
  const chartData = data?.map((item: any) => ({
    time: format(new Date(item.hour), "HH:mm", { locale: es }),
    comentarios: item.comments || 0,
    donaciones: item.donations || 0,
    follows: item.follows || 0,
  })) || []

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

