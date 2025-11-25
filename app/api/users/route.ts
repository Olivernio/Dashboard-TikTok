import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const username = searchParams.get("username")
    const streamId = searchParams.get("stream_id")

    let query = supabase.from("users").select("*")

    if (username) {
      query = query.eq("username", username)
    }

    if (streamId) {
      // Get users who interacted in this stream
      const { data: events } = await supabase
        .from("events")
        .select("user_id")
        .eq("stream_id", streamId)
        .not("user_id", "is", null)

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

