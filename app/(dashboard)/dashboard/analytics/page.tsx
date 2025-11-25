"use client"

import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { TrendingUp, Users, Gift, MessageSquare, Calendar } from "lucide-react"
import { formatInTimeZone } from "date-fns-tz"
import { format, subDays } from "date-fns"
import { es } from "date-fns/locale"
import { useSettingsStore } from "@/store/use-settings-store"

const COLORS = ["#8884d8", "#82ca9d", "#ffc658", "#ff7300", "#0088fe"]

export default function AnalyticsPage() {
  const timezone = useSettingsStore((state) => state.timezone)

  const { data: stats } = useQuery({
    queryKey: ["analytics-stats"],
    queryFn: async () => {
      const res = await fetch("/api/stats")
      return res.json()
    },
  })

  const { data: eventsByType } = useQuery({
    queryKey: ["analytics-events-by-type"],
    queryFn: async () => {
      const res = await fetch("/api/events?limit=10000")
      const events = await res.json()
      
      const grouped = events.reduce((acc: any, event: any) => {
        acc[event.event_type] = (acc[event.event_type] || 0) + 1
        return acc
      }, {})

      return Object.entries(grouped).map(([type, count]) => ({
        name: type.charAt(0).toUpperCase() + type.slice(1),
        value: count,
      }))
    },
  })

  const { data: eventsByDay } = useQuery({
    queryKey: ["analytics-events-by-day"],
    queryFn: async () => {
      const res = await fetch("/api/events?limit=10000")
      const events = await res.json()
      
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = subDays(new Date(), i)
        return format(date, "yyyy-MM-dd")
      }).reverse()

      const grouped = events.reduce((acc: any, event: any) => {
        const date = format(new Date(event.created_at), "yyyy-MM-dd")
        if (last7Days.includes(date)) {
          acc[date] = (acc[date] || 0) + 1
        }
        return acc
      }, {})

      return last7Days.map((date) => ({
        date: format(new Date(date), "EEE dd", { locale: es }),
        eventos: grouped[date] || 0,
      }))
    },
  })

  const { data: topDonors } = useQuery({
    queryKey: ["analytics-top-donors"],
    queryFn: async () => {
      const res = await fetch("/api/donations?limit=1000")
      const donations = await res.json()
      
      const grouped = donations.reduce((acc: any, donation: any) => {
        const userId = donation.user_id
        if (!acc[userId]) {
          acc[userId] = {
            user: donation.users,
            total: 0,
            count: 0,
          }
        }
        acc[userId].total += (donation.gift_value || 0) * donation.gift_count
        acc[userId].count += donation.gift_count
        return acc
      }, {})

      return Object.values(grouped)
        .sort((a: any, b: any) => b.total - a.total)
        .slice(0, 10)
        .map((item: any) => ({
          name: item.user?.display_name || item.user?.username || "Unknown",
          total: item.total,
          count: item.count,
        }))
    },
  })

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">
            Estadísticas descriptivas y análisis de datos
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Eventos</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.total_events?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Donaciones</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.total_donations?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuarios Únicos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.total_users?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Streams Totales</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.total_streams?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Eventos por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={eventsByType || []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {(eventsByType || []).map((entry: any, index: number) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Eventos Últimos 7 Días</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={eventsByDay || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="eventos" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Donors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Top Donadores
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {topDonors && topDonors.length > 0 ? (
              topDonors.map((donor: any, index: number) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-semibold">{donor.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {donor.count} regalos
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-500">
                      ${donor.total.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No hay datos de donaciones disponibles
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

