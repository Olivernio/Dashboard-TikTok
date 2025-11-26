export interface Streamer {
  id: string
  username: string
  display_name: string | null
  profile_image_url: string | null
  follower_count: number | null
  following_count: number | null
  created_at: string
  updated_at: string
}

export interface Stream {
  id: string
  streamer_id: string
  title: string | null
  started_at: string
  ended_at: string | null
  viewer_count: number | null
  total_events: number
  total_donations: number
  total_follows: number
  parent_stream_id?: string | null
  part_number?: number
  created_at: string
  updated_at: string
  // Campos agregados por la API
  is_active?: boolean
  parts?: Stream[]
  part_count?: number
  parent_stream?: Stream
  streamers?: Streamer
}

export interface User {
  id: string
  username: string
  display_name: string | null
  profile_image_url: string | null
  follower_count: number | null
  following_count: number | null
  is_following_streamer: boolean | null
  created_at: string
  updated_at: string
}

export interface Event {
  id: string
  stream_id: string
  user_id: string | null
  event_type: "comment" | "donation" | "follow" | "join" | "like" | "share"
  content: string | null
  metadata: Record<string, any> | null
  created_at: string
}

export interface Donation {
  id: string
  event_id: string
  stream_id: string
  user_id: string
  gift_type: string
  gift_name: string
  gift_count: number
  gift_value: number | null
  tiktok_coins: number | null
  gift_image_url: string | null
  message: string | null
  created_at: string
}

export interface UserChangeLog {
  id: string
  user_id: string
  field_changed: string
  old_value: string | null
  new_value: string | null
  created_at: string
}

export interface DashboardStats {
  total_events: number
  total_donations: number
  total_follows: number
  total_users: number
  total_streams: number
  active_streams: number
}

