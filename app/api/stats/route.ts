import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const streamId = searchParams.get("stream_id")
    const streamerId = searchParams.get("streamer_id")

    const { sql } = await import("@/lib/db")

    if (streamId) {
      // Stats for specific stream (incluyendo partes si las tiene)
      // Obtener stream y determinar si tiene partes
      const streamResult = await sql`SELECT id, parent_stream_id FROM streams WHERE id = ${streamId} LIMIT 1`
      const stream = streamResult[0] || null
      
      if (!stream) {
        return NextResponse.json({
          total_events: 0,
          total_donations: 0,
          total_follows: 0,
          total_users: 0,
        })
      }

      // Si el stream tiene parent_stream_id, usar el parent como principal
      const principalStreamId = stream.parent_stream_id || streamId
      
      // Obtener todas las partes del stream principal
      const partsResult = await sql`
        SELECT id FROM streams 
        WHERE parent_stream_id = ${principalStreamId} OR id = ${principalStreamId}
      `
      const streamIds = partsResult.map((s: any) => s.id)

      // Contar eventos de todos los streams (principal + partes)
      const eventsResult = await sql`
        SELECT COUNT(*) as count FROM events 
        WHERE stream_id = ANY(${streamIds})
      `
      const eventsCount = parseInt(eventsResult[0]?.count || "0")

      // Contar usuarios únicos de todos los streams
      const usersResult = await sql`
        SELECT COUNT(DISTINCT user_id) as count FROM events 
        WHERE stream_id = ANY(${streamIds}) AND user_id IS NOT NULL
      `
      const usersCount = parseInt(usersResult[0]?.count || "0")

      // Contar donaciones de todos los streams
      const donationsResult = await sql`
        SELECT COUNT(*) as count FROM donations 
        WHERE stream_id = ANY(${streamIds})
      `
      const donationsCount = parseInt(donationsResult[0]?.count || "0")

      // Contar follows de todos los streams
      const followsResult = await sql`
        SELECT COUNT(*) as count FROM events 
        WHERE stream_id = ANY(${streamIds}) AND event_type = 'follow'
      `
      const followsCount = parseInt(followsResult[0]?.count || "0")

      return NextResponse.json({
        total_events: eventsCount,
        total_donations: donationsCount,
        total_follows: followsCount,
        total_users: usersCount,
      })
    } else if (streamerId) {
      // Stats for specific streamer (todos sus streams)
      // Obtener todos los streams del streamer
      const streamsResult = await sql`SELECT id FROM streams WHERE streamer_id = ${streamerId}`
      const streamIds = streamsResult.map((s: any) => s.id)

      if (streamIds.length === 0) {
        // No hay streams para este streamer
        return NextResponse.json({
          total_events: 0,
          total_donations: 0,
          total_follows: 0,
          total_users: 0,
          total_streams: 0,
          active_streams: 0,
        })
      }

      // Contar eventos de todos los streams del streamer
      const eventsResult = await sql`
        SELECT COUNT(*) as count FROM events 
        WHERE stream_id = ANY(${streamIds})
      `
      const eventsCount = parseInt(eventsResult[0]?.count || "0")

      // Contar usuarios únicos de todos los streams del streamer
      const usersResult = await sql`
        SELECT COUNT(DISTINCT user_id) as count FROM events 
        WHERE stream_id = ANY(${streamIds}) AND user_id IS NOT NULL
      `
      const usersCount = parseInt(usersResult[0]?.count || "0")

      // Contar donaciones de todos los streams del streamer
      const donationsResult = await sql`
        SELECT COUNT(*) as count FROM donations 
        WHERE stream_id = ANY(${streamIds})
      `
      const donationsCount = parseInt(donationsResult[0]?.count || "0")

      // Contar follows de todos los streams del streamer
      const followsResult = await sql`
        SELECT COUNT(*) as count FROM events 
        WHERE stream_id = ANY(${streamIds}) AND event_type = 'follow'
      `
      const followsCount = parseInt(followsResult[0]?.count || "0")

      // Contar streams del streamer
      const streamsCountResult = await sql`
        SELECT COUNT(*) as count FROM streams WHERE streamer_id = ${streamerId}
      `
      const streamsCount = parseInt(streamsCountResult[0]?.count || "0")

      // Contar streams activos del streamer
      const activeStreamsResult = await sql`
        SELECT COUNT(*) as count FROM streams 
        WHERE streamer_id = ${streamerId} AND ended_at IS NULL
      `
      const activeStreams = parseInt(activeStreamsResult[0]?.count || "0")

      return NextResponse.json({
        total_events: eventsCount,
        total_donations: donationsCount,
        total_follows: followsCount,
        total_users: usersCount,
        total_streams: streamsCount,
        active_streams: activeStreams,
      })
    } else {
      // Global stats - usar COUNT directamente
      const { sql } = await import("@/lib/db")
      
      // Contar eventos totales
      const eventsResult = await sql`SELECT COUNT(*) as count FROM events`
      const totalEvents = parseInt(eventsResult[0]?.count || "0")

      // Contar donaciones
      const donationsResult = await sql`SELECT COUNT(*) as count FROM donations`
      const totalDonations = parseInt(donationsResult[0]?.count || "0")

      // Contar follows
      const followsResult = await sql`SELECT COUNT(*) as count FROM events WHERE event_type = 'follow'`
      const totalFollows = parseInt(followsResult[0]?.count || "0")

      // Contar usuarios
      const usersResult = await sql`SELECT COUNT(*) as count FROM users`
      const totalUsers = parseInt(usersResult[0]?.count || "0")

      // Contar streams totales
      const streamsResult = await sql`SELECT COUNT(*) as count FROM streams`
      const totalStreams = parseInt(streamsResult[0]?.count || "0")

      // Contar streams activos
      const activeStreamsResult = await sql`SELECT COUNT(*) as count FROM streams WHERE ended_at IS NULL`
      const activeStreams = parseInt(activeStreamsResult[0]?.count || "0")

      return NextResponse.json({
        total_events: totalEvents,
        total_donations: totalDonations,
        total_follows: totalFollows,
        total_users: totalUsers,
        total_streams: totalStreams,
        active_streams: activeStreams,
      })
    }
  } catch (error) {
    console.error("Error fetching stats:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

