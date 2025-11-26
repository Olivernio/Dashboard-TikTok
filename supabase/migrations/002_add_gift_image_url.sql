-- Agregar columna gift_image_url a la tabla donations
ALTER TABLE donations 
ADD COLUMN IF NOT EXISTS gift_image_url TEXT;

-- Agregar índice para búsquedas (opcional, solo si gift_image_url no es null)
CREATE INDEX IF NOT EXISTS idx_donations_gift_image 
ON donations(gift_image_url) 
WHERE gift_image_url IS NOT NULL;

