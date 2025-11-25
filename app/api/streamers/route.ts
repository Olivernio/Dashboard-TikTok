import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/db"

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("streamers")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch streamers", details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching streamers:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, display_name, profile_image_url, follower_count, following_count } = body

    if (!username) {
      return NextResponse.json(
        { error: "Missing required field: username" },
        { status: 400 }
      )
    }

    // Check if streamer exists
    const { data: existing } = await supabase
      .from("streamers")
      .select("id")
      .eq("username", username)
      .single()

    if (existing) {
      // Update existing streamer
      const { data, error } = await supabase
        .from("streamers")
        .update({
          display_name,
          profile_image_url,
          follower_count,
          following_count,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single()

      if (error) {
        return NextResponse.json(
          { error: "Failed to update streamer", details: error.message },
          { status: 500 }
        )
      }

      return NextResponse.json(data)
    } else {
      // Create new streamer
      const { data, error } = await supabase
        .from("streamers")
        .insert({
          username,
          display_name,
          profile_image_url,
          follower_count,
          following_count,
        })
        .select()
        .single()

      if (error) {
        return NextResponse.json(
          { error: "Failed to create streamer", details: error.message },
          { status: 500 }
        )
      }

      return NextResponse.json(data)
    }
  } catch (error) {
    console.error("Error creating/updating streamer:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

