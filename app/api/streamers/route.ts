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

    // Limpiar valores undefined/null - convertir a null explícito o eliminar
    const cleanValue = (val: any) => val === undefined ? null : val
    
    const updateData: any = {
      display_name: cleanValue(display_name),
      updated_at: new Date().toISOString(),
    }
    
    // Solo incluir campos si tienen valor (no undefined)
    if (profile_image_url !== undefined) updateData.profile_image_url = cleanValue(profile_image_url)
    if (follower_count !== undefined) updateData.follower_count = cleanValue(follower_count)
    if (following_count !== undefined) updateData.following_count = cleanValue(following_count)

    const insertData: any = {
      username,
      display_name: cleanValue(display_name) || username,
    }
    
    if (profile_image_url !== undefined) insertData.profile_image_url = cleanValue(profile_image_url)
    if (follower_count !== undefined) insertData.follower_count = cleanValue(follower_count)
    if (following_count !== undefined) insertData.following_count = cleanValue(following_count)

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
        .update(updateData)
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
        .insert(insertData)
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

