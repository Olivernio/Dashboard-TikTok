"use client"

import { Modal } from "@/components/ui/modal"
import { useQuery } from "@tanstack/react-query"
import { User, Gift, MessageSquare, TrendingUp, Clock, Users } from "lucide-react"
import { formatInTimeZone } from "date-fns-tz"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { useSettingsStore } from "@/store/use-settings-store"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface UserDetailModalProps {
  userId: string | null
  isOpen: boolean
  onClose: () => void
}

export function UserDetailModal({ userId, isOpen, onClose }: UserDetailModalProps) {
  const timezone = useSettingsStore((state) => state.timezone)

  const { data: userData, isLoading } = useQuery({
    queryKey: ["user-detail", userId],
    queryFn: async () => {
      if (!userId) return null
      const res = await fetch(`/api/users/${userId}`)
      return res.json()
    },
    enabled: !!userId && isOpen,
  })

  if (!isOpen || !userId) return null

  if (isLoading) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Detalles del Usuario">
        <div className="text-center py-8">Cargando...</div>
      </Modal>
    )
  }

  if (!userData) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Detalles del Usuario">
        <div className="text-center py-8 text-muted-foreground">
          Usuario no encontrado
        </div>
      </Modal>
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalles del Usuario" className="max-w-4xl">
      <div className="space-y-6">
        {/* User Info Header */}
        <div className="flex items-start gap-4 pb-4 border-b">
          {userData.profile_image_url ? (
            <img
              src={userData.profile_image_url}
              alt={userData.username}
              className="w-20 h-20 rounded-full"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
              <User className="h-10 w-10 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1">
            <h2 className="text-2xl font-bold">
              {userData.display_name || userData.username}
            </h2>
            <p className="text-muted-foreground">@{userData.username}</p>
            <div className="flex items-center gap-4 mt-4 text-sm">
              {userData.follower_count !== null && (
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span className="font-semibold">{userData.follower_count.toLocaleString()}</span>
                  <span className="text-muted-foreground">seguidores</span>
                </div>
              )}
              {userData.following_count !== null && (
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span className="font-semibold">{userData.following_count.toLocaleString()}</span>
                  <span className="text-muted-foreground">siguiendo</span>
                </div>
              )}
              {userData.is_following_streamer !== null && (
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-4 w-4" />
                  <span className={userData.is_following_streamer ? "text-green-500" : "text-muted-foreground"}>
                    {userData.is_following_streamer ? "Sigue al streamer" : "No sigue al streamer"}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="events" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="events">Eventos ({userData.events?.length || 0})</TabsTrigger>
            <TabsTrigger value="donations">Donaciones ({userData.donations?.length || 0})</TabsTrigger>
            <TabsTrigger value="changes">Historial de Cambios ({userData.change_log?.length || 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="events" className="space-y-4 mt-4">
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {userData.events && userData.events.length > 0 ? (
                userData.events.map((event: any) => (
                  <Card key={event.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <MessageSquare className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-semibold capitalize">{event.event_type}</span>
                            {event.streams && (
                              <span className="text-xs text-muted-foreground">
                                en stream: {event.streams.title || "Sin título"}
                              </span>
                            )}
                          </div>
                          {event.content && (
                            <p className="text-sm mt-2">{event.content}</p>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatInTimeZone(
                            new Date(event.created_at),
                            timezone,
                            "PPp",
                            { locale: es }
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No hay eventos registrados
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="donations" className="space-y-4 mt-4">
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {userData.donations && userData.donations.length > 0 ? (
                userData.donations.map((donation: any) => (
                  <Card key={donation.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Gift className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-semibold">
                              {donation.gift_name} x{donation.gift_count}
                            </span>
                            {donation.gift_value && (
                              <span className="text-sm text-green-500">
                                ${donation.gift_value.toFixed(2)}
                              </span>
                            )}
                          </div>
                          {donation.message && (
                            <p className="text-sm mt-2 text-muted-foreground">
                              &ldquo;{donation.message}&rdquo;
                            </p>
                          )}
                          {donation.streams && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Stream: {donation.streams.title || "Sin título"}
                            </p>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatInTimeZone(
                            new Date(donation.created_at),
                            timezone,
                            "PPp",
                            { locale: es }
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No hay donaciones registradas
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="changes" className="space-y-4 mt-4">
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {userData.change_log && userData.change_log.length > 0 ? (
                userData.change_log.map((change: any) => (
                  <Card key={change.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-semibold capitalize">
                              {change.field_changed.replace("_", " ")}
                            </span>
                          </div>
                          <div className="text-sm mt-2 space-y-1">
                            {change.old_value && (
                              <div>
                                <span className="text-muted-foreground">Antes: </span>
                                <span className="line-through">{change.old_value}</span>
                              </div>
                            )}
                            {change.new_value && (
                              <div>
                                <span className="text-muted-foreground">Ahora: </span>
                                <span className="font-semibold">{change.new_value}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatInTimeZone(
                            new Date(change.created_at),
                            timezone,
                            "PPp",
                            { locale: es }
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No hay cambios registrados
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Modal>
  )
}

