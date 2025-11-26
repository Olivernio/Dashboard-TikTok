# Guía de Backup y Restauración de Base de Datos

## 📦 Crear Backup

Para crear un backup completo de la base de datos antes de hacer cambios importantes:

```bash
npm run backup-db
```

El backup se guardará en la carpeta `backups/` con un nombre como:
- `backup_2025-11-26T10-30-00.sql`

**Importante**: Siempre haz un backup antes de:
- Fusionar partes de streams
- Unificar streams
- Cualquier operación masiva de datos

## 🔄 Restaurar Backup

### Opción 1: Listar backups disponibles

```bash
npm run restore-db
```

Esto mostrará todos los backups disponibles con su tamaño y fecha.

### Opción 2: Restaurar un backup específico

```bash
npm run restore-db backup_2025-11-26T10-30-00.sql
```

**⚠️ ADVERTENCIA**: La restauración eliminará TODOS los datos actuales y los reemplazará con los del backup.

### Restauración Manual (si el script no funciona)

#### Windows (PowerShell):
```powershell
# Si PostgreSQL está en el PATH:
psql -h localhost -p 5432 -U postgres -d tiktok_dashboard -f "backups\backup_2025-11-26T10-30-00.sql"

# O con ruta completa:
"C:\Program Files\PostgreSQL\15\bin\psql.exe" -h localhost -p 5432 -U postgres -d tiktok_dashboard -f "backups\backup_2025-11-26T10-30-00.sql"
```

#### Linux/Mac:
```bash
PGPASSWORD=123123 psql -h localhost -p 5432 -U postgres -d tiktok_dashboard -f backups/backup_2025-11-26T10-30-00.sql
```

## 📋 Variables de Entorno

Si tu base de datos usa credenciales diferentes, puedes configurarlas con variables de entorno:

```bash
# Windows (PowerShell)
$env:DB_USER="postgres"
$env:DB_PASSWORD="tu_password"
$env:DB_HOST="localhost"
$env:DB_PORT="5432"
$env:DB_NAME="tiktok_dashboard"
npm run backup-db

# Linux/Mac
export DB_USER="postgres"
export DB_PASSWORD="tu_password"
export DB_HOST="localhost"
export DB_PORT="5432"
export DB_NAME="tiktok_dashboard"
npm run backup-db
```

O crear un archivo `.env.local` (aunque los scripts de backup no lo leen automáticamente, puedes exportar las variables antes de ejecutar).

## 🔍 Verificar Backup

Puedes verificar que el backup se creó correctamente:

```bash
# Ver tamaño del archivo
ls -lh backups/backup_*.sql

# Ver primeras líneas del backup (debe empezar con comentarios SQL)
head -20 backups/backup_2025-11-26T10-30-00.sql
```

## 💡 Consejos

1. **Haz backups regulares**: Especialmente antes de operaciones importantes
2. **Nombra tus backups**: Si haces un backup manual importante, puedes renombrarlo:
   ```bash
   mv backups/backup_2025-11-26T10-30-00.sql backups/backup_antes_de_fusionar_parts.sql
   ```
3. **Verifica el backup**: Asegúrate de que el archivo no esté vacío antes de eliminar datos
4. **Mantén múltiples backups**: No elimines backups antiguos hasta estar seguro de que no los necesitas

## 🚨 En caso de emergencia

Si algo sale mal y necesitas restaurar rápidamente:

1. **Detén el servidor** (Ctrl+C en la terminal donde corre `npm run dev`)
2. **Restaura el backup más reciente**:
   ```bash
   npm run restore-db backup_MAS_RECIENTE.sql
   ```
3. **Verifica que todo esté bien** antes de continuar
4. **Reinicia el servidor**: `npm run dev`

