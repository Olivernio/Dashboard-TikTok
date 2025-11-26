import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/db"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: stream, error } = await supabase
      .from("streams")
      .select("*")
      .eq("id", params.id)
      .single()

    if (error) {
      return NextResponse.json(
        { error: "Stream not found", details: error.message },
        { status: 404 }
      )
    }

    // Obtener streamer relacionado
    let streamer = null
    if (stream.streamer_id) {
      const { data: streamerData } = await supabase
        .from("streamers")
        .select("*")
        .eq("id", stream.streamer_id)
        .single()
      
      streamer = streamerData
    }

    // Si el stream tiene parent_stream_id, obtener información del stream principal
    let parentStream = null
    if (stream.parent_stream_id) {
      const { data: parentData } = await supabase
        .from("streams")
        .select("*")
        .eq("id", stream.parent_stream_id)
        .single()
      
      if (parentData) {
        // Obtener streamer del parent
        let parentStreamer = null
        if (parentData.streamer_id) {
          const { data: parentStreamerData } = await supabase
            .from("streamers")
            .select("*")
            .eq("id", parentData.streamer_id)
            .single()
          
          parentStreamer = parentStreamerData
        }
        
        parentStream = {
          ...parentData,
          is_active: parentData.ended_at === null,
          streamers: parentStreamer,
        }
      }
    }

    // Si el stream es principal (no tiene parent_stream_id), obtener todas sus partes
    let parts: any[] = []
    if (!stream.parent_stream_id) {
      const { data: partsData } = await supabase
        .from("streams")
        .select("*")
        .eq("parent_stream_id", stream.id)
        .order("part_number", { ascending: true })
      
      if (partsData) {
        // Obtener streamers para las partes
        const partStreamerIds = [...new Set(partsData.map((p: any) => p.streamer_id).filter(Boolean))]
        const partStreamersMap = new Map()
        
        if (partStreamerIds.length > 0) {
          const { data: partStreamers } = await supabase
            .from("streamers")
            .select("*")
            .in("id", partStreamerIds)
          
          partStreamers?.forEach((s: any) => partStreamersMap.set(s.id, s))
        }
        
        parts = partsData.map((part: any) => ({
          ...part,
          is_active: part.ended_at === null,
          streamers: part.streamer_id ? partStreamersMap.get(part.streamer_id) || null : null,
        }))
      }
    }

    // Construir respuesta
    const streamWithStatus: any = {
      ...stream,
      is_active: stream.ended_at === null,
      streamers: streamer,
    }

    if (parentStream) {
      streamWithStatus.parent_stream = parentStream
    }

    if (parts.length > 0) {
      streamWithStatus.parts = parts
      streamWithStatus.part_count = parts.length + 1 // +1 incluye el principal
    }

    return NextResponse.json(streamWithStatus)
  } catch (error) {
    console.error("Error fetching stream:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { 
      viewer_count, 
      title, 
      started_at, 
      ended_at, 
      parent_stream_id, 
      part_number,
      streamer_id 
    } = body

    const updateData: any = {}
    if (viewer_count !== undefined) updateData.viewer_count = viewer_count
    if (title !== undefined) updateData.title = title
    if (started_at !== undefined) updateData.started_at = started_at
    if (ended_at !== undefined) updateData.ended_at = ended_at
    if (parent_stream_id !== undefined) updateData.parent_stream_id = parent_stream_id
    if (part_number !== undefined) updateData.part_number = part_number
    if (streamer_id !== undefined) updateData.streamer_id = streamer_id

    const { data, error } = await supabase
      .from("streams")
      .update(updateData)
      .eq("id", params.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: "Failed to update stream", details: error.message },
        { status: 500 }
      )
    }

    // Obtener streamer relacionado
    let streamer = null
    if (data.streamer_id) {
      const { data: streamerData } = await supabase
        .from("streamers")
        .select("*")
        .eq("id", data.streamer_id)
        .single()
      
      streamer = streamerData
    }

    const streamWithStatus = {
      ...data,
      is_active: data.ended_at === null,
      streamers: streamer,
    }

    return NextResponse.json(streamWithStatus)
  } catch (error) {
    console.error("Error updating stream:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

