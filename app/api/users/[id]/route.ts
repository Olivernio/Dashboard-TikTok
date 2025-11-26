import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/db"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get user with their interactions
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", params.id)
      .single()

    if (userError) {
      return NextResponse.json(
        { error: "User not found", details: userError.message },
        { status: 404 }
      )
    }

    // Get user's events
    const { data: events } = await supabase
      .from("events")
      .select("*")
      .eq("user_id", params.id)
      .order("created_at", { ascending: false })
      .limit(100)

    // Get user's donations
    const { data: donations } = await supabase
      .from("donations")
      .select("*")
      .eq("user_id", params.id)
      .order("created_at", { ascending: false })
      .limit(100)

    // Get user change log
    const { data: changeLog } = await supabase
      .from("user_changes_log")
      .select("*")
      .eq("user_id", params.id)
      .order("created_at", { ascending: false })
      .limit(100)

    // Obtener streams relacionados manualmente
    const streamIds = new Set<string>()
    
    events?.forEach((event: any) => {
      if (event.stream_id) streamIds.add(event.stream_id)
    })
    
    donations?.forEach((donation: any) => {
      if (donation.stream_id) streamIds.add(donation.stream_id)
    })

    const streamsMap = new Map()
    
    if (streamIds.size > 0) {
      const { data: streams } = await supabase
        .from("streams")
        .select("*")
        .in("id", Array.from(streamIds))
      
      streams?.forEach((stream: any) => streamsMap.set(stream.id, stream))
    }

    // Combinar datos con streams relacionados
    const eventsWithStreams = events?.map((event: any) => ({
      ...event,
      streams: event.stream_id ? streamsMap.get(event.stream_id) || null : null,
    })) || []

    const donationsWithStreams = donations?.map((donation: any) => ({
      ...donation,
      streams: donation.stream_id ? streamsMap.get(donation.stream_id) || null : null,
    })) || []

    return NextResponse.json({
      ...user,
      events: eventsWithStreams,
      donations: donationsWithStreams,
      change_log: changeLog || [],
    })
  } catch (error) {
    console.error("Error fetching user:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

