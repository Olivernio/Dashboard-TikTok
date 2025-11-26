import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { stream_ids } = body

    if (!stream_ids || !Array.isArray(stream_ids) || stream_ids.length < 2) {
      return NextResponse.json(
        { error: "stream_ids debe ser un array con al menos 2 IDs" },
        { status: 400 }
      )
    }

    // Obtener todos los streams
    const { data: streams, error: fetchError } = await supabase
      .from("streams")
      .select("*")
      .in("id", stream_ids)

    if (fetchError) {
      return NextResponse.json(
        { error: "Failed to fetch streams", details: fetchError.message },
        { status: 500 }
      )
    }

    if (!streams || streams.length === 0) {
      return NextResponse.json(
        { error: "No se encontraron streams con los IDs proporcionados" },
        { status: 404 }
      )
    }

    // Verificar que todos los streams sean del mismo streamer
    const streamerIds = [...new Set(streams.map(s => s.streamer_id))]
    if (streamerIds.length > 1) {
      return NextResponse.json(
        { error: "Todos los streams deben ser del mismo streamer" },
        { status: 400 }
      )
    }

    // Ordenar por started_at para encontrar el más antiguo (principal)
    streams.sort((a, b) => 
      new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
    )

    const principalStream = streams[0]
    const partStreams = streams.slice(1)

    // Actualizar el stream principal (asegurar que sea principal)
    const { error: updatePrincipalError } = await supabase
      .from("streams")
      .update({ 
        parent_stream_id: null,
        part_number: 1,
        ended_at: null // Reabrir si estaba cerrado
      })
      .eq("id", principalStream.id)

    if (updatePrincipalError) {
      return NextResponse.json(
        { error: "Failed to update principal stream", details: updatePrincipalError.message },
        { status: 500 }
      )
    }

    // Actualizar los streams que serán partes
    for (let i = 0; i < partStreams.length; i++) {
      const partStream = partStreams[i]
      const { error: updatePartError } = await supabase
        .from("streams")
        .update({
          parent_stream_id: principalStream.id,
          part_number: i + 2, // part_number 2, 3, 4, ...
        })
        .eq("id", partStream.id)

      if (updatePartError) {
        return NextResponse.json(
          { error: `Failed to update part stream ${partStream.id}`, details: updatePartError.message },
          { status: 500 }
        )
      }
    }

    // Obtener el stream principal actualizado con todas sus partes
    const { data: updatedPrincipal, error: getPrincipalError } = await supabase
      .from("streams")
      .select("*")
      .eq("id", principalStream.id)
      .single()

    if (getPrincipalError) {
      return NextResponse.json(
        { error: "Failed to fetch updated principal stream", details: getPrincipalError.message },
        { status: 500 }
      )
    }

    // Obtener todas las partes
    const { data: parts, error: getPartsError } = await supabase
      .from("streams")
      .select("*")
      .eq("parent_stream_id", principalStream.id)
      .order("part_number", { ascending: true })

    if (getPartsError) {
      return NextResponse.json(
        { error: "Failed to fetch parts", details: getPartsError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ...updatedPrincipal,
      parts: parts || [],
      part_count: (parts?.length || 0) + 1, // +1 incluye el principal
    })
  } catch (error) {
    console.error("Error unifying streams:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

