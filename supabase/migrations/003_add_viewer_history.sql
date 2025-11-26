-- Tabla para historial de viewers
CREATE TABLE IF NOT EXISTS viewer_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stream_id UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
    viewer_count INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_viewer_history_stream_id ON viewer_history(stream_id);
CREATE INDEX IF NOT EXISTS idx_viewer_history_created_at ON viewer_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_viewer_history_stream_created ON viewer_history(stream_id, created_at DESC);

