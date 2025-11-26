const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuración de PostgreSQL (misma que lib/db.ts)
const dbUser = process.env.DB_USER || "postgres";
const dbPassword = process.env.DB_PASSWORD || "123123";
const dbHost = process.env.DB_HOST || "localhost";
const dbPort = process.env.DB_PORT || "5432";
const dbName = process.env.DB_NAME || "tiktok_dashboard";

// Crear directorio de backups si no existe
const backupsDir = path.join(__dirname, '..', 'backups');
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

// Generar nombre de archivo con timestamp
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const backupFileName = `backup_${timestamp}.sql`;
const backupPath = path.join(backupsDir, backupFileName);

// Comando pg_dump
// En Windows, puede necesitar la ruta completa a pg_dump
const pgDumpCommand = process.platform === 'win32' 
  ? `pg_dump -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -F p > "${backupPath}"`
  : `PGPASSWORD=${dbPassword} pg_dump -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -F p > "${backupPath}"`;

console.log('🔄 Iniciando backup de base de datos...');
console.log(`📁 Base de datos: ${dbName}`);
console.log(`💾 Archivo de backup: ${backupPath}`);

// Ejecutar backup
const backupProcess = exec(pgDumpCommand, (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Error al crear backup:', error.message);
    
    // En Windows, intentar con ruta común de PostgreSQL
    if (process.platform === 'win32') {
      // Buscar versiones más recientes primero (18, 17, 16, 15, 14, 13)
      const commonPgDumpPaths = [
        'C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe',
        'C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe',
        'C:\\Program Files\\PostgreSQL\\16\\bin\\pg_dump.exe',
        'C:\\Program Files\\PostgreSQL\\15\\bin\\pg_dump.exe',
        'C:\\Program Files\\PostgreSQL\\14\\bin\\pg_dump.exe',
        'C:\\Program Files\\PostgreSQL\\13\\bin\\pg_dump.exe',
      ];
      
      const availablePaths = commonPgDumpPaths.filter(p => fs.existsSync(p));
      
      if (availablePaths.length === 0) {
        console.error('\n❌ No se encontró pg_dump en las rutas comunes de PostgreSQL.');
        console.error('💡 Soluciones:');
        console.error('   1. Instala PostgreSQL Client Tools');
        console.error('   2. O agrega pg_dump al PATH del sistema');
        console.error('   3. O ejecuta manualmente:');
        console.error(`      pg_dump -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} > "${backupPath}"`);
        process.exit(1);
      }
      
      // Intentar cada versión disponible secuencialmente
      let currentIndex = 0;
      
      const tryNextVersion = () => {
        if (currentIndex >= availablePaths.length) {
          console.error('\n❌ No se pudo crear el backup con ninguna versión encontrada.');
          console.error('💡 Tu servidor PostgreSQL es versión 18.0, pero las herramientas instaladas son incompatibles.');
          console.error('💡 Soluciones:');
          console.error('   1. Instala PostgreSQL 18 Client Tools desde: https://www.postgresql.org/download/windows/');
          console.error('   2. O agrega la ruta de PostgreSQL 18 al PATH del sistema');
          console.error('   3. O ejecuta manualmente:');
          console.error(`      "C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe" -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -f "${backupPath}"`);
          process.exit(1);
        }
        
        const pgDumpPath = availablePaths[currentIndex];
        console.log(`\n🔄 Intentando con: ${pgDumpPath}`);
        const winCommand = `"${pgDumpPath}" -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -F p -f "${backupPath}"`;
        
        const winProcess = exec(winCommand, { env: { ...process.env, PGPASSWORD: dbPassword } }, (error2, stdout2, stderr2) => {
          if (error2) {
            // Si hay error de versión, continuar con la siguiente
            if (stderr2 && stderr2.includes('version mismatch')) {
              console.log(`⚠️  Versión incompatible, probando siguiente versión...`);
              currentIndex++;
              tryNextVersion();
              return;
            }
            // Otro tipo de error
            console.error('❌ Error:', error2.message);
            if (stderr2) console.error('Detalles:', stderr2);
            currentIndex++;
            tryNextVersion();
          } else {
            // Éxito
            const stats = fs.statSync(backupPath);
            console.log('✅ Backup creado exitosamente!');
            console.log(`📊 Tamaño: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
            console.log(`📍 Ubicación: ${backupPath}`);
            process.exit(0);
          }
        });
      };
      
      // Empezar a intentar
      tryNextVersion();
      return;
    }
    process.exit(1);
  } else {
    const stats = fs.statSync(backupPath);
    console.log('✅ Backup creado exitosamente!');
    console.log(`📊 Tamaño: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`📍 Ubicación: ${backupPath}`);
  }
});

// Manejar entrada de contraseña si es necesario
if (process.platform !== 'win32') {
  backupProcess.stdin.setEncoding('utf8');
}
