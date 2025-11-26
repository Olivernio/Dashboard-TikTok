import postgres from "postgres"

// Configuración de PostgreSQL local
const dbUser = process.env.DB_USER || "postgres"
const dbPassword = process.env.DB_PASSWORD || "123123"
const dbHost = process.env.DB_HOST || "localhost"
const dbPort = process.env.DB_PORT || "5432"
const dbName = process.env.DB_NAME || "tiktok_dashboard"

const connectionString = process.env.DATABASE_URL || 
  `postgresql://${dbUser}:${dbPassword}@${dbHost}:${dbPort}/${dbName}`

// Crear cliente PostgreSQL
export const sql = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
})

// Wrapper que simula la API de Supabase
class PostgresWrapper {
  from(table: string) {
    return new QueryBuilder(table, sql)
  }

  channel(name: string) {
    return {
      on: () => this,
      subscribe: () => this,
    }
  }

  removeChannel() {
    // No-op para desarrollo local
  }
}

class QueryBuilder {
  private table: string
  private sql: ReturnType<typeof postgres>
  private filters: Array<{ column: string; operator: string; value: any }> = []
  private selects: string = "*"
  private orderBy?: { column: string; ascending: boolean }
  private limitCount?: number
  private singleResult = false

  constructor(table: string, sql: ReturnType<typeof postgres>) {
    this.table = table
    this.sql = sql
  }

  select(columns: string = "*") {
    this.selects = columns
    return this
  }

  eq(column: string, value: any) {
    this.filters.push({ column, operator: "=", value })
    return this
  }

  is(column: string, value: any) {
    if (value === null) {
      this.filters.push({ column, operator: "IS NULL", value: null })
    } else {
      this.filters.push({ column, operator: "=", value })
    }
    return this
  }

  not(column: string, operator: string, value: any) {
    if (operator === "is" && value === null) {
      this.filters.push({ column, operator: "IS NOT NULL", value: null })
    }
    return this
  }

  in(column: string, values: any[]) {
    this.filters.push({ column, operator: "IN", value: values })
    return this
  }

  gte(column: string, value: any) {
    this.filters.push({ column, operator: ">=", value })
    return this
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = {
      column,
      ascending: options?.ascending !== false,
    }
    return this
  }

  limit(count: number) {
    this.limitCount = count
    return this
  }

  single() {
    this.singleResult = true
    return this
  }

  async then<T>(
    resolve?: (value: { data: T | null; error: any }) => void,
    reject?: (reason: any) => void
  ) {
    try {
      // Si hay insert o update, ejecutar esos métodos
      if (this.insertData) {
        const response = await this.executeInsert()
        if (resolve) resolve(response as any)
        return Promise.resolve(response)
      }

      if (this.updateData) {
        const response = await this.executeUpdate()
        if (resolve) resolve(response as any)
        return Promise.resolve(response)
      }

      if (this.deleteMode) {
        const response = await this.executeDelete()
        if (resolve) resolve(response as any)
        return Promise.resolve(response)
      }

      // Construir query SELECT usando sql.unsafe para mayor flexibilidad
      let queryParts: string[] = []
      const params: any[] = []
      let paramIndex = 1

      // SELECT
      queryParts.push(`SELECT ${this.selects} FROM ${this.table}`)

      // WHERE conditions
      if (this.filters.length > 0) {
        const conditions: string[] = []

        for (const filter of this.filters) {
          if (filter.operator === "IN") {
            // Para IN, crear placeholders para cada valor
            const inValues = filter.value
            const inPlaceholders = inValues.map((_: any, i: number) => {
              const idx = paramIndex + i
              params.push(inValues[i])
              return `$${idx}`
            }).join(", ")
            paramIndex += inValues.length
            conditions.push(`${filter.column} IN (${inPlaceholders})`)
          } else if (filter.operator === "IS NULL") {
            conditions.push(`${filter.column} IS NULL`)
          } else if (filter.operator === "IS NOT NULL") {
            conditions.push(`${filter.column} IS NOT NULL`)
          } else if (filter.operator === ">=") {
            conditions.push(`${filter.column} >= $${paramIndex}`)
            params.push(filter.value)
            paramIndex++
          } else {
            conditions.push(`${filter.column} = $${paramIndex}`)
            params.push(filter.value)
            paramIndex++
          }
          }

        queryParts.push(`WHERE ${conditions.join(" AND ")}`)
      }

      // ORDER BY
      if (this.orderBy) {
        const direction = this.orderBy.ascending ? "ASC" : "DESC"
        queryParts.push(`ORDER BY ${this.orderBy.column} ${direction}`)
      }

      // LIMIT
      if (this.limitCount) {
        queryParts.push(`LIMIT ${this.limitCount}`)
      }

      const queryString = queryParts.join(" ")
      const result = await this.sql.unsafe(queryString, params)

      if (this.singleResult) {
        const data = result.length > 0 ? result[0] : null
        const response = { data: data as T, error: null }
        if (resolve) resolve(response)
        return Promise.resolve(response)
      } else {
        const response = { data: result as T, error: null }
        if (resolve) resolve(response)
        return Promise.resolve(response)
      }
    } catch (error) {
      const response = { data: null, error }
      if (reject) reject(error)
      return Promise.reject(response)
    }
  }

