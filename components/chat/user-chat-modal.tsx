"use client"

import { Modal } from "@/components/ui/modal"
import { useQuery } from "@tanstack/react-query"
import { User, MessageSquare, Users, TrendingUp } from "lucide-react"
import { formatInTimeZone } from "date-fns-tz"
import { es } from "date-fns/locale"
import { useSettingsStore } from "@/store/use-settings-store"
import { Card, CardContent } from "@/components/ui/card"

interface UserChatModalProps {
  userId: string | null
  streamId: string | null
  isOpen: boolean
  onClose: () => void
}

export function UserChatModal({ userId, streamId, isOpen, onClose }: UserChatModalProps) {
  const timezone = useSettingsStore((state) => state.timezone)

  // Obtener datos del usuario
  const { data: userData, isLoading: isLoadingUser } = useQuery({
    queryKey: ["user-detail", userId],
    queryFn: async () => {
      if (!userId) return null
      const res = await fetch(`/api/users/${userId}`)
      return res.json()
    },
    enabled: !!userId && isOpen,
  })

  // Obtener comentarios del usuario en este stream
  const { data: streamComments, isLoading: isLoadingComments } = useQuery({
    queryKey: ["user-stream-comments", userId, streamId],
    queryFn: async () => {
      if (!userId || !streamId) return []
      const res = await fetch(`/api/events?user_id=${userId}&stream_id=${streamId}&event_type=comment&limit=100&include=user`)
      return res.json()
    },
    enabled: !!userId && !!streamId && isOpen,
  })

  if (!isOpen || !userId) return null

  const isLoading = isLoadingUser || isLoadingComments

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Detalles del Usuario" className="max-w-2xl">
      {isLoading ? (
        <div className="text-center py-8">Cargando...</div>
      ) : !userData ? (
        <div className="text-center py-8 text-muted-foreground">
          Usuario no encontrado
        </div>
      ) : (
        <div className="space-y-6">
          {/* User Info Header */}
          <div className="flex items-start gap-4 pb-4 border-b">
            {userData.profile_image_url ? (
              <img
                src={userData.profile_image_url}
                alt={userData.username}
                className="w-16 h-16 rounded-full"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <User className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1">
              <h2 className="text-xl font-bold">
                {userData.display_name || userData.username}
              </h2>
              <p className="text-muted-foreground">@{userData.username}</p>
              <div className="flex items-center gap-4 mt-3 text-sm">
                {userData.follower_count != null && typeof userData.follower_count === 'number' && (
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span className="font-semibold">{userData.follower_count.toLocaleString()}</span>
                    <span className="text-muted-foreground">seguidores</span>
                  </div>
                )}
                {userData.following_count != null && typeof userData.following_count === 'number' && (
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span className="font-semibold">{userData.following_count.toLocaleString()}</span>
                    <span className="text-muted-foreground">siguiendo</span>
                  </div>
                )}
                {userData.is_following_streamer !== null && userData.is_following_streamer !== undefined && (
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

          {/* Comentarios en este stream */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="h-5 w-5" />
              <h3 className="font-semibold">
                Comentarios en este directo ({streamComments?.length || 0})
              </h3>
            </div>
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {streamComments && streamComments.length > 0 ? (
                streamComments.map((comment: any) => (
                  <Card key={comment.id}>
                    <CardContent className="p-3">
                      <p className="text-sm">{comment.content}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatInTimeZone(
                          new Date(comment.created_at),
                          timezone,
                          "PPp",
                          { locale: es }
                        )}
                      </p>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No hay comentarios en este directo
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}

