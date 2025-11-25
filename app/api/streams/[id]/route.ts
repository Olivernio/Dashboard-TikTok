import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/db"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data, error } = await supabase
      .from("streams")
      .select("*, streamers(*)")
      .eq("id", params.id)
      .single()

    if (error) {
      return NextResponse.json(
        { error: "Stream not found", details: error.message },
        { status: 404 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching stream:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

