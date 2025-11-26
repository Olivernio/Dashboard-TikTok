const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuración de PostgreSQL (misma que lib/db.ts)
const dbUser = process.env.DB_USER || "postgres";
const dbPassword = process.env.DB_PASSWORD || "123123";
const dbHost = process.env.DB_HOST || "localhost";
const dbPort = process.env.DB_PORT || "5432";
const dbName = process.env.DB_NAME || "tiktok_dashboard";

// Obtener archivo de backup del argumento o listar disponibles
const backupFile = process.argv[2];

if (!backupFile) {
  console.log('📋 Listando backups disponibles...\n');
  
  const backupsDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupsDir)) {
    console.log('❌ No existe la carpeta de backups.');
    process.exit(1);
  }

  const backups = fs.readdirSync(backupsDir)
    .filter(file => file.endsWith('.sql'))
    .sort()
    .reverse(); // Más recientes primero

  if (backups.length === 0) {
    console.log('❌ No se encontraron backups.');
    process.exit(1);
  }

  console.log('Backups disponibles:\n');
  backups.forEach((file, index) => {
    const filePath = path.join(backupsDir, file);
    const stats = fs.statSync(filePath);
    const size = (stats.size / 1024 / 1024).toFixed(2);
    const date = stats.mtime.toLocaleString();
    console.log(`${index + 1}. ${file}`);
    console.log(`   Tamaño: ${size} MB | Fecha: ${date}\n`);
  });

  console.log('💡 Uso: node scripts/restore-db.js <nombre-del-archivo-backup.sql>');
  console.log('   Ejemplo: node scripts/restore-db.js backup_2025-11-26T10-30-00.sql');
  process.exit(0);
}

const backupsDir = path.join(__dirname, '..', 'backups');
const backupPath = path.join(backupsDir, backupFile);

if (!fs.existsSync(backupPath)) {
  console.error(`❌ No se encontró el archivo: ${backupPath}`);
  process.exit(1);
}

console.log('⚠️  ADVERTENCIA: Esta operación eliminará TODOS los datos actuales de la base de datos.');
console.log(`📁 Archivo de backup: ${backupFile}`);
console.log(`💾 Base de datos: ${dbName}`);
console.log('');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Verificar si hay flag --yes o -y para saltar confirmación
const skipConfirmation = process.argv.includes('--yes') || process.argv.includes('-y')

if (skipConfirmation) {
  rl.close()
  executeRestore()
} else {
  rl.question('¿Estás seguro de que quieres restaurar este backup? (escribe "SI" para confirmar): ', (answer) => {
    if (answer !== 'SI') {
      console.log('❌ Restauración cancelada.');
      rl.close();
      process.exit(0);
    }

    rl.close();
    executeRestore()
  })
}

function executeRestore() {
  // Comando psql para restaurar
  // En Windows, puede necesitar la ruta completa a psql
  const psqlCommand = process.platform === 'win32'
    ? `psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -f "${backupPath}"`
    : `PGPASSWORD=${dbPassword} psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -f "${backupPath}"`;

  console.log('\n🔄 Restaurando backup...');

  const restoreProcess = exec(psqlCommand, { env: { ...process.env, PGPASSWORD: dbPassword } }, (error, stdout, stderr) => {
    if (error) {
      console.error('❌ Error al restaurar backup:', error.message);
      
      // En Windows, intentar con ruta común de PostgreSQL
      if (process.platform === 'win32') {
        const commonPsqlPaths = [
          'C:\\Program Files\\PostgreSQL\\18\\bin\\psql.exe',
          'C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe',
          'C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe',
          'C:\\Program Files\\PostgreSQL\\15\\bin\\psql.exe',
          'C:\\Program Files\\PostgreSQL\\14\\bin\\psql.exe',
          'C:\\Program Files\\PostgreSQL\\13\\bin\\psql.exe',
        ];
        
        for (const psqlPath of commonPsqlPaths) {
          if (fs.existsSync(psqlPath)) {
            console.log(`\n🔄 Intentando con: ${psqlPath}`);
            const winCommand = `"${psqlPath}" -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -f "${backupPath}"`;
            
            exec(winCommand, { env: { ...process.env, PGPASSWORD: dbPassword } }, (error2, stdout2, stderr2) => {
              if (error2) {
                console.error('❌ Error:', error2.message);
                if (stderr2) console.error('Detalles:', stderr2);
                process.exit(1);
              } else {
                console.log('✅ Backup restaurado exitosamente!');
                if (stdout2) console.log(stdout2);
              }
            });
            return;
          }
        }
        
        console.error('\n💡 Sugerencia: Asegúrate de que psql esté en tu PATH o especifica la ruta completa.');
        console.error('   También puedes restaurar manualmente:');
        console.error(`   psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} < "${backupPath}"`);
      }
      process.exit(1);
    } else {
      console.log('✅ Backup restaurado exitosamente!');
      if (stdout) console.log(stdout);
    }
  });

  // Manejar entrada de contraseña si es necesario
  if (process.platform !== 'win32') {
    restoreProcess.stdin.setEncoding('utf8');
  }
}
