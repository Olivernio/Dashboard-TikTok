"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Settings, Video, User, Gift, MessageSquare, Users, ChevronDown, ChevronRight } from "lucide-react"
import { formatInTimeZone } from "date-fns-tz"
import { es } from "date-fns/locale"
import { useSettingsStore } from "@/store/use-settings-store"

export default function AdminPage() {
  const timezone = useSettingsStore((state) => state.timezone)
  const [activeTab, setActiveTab] = useState("streams")

  const handleTabChange = (value: string) => {
    setActiveTab(value)
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Settings className="h-8 w-8" />
            Panel de Administración
          </h1>
          <p className="text-muted-foreground mt-2">
            Edita y gestiona manualmente todos los elementos del sistema
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="streams" className="flex items-center gap-2">
            <Video className="h-4 w-4" />
            Streams
          </TabsTrigger>
          <TabsTrigger value="streamers" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Streamers
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Usuarios
          </TabsTrigger>
          <TabsTrigger value="events" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Eventos
          </TabsTrigger>
          <TabsTrigger value="donations" className="flex items-center gap-2">
            <Gift className="h-4 w-4" />
            Donaciones
          </TabsTrigger>
        </TabsList>

        <TabsContent value="streams" className="space-y-4">
          <StreamsManager timezone={timezone} />
        </TabsContent>

        <TabsContent value="streamers" className="space-y-4">
          <StreamersManager />
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <UsersManager />
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <EventsManager timezone={timezone} />
        </TabsContent>

        <TabsContent value="donations" className="space-y-4">
          <DonationsManager timezone={timezone} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Componente para gestionar Streams
function StreamsManager({ timezone }: { timezone: string }) {
  const queryClient = useQueryClient()
  const [selectedStreamerId, setSelectedStreamerId] = useState<string>("")
  const [streamsToUnify, setStreamsToUnify] = useState<string[]>([])
  const [partsToMerge, setPartsToMerge] = useState<string[]>([])

  const { data: streamers } = useQuery({
    queryKey: ["streamers"],
    queryFn: async () => {
      const res = await fetch("/api/streamers")
      return res.json()
    },
  })

  const { data: streams, isLoading } = useQuery({
    queryKey: ["streams", selectedStreamerId],
    queryFn: async () => {
      const url = selectedStreamerId
        ? `/api/streams?streamer_id=${selectedStreamerId}`
        : "/api/streams"
      const res = await fetch(url)
      return res.json()
    },
  })

  const unifyMutation = useMutation({
    mutationFn: async (streamIds: string[]) => {
      const res = await fetch("/api/streams/unify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stream_ids: streamIds }),
      })
      if (!res.ok) throw new Error("Error unificando streams")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["streams"] })
      setStreamsToUnify([])
      alert("Streams unificados exitosamente")
    },
  })

  const updateStreamMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const res = await fetch(`/api/streams/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error("Error actualizando stream")
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["streams"] })
      alert("Stream actualizado exitosamente")
    },
  })

  const mergePartsMutation = useMutation({
    mutationFn: async (partIds: string[]) => {
      const res = await fetch("/api/streams/merge-parts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stream_ids: partIds }),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Error fusionando partes")
      }
      return res.json()
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["streams"] })
      setPartsToMerge([])
      alert(`Partes fusionadas exitosamente. ${data.merged_parts?.length || 0} partes fueron fusionadas.`)
    },
    onError: (error: Error) => {
      alert(`Error al fusionar partes: ${error.message}`)
    },
  })

  const handleUnify = () => {
    if (streamsToUnify.length < 2) {
      alert("Selecciona al menos 2 streams para unificar")
      return
    }
    if (confirm(`¿Unificar ${streamsToUnify.length} streams?`)) {
      unifyMutation.mutate(streamsToUnify)
    }
  }

  const handleMergeParts = () => {
    if (partsToMerge.length < 1) {
      alert("Selecciona al menos 1 parte para fusionar con la parte principal")
      return
    }
    const confirmMessage = `¿Fusionar ${partsToMerge.length} partes?\n\n⚠️ ADVERTENCIA: Esta acción moverá TODOS los datos (eventos, donaciones, viewers) de las partes seleccionadas a la parte principal y eliminará las partes fusionadas.\n\nEsta acción NO se puede deshacer.`
    if (confirm(confirmMessage)) {
      mergePartsMutation.mutate(partsToMerge)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Gestionar Streams</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Filtrar por Streamer</label>
            <Select
              value={selectedStreamerId}
              onChange={(e) => setSelectedStreamerId(e.target.value)}
            >
              <option value="">Todos los streamers</option>
              {streamers?.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.display_name || s.username}
                </option>
              ))}
            </Select>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Unificar Streams</h3>
              <Button
                onClick={handleUnify}
                disabled={streamsToUnify.length < 2 || unifyMutation.isPending}
              >
                Unificar Seleccionados ({streamsToUnify.length})
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Selecciona múltiples streams para unificarlos en uno con partes
            </p>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">Fusionar Partes</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Fusiona múltiples partes de un stream unificado en una sola parte
                </p>
              </div>
              <Button
                onClick={handleMergeParts}
                disabled={partsToMerge.length < 1 || mergePartsMutation.isPending}
                variant="destructive"
              >
                {mergePartsMutation.isPending ? "Fusionando..." : `Fusionar Partes (${partsToMerge.length})`}
              </Button>
            </div>
            {partsToMerge.length > 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded p-3 mb-4">
                <p className="text-sm text-yellow-700 dark:text-yellow-400">
                  ⚠️ <strong>Advertencia:</strong> Se moverán TODOS los datos (eventos, donaciones, viewers) 
                  de {partsToMerge.length} {partsToMerge.length === 1 ? 'parte' : 'partes'} a la parte principal y se {partsToMerge.length === 1 ? 'eliminará' : 'eliminarán'} {partsToMerge.length === 1 ? 'la parte' : 'las partes'} fusionada{partsToMerge.length === 1 ? '' : 's'}.
                </p>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="text-center py-8">Cargando...</div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {streams?.map((stream: any) => (
                <StreamGroup
                  key={stream.id}
                  stream={stream}
                  timezone={timezone}
                  streamsToUnify={streamsToUnify}
                  partsToMerge={partsToMerge}
                  onToggleSelect={(id) => {
                    setStreamsToUnify((prev) =>
                      prev.includes(id)
                        ? prev.filter((s) => s !== id)
                        : [...prev, id]
                    )
                  }}
                  onToggleMergePart={(id) => {
                    setPartsToMerge((prev) =>
                      prev.includes(id)
                        ? prev.filter((s) => s !== id)
                        : [...prev, id]
                    )
                  }}
                  onUpdate={(id, updates) => {
                    updateStreamMutation.mutate({ id, updates })
                  }}
                  streamers={streamers}
                  allStreams={streams}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// Componente para mostrar un stream con sus partes (expandible)
function StreamGroup({
  stream,
  timezone,
  streamsToUnify,
  partsToMerge,
  onToggleSelect,
  onToggleMergePart,
  onUpdate,
  streamers,
  allStreams,
}: {
  stream: any
  timezone: string
  streamsToUnify: string[]
  partsToMerge: string[]
  onToggleSelect: (id: string) => void
  onToggleMergePart: (id: string) => void
  onUpdate: (id: string, updates: any) => void
  streamers?: any[]
  allStreams?: any[]
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const hasParts = stream.parts && stream.parts.length > 0

  return (
    <div className="space-y-2">
      {/* Stream Principal */}
      <StreamCard
        stream={stream}
        timezone={timezone}
        isSelected={streamsToUnify.includes(stream.id)}
        isSelectedForMerge={false}
        onToggleSelect={onToggleSelect}
        onToggleMergePart={onToggleMergePart}
        onUpdate={onUpdate}
        streamers={streamers}
        allStreams={allStreams}
        isPrincipal={true}
        hasParts={hasParts}
        isExpanded={isExpanded}
        onToggleExpand={() => setIsExpanded(!isExpanded)}
      />

      {/* Partes del Stream (mostrar si está expandido) */}
      {hasParts && isExpanded && (
        <div className="ml-8 space-y-2 border-l-2 border-muted pl-4">
          {stream.parts.map((part: any) => (
            <StreamCard
              key={part.id}
              stream={part}
              timezone={timezone}
              isSelected={streamsToUnify.includes(part.id)}
              isSelectedForMerge={partsToMerge.includes(part.id)}
              onToggleSelect={onToggleSelect}
              onToggleMergePart={onToggleMergePart}
              onUpdate={onUpdate}
              streamers={streamers}
              allStreams={allStreams}
              isPrincipal={false}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function StreamCard({
  stream,
  timezone,
  isSelected,
  isSelectedForMerge,
  onToggleSelect,
  onToggleMergePart,
  onUpdate,
  streamers,
  allStreams,
  isPrincipal = true,
  hasParts = false,
  isExpanded = false,
  onToggleExpand,
}: {
  stream: any
  timezone: string
  isSelected: boolean
  isSelectedForMerge: boolean
  onToggleSelect: (id: string) => void
  onToggleMergePart: (id: string) => void
  onUpdate: (id: string, updates: any) => void
  streamers?: any[]
  allStreams?: any[]
  isPrincipal?: boolean
  hasParts?: boolean
  isExpanded?: boolean
  onToggleExpand?: () => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [title, setTitle] = useState(stream.title || "")
  const [viewerCount, setViewerCount] = useState(stream.viewer_count?.toString() || "")
  const [streamerId, setStreamerId] = useState(stream.streamer_id || "")
  const [startedAt, setStartedAt] = useState(
    stream.started_at 
      ? new Date(stream.started_at).toISOString().slice(0, 16)
      : ""
  )
  const [endedAt, setEndedAt] = useState(
    stream.ended_at 
      ? new Date(stream.ended_at).toISOString().slice(0, 16)
      : ""
  )
  const [isActive, setIsActive] = useState(!stream.ended_at)
  const [parentStreamId, setParentStreamId] = useState(stream.parent_stream_id || "")
  const [partNumber, setPartNumber] = useState(stream.part_number?.toString() || "1")

  // Función helper para convertir fecha local a ISO string
  const localToISO = (localDateTime: string) => {
    if (!localDateTime) return null
    // Convertir de formato local (YYYY-MM-DDTHH:mm) a ISO
    return new Date(localDateTime).toISOString()
  }

  const handleSave = () => {
    const updates: any = {
      title: title || null,
      viewer_count: viewerCount ? parseInt(viewerCount) : null,
      streamer_id: streamerId || null,
      started_at: localToISO(startedAt),
      ended_at: isActive ? null : (endedAt ? localToISO(endedAt) : new Date().toISOString()),
      parent_stream_id: parentStreamId || null,
      part_number: partNumber ? parseInt(partNumber) : 1,
    }
    onUpdate(stream.id, updates)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setTitle(stream.title || "")
    setViewerCount(stream.viewer_count?.toString() || "")
    setStreamerId(stream.streamer_id || "")
    setStartedAt(
      stream.started_at 
        ? new Date(stream.started_at).toISOString().slice(0, 16)
        : ""
    )
    setEndedAt(
      stream.ended_at 
        ? new Date(stream.ended_at).toISOString().slice(0, 16)
        : ""
    )
    setIsActive(!stream.ended_at)
    setParentStreamId(stream.parent_stream_id || "")
    setPartNumber(stream.part_number?.toString() || "1")
  }

  return (
    <div
      className={`border rounded-lg p-4 ${
        isSelected ? "ring-2 ring-primary bg-primary/5" : ""
      } ${
        isSelectedForMerge ? "ring-2 ring-yellow-500 bg-yellow-500/10" : ""
      } ${!isPrincipal ? "bg-muted/30" : ""}`}
    >
      <div className="flex items-start gap-4">
        <div className="flex items-center gap-2">
          {hasParts && onToggleExpand && (
            <button
              onClick={onToggleExpand}
              className="p-1 hover:bg-accent rounded"
              type="button"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          )}
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(stream.id)}
            className="mt-1"
            title="Seleccionar para unificar"
          />
          {!isPrincipal && (
            <input
              type="checkbox"
              checked={isSelectedForMerge}
              onChange={() => onToggleMergePart(stream.id)}
              className="mt-1 border-yellow-500"
              title="Seleccionar para fusionar"
              style={{ accentColor: "#eab308" }}
            />
          )}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {!isPrincipal && (
              <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-700 rounded">
                Parte {stream.part_number || 1}
              </span>
            )}
            <span className="font-semibold">ID: {stream.id.substring(0, 8)}...</span>
            {isPrincipal && stream.part_count > 1 && (
              <span className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-700 rounded">
                {stream.part_count} partes
              </span>
            )}
            {!stream.ended_at && (
              <span className="px-2 py-0.5 text-xs bg-green-500 text-white rounded">
                ACTIVO
              </span>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium mb-1 block">Título</label>
                <Input
                  placeholder="Título del stream"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              
              <div>
                <label className="text-xs font-medium mb-1 block">Viewer Count</label>
                <Input
                  type="number"
                  placeholder="Cantidad de viewers"
                  value={viewerCount}
                  onChange={(e) => setViewerCount(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block">Streamer</label>
                <Select
                  value={streamerId}
                  onChange={(e) => setStreamerId(e.target.value)}
                >
                  <option value="">Seleccionar streamer</option>
                  {streamers?.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.display_name || s.username}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block">Fecha de Inicio</label>
                <Input
                  type="datetime-local"
                  value={startedAt}
                  onChange={(e) => setStartedAt(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => {
                      setIsActive(e.target.checked)
                      if (e.target.checked) {
                        setEndedAt("")
                      } else if (!endedAt) {
                        // Si se desactiva y no hay fecha, establecer fecha actual
                        setEndedAt(new Date().toISOString().slice(0, 16))
                      }
                    }}
                    className="rounded"
                  />
                  <span>Stream Activo</span>
                </label>
                {!isActive && (
                  <div className="mt-2">
                    <label className="text-xs font-medium mb-1 block">Fecha de Fin</label>
                    <Input
                      type="datetime-local"
                      value={endedAt}
                      onChange={(e) => setEndedAt(e.target.value)}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block">Stream Principal (Parent)</label>
                <Select
                  value={parentStreamId}
                  onChange={(e) => setParentStreamId(e.target.value)}
                >
                  <option value="">Ninguno (Stream principal)</option>
                  {allStreams?.filter((s: any) => s.id !== stream.id).map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.id.substring(0, 8)}... - {s.title || "Sin título"}
                    </option>
                  ))}
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block">Número de Parte</label>
                <Input
                  type="number"
                  min="1"
                  placeholder="1"
                  value={partNumber}
                  onChange={(e) => setPartNumber(e.target.value)}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={handleSave}>
                  Guardar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancel}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <strong>Título:</strong> {stream.title || "Sin título"}
                </div>
                <div>
                  <strong>Viewers:</strong> {stream.viewer_count || "N/A"}
                </div>
                <div>
                  <strong>Streamer:</strong> {stream.streamers?.display_name || stream.streamers?.username || "N/A"}
                </div>
                <div>
                  <strong>Parte:</strong> {stream.part_number || 1}
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground">
                <p>
                  <strong>Inicio:</strong>{" "}
                  {formatInTimeZone(
                    new Date(stream.started_at),
                    timezone,
                    "PPp",
                    { locale: es }
                  )}
                </p>
                {stream.ended_at ? (
                  <p>
                    <strong>Fin:</strong>{" "}
                    {formatInTimeZone(
                      new Date(stream.ended_at),
                      timezone,
                      "PPp",
                      { locale: es }
                    )}
                  </p>
                ) : (
                  <p className="text-green-600">
                    <strong>Estado:</strong> Activo
                  </p>
                )}
              </div>

              {stream.parent_stream_id && (
                <div className="text-xs text-muted-foreground">
                  <strong>Stream Principal:</strong> {stream.parent_stream_id.substring(0, 8)}...
                </div>
              )}

              {stream.parts && stream.parts.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-semibold">Partes:</p>
                  <div className="space-y-1 mt-1">
                    {stream.parts.map((part: any) => (
                      <div
                        key={part.id}
                        className="text-xs pl-4 border-l-2 border-muted"
                      >
                        Parte {part.part_number}: {part.id.substring(0, 8)}...
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => setIsEditing(true)}
              >
                Editar
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Componentes simplificados para otras secciones
function StreamersManager() {
  const { data: streamers, isLoading } = useQuery({
    queryKey: ["streamers"],
    queryFn: async () => {
      const res = await fetch("/api/streamers")
      return res.json()
    },
  })

  if (isLoading) return <div>Cargando streamers...</div>

  return (
    <Card>
      <CardHeader>
        <CardTitle>Streamers</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {streamers?.map((s: any) => (
            <div key={s.id} className="border rounded p-3">
              <p className="font-semibold">{s.display_name || s.username}</p>
              <p className="text-sm text-muted-foreground">@{s.username}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function UsersManager() {
  const { data: users, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch("/api/users")
      return res.json()
    },
  })

  if (isLoading) return <div>Cargando usuarios...</div>

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usuarios</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {users?.map((u: any) => (
            <div key={u.id} className="border rounded p-3">
              <p className="font-semibold">{u.display_name || u.username}</p>
              <p className="text-sm text-muted-foreground">@{u.username}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function EventsManager({ timezone }: { timezone: string }) {
  const { data: events, isLoading } = useQuery({
    queryKey: ["events-admin"],
    queryFn: async () => {
      const res = await fetch("/api/events?limit=100")
      return res.json()
    },
  })

  if (isLoading) return <div>Cargando eventos...</div>

  return (
    <Card>
      <CardHeader>
        <CardTitle>Eventos (últimos 100)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {events?.map((e: any) => (
            <div key={e.id} className="border rounded p-3">
              <p className="font-semibold">{e.event_type}</p>
              <p className="text-sm">{e.content}</p>
              <p className="text-xs text-muted-foreground">
                {formatInTimeZone(
                  new Date(e.created_at),
                  timezone,
                  "PPp",
                  { locale: es }
                )}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function DonationsManager({ timezone }: { timezone: string }) {
  const { data: donations, isLoading } = useQuery({
    queryKey: ["donations-admin"],
    queryFn: async () => {
      const res = await fetch("/api/donations?limit=100")
      return res.json()
    },
  })

  if (isLoading) return <div>Cargando donaciones...</div>

  return (
    <Card>
      <CardHeader>
        <CardTitle>Donaciones (últimas 100)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {donations?.map((d: any) => (
            <div key={d.id} className="border rounded p-3">
              <p className="font-semibold">{d.gift_name} x{d.gift_count}</p>
              <p className="text-sm">
                {d.users?.display_name || d.users?.username}
              </p>
              {d.tiktok_coins && (
                <p className="text-sm">💰 {d.tiktok_coins} coins</p>
              )}
              <p className="text-xs text-muted-foreground">
                {formatInTimeZone(
                  new Date(d.created_at),
                  timezone,
                  "PPp",
                  { locale: es }
                )}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

