-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Streamers table
CREATE TABLE streamers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255),
    profile_image_url TEXT,
    follower_count INTEGER,
    following_count INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Streams table
CREATE TABLE streams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    streamer_id UUID NOT NULL REFERENCES streamers(id) ON DELETE CASCADE,
    title VARCHAR(500),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    viewer_count INTEGER,
    total_events INTEGER DEFAULT 0,
    total_donations INTEGER DEFAULT 0,
    total_follows INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(255) NOT NULL,
    display_name VARCHAR(255),
    profile_image_url TEXT,
    follower_count INTEGER,
    following_count INTEGER,
    is_following_streamer BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(username)
);

-- Events table
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('comment', 'donation', 'follow', 'join', 'like', 'share')),
    content TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Donations table
CREATE TABLE donations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    gift_type VARCHAR(100) NOT NULL,
    gift_name VARCHAR(255) NOT NULL,
    gift_count INTEGER NOT NULL DEFAULT 1,
    gift_value DECIMAL(10, 2),
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User changes log table (audit)
CREATE TABLE user_changes_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    field_changed VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_streams_streamer_id ON streams(streamer_id);
CREATE INDEX idx_streams_started_at ON streams(started_at DESC);
CREATE INDEX idx_events_stream_id ON events(stream_id);
CREATE INDEX idx_events_user_id ON events(user_id);
CREATE INDEX idx_events_event_type ON events(event_type);
CREATE INDEX idx_events_created_at ON events(created_at DESC);
CREATE INDEX idx_donations_stream_id ON donations(stream_id);
CREATE INDEX idx_donations_user_id ON donations(user_id);
CREATE INDEX idx_donations_created_at ON donations(created_at DESC);
CREATE INDEX idx_user_changes_log_user_id ON user_changes_log(user_id);
CREATE INDEX idx_user_changes_log_created_at ON user_changes_log(created_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_streamers_updated_at BEFORE UPDATE ON streamers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_streams_updated_at BEFORE UPDATE ON streams
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to log user changes
CREATE OR REPLACE FUNCTION log_user_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        IF OLD.username IS DISTINCT FROM NEW.username THEN
            INSERT INTO user_changes_log (user_id, field_changed, old_value, new_value)
            VALUES (NEW.id, 'username', OLD.username, NEW.username);
        END IF;
        
        IF OLD.display_name IS DISTINCT FROM NEW.display_name THEN
            INSERT INTO user_changes_log (user_id, field_changed, old_value, new_value)
            VALUES (NEW.id, 'display_name', OLD.display_name, NEW.display_name);
        END IF;
        
        IF OLD.profile_image_url IS DISTINCT FROM NEW.profile_image_url THEN
            INSERT INTO user_changes_log (user_id, field_changed, old_value, new_value)
            VALUES (NEW.id, 'profile_image_url', OLD.profile_image_url, NEW.profile_image_url);
        END IF;
        
        IF OLD.follower_count IS DISTINCT FROM NEW.follower_count THEN
            INSERT INTO user_changes_log (user_id, field_changed, old_value, new_value)
            VALUES (NEW.id, 'follower_count', OLD.follower_count::TEXT, NEW.follower_count::TEXT);
        END IF;
        
        IF OLD.following_count IS DISTINCT FROM NEW.following_count THEN
            INSERT INTO user_changes_log (user_id, field_changed, old_value, new_value)
            VALUES (NEW.id, 'following_count', OLD.following_count::TEXT, NEW.following_count::TEXT);
        END IF;
        
        IF OLD.is_following_streamer IS DISTINCT FROM NEW.is_following_streamer THEN
            INSERT INTO user_changes_log (user_id, field_changed, old_value, new_value)
            VALUES (NEW.id, 'is_following_streamer', OLD.is_following_streamer::TEXT, NEW.is_following_streamer::TEXT);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to log user changes
CREATE TRIGGER log_users_changes AFTER UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION log_user_changes();

-- Function to update stream statistics
CREATE OR REPLACE FUNCTION update_stream_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE streams
        SET 
            total_events = total_events + 1,
            total_donations = CASE WHEN NEW.event_type = 'donation' THEN total_donations + 1 ELSE total_donations END,
            total_follows = CASE WHEN NEW.event_type = 'follow' THEN total_follows + 1 ELSE total_follows END,
            updated_at = NOW()
        WHERE id = NEW.stream_id;
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update stream stats
CREATE TRIGGER update_stream_stats_on_event AFTER INSERT ON events
    FOR EACH ROW EXECUTE FUNCTION update_stream_stats();

