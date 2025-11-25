"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useQuery } from "@tanstack/react-query"
import { Activity, Gift, Users, MessageSquare, TrendingUp, Video } from "lucide-react"

interface StatsCardsProps {
  streamId?: string
}

export function StatsCards({ streamId }: StatsCardsProps) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["stats", streamId],
    queryFn: async () => {
      const url = streamId
        ? `/api/stats?stream_id=${streamId}`
        : "/api/stats"
      const res = await fetch(url)
      return res.json()
    },
    refetchInterval: 5000,
  })

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cargando...</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">-</div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const cards = [
    {
      title: "Total Eventos",
      value: stats?.total_events || 0,
      icon: Activity,
      description: "Todos los eventos capturados",
    },
    {
      title: "Donaciones",
      value: stats?.total_donations || 0,
      icon: Gift,
      description: "Regalos recibidos",
    },
    {
      title: "Nuevos Seguidores",
      value: stats?.total_follows || 0,
      icon: TrendingUp,
      description: "Follows durante el stream",
    },
    {
      title: "Usuarios Únicos",
      value: stats?.total_users || 0,
      icon: Users,
      description: "Usuarios que interactuaron",
    },
    {
      title: "Streams Totales",
      value: stats?.total_streams || 0,
      icon: Video,
      description: "Directos registrados",
    },
    {
      title: "Streams Activos",
      value: stats?.active_streams || 0,
      icon: MessageSquare,
      description: "En vivo ahora",
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {card.description}
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

