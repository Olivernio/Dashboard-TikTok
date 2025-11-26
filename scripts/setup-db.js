/**
 * Script para configurar la base de datos PostgreSQL local
 * Ejecuta las migraciones SQL
 */

const fs = require("fs")
const path = require("path")
const postgres = require("postgres")

// Configuración de conexión
const dbUser = process.env.DB_USER || "postgres"
const dbPassword = process.env.DB_PASSWORD || "123123"
const dbHost = process.env.DB_HOST || "localhost"
const dbPort = process.env.DB_PORT || "5432"
const dbName = process.env.DB_NAME || "tiktok_dashboard"

const connectionString = `postgresql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`

async function setupDatabase() {
  const sql = postgres(connectionString)

  try {
    console.log("📦 Conectando a PostgreSQL...")
    
    // Leer el archivo de migración
    const migrationPath = path.join(__dirname, "../supabase/migrations/001_initial_schema.sql")
    const migrationSQL = fs.readFileSync(migrationPath, "utf8")

    console.log("📝 Ejecutando migraciones...")
    
    // Ejecutar la migración
    await sql.unsafe(migrationSQL)

    console.log("✅ Base de datos configurada correctamente!")
    console.log(`📊 Base de datos: ${dbName}`)
    console.log(`🔗 Host: ${dbHost}:${dbPort}`)
    
  } catch (error) {
    console.error("❌ Error configurando la base de datos:", error.message)
    
    if (error.message.includes("does not exist")) {
      console.log("\n💡 Sugerencia: Crea la base de datos primero:")
      console.log(`   CREATE DATABASE ${dbName};`)
    }
    
    process.exit(1)
  } finally {
    await sql.end()
  }
}

setupDatabase()

