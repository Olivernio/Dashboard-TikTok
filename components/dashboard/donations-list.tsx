"use client"

import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useState } from "react"
import { Gift, Search } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { useSettingsStore } from "@/store/use-settings-store"
import { formatInTimeZone } from "date-fns-tz"

interface DonationsListProps {
  streamId?: string
}

export function DonationsList({ streamId }: DonationsListProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const timezone = useSettingsStore((state) => state.timezone)

  const { data: donations, isLoading } = useQuery({
    queryKey: ["donations", streamId],
    queryFn: async () => {
      const url = streamId
        ? `/api/donations?stream_id=${streamId}`
        : "/api/donations"
      const res = await fetch(url)
      return res.json()
    },
    refetchInterval: 5000,
  })

  const filteredDonations = donations?.filter((donation: any) => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      donation.users?.username?.toLowerCase().includes(term) ||
      donation.gift_name?.toLowerCase().includes(term) ||
      donation.message?.toLowerCase().includes(term)
    )
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Donaciones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">Cargando...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5" />
          Donaciones ({filteredDonations?.length || 0})
        </CardTitle>
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por usuario, regalo o mensaje..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 max-h-[600px] overflow-y-auto">
          {filteredDonations && filteredDonations.length > 0 ? (
            filteredDonations.map((donation: any) => (
              <div
                key={donation.id}
                className="flex items-start gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                {donation.users?.profile_image_url && (
                  <img
                    src={donation.users.profile_image_url}
                    alt={donation.users.username}
                    className="w-12 h-12 rounded-full"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">
                        {donation.users?.display_name || donation.users?.username || "Usuario desconocido"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        @{donation.users?.username || "unknown"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">
                        {donation.gift_name} x{donation.gift_count}
                      </p>
                      {donation.gift_value && (
                        <p className="text-sm text-muted-foreground">
                          ${donation.gift_value.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                  {donation.message && (
                    <p className="mt-2 text-sm text-muted-foreground">
                      &ldquo;{donation.message}&rdquo;
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatInTimeZone(
                      new Date(donation.created_at),
                      timezone,
                      "PPpp",
                      { locale: es }
                    )}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No hay donaciones para mostrar
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

