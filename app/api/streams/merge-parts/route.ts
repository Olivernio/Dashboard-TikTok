import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { stream_ids } = body

    if (!stream_ids || !Array.isArray(stream_ids) || stream_ids.length < 1) {
      return NextResponse.json(
        { error: "Se requiere al menos 1 stream_id para fusionar" },
        { status: 400 }
      )
    }

    // Obtener todos los streams a fusionar
    const { data: streams, error: fetchError } = await supabase
      .from("streams")
      .select("*")
      .in("id", stream_ids)

    if (fetchError) {
      return NextResponse.json(
        { error: "Error al obtener streams", details: fetchError.message },
        { status: 500 }
      )
    }

    if (!streams || streams.length < stream_ids.length) {
      return NextResponse.json(
        { error: "No se encontraron todos los streams proporcionados" },
        { status: 404 }
      )
    }

    // Validar que todas las partes pertenezcan al mismo stream principal
    const parentStreamIds = [...new Set(streams.map((s: any) => s.parent_stream_id).filter(Boolean))]
    if (parentStreamIds.length > 1) {
      return NextResponse.json(
        { error: "Todas las partes deben pertenecer al mismo stream principal" },
        { status: 400 }
      )
    }

    // Validar que no se intente fusionar la parte principal con otras partes
    const hasPrincipal = streams.some((s: any) => !s.parent_stream_id)
    if (hasPrincipal) {
      return NextResponse.json(
        { error: "No se puede fusionar la parte principal. Solo se pueden fusionar partes hijas." },
        { status: 400 }
      )
    }

    // Obtener el parent_stream_id común
    const parentStreamId = streams[0].parent_stream_id
    if (!parentStreamId) {
      return NextResponse.json(
        { error: "Las partes a fusionar deben tener un stream principal" },
        { status: 400 }
      )
    }

    // Obtener la parte principal (siempre necesaria)
    const { data: principalData, error: principalError } = await supabase
      .from("streams")
      .select("*")
      .eq("id", parentStreamId)
      .single()

    if (principalError || !principalData) {
      return NextResponse.json(
        { error: "Error al obtener la parte principal", details: principalError?.message },
        { status: 500 }
      )
    }

    const principalPart = principalData

    // Si solo hay 1 parte seleccionada, fusionarla con la principal
    // Si hay múltiples, ordenarlas por fecha y usar la más antigua como referencia
    let partsToMerge = streams
    if (streams.length > 1) {
      // Si hay múltiples partes, ordenar por fecha (la más antigua será referencia)
      partsToMerge.sort((a: any, b: any) => 
        new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
      )
    }

    const partIdsToMerge = partsToMerge.map((p: any) => p.id)

    // Calcular fechas mínimas y máximas
    const allStartedAt = streams.map((s: any) => new Date(s.started_at))
    const allEndedAt = streams.map((s: any) => s.ended_at ? new Date(s.ended_at) : null).filter(Boolean)
    
    const minStartedAt = new Date(Math.min(...allStartedAt.map(d => d.getTime())))
    const maxEndedAt = allEndedAt.length > 0 
      ? new Date(Math.max(...allEndedAt.map(d => d.getTime())))
      : null

    // Verificar si alguna parte está activa
    const hasActivePart = streams.some((s: any) => !s.ended_at)
    const finalEndedAt = hasActivePart ? null : maxEndedAt?.toISOString()

    console.log(`🔄 Fusionando ${partsToMerge.length} partes en la parte principal ${principalPart.id}`)
    console.log(`📅 Rango de fechas: ${minStartedAt.toISOString()} - ${finalEndedAt || 'ACTIVO'}`)

    // Mover TODOS los eventos (todos los tipos: comment, like, join, share, follow, donation)
    const { error: eventsError } = await supabase
      .from("events")
      .update({ stream_id: principalPart.id })
      .in("stream_id", partIdsToMerge)

    if (eventsError) {
      return NextResponse.json(
        { error: "Error al mover eventos", details: eventsError.message },
        { status: 500 }
      )
    }

    // Mover todas las donaciones
    const { error: donationsError } = await supabase
      .from("donations")
      .update({ stream_id: principalPart.id })
      .in("stream_id", partIdsToMerge)

    if (donationsError) {
      return NextResponse.json(
        { error: "Error al mover donaciones", details: donationsError.message },
        { status: 500 }
      )
    }

    // Mover todo el historial de viewers
    const { error: viewerHistoryError } = await supabase
      .from("viewer_history")
      .update({ stream_id: principalPart.id })
      .in("stream_id", partIdsToMerge)

    if (viewerHistoryError) {
      return NextResponse.json(
        { error: "Error al mover historial de viewers", details: viewerHistoryError.message },
        { status: 500 }
      )
    }

    // Actualizar la parte principal con las nuevas fechas
    const { error: updatePrincipalError } = await supabase
      .from("streams")
      .update({
        started_at: minStartedAt.toISOString(),
        ended_at: finalEndedAt,
      })
      .eq("id", principalPart.id)

    if (updatePrincipalError) {
      return NextResponse.json(
        { error: "Error al actualizar parte principal", details: updatePrincipalError.message },
        { status: 500 }
      )
    }

    // Eliminar las partes fusionadas
    const { error: deleteError } = await supabase
      .from("streams")
      .delete()
      .in("id", partIdsToMerge)

    if (deleteError) {
      return NextResponse.json(
        { error: "Error al eliminar partes fusionadas", details: deleteError.message },
        { status: 500 }
      )
    }

    // Renumerar las partes restantes del mismo parent_stream_id
    const { data: remainingParts, error: remainingPartsError } = await supabase
      .from("streams")
      .select("*")
      .eq("parent_stream_id", parentStreamId)
      .order("started_at", { ascending: true })

    if (remainingPartsError) {
      console.warn("Advertencia: No se pudieron renumerar las partes restantes", remainingPartsError.message)
    } else if (remainingParts && remainingParts.length > 0) {
      // Renumerar secuencialmente empezando desde 2 (la parte 1 es el principal)
      for (let i = 0; i < remainingParts.length; i++) {
        const { error: renumberError } = await supabase
          .from("streams")
          .update({ part_number: i + 2 })
          .eq("id", remainingParts[i].id)

        if (renumberError) {
          console.warn(`Advertencia: No se pudo renumerar parte ${remainingParts[i].id}`, renumberError.message)
        }
      }
    }

    // Obtener el stream principal actualizado con todas sus partes
    const { data: updatedPrincipal, error: fetchUpdatedPrincipalError } = await supabase
      .from("streams")
      .select("*, parts:streams!parent_stream_id(id, started_at, ended_at, part_number)")
      .eq("id", parentStreamId)
      .single()

    if (fetchUpdatedPrincipalError) {
      return NextResponse.json(
        { error: "Error al obtener stream principal actualizado", details: fetchUpdatedPrincipalError.message },
        { status: 500 }
      )
    }

    // Obtener todas las partes actualizadas
    const { data: allParts, error: fetchAllPartsError } = await supabase
      .from("streams")
      .select("*")
      .eq("parent_stream_id", parentStreamId)
      .order("part_number", { ascending: true })

    if (fetchAllPartsError) {
      return NextResponse.json(
        { error: "Error al obtener partes actualizadas", details: fetchAllPartsError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: `Partes fusionadas exitosamente. ${partsToMerge.length} partes fueron fusionadas en la parte principal.`,
      principal_stream: {
        ...updatedPrincipal,
        parts: allParts || [],
        part_count: (allParts?.length || 0) + 1,
      },
      merged_parts: partIdsToMerge,
    })
  } catch (error) {
    console.error("Error fusionando partes:", error)
    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