  private insertData?: any
  private updateData?: any
  private deleteMode = false

  delete() {
    this.deleteMode = true
    return this
  }

  insert(data: any) {
    this.insertData = data
    return this
  }

  update(data: any) {
    this.updateData = data
    return this
  }

  async executeInsert() {
    if (!this.insertData) {
      throw new Error("No data to insert")
    }

    try {
      const columns = Object.keys(this.insertData)
      const values = columns.map(col => this.insertData[col])
      
      // Construir la query de INSERT usando postgres
      const columnList = columns.join(", ")
      const valuePlaceholders = columns.map((_, i) => `$${i + 1}`).join(", ")
      const returnColumns = this.selects !== "*" ? this.selects : "*"
      
      const query = `INSERT INTO ${this.table} (${columnList}) VALUES (${valuePlaceholders}) RETURNING ${returnColumns}`
      const result = await this.sql.unsafe(query, values)

      if (this.singleResult) {
        const data = result.length > 0 ? result[0] : null
        return { data, error: null }
      } else {
      return { data: result, error: null }
      }
    } catch (error: any) {
      return { data: null, error }
    }
  }

  async executeUpdate() {
    if (!this.updateData) {
      throw new Error("No data to update")
    }

    try {
      const setParts: string[] = []
      const updateValues: any[] = []
      let paramIndex = 1

      for (const [key, value] of Object.entries(this.updateData)) {
        setParts.push(`${key} = $${paramIndex}`)
        updateValues.push(value)
        paramIndex++
      }

      const whereParts: string[] = []
      const whereValues: any[] = []

      // WHERE conditions
      if (this.filters.length > 0) {
        for (const filter of this.filters) {
          if (filter.operator === "IN") {
            // Para IN, crear placeholders para cada valor
            const inValues = filter.value
            const inPlaceholders = inValues.map((_: any, i: number) => {
              const idx = paramIndex + i
              whereValues.push(inValues[i])
              return `$${idx}`
            }).join(", ")
            paramIndex += inValues.length
            whereParts.push(`${filter.column} IN (${inPlaceholders})`)
          } else if (filter.operator === "IS NULL") {
            whereParts.push(`${filter.column} IS NULL`)
          } else if (filter.operator === "IS NOT NULL") {
            whereParts.push(`${filter.column} IS NOT NULL`)
          } else {
            whereParts.push(`${filter.column} = $${paramIndex}`)
            whereValues.push(filter.value)
            paramIndex++
          }
        }
      }

      const returnColumns = this.selects !== "*" ? this.selects : "*"
      const setClause = setParts.join(", ")
      const whereClause = whereParts.length > 0 ? ` WHERE ${whereParts.join(" AND ")}` : ""
      
      const query = `UPDATE ${this.table} SET ${setClause}${whereClause} RETURNING ${returnColumns}`
      const allValues = [...updateValues, ...whereValues]
      
      const result = await this.sql.unsafe(query, allValues)

      if (this.singleResult) {
        const data = result.length > 0 ? result[0] : null
        return { data, error: null }
      } else {
        return { data: result, error: null }
      }
    } catch (error: any) {
      return { data: null, error }
    }
  }

  async executeDelete() {
    try {
      const whereParts: string[] = []
      const whereValues: any[] = []
      let paramIndex = 1

      // WHERE conditions
      if (this.filters.length > 0) {
        for (const filter of this.filters) {
          if (filter.operator === "IN") {
            // Para IN, crear placeholders para cada valor
            const inValues = filter.value
            const inPlaceholders = inValues.map((_: any, i: number) => {
              whereValues.push(inValues[i])
              return `$${paramIndex + i}`
            }).join(", ")
            paramIndex += inValues.length
            whereParts.push(`${filter.column} IN (${inPlaceholders})`)
          } else if (filter.operator === "IS NULL") {
            whereParts.push(`${filter.column} IS NULL`)
          } else if (filter.operator === "IS NOT NULL") {
            whereParts.push(`${filter.column} IS NOT NULL`)
          } else {
            whereParts.push(`${filter.column} = $${paramIndex}`)
            whereValues.push(filter.value)
            paramIndex++
          }
          }
      }

      const returnColumns = this.selects !== "*" ? this.selects : "*"
      const whereClause = whereParts.length > 0 ? ` WHERE ${whereParts.join(" AND ")}` : ""
      
      const query = `DELETE FROM ${this.table}${whereClause} RETURNING ${returnColumns}`

      const result = await this.sql.unsafe(query, whereValues)
      
      if (this.singleResult) {
        const data = result.length > 0 ? result[0] : null
        return { data, error: null }
      } else {
      return { data: result, error: null }
      }
    } catch (error: any) {
      return { data: null, error }
    }
  }
}

// Exportar instancia que simula Supabase
export const supabase = new PostgresWrapper() as any
