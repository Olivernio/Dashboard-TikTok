-- Agregar relación de partes a streams
ALTER TABLE streams 
ADD COLUMN IF NOT EXISTS parent_stream_id UUID REFERENCES streams(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS part_number INTEGER DEFAULT 1;

-- Crear índice para mejorar performance en consultas de partes
CREATE INDEX IF NOT EXISTS idx_streams_parent_stream_id ON streams(parent_stream_id);
CREATE INDEX IF NOT EXISTS idx_streams_part_number ON streams(part_number);

-- Agregar constraint para asegurar que part_number sea >= 1
ALTER TABLE streams 
ADD CONSTRAINT check_part_number_positive CHECK (part_number >= 1);

-- Comentarios para documentación
COMMENT ON COLUMN streams.parent_stream_id IS 'ID del stream principal si este es una parte. NULL si es el stream principal.';
COMMENT ON COLUMN streams.part_number IS 'Número de parte (1 para el principal, 2, 3, 4... para las partes)';

