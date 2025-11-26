import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/db"
import type { Event, Donation } from "@/lib/types"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { event_type, stream_id, user_data, event_data } = body

    if (!event_type || !stream_id) {
      return NextResponse.json(
        { error: "Missing required fields: event_type, stream_id" },
        { status: 400 }
      )
    }

    // Get or create user if user_data is provided
    let userId: string | null = null
    if (user_data) {
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("username", user_data.username)
        .single()

      if (existingUser) {
        userId = existingUser.id
        // Update user data if changed
        await supabase
          .from("users")
          .update({
            display_name: user_data.display_name,
            profile_image_url: user_data.profile_image_url,
            follower_count: user_data.follower_count,
            following_count: user_data.following_count,
            is_following_streamer: user_data.is_following_streamer,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId)
      } else {
        const { data: newUser, error: userError } = await supabase
          .from("users")
          .insert({
            username: user_data.username,
            display_name: user_data.display_name,
            profile_image_url: user_data.profile_image_url,
            follower_count: user_data.follower_count,
            following_count: user_data.following_count,
            is_following_streamer: user_data.is_following_streamer,
          })
          .select("id")
          .single()

        if (userError) {
          console.error("Error creating user:", userError)
        } else {
          userId = newUser.id
        }
      }
    }

    // Create event
    const eventPayload: Partial<Event> = {
      stream_id,
      user_id: userId,
      event_type: event_type as Event["event_type"],
      content: event_data?.content || null,
      metadata: event_data?.metadata || null,
    }

    const { data: event, error: eventError } = await supabase
      .from("events")
      .insert(eventPayload)
      .select("id")
      .single()

    if (eventError) {
      console.error("Error creating event:", eventError)
      return NextResponse.json(
        { error: "Failed to create event", details: eventError.message },
        { status: 500 }
      )
    }

    // If it's a donation, create donation record
    if (event_type === "donation" && event_data?.donation) {
      const donationData = event_data.donation
      const { error: donationError } = await supabase.from("donations").insert({
        event_id: event.id,
        stream_id,
        user_id: userId!,
        gift_type: donationData.gift_type,
        gift_name: donationData.gift_name,
        gift_count: donationData.gift_count || 1,
        gift_value: donationData.gift_value || null,
        tiktok_coins: donationData.tiktok_coins || null,
        gift_image_url: donationData.gift_image_url || null,
        message: donationData.message || null,
      })

      if (donationError) {
        console.error("Error creating donation:", donationError)
      }
    }

    return NextResponse.json({ success: true, event_id: event.id })
  } catch (error) {
    console.error("Error processing event:", error)
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
    const streamerId = searchParams.get("streamer_id")
    const userId = searchParams.get("user_id")
    const eventType = searchParams.get("event_type")
    const limit = parseInt(searchParams.get("limit") || "100")
    const groupBy = searchParams.get("group_by")
    const hours = parseInt(searchParams.get("hours") || "24")
    const since = searchParams.get("since") // Para tiempo real: solo eventos desde este timestamp

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

    if (groupBy === "hour") {
      // Obtener eventos sin filtro de tiempo inicial (para detectar primera y última hora)
      let query = supabase
        .from("events")
        .select("event_type, created_at")

      if (streamId) {
        query = query.eq("stream_id", streamId)
      } else if (streamIds.length > 0) {
        query = query.in("stream_id", streamIds)
      }

      const { data: events, error } = await query

      if (error) {
        return NextResponse.json(
          { error: "Failed to fetch events", details: error.message },
          { status: 500 }
        )
      }

      // Verificar si el stream está activo (antes de verificar eventos)
      let isStreamActive = false
      if (streamId) {
        const { data: streamData } = await supabase
          .from("streams")
          .select("ended_at, is_active")
          .eq("id", streamId)
          .single()
        
        isStreamActive = streamData && (streamData.is_active || !streamData.ended_at)
      }

      // Si no hay eventos pero el stream está activo, mostrar al menos la hora actual
      if (!events || events.length === 0) {
        if (isStreamActive && streamId) {
          // Stream activo sin eventos aún - mostrar hora actual
          const now = new Date()
          now.setMinutes(0, 0, 0)
          const hourStr = now.toISOString().slice(0, 13) + ":00:00"
          return NextResponse.json([{
            hour: hourStr,
            comments: 0,
            donations: 0,
            follows: 0,
          }])
        }
        return NextResponse.json([])
      }

      // Encontrar primera y última hora con eventos
      const eventDates = events.map(e => new Date(e.created_at))
      const firstEvent = new Date(Math.min(...eventDates.map(d => d.getTime())))
      let lastEvent = new Date(Math.max(...eventDates.map(d => d.getTime())))
      
      // Redondear a la hora más cercana
      firstEvent.setMinutes(0, 0, 0)
      lastEvent.setMinutes(0, 0, 0)
      
      // Si hay un stream activo, incluir la hora actual aunque no tenga eventos aún
      // Esto permite que el gráfico se actualice en tiempo real
      if (isStreamActive) {
        // Stream está activo, incluir hora actual
        const now = new Date()
        now.setMinutes(0, 0, 0)
        if (now >= lastEvent) {
          lastEvent = new Date(now)
        }
      }
      
      lastEvent.setHours(lastEvent.getHours() + 1) // Incluir la última hora completa

      // Group by hour
      const grouped: Record<string, { comments: number; donations: number; follows: number }> = {}
      
      events.forEach((event) => {
        const hour = new Date(event.created_at).toISOString().slice(0, 13) + ":00:00"
        if (!grouped[hour]) {
          grouped[hour] = { comments: 0, donations: 0, follows: 0 }
        }
        if (event.event_type === "comment") grouped[hour].comments++
        if (event.event_type === "donation") grouped[hour].donations++
        if (event.event_type === "follow") grouped[hour].follows++
      })

      // Generar todas las horas entre la primera y la última
      const result: Array<{ hour: string; comments: number; donations: number; follows: number }> = []
      const current = new Date(firstEvent)
      
      while (current <= lastEvent) {
        const hourStr = current.toISOString().slice(0, 13) + ":00:00"
        const hourData = grouped[hourStr] || { comments: 0, donations: 0, follows: 0 }
        result.push({
          hour: hourStr,
          ...hourData,
        })
        current.setHours(current.getHours() + 1)
      }

      return NextResponse.json(result.sort((a, b) => a.hour.localeCompare(b.hour)))
    }

    // Regular query - sin relaciones anidadas por ahora
    let query = supabase
      .from("events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit)

    // Filtrar por stream_id o streamer_id (a través de stream_ids)
    if (streamId) {
      query = query.eq("stream_id", streamId)
    } else if (streamIds.length > 0) {
      query = query.in("stream_id", streamIds)
    }

    if (eventType) {
      query = query.eq("event_type", eventType)
    }

    // Filtrar por user_id si se proporciona
    if (userId) {
      query = query.eq("user_id", userId)
    }

    // Si hay "since", solo obtener eventos más recientes (para tiempo real)
    if (since) {
      query = query.gte("created_at", since)
    }

    const { data: events, error } = await query

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch events", details: error.message },
        { status: 500 }
      )
    }

    // Si hay eventos, obtener usuarios y streams relacionados manualmente
    if (events && events.length > 0) {
      const userIds = [...new Set(events.map(e => e.user_id).filter(Boolean))]
      const streamIds = [...new Set(events.map(e => e.stream_id).filter(Boolean))]

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
      const eventsWithRelations = events.map(event => ({
        ...event,
        users: event.user_id ? usersMap.get(event.user_id) || null : null,
        streams: event.stream_id ? streamsMap.get(event.stream_id) || null : null,
      }))

      return NextResponse.json(eventsWithRelations)
    }

    return NextResponse.json(events || [])
  } catch (error) {
    console.error("Error fetching events:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
