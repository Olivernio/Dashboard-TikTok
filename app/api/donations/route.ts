import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const streamId = searchParams.get("stream_id")
    const limit = parseInt(searchParams.get("limit") || "100")

    let query = supabase
      .from("donations")
      .select("*, users(*), streams(*)")
      .order("created_at", { ascending: false })
      .limit(limit)

    if (streamId) {
      query = query.eq("stream_id", streamId)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch donations", details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching donations:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

