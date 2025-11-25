"use client"

import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/db"

interface RealtimeStatsProps {
  streamId?: string
}

export function RealtimeStats({ streamId }: RealtimeStatsProps) {
  const queryClient = useQueryClient()

  useEffect(() => {
    // Subscribe to events table changes
    const channel = supabase
      .channel("realtime-stats")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "events",
        },
        () => {
          // Invalidate and refetch stats
          queryClient.invalidateQueries({ queryKey: ["stats"] })
          queryClient.invalidateQueries({ queryKey: ["events-chart"] })
          queryClient.invalidateQueries({ queryKey: ["donations"] })
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "donations",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["stats"] })
          queryClient.invalidateQueries({ queryKey: ["donations"] })
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "streams",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["stats"] })
          queryClient.invalidateQueries({ queryKey: ["streams"] })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [queryClient, streamId])

  return null // This component doesn't render anything
}

