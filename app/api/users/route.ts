import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const username = searchParams.get("username")
    const streamId = searchParams.get("stream_id")
    const streamerId = searchParams.get("streamer_id")

    let query = supabase.from("users").select("*")

    if (username) {
      query = query.eq("username", username)
    }

    // Si se especifica streamer_id, obtener todos los streams de ese streamer
    let streamIds: string[] = []
    if (streamerId && !streamId) {
      const { data: streams, error: streamsError } = await supabase
        .from("streams")
        .select("id")
        .eq("streamer_id", streamerId)
      
      if (streamsError) {
        return NextResponse.json(
          { error: "Failed to fetch streams", details: streamsError.message },
          { status: 500 }
        )
      }
      
      streamIds = streams?.map(s => s.id) || []
      if (streamIds.length === 0) {
        // No hay streams para este streamer, retornar array vacío
        return NextResponse.json([])
      }
    } else if (streamId) {
      streamIds = [streamId]
    }

    if (streamId || streamIds.length > 0) {
      // Get users who interacted in this stream(s)
      let eventsQuery = supabase
        .from("events")
        .select("user_id")
        .not("user_id", "is", null)

      if (streamId) {
        eventsQuery = eventsQuery.eq("stream_id", streamId)
      } else if (streamIds.length > 0) {
        eventsQuery = eventsQuery.in("stream_id", streamIds)
      }

      const { data: events, error: eventsError } = await eventsQuery

      if (eventsError) {
        return NextResponse.json(
          { error: "Failed to fetch events", details: eventsError.message },
          { status: 500 }
        )
      }

      const userIds = [...new Set(events?.map((e) => e.user_id) || [])]
      if (userIds.length > 0) {
        query = query.in("id", userIds)
      } else {
        return NextResponse.json([])
      }
    }

    const { data, error } = await query.order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch users", details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching users:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

