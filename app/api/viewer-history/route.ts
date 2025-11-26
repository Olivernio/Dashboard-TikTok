import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { stream_id, viewer_count } = body

    if (!stream_id || viewer_count === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: stream_id, viewer_count" },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from("viewer_history")
      .insert({
        stream_id,
        viewer_count: parseInt(viewer_count),
      })

    if (error) {
      return NextResponse.json(
        { error: "Failed to save viewer history", details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("Error saving viewer history:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const streamId = searchParams.get("stream_id")
    const hours = parseInt(searchParams.get("hours") || "24")
    const groupBy = searchParams.get("group_by") // 'minute', 'hour', 'day'

    if (!streamId) {
      return NextResponse.json(
        { error: "Missing required parameter: stream_id" },
        { status: 400 }
      )
    }

    // Obtener el stream y sus partes si las tiene
    const { data: streamData } = await supabase
      .from("streams")
      .select("id, parent_stream_id")
      .eq("id", streamId)
      .single()
    
    // Si el stream tiene parent_stream_id, usar el parent como principal
    const principalStreamId = streamData?.parent_stream_id || streamId
    
    // Obtener todas las partes del stream principal
    const { data: parts } = await supabase
      .from("streams")
      .select("id")
      .eq("parent_stream_id", principalStreamId)
    
    // Incluir el principal y todas sus partes
    const streamIds = [principalStreamId, ...(parts?.map(p => p.id) || [])]

    const { sql } = await import("@/lib/db")
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

    let query
    if (groupBy === "minute") {
      query = sql`
        SELECT 
          DATE_TRUNC('minute', created_at) as time,
          AVG(viewer_count)::INTEGER as viewer_count,
          MAX(viewer_count) as max_viewers,
          MIN(viewer_count) as min_viewers
        FROM viewer_history
        WHERE stream_id = ANY(${streamIds}) AND created_at >= ${since}
        GROUP BY DATE_TRUNC('minute', created_at)
        ORDER BY time ASC
      `
    } else if (groupBy === "hour") {
      query = sql`
        SELECT 
          DATE_TRUNC('hour', created_at) as time,
          AVG(viewer_count)::INTEGER as viewer_count,
          MAX(viewer_count) as max_viewers,
          MIN(viewer_count) as min_viewers
        FROM viewer_history
        WHERE stream_id = ANY(${streamIds}) AND created_at >= ${since}
        GROUP BY DATE_TRUNC('hour', created_at)
        ORDER BY time ASC
      `
    } else {
      // Sin agrupación, todos los registros
      query = sql`
        SELECT 
          created_at as time,
          viewer_count,
          viewer_count as max_viewers,
          viewer_count as min_viewers
        FROM viewer_history
        WHERE stream_id = ANY(${streamIds}) AND created_at >= ${since}
        ORDER BY created_at ASC
      `
    }

    const data = await query
    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching viewer history:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

