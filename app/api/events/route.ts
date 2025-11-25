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
    const eventType = searchParams.get("event_type")
    const limit = parseInt(searchParams.get("limit") || "100")
    const groupBy = searchParams.get("group_by")
    const hours = parseInt(searchParams.get("hours") || "24")

    if (groupBy === "hour") {
      // Group events by hour for chart
      const startDate = new Date()
      startDate.setHours(startDate.getHours() - hours)

      let query = supabase
        .from("events")
        .select("event_type, created_at")
        .gte("created_at", startDate.toISOString())

      if (streamId) {
        query = query.eq("stream_id", streamId)
      }

      const { data: events, error } = await query

      if (error) {
        return NextResponse.json(
          { error: "Failed to fetch events", details: error.message },
          { status: 500 }
        )
      }

      // Group by hour
      const grouped: Record<string, { comments: number; donations: number; follows: number }> = {}
      
      events?.forEach((event) => {
        const hour = new Date(event.created_at).toISOString().slice(0, 13) + ":00:00"
        if (!grouped[hour]) {
          grouped[hour] = { comments: 0, donations: 0, follows: 0 }
        }
        if (event.event_type === "comment") grouped[hour].comments++
        if (event.event_type === "donation") grouped[hour].donations++
        if (event.event_type === "follow") grouped[hour].follows++
      })

      const result = Object.entries(grouped).map(([hour, counts]) => ({
        hour,
        ...counts,
      }))

      return NextResponse.json(result.sort((a, b) => a.hour.localeCompare(b.hour)))
    }

    // Regular query
    let query = supabase
      .from("events")
      .select("*, users(*), streams(*)")
      .order("created_at", { ascending: false })
      .limit(limit)

    if (streamId) {
      query = query.eq("stream_id", streamId)
    }

    if (eventType) {
      query = query.eq("event_type", eventType)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch events", details: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error fetching events:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
