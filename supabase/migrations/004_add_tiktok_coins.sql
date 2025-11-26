-- Agregar columna para TikTok coins en la tabla donations
ALTER TABLE donations 
ADD COLUMN IF NOT EXISTS tiktok_coins INTEGER;

-- Índice para búsquedas por coins
CREATE INDEX IF NOT EXISTS idx_donations_tiktok_coins 
ON donations(tiktok_coins) 
WHERE tiktok_coins IS NOT NULL;

