/**
 * Script para unificar los 4 streams existentes mencionados por el usuario
 * 
 * Uso:
 *   npx tsx scripts/unify-streams.ts
 * 
 * O ejecutar desde el navegador:
 *   fetch('/api/streams/unify', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({
 *       stream_ids: [
 *         '8421c22d-bbd8-4a97-89fc-c26181fe9308',
 *         '1e317298-7c35-4fe6-9433-e39099d16215',
 *         '2db9a9a5-d63f-4563-b501-20162bd65b6e',
 *         'aedf3d9d-48d4-46fa-b142-bb5f648cb649'
 *       ]
 *     })
 *   }).then(r => r.json()).then(console.log)
 */

const STREAM_IDS = [
  '8421c22d-bbd8-4a97-89fc-c26181fe9308', // Parte 1, división 1
  '1e317298-7c35-4fe6-9433-e39099d16215', // Parte 1, división 2
  '2db9a9a5-d63f-4563-b501-20162bd65b6e', // Parte 1, división 3
  'aedf3d9d-48d4-46fa-b142-bb5f648cb649', // Parte 1, división 4
]

const API_URL = process.env.API_URL || 'http://localhost:3000/api'

async function unifyStreams() {
  try {
    console.log('🔄 Unificando streams...')
    console.log('Stream IDs:', STREAM_IDS)
    
    const response = await fetch(`${API_URL}/streams/unify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        stream_ids: STREAM_IDS,
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Error: ${response.status} - ${JSON.stringify(error)}`)
    }

    const result = await response.json()
    console.log('✅ Streams unificados exitosamente!')
    console.log('Stream principal:', result.id)
    console.log('Número de partes:', result.part_count)
    console.log('Partes:', result.parts?.map((p: any) => ({ id: p.id, part_number: p.part_number })))
    
    return result
  } catch (error) {
    console.error('❌ Error unificando streams:', error)
    throw error
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  unifyStreams()
    .then(() => {
      console.log('✅ Proceso completado')
      process.exit(0)
    })
    .catch((error) => {
      console.error('❌ Proceso falló:', error)
      process.exit(1)
    })
}

export { unifyStreams, STREAM_IDS }

