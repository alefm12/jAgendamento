/**
 * AnalyticsPDFExport
 *
 * Ao invés de gerar PDF via biblioteca (jsPDF / html2canvas),
 * serializa os dados no sessionStorage e abre uma nova aba em
 * /:tenantSlug/relatorio — página print-friendly com window.print().
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { FilePdf, SpinnerGap } from '@phosphor-icons/react'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface AnalyticsPDFExportProps {
  data: {
    totalAppointments:     number
    todayAppointments:     number
    monthAppointments:     number
    completedAppointments: number
    cinDelivered:          number
    waitingForDelivery:    number
    statusData:       Array<{ name: string; value: number; color: string }>
    rgTypeData:       Array<{ name: string; value: number; color?: string }>
    locationData:     Array<{ name: string; value: number }>
    locationDetailedStats?: Array<{
      name: string; address: string; total: number
      pending: number; confirmed: number; completed: number
      awaitingIssuance: number; cinReady: number; cinDelivered: number
      cancelled: number; firstVia: number; secondVia: number; successRate: string
    }>
    regionData:       Array<{ name: string; value: number; color?: string }>
    genderData:       Array<{ name: string; value: number; color?: string }>
    neighborhoodData:          Array<{ name: string; value: number }>
    neighborhoodSedeData?:     Array<{ name: string; value: number }>
    neighborhoodDistritoData?: Array<{ name: string; value: number }>
    monthlyTrendData:  Array<{ month: string; total: number }>
    rgTypeMonthlyData: Array<{ month: string; primeiraVia: number; segundaVia: number }>
    weeklyData:        Array<{ day: string; count: number }>
    deliveryStats: {
      awaitingIssuance: number
      cinReady:         number
      delivered:        number
      totalPending:     number
      avgWaitTime:      string
    }
  }
  filters?: {
    period?:    string
    locations?: string[]
    statuses?:  string[]
    cinTypes?:  string[]
    regions?:   string[]
    genders?:   string[]
    users?:     string[]
  }
  systemName?:        string
  currentUser?:       string
  institutionalLogo?: string
  secretariaName?:    string
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function AnalyticsPDFExport({
  data, filters, systemName, currentUser, institutionalLogo, secretariaName,
}: AnalyticsPDFExportProps) {
  const [loading, setLoading] = useState(false)

  const handleExport = () => {
    setLoading(true)
    // Usa setTimeout para liberar a thread do browser antes de serializar
    // o payload (JSON.stringify grande pode ser síncrono e bloquear a UI)
    setTimeout(() => {
      try {
        const payload = {
          data,
          filters,
          systemName,
          currentUser,
          institutionalLogo,
          secretariaName,
        }
        // localStorage é compartilhado entre abas da mesma origem,
        // ao contrário do sessionStorage que é isolado por aba
        localStorage.setItem('relatorio-print-data', JSON.stringify(payload))

        const parts = window.location.pathname.split('/').filter(Boolean)
        const tenantSlug = parts[0] || 'relatorio'

        // noopener,noreferrer abre em processo separado no Chromium/Edge,
        // evitando que a renderização dos gráficos bloqueie esta aba
        window.open(`/${tenantSlug}/relatorio`, '_blank', 'noopener,noreferrer')
      } catch (err) {
        console.error('[AnalyticsPDFExport] Erro ao preparar relatório:', err)
      } finally {
        setTimeout(() => setLoading(false), 600)
      }
    }, 0)
  }

  return (
    <Button
      onClick={handleExport}
      disabled={loading}
      className="gap-2 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-lg hover:shadow-xl transition-all"
    >
      {loading
        ? <SpinnerGap size={20} className="animate-spin" />
        : <FilePdf size={20} weight="fill" />}
      {loading ? 'Preparando...' : 'Exportar PDF Completo'}
    </Button>
  )
}
