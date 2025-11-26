import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const streamerId = searchParams.get("streamer_id")
    const active = searchParams.get("active") === "true"

    let query = supabase
      .from("streams")
      .select("*")
      .order("started_at", { ascending: false })

    if (streamerId) {
      query = query.eq("streamer_id", streamerId)
    }

    if (active) {
      query = query.is("ended_at", null)
    }

    const { data: streams, error } = await query

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch streams", details: error.message },
        { status: 500 }
      )
    }

    if (!streams || streams.length === 0) {
      return NextResponse.json([])
    }

    // Separar streams principales (sin parent_stream_id) de las partes (con parent_stream_id)
    const principalStreams = streams.filter((s: any) => !s.parent_stream_id)
    const partStreams = streams.filter((s: any) => s.parent_stream_id)

    // Crear un mapa de partes agrupadas por parent_stream_id
    const partsMap = new Map<string, any[]>()
    partStreams.forEach((part: any) => {
      const parentId = part.parent_stream_id
      if (!partsMap.has(parentId)) {
        partsMap.set(parentId, [])
      }
      partsMap.get(parentId)!.push(part)
    })

    // Obtener streamers relacionados
    const streamerIds = [...new Set(streams.map((s: any) => s.streamer_id).filter(Boolean))]
    const streamersMap = new Map()
    
    if (streamerIds.length > 0) {
      const { data: streamers } = await supabase
        .from("streamers")
        .select("*")
        .in("id", streamerIds)
      
      streamers?.forEach((streamer: any) => streamersMap.set(streamer.id, streamer))
    }

    // Construir respuesta con streams principales y sus partes
    const streamsWithParts = principalStreams.map((stream: any) => {
      const parts = partsMap.get(stream.id) || []
      // Ordenar partes por part_number
      parts.sort((a: any, b: any) => (a.part_number || 1) - (b.part_number || 1))
      
      return {
        ...stream,
        is_active: stream.ended_at === null,
        streamers: stream.streamer_id ? streamersMap.get(stream.streamer_id) || null : null,
        parts: parts.map((part: any) => ({
          ...part,
          is_active: part.ended_at === null,
          streamers: part.streamer_id ? streamersMap.get(part.streamer_id) || null : null,
        })),
        part_count: parts.length + 1, // +1 incluye el principal
      }
    })

    return NextResponse.json(streamsWithParts)
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

    // Limpiar valores undefined - convertir a null explícito
    const cleanValue = (val: any) => val === undefined ? null : val
    
    const insertData: any = {
      streamer_id,
      started_at: new Date().toISOString(),
    }
    
    // Solo incluir campos opcionales si están definidos
    if (title !== undefined) insertData.title = cleanValue(title)
    if (viewer_count !== undefined) insertData.viewer_count = cleanValue(viewer_count)

    const { data, error } = await supabase
      .from("streams")
      .insert(insertData)
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

