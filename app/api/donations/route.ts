import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const streamId = searchParams.get("stream_id")
    const streamerId = searchParams.get("streamer_id")
    const limit = parseInt(searchParams.get("limit") || "100")

    // Si se especifica streamer_id, obtener todos los streams de ese streamer
    let streamIds: string[] = []
    if (streamerId && !streamId) {
      const { data: streams, error: streamsError } = await supabase
        .from("streams")
        .select("id")
        .eq("streamer_id", streamerId)
      
      if (streamsError) {
        return NextResponse.json(
          { error: "Failed to fetch streams", details: streamsError.message },
          { status: 500 }
        )
      }
      
      streamIds = streams?.map(s => s.id) || []
      if (streamIds.length === 0) {
        // No hay streams para este streamer, retornar array vacío
        return NextResponse.json([])
      }
    } else if (streamId) {
      // Obtener el stream y sus partes si las tiene
      const { data: streamData } = await supabase
        .from("streams")
        .select("id, parent_stream_id")
        .eq("id", streamId)
        .single()
      
      if (streamData) {
        // Si el stream tiene parent_stream_id, usar el parent como principal
        const principalStreamId = streamData.parent_stream_id || streamId
        
        // Obtener todas las partes del stream principal
        const { data: parts } = await supabase
          .from("streams")
          .select("id")
          .eq("parent_stream_id", principalStreamId)
        
        // Incluir el principal y todas sus partes
        streamIds = [principalStreamId, ...(parts?.map(p => p.id) || [])]
      } else {
        streamIds = [streamId]
      }
    }

    let query = supabase
      .from("donations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit)

    // Filtrar por stream_id o streamer_id (a través de stream_ids)
    if (streamId) {
      query = query.eq("stream_id", streamId)
    } else if (streamIds.length > 0) {
      query = query.in("stream_id", streamIds)
    }

    const { data: donations, error } = await query

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch donations", details: error.message },
        { status: 500 }
      )
    }

    // Si hay donaciones, obtener usuarios y streams relacionados manualmente
    if (donations && donations.length > 0) {
      const userIds = [...new Set(donations.map(d => d.user_id).filter(Boolean))]
      const streamIds = [...new Set(donations.map(d => d.stream_id).filter(Boolean))]

      const usersMap = new Map()
      const streamsMap = new Map()

      // Obtener usuarios
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from("users")
          .select("*")
          .in("id", userIds)
        
        users?.forEach(user => usersMap.set(user.id, user))
      }

      // Obtener streams
      if (streamIds.length > 0) {
        const { data: streams } = await supabase
          .from("streams")
          .select("*")
          .in("id", streamIds)
        
        streams?.forEach(stream => streamsMap.set(stream.id, stream))
      }

      // Combinar datos
      const donationsWithRelations = donations.map(donation => ({
        ...donation,
        users: donation.user_id ? usersMap.get(donation.user_id) || null : null,
        streams: donation.stream_id ? streamsMap.get(donation.stream_id) || null : null,
      }))

      return NextResponse.json(donationsWithRelations)
    }

    return NextResponse.json(donations || [])
  } catch (error) {
    console.error("Error fetching donations:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

