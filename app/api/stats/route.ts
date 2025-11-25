import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const streamId = searchParams.get("stream_id")

    if (streamId) {
      // Stats for specific stream
      const { data: stream } = await supabase
        .from("streams")
        .select("total_events, total_donations, total_follows")
        .eq("id", streamId)
        .single()

      const { count: eventsCount } = await supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .eq("stream_id", streamId)

      const { count: usersCount } = await supabase
        .from("events")
        .select("user_id", { count: "exact", head: true })
        .eq("stream_id", streamId)
        .not("user_id", "is", null)

      return NextResponse.json({
        total_events: eventsCount || 0,
        total_donations: stream?.total_donations || 0,
        total_follows: stream?.total_follows || 0,
        total_users: usersCount || 0,
      })
    } else {
      // Global stats
      const { count: totalEvents } = await supabase
        .from("events")
        .select("*", { count: "exact", head: true })

      const { count: totalDonations } = await supabase
        .from("donations")
        .select("*", { count: "exact", head: true })

      const { count: totalFollows } = await supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .eq("event_type", "follow")

      const { count: totalUsers } = await supabase
        .from("users")
        .select("*", { count: "exact", head: true })

      const { count: totalStreams } = await supabase
        .from("streams")
        .select("*", { count: "exact", head: true })

      const { count: activeStreams } = await supabase
        .from("streams")
        .select("*", { count: "exact", head: true })
        .is("ended_at", null)

      return NextResponse.json({
        total_events: totalEvents || 0,
        total_donations: totalDonations || 0,
        total_follows: totalFollows || 0,
        total_users: totalUsers || 0,
        total_streams: totalStreams || 0,
        active_streams: activeStreams || 0,
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

