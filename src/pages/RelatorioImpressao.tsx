/**
 * RelatorioImpressao — Página de pré-visualização / impressão do relatório analítico.
 * Abre via window.open('/:tenantSlug/relatorio').
 * Impressão somente via botão "Imprimir Documento" ou Ctrl+P.
 */

import { useEffect, useState } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
  LineChart, Line,
} from 'recharts'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ReportData {
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
  neighborhoodData:         Array<{ name: string; value: number }>
  neighborhoodSedeData?:    Array<{ name: string; value: number }>
  neighborhoodDistritoData?: Array<{ name: string; value: number }>
  monthlyTrendData:  Array<{ month: string; total: number }>
  rgTypeMonthlyData?: Array<{ month: string; primeiraVia: number; segundaVia: number }>
  weeklyData:        Array<{ day: string; count: number }>
  deliveryStats: {
    awaitingIssuance: number
    cinReady:         number
    delivered:        number
    totalPending:     number
    avgWaitTime:      string
  }
}

interface StoredReport {
  data:               ReportData
  filters?:           { period?: string; locations?: string[]; statuses?: string[]; cinTypes?: string[]; regions?: string[]; genders?: string[]; users?: string[] }
  systemName?:        string
  currentUser?:       string
  institutionalLogo?: string
  secretariaName?:    string
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const COLORS = ['#009639','#1d4ed8','#dc2626','#d97706','#7c3aed','#0891b2','#374151','#f59e0b','#10b981','#ef4444']

// Dimensões para gráficos — ajustadas para caber bem em cada seção
const PIE_W  = 680
const PIE_H  = 460
const BAR_W  = 680
const BAR_H  = 400
const LINE_W = 680
const LINE_H = 380

const RADIAN = Math.PI / 180

// Percentual dentro da fatia
const InnerLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: {
  cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number; percent: number
}) => {
  if (percent < 0.06) return null
  const r = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + r * Math.cos(-midAngle * RADIAN)
  const y = cy + r * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight="bold">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

// ─── Cabeçalho de seção com faixa verde ──────────────────────────────────────

function PageHeader({ title, subtitle, page, total }: {
  title: string; subtitle?: string; page?: number; total?: number
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      {/* Faixa de cor */}
      <div style={{
        background: 'linear-gradient(135deg, #009639 0%, #00b844 100%)',
        borderRadius: '10px 10px 0 0',
        padding: '14px 22px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: '#fff', margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {title}
          </h2>
          {subtitle && (
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', margin: '3px 0 0' }}>{subtitle}</p>
          )}
        </div>
        {page && total && (
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap' }}>
            Pág. {page}/{total}
          </span>
        )}
      </div>
      {/* Linha inferior decorativa */}
      <div style={{ height: 3, background: 'linear-gradient(90deg, #009639, transparent)', borderRadius: '0 0 3px 3px' }} />
    </div>
  )
}

// ─── Card de sumário com bolinhas + barra de progresso ───────────────────────

function SummaryCard({
  title, subtitle, data,
}: { title: string; subtitle: string; data: Array<{ name: string; value: number; color?: string }> }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const items = data.filter(d => d.value > 0)
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 12,
      padding: '20px 24px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    }}>
      <p style={{ fontWeight: 700, fontSize: 15, margin: '0 0 3px', color: '#111' }}>{title}</p>
      <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 18px' }}>{subtitle}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {items.map((item, i) => {
          const pct   = total > 0 ? (item.value / total) * 100 : 0
          const color = item.color || COLORS[i % COLORS.length]
          return (
            <div key={i}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 14, color: '#374151', fontWeight: 500 }}>{item.name}</span>
                <span style={{
                  fontSize: 13, fontWeight: 700, color: '#fff',
                  background: color, borderRadius: 20,
                  padding: '3px 14px', minWidth: 34, textAlign: 'center',
                }}>{item.value}</span>
              </div>
              <div style={{ height: 7, background: '#f3f4f6', borderRadius: 6 }}>
                <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 6 }} />
              </div>
              <p style={{ fontSize: 11, color: '#9ca3af', margin: '4px 0 0' }}>{pct.toFixed(1)}% do total</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Seção de PIZZA: sumário (topo) + gráfico (base) ─────────────────────────

function PieSection({ title, subtitle, summaryTitle, summarySubtitle, data, pageNum, totalPages }: {
  title: string; subtitle: string
  summaryTitle: string; summarySubtitle: string
  data: Array<{ name: string; value: number; color?: string }>
  pageNum: number; totalPages: number
}) {
  const items = data.filter(d => d.value > 0)
  return (
    <div className="print-page" style={{
      padding: '16px 18px 24px', background: '#fff',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <PageHeader title={title} subtitle={subtitle} page={pageNum} total={totalPages} />
      <div className="avoid-break">
        <SummaryCard title={summaryTitle} subtitle={summarySubtitle} data={items} />
      </div>
      <div className="avoid-break" style={{
        border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 4px 8px',
        background: '#fff', display: 'flex', alignItems: 'flex-start',
        justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        overflow: 'hidden',
      }}>
        <PieChart width={PIE_W} height={PIE_H}>
          <Pie data={items} cx={PIE_W / 2} cy={PIE_H / 2 - 20}
            outerRadius={170} dataKey="value" label={InnerLabel} labelLine={false}>
            {items.map((e, i) => <Cell key={i} fill={e.color || COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(v, n) => [v, n]} />
          <Legend iconType="circle" iconSize={13} wrapperStyle={{ paddingTop: 12 }}
            formatter={v => <span style={{ fontSize: 13, color: '#374151' }}>{v}</span>} />
        </PieChart>
      </div>
    </div>
  )
}

// ─── Seção de BARRAS HORIZONTAIS ─────────────────────────────────────────────

function HBarSection({ title, subtitle, data, color = '#009639', pageNum, totalPages }: {
  title: string; subtitle: string
  data: Array<{ name: string; value: number }>
  color?: string; pageNum: number; totalPages: number
}) {
  const items = data.slice(0, 14)
  const total = items.reduce((s, d) => s + d.value, 0)
  return (
    <div className="print-page" style={{
      padding: '16px 18px 24px', background: '#fff',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <PageHeader title={title} subtitle={subtitle} page={pageNum} total={totalPages} />
      <div className="avoid-break" style={{
        border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 16px 16px 10px',
        background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <BarChart width={BAR_W} height={BAR_H} data={items} layout="vertical"
          margin={{ top: 10, right: 72, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="name" width={155} tick={{ fontSize: 11, fill: '#374151' }} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(v) => [`${v} (${total > 0 ? ((Number(v) / total) * 100).toFixed(1) : 0}%)`, 'Atendimentos']}
            contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
          />
          <Bar dataKey="value" fill={color} radius={[0, 6, 6, 0]}>
            <LabelList dataKey="value" position="right" style={{ fontSize: 11, fill: '#6b7280', fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </div>
    </div>
  )
}

// ─── Seção de LINHA com labels nos pontos ────────────────────────────────────

function LineSection({ title, subtitle, data, pageNum, totalPages }: {
  title: string; subtitle: string
  data: Array<{ month: string; total: number }>
  pageNum: number; totalPages: number
}) {
  const DotLabel = ({ x, y, value }: { x?: number; y?: number; value?: number }) => {
    if (!x || !y || value === undefined) return null
    return (
      <text x={x} y={y - 14} textAnchor="middle" fontSize={12} fontWeight="bold" fill="#374151">
        {value}
      </text>
    )
  }

  return (
    <div className="print-page" style={{
      padding: '16px 18px 24px', background: '#fff',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <PageHeader title={title} subtitle={subtitle} page={pageNum} total={totalPages} />
      <div className="avoid-break" style={{
        border: '1px solid #e5e7eb', borderRadius: 12, padding: '24px 16px 16px',
        background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <LineChart width={LINE_W} height={LINE_H} data={data}
          margin={{ top: 30, right: 40, left: 10, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }} />
          <Line type="monotone" dataKey="total" stroke="#009639" strokeWidth={3}
            dot={{ fill: '#009639', r: 6, strokeWidth: 2, stroke: '#fff' }}
            activeDot={{ r: 8 }} name="Agendamentos"
            label={<DotLabel />}
          />
        </LineChart>
      </div>
    </div>
  )
}

// ─── Seção de BAIRROS/LOCALIDADES genérica ────────────────────────────────────

function BairrosSection({ title, subtitle, data, accentColor = '#009639', pageNum, totalPages }: {
  title: string; subtitle: string
  data:  Array<{ name: string; value: number }>
  accentColor?: string
  pageNum: number; totalPages: number
}) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const items = data.length > 0 ? data : [{ name: 'Sem dados', value: 0 }]

  return (
    <div className="print-page" style={{
      padding: '16px 18px 24px', background: '#fff',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <PageHeader title={title} subtitle={subtitle} page={pageNum} total={totalPages} />

      {/* Grade de cards */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, alignContent: 'start' }}>
        {items.map((item, i) => {
          const pct = total > 0 ? (item.value / total) * 100 : 0
          const color = COLORS[i % COLORS.length]
          return (
            <div key={i} className="avoid-break" style={{
              borderLeft: `5px solid ${color}`,
              borderRadius: 10,
              padding: '16px 18px',
              background: `${color}0d`,
              boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
            }}>
              <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 6px', fontWeight: 600, lineHeight: 1.3 }}>{item.name}</p>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 36, fontWeight: 900, color, lineHeight: 1 }}>{item.value}</span>
                <span style={{ fontSize: 13, color: '#9ca3af', fontWeight: 500 }}>{pct.toFixed(1)}%</span>
              </div>
              <div style={{ height: 5, background: '#f3f4f6', borderRadius: 4, marginTop: 10 }}>
                <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4 }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* Rodapé da seção */}
      <div style={{ borderTop: `2px solid ${accentColor}20`, paddingTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
        <span style={{ fontSize: 11, color: '#9ca3af' }}>Total: <strong style={{ color: '#374151' }}>{total}</strong> atendimentos</span>
      </div>
    </div>
  )
}

// ─── Estatísticas detalhadas por localidade ──────────────────────────────────

type LocationStat = {
  name: string; address: string; total: number
  pending: number; confirmed: number; completed: number
  awaitingIssuance: number; cinReady: number; cinDelivered: number
  cancelled: number; firstVia: number; secondVia: number; successRate: string
}

function LocationDetailSection({ stats, totalGeral, pageNum, totalPages }: {
  stats: LocationStat[]; totalGeral: number; pageNum: number; totalPages: number
}) {
  return (
    <div className="print-page" style={{ padding: '16px 18px 24px', background: '#fff', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        title="Estatísticas Detalhadas por Localidade"
        subtitle="Dados completos de cada unidade de atendimento"
        page={pageNum} total={totalPages}
      />
      {stats.map((s, i) => {
        const pct = totalGeral > 0 ? (s.total / totalGeral * 100).toFixed(1) : '0'
        return (
          <div key={i} className="avoid-break" style={{
            border: '1px solid #e5e7eb', borderRadius: 12,
            overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}>
            {/* Cabeçalho da localidade */}
            <div style={{ background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', padding: '14px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 800, color: '#111', margin: 0 }}>{s.name}</p>
                <p style={{ fontSize: 11, color: '#6b7280', margin: '3px 0 0' }}>{s.address}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 32, fontWeight: 900, color: '#009639', margin: 0, lineHeight: 1 }}>{s.total}</p>
                <p style={{ fontSize: 11, color: '#6b7280', margin: '3px 0 0' }}>agendamentos · {pct}% do total</p>
              </div>
            </div>
            {/* Grade de status */}
            <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {[
                { label: 'Pendentes',       value: s.pending,          color: '#d97706' },
                { label: 'Confirmados',     value: s.confirmed,        color: '#0891b2' },
                { label: 'Aguardando CIN',  value: s.awaitingIssuance, color: '#8b5cf6' },
                { label: 'CIN Prontas',     value: s.cinReady,         color: '#ec4899' },
                { label: 'CIN Entregues',   value: s.cinDelivered,     color: '#0284c7' },
                { label: 'Cancelados',      value: s.cancelled,        color: '#dc2626' },
                { label: '1ª Via',          value: s.firstVia,         color: '#3b82f6' },
                { label: '2ª Via',          value: s.secondVia,        color: '#7c3aed' },
              ].map((item, j) => (
                <div key={j} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: `${item.color}08`, borderRadius: 8, border: `1px solid ${item.color}20` }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 10, color: '#6b7280', margin: 0, fontWeight: 500 }}>{item.label}</p>
                    <p style={{ fontSize: 18, fontWeight: 800, color: item.color, margin: 0, lineHeight: 1.1 }}>{item.value}</p>
                  </div>
                </div>
              ))}
            </div>
            {/* Rodapé: taxa de sucesso */}
            <div style={{ padding: '10px 16px', borderTop: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 12, background: '#fafafa' }}>
              <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Taxa de Sucesso:</span>
              <div style={{ flex: 1, height: 8, background: '#e5e7eb', borderRadius: 4 }}>
                <div style={{ height: '100%', width: `${s.successRate}%`, background: '#009639', borderRadius: 4 }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#009639' }}>{s.successRate}%</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Seção comparativa 1ª via vs 2ª via por mês ──────────────────────────────

function RgTypeMonthlySection({ rgTypeData, monthlyData, pageNum, totalPages }: {
  rgTypeData: Array<{ name: string; value: number; color?: string }>
  monthlyData: Array<{ month: string; primeiraVia: number; segundaVia: number }>
  pageNum: number; totalPages: number
}) {
  const v1  = rgTypeData.find(d => d.name === '1ª via')?.value ?? 0
  const v2  = rgTypeData.find(d => d.name === '2ª via')?.value ?? 0
  const tot = v1 + v2
  const kpis = [
    { label: '1ª Via',  value: v1,  pct: tot > 0 ? (v1 / tot * 100).toFixed(1) : '0', color: '#3b82f6' },
    { label: '2ª Via',  value: v2,  pct: tot > 0 ? (v2 / tot * 100).toFixed(1) : '0', color: '#8b5cf6' },
    { label: 'Total',   value: tot, pct: '100', color: '#009639' },
  ]
  return (
    <div className="print-page" style={{ padding: '16px 18px 24px', background: '#fff', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <PageHeader
        title="Evolução Mensal por Tipo de CIN"
        subtitle="Comparativo mês a mês — 1ª via vs 2ª via"
        page={pageNum} total={totalPages}
      />

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
        {kpis.map((kpi, i) => (
          <div key={i} style={{
            border: `2px solid ${kpi.color}30`, borderRadius: 12,
            padding: '18px 24px', background: `${kpi.color}08`, textAlign: 'center',
          }}>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 8px', fontWeight: 600 }}>{kpi.label}</p>
            <p style={{ fontSize: 44, fontWeight: 900, color: kpi.color, margin: 0, lineHeight: 1 }}>{kpi.value}</p>
            <p style={{ fontSize: 11, color: '#9ca3af', margin: '6px 0 0' }}>
              {kpi.label === 'Total' ? 'total emissões' : `${kpi.pct}% do total`}
            </p>
          </div>
        ))}
      </div>

      {/* Gráfico de barras agrupadas */}
      <div className="avoid-break" style={{
        border: '1px solid #e5e7eb', borderRadius: 12, padding: '20px 10px 16px',
        background: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <BarChart width={BAR_W} height={BAR_H} data={monthlyData}
          margin={{ top: 20, right: 40, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }} />
          <Legend iconType="circle" iconSize={11}
            formatter={v => <span style={{ fontSize: 12, color: '#374151' }}>{v}</span>} />
          <Bar dataKey="primeiraVia" name="1ª Via" fill="#3b82f6" radius={[4,4,0,0]}>
            <LabelList dataKey="primeiraVia" position="top" style={{ fontSize: 10, fill: '#374151', fontWeight: 600 }} />
          </Bar>
          <Bar dataKey="segundaVia" name="2ª Via" fill="#8b5cf6" radius={[4,4,0,0]}>
            <LabelList dataKey="segundaVia" position="top" style={{ fontSize: 10, fill: '#374151', fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </div>
    </div>
  )
}

// ─── KPI Card empilhado (Resumo Executivo) ────────────────────────────────────

function StackedKpi({ label, value, bg, fg, border }: {
  label: string; value: number; bg: string; fg: string; border?: string
}) {
  return (
    <div className="avoid-break" style={{
      background: bg, border: border || 'none', borderRadius: 16,
      padding: '24px 32px', textAlign: 'center',
      boxShadow: bg === '#ffffff' ? '0 1px 6px rgba(0,0,0,0.08)' : '0 2px 12px rgba(0,0,0,0.12)',
    }}>
      <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 12px', lineHeight: 1.3,
        color: fg === '#ffffff' ? 'rgba(255,255,255,0.85)' : '#6b7280',
      }}>{label}</p>
      <p style={{ fontSize: 56, fontWeight: 900, margin: 0, lineHeight: 1, color: fg }}>{value}</p>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function RelatorioImpressao() {
  const [report, setReport] = useState<StoredReport | null>(null)
  const [loading, setLoading] = useState(true)

  // Esconde VLibras (script global injetado pelo index.html)
  useEffect(() => {
    const hide = () => {
      ['[vw]', '.vw-access-button', '.vw-plugin-wrapper', '.vw-plugin-top-container', '#VLibrasPlugin']
        .forEach(sel => document.querySelectorAll<HTMLElement>(sel).forEach(el => {
          el.style.setProperty('display', 'none', 'important')
        }))
    }
    hide()
    const t1 = setTimeout(hide, 600)
    const t2 = setTimeout(hide, 1800)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  useEffect(() => {
    const raw = localStorage.getItem('relatorio-print-data')
    if (raw) {
      try {
        setReport(JSON.parse(raw))
        localStorage.removeItem('relatorio-print-data')
      } catch { /* ignore */ }
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!loading && report) document.title = 'Relatório Analítico'
  }, [loading, report])

  if (loading) return <Splash msg="Preparando relatório..." />
  if (!report)  return <Splash msg="Dados não encontrados. Volte ao Analytics e clique em 'Exportar PDF'." error />

  const { data, filters, systemName, currentUser, institutionalLogo, secretariaName } = report
  const now     = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  const orgName = secretariaName || systemName || 'Secretaria Municipal'

  const cancelledCount = data.statusData
    .filter(d => d.name.toLowerCase().includes('cancel'))
    .reduce((s, d) => s + d.value, 0)

  const deliveryData = [
    { name: 'Em emissão',          value: data.deliveryStats.awaitingIssuance, color: '#8b5cf6' },
    { name: 'Prontas p/ retirada', value: data.deliveryStats.cinReady,         color: '#0ea5e9' },
    { name: 'Entregues',           value: data.deliveryStats.delivered,         color: '#009639' },
  ]

  // capa(1)+executivo(2)+status(3)+tipo(4)+tipo-mensal(5)+região(6)
  // +sede(7)+distritos(8)+gênero(9)+unidade(10)+unidade-detalhe(11)+tendência(12)+semanal(13)+entrega(14)+top bairros(15)
  const TOTAL = 15

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      {/* ── Botões flutuantes ─────────────────────────────────────────────── */}
      <div className="no-print" style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <button onClick={() => window.print()} style={{
          background: 'linear-gradient(135deg,#009639,#00b844)', color: '#fff',
          border: 'none', borderRadius: 10, padding: '13px 22px',
          fontSize: 14, fontWeight: 600, cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(0,150,57,0.4)',
        }}>
          🖨️ Imprimir Documento
        </button>
        <button onClick={() => window.close()} style={{
          background: '#f3f4f6', color: '#374151',
          border: 'none', borderRadius: 10, padding: '10px 22px',
          fontSize: 13, cursor: 'pointer',
        }}>
          ✕ Fechar
        </button>
      </div>

      {/* ═══ PÁGINA 1 — CAPA ═══════════════════════════════════════════════ */}
      <div className="print-page avoid-break" style={{
        display: 'flex', flexDirection: 'column',
        height: '297mm', background: '#fff',
        borderTop: '12px solid #009639',
        overflow: 'hidden',
        paddingTop: '30mm',
      }}>
        {/* Conteúdo superior */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0 48px' }}>
          {institutionalLogo && (
            <img src={institutionalLogo} alt="Logo"
              style={{ height: 200, maxWidth: 400, objectFit: 'contain', marginBottom: 36 }} />
          )}
          <h1 style={{ fontSize: 46, fontWeight: 900, color: '#0d0d0d', margin: '0 0 14px', letterSpacing: 2 }}>
            RELATÓRIO ANALÍTICO
          </h1>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#009639', margin: '0 0 32px', textTransform: 'uppercase', letterSpacing: 2 }}>
            {orgName.toUpperCase()}
          </h2>
          <div style={{ width: 120, height: 4, background: 'linear-gradient(90deg,#009639,#e5e7eb)', margin: '0 0 28px', borderRadius: 2 }} />
          <p style={{ fontSize: 18, color: '#374151', margin: 0, fontWeight: 500 }}>
            Emitido por <strong style={{ color: '#0d0d0d' }}>{currentUser || 'Usuário'}</strong> — {now}
          </p>
          {(() => {
            const vals = [
              ...(filters?.users     || []),
              ...(filters?.locations || []),
              ...(filters?.statuses  || []),
              ...(filters?.cinTypes  || []),
              ...(filters?.regions   || []),
              ...(filters?.genders   || []),
            ].filter(Boolean)
            return (
              <>
                {vals.length > 0 && (
                  <p style={{ fontSize: 14, color: '#374151', marginTop: 10, marginBottom: 0 }}>
                    <strong>Filtros:</strong> {vals.join(', ')}
                  </p>
                )}
                {filters?.period && (
                  <p style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>Período: {filters.period}</p>
                )}
              </>
            )
          })()}
        </div>

        {/* Bonecos + barra verde — empurrados para o fundo, com espaço mínimo acima */}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', paddingTop: '16mm' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <img src="/boneco_rg.png" alt="Bonecos CIN"
              style={{ maxHeight: 340, maxWidth: '85%', objectFit: 'contain', objectPosition: 'bottom', display: 'block' }} />
          </div>
          {/* Barra verde inferior */}
          <div style={{ height: 12, background: '#009639' }} />
        </div>
      </div>

      {/* ═══ PÁGINA 2 — RESUMO EXECUTIVO ═══════════════════════════════════ */}
      <div className="print-page avoid-break" style={{
        background: '#fff', display: 'flex', flexDirection: 'column',
        alignItems: 'center', minHeight: '270mm', padding: '36px 28px 32px',
      }}>
        <h1 style={{
          fontSize: 42, fontWeight: 900, color: '#111',
          textTransform: 'uppercase', textAlign: 'center',
          margin: '0 0 28px', letterSpacing: 1,
          borderBottom: '3px solid #009639', paddingBottom: 16, width: '100%',
        }}>
          RESUMO EXECUTIVO
        </h1>

        {/* Filtros */}
        {(() => {
          const vals = [
            ...(filters?.users     || []),
            ...(filters?.locations || []),
            ...(filters?.statuses  || []),
            ...(filters?.cinTypes  || []),
            ...(filters?.regions   || []),
            ...(filters?.genders   || []),
          ].filter(Boolean)
          const hasPeriod = filters?.period && filters.period !== 'Todos os Períodos'
          if (vals.length === 0 && !hasPeriod) return null
          return (
            <div style={{ width: '100%', maxWidth: 560, marginBottom: 28, fontSize: 13, color: '#374151', display: 'flex', flexDirection: 'column', gap: 6, borderLeft: '3px solid #009639', paddingLeft: 12 }}>
              {vals.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  <span style={{ fontWeight: 700, whiteSpace: 'nowrap', marginRight: 4 }}>Filtros aplicados:</span>
                  <span style={{ color: '#374151' }}>{vals.join(', ')}</span>
                </div>
              )}
              <div style={{ display: 'flex', gap: 4 }}>
                <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Período:</span>
                <span style={{ color: '#6b7280' }}>{filters?.period || 'Todos os Períodos'}</span>
              </div>
            </div>
          )
        })()}

        {/* KPI Cards empilhados */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', maxWidth: 440 }}>
          <StackedKpi label="Total de Agendamentos"           value={data.totalAppointments}     bg="#e5e7eb"  fg="#111827" />
          <StackedKpi label="Cancelados"                       value={cancelledCount}              bg="#dc2626"  fg="#ffffff" />
          <StackedKpi label="Total CIN Prontas"                value={data.cinReady}               bg="#ec4899"  fg="#ffffff" />
          <StackedKpi label="Total CIN Entregues"              value={data.cinDelivered}           bg="#0891b2"  fg="#ffffff" />
          <StackedKpi label="Total Aguardando Confecção"       value={data.waitingForDelivery}     bg="#ffffff"  fg="#111827" border="2px solid #e5e7eb" />
        </div>
      </div>

      {/* ═══ PÁGINAS DE GRÁFICOS ════════════════════════════════════════════ */}

      <PieSection
        title="Distribuição por Status"      subtitle="Agendamentos por status atual"
        summaryTitle="Resumo de Status"      summarySubtitle="Quantidade por categoria"
        data={data.statusData} pageNum={3} totalPages={TOTAL}
      />

      <PieSection
        title="Distribuição por Tipo de CIN" subtitle="Comparação entre 1ª e 2ª via"
        summaryTitle="Resumo de Tipos"       summarySubtitle="Quantidade por tipo de CIN"
        data={data.rgTypeData} pageNum={4} totalPages={TOTAL}
      />

      {/* ═══ EVOLUÇÃO MENSAL POR TIPO (1ª via vs 2ª via) ════════════════════ */}
      <RgTypeMonthlySection
        rgTypeData={data.rgTypeData}
        monthlyData={data.rgTypeMonthlyData ?? []}
        pageNum={5} totalPages={TOTAL}
      />

      <PieSection
        title="Distribuição por Região"      subtitle="Agendamentos por região (Sede vs Distrito)"
        summaryTitle="Resumo por Região"     summarySubtitle="Quantidade por categoria de região"
        data={data.regionData} pageNum={6} totalPages={TOTAL}
      />

      {/* ═══ REGIÕES ESPECÍFICAS — SEDE ═════════════════════════════════════ */}
      <BairrosSection
        title="Distribuição por Regiões Específicas — Sede"
        subtitle="Bairros e localidades atendidos pela sede"
        data={data.neighborhoodSedeData ?? []}
        accentColor="#009639"
        pageNum={7} totalPages={TOTAL}
      />

      {/* ═══ REGIÕES ESPECÍFICAS — DISTRITOS ════════════════════════════════ */}
      <BairrosSection
        title="Distribuição por Regiões Específicas — Distritos"
        subtitle="Localidades atendidas pelos distritos"
        data={data.neighborhoodDistritoData ?? []}
        accentColor="#7c3aed"
        pageNum={8} totalPages={TOTAL}
      />

      <PieSection
        title="Distribuição por Gênero"      subtitle="Agendamentos por gênero declarado"
        summaryTitle="Resumo de Gênero"      summarySubtitle="Quantidade por gênero"
        data={data.genderData} pageNum={9} totalPages={TOTAL}
      />

      <HBarSection
        title="Distribuição por Unidade/Local" subtitle="Atendimentos por unidade de atendimento"
        data={data.locationData} color="#009639" pageNum={10} totalPages={TOTAL}
      />

      {/* ═══ ESTATÍSTICAS DETALHADAS POR LOCALIDADE ═════════════════════════ */}
      {(data.locationDetailedStats ?? []).length > 0 && (
        <LocationDetailSection
          stats={data.locationDetailedStats!}
          totalGeral={data.locationData.reduce((s, d) => s + d.value, 0)}
          pageNum={11} totalPages={TOTAL}
        />
      )}

      <LineSection
        title="Tendência Mensal de Agendamentos" subtitle="Evolução no período filtrado"
        data={data.monthlyTrendData} pageNum={12} totalPages={TOTAL}
      />

      {/* Semanal só aparece quando o filtro de período for "Esta Semana" */}
      {filters?.period === 'Esta Semana' && (
        <HBarSection
          title="Distribuição Semanal" subtitle="Atendimentos por dia da semana"
          data={(data.weeklyData ?? []).map(d => ({ name: d.day, value: d.count }))}
          color="#7c3aed" pageNum={13} totalPages={TOTAL}
        />
      )}

      <PieSection
        title="Entrega de CIN"              subtitle="Status do processo de entrega"
        summaryTitle="Resumo de Entrega"    summarySubtitle="Etapas do processo"
        data={deliveryData} pageNum={14} totalPages={TOTAL}
      />

      {/* ═══ TOP BAIRROS GERAL ══════════════════════════════════════════════ */}
      <HBarSection
        title="Top Bairros / Comunidades"  subtitle="Localidades com mais atendimentos (geral)"
        data={data.neighborhoodData} color="#1d4ed8" pageNum={15} totalPages={TOTAL}
      />

      {/* Rodapé */}
      <div style={{ textAlign: 'center', padding: '14px', borderTop: '3px solid #009639', color: '#9ca3af', fontSize: 11 }}>
        {orgName} — Relatório gerado em {now}
      </div>
    </>
  )
}

// ─── Splash de loading/erro ───────────────────────────────────────────────────

function Splash({ msg, error }: { msg: string; error?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', fontFamily: 'Arial,sans-serif' }}>
      <p style={{ color: error ? '#dc2626' : '#6b7280', textAlign: 'center', maxWidth: 340, lineHeight: 1.6 }}>{msg}</p>
    </div>
  )
}

// ─── CSS de impressão ─────────────────────────────────────────────────────────

const PRINT_CSS = `
  @page {
    size: 210mm 297mm portrait;
    margin: 8mm 10mm;
  }
  @page :first { size: 210mm 297mm portrait; }
  @page :left  { size: 210mm 297mm portrait; }
  @page :right { size: 210mm 297mm portrait; }

  html {
    margin: 0; padding: 0;
    background: #d1d5db;
    min-height: 100%;
    font-family: 'Helvetica Neue', Arial, sans-serif;
  }
  body {
    margin: 0 auto; padding: 0;
    background: #fff;
    max-width: 794px;
    border: 1px solid #9ca3af;
    box-shadow: 0 4px 32px rgba(0,0,0,0.25);
    min-height: 100vh;
  }

  *, *::before, *::after {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
    box-sizing: border-box;
  }

  .print-page { page-break-before: always; break-before: page; width: 100%; }
  .print-page:first-of-type { page-break-before: auto; break-before: auto; }
  .avoid-break { page-break-inside: avoid; break-inside: avoid; }
  .no-print    { display: flex; }

  @media print {
    /* Sem margens na impressão → aproveita 100% da folha */
    @page { size: 210mm 297mm portrait; margin: 0; }

    *, *::before, *::after {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    html { background: #fff !important; }
    html, body {
      width: 210mm !important;
      max-width: 210mm !important;
      margin: 0 !important;
      padding: 0 !important;
      box-shadow: none !important;
      border: none !important;   /* SEM borda na impressão */
    }

    .no-print, button {
      display: none !important;
    }
    [vw],[vw="true"],[vw="false"],
    .vw-access-button,.vw-plugin-wrapper,.vw-plugin-top-container,
    #VLibrasPlugin,[data-vw],div[id*="vlibras" i],div[class*="vw-" i] {
      display: none !important; visibility: hidden !important;
    }

    .print-page {
      page-break-before: always !important; break-before: page !important;
      width: 100% !important; max-width: none !important;
    }
    .print-page:first-of-type { page-break-before: auto !important; break-before: auto !important; }
    .avoid-break { page-break-inside: avoid !important; break-inside: avoid !important; }
  }
`
