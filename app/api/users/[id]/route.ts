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
      .select("*, streams(*)")
      .eq("user_id", params.id)
      .order("created_at", { ascending: false })
      .limit(100)

    // Get user's donations
    const { data: donations } = await supabase
      .from("donations")
      .select("*, streams(*)")
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

    return NextResponse.json({
      ...user,
      events: events || [],
      donations: donations || [],
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

