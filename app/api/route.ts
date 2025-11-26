import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    message: "TikTok Dashboard API",
    version: "1.0.0",
    endpoints: {
      streamers: "/api/streamers",
      streams: "/api/streams",
      events: "/api/events",
      users: "/api/users",
      donations: "/api/donations",
      stats: "/api/stats",
    },
  })
}

