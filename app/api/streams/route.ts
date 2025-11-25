import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const streamerId = searchParams.get("streamer_id")
    const active = searchParams.get("active") === "true"

    let query = supabase
      .from("streams")
      .select("*, streamers(*)")
      .order("started_at", { ascending: false })

    if (streamerId) {
      query = query.eq("streamer_id", streamerId)
    }

    if (active) {
      query = query.is("ended_at", null)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch streams", details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching streams:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { streamer_id, title, viewer_count } = body

    if (!streamer_id) {
      return NextResponse.json(
        { error: "Missing required field: streamer_id" },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from("streams")
      .insert({
        streamer_id,
        title,
        viewer_count,
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: "Failed to create stream", details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error creating stream:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json(
        { error: "Missing required field: id" },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from("streams")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: "Failed to update stream", details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error updating stream:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

