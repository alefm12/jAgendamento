import { Router } from 'express'
import { query } from '../config/db'

const router = Router()

const DEFAULT_PUBLIC_NAME = 'PREFEITURA MUNICIPAL'
const DEFAULT_PUBLIC_SUBTITLE = 'Serviço de Agendamento'
const DEFAULT_PUBLIC_PRIMARY = '#059669'
const DEFAULT_PUBLIC_SECONDARY = '#1d4ed8'

type PublicBrandingRow = {
  nome: string
  nome_exibicao: string | null
  subtitulo: string | null
  telefone_contato: string | null
  cor_principal: string | null
  cor_botao_agendar: string | null
  cor_botao_consultar: string | null
  logo_path: string | null
  fundo_path: string | null
}

type PublicLocationRow = {
  id: number
  nome_local: string
  endereco: string | null
  link_mapa: string | null
  ativo: boolean | null
  criado_em: string | null
}

type PublicAppointmentRow = {
  id: number
  local_id: number | null
  data_agendamento: string | Date
  hora_agendamento: string | null
  status: string | null
}

type PublicBlockedDateRow = {
  id: number
  data: string | Date
  motivo: string | null
  tipo_bloqueio: string | null
  horarios_bloqueados: unknown
  criado_por: string | null
  criado_em: string | Date | null
}

type TenantCallRow = {
  id: number
  cidadao_nome: string
  cidadao_cpf: string
  data_agendamento: string | Date
  hora_agendamento: string | null
  status: string | null
  local_nome: string | null
  local_endereco: string | null
}

type TenantBrandingRow = {
  id: number
  nome: string
  logo_path: string | null
  cor_principal: string | null
}

type TenantCallsConfigRow = {
  voz_tipo: string | null
  voz_idioma: string | null
  voz_genero: string | null
  voz_velocidade: number | null
  voz_volume: number | null
  template_chamada: string | null
  cor_fundo_chamada: string | null
  cor_texto_chamada: string | null
  cor_destaque_chamada: string | null
}

function buildPublicResponse(row?: PublicBrandingRow) {
  return {
    nome: row?.nome_exibicao ?? row?.nome ?? DEFAULT_PUBLIC_NAME,
    subtitulo: row?.subtitulo ?? DEFAULT_PUBLIC_SUBTITLE,
    cores: {
      principal: row?.cor_principal ?? DEFAULT_PUBLIC_PRIMARY,
      agendar: row?.cor_botao_agendar ?? DEFAULT_PUBLIC_PRIMARY,
      consultar: row?.cor_botao_consultar ?? DEFAULT_PUBLIC_SECONDARY
    },
    logo: row?.logo_path ?? null,
    fundo: row?.fundo_path ?? null,
    telefone: row?.telefone_contato ?? null
  }
}

function fallbackResponse(slug: string) {
  if (slug === 'iraucuba') {
    return {
      nome: 'PREFEITURA DE IRAUÇUBA',
      subtitulo: 'SERVIÇO DE AGENDAMENTO DE RG',
      cores: {
        principal: DEFAULT_PUBLIC_PRIMARY,
        agendar: DEFAULT_PUBLIC_PRIMARY,
        consultar: DEFAULT_PUBLIC_SECONDARY
      },
      logo:
        'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Bras%C3%A3o_de_Irau%C3%A7uba.png/1200px-Bras%C3%A3o_de_Irau%C3%A7uba.png',
      fundo: null,
      telefone: '(88) 3636-1133'
    }
  }

  return {
    nome: DEFAULT_PUBLIC_NAME,
    subtitulo: DEFAULT_PUBLIC_SUBTITLE,
    cores: {
      principal: DEFAULT_PUBLIC_PRIMARY,
      agendar: DEFAULT_PUBLIC_PRIMARY,
      consultar: DEFAULT_PUBLIC_SECONDARY
    },
    logo: null,
    fundo: null,
    telefone: null
  }
}

router.get('/public/config/:slug', async (req, res) => {
  const { slug } = req.params

  try {
    const result = await query(
      `SELECT 
        p.nome,
        b.nome_exibicao,
        b.subtitulo,
        b.telefone_contato,
        b.cor_principal,
        b.cor_botao_agendar,
        b.cor_botao_consultar,
        b.logo_path,
        b.fundo_path
      FROM prefeituras p
      LEFT JOIN tenant_branding b ON b.prefeitura_id = p.id
      WHERE p.slug = $1
      LIMIT 1`,
      [slug]
    )

    if ((result.rowCount ?? 0) > 0) {
      const row = result.rows[0] as PublicBrandingRow | undefined
      const built = buildPublicResponse(row)
      // Se não há logo no banco, tenta o fallback para o slug
      if (!built.logo) {
        const fb = fallbackResponse(slug)
        built.logo = fb.logo
      }
      return res.json(built)
    }

    return res.json(fallbackResponse(slug))
  } catch (error) {
    console.warn(`[Public Config] Erro ao buscar tenant '${slug}' (usando fallback):`, error)
    return res.json(fallbackResponse(slug))
  }
})

router.get('/public/locations/:slug', async (req, res) => {
  const { slug } = req.params

  try {
    const tenantResult = await query('SELECT id FROM prefeituras WHERE slug = $1 LIMIT 1', [slug])
    const tenantRow = tenantResult.rows[0] as { id: number } | undefined

    if (!tenantRow) {
      console.warn(`[Public Locations] Prefeitura '${slug}' não encontrada.`)
      res.json([])
      return
    }

    const locationsResult = await query(
      `SELECT id, nome_local, endereco, link_mapa, ativo, criado_em
         FROM locais_atendimento
        WHERE prefeitura_id = $1
          AND (ativo IS DISTINCT FROM FALSE)
        ORDER BY nome_local ASC`,
      [tenantRow.id]
    )

    const payload = locationsResult.rows.map((row) => {
      const typedRow = row as any
      return {
        id: String(typedRow.id),
        name: typedRow.nome_local,
        address: typedRow.endereco ?? '',
        googleMapsUrl: typedRow.link_mapa ?? undefined,
        isActive: typedRow.ativo ?? true,
        createdAt: typedRow.criado_em ?? new Date().toISOString()
      }
    })

    console.log(`[Public Locations] slug=${slug} ->`, payload)
    res.json(payload)
  } catch (error) {
    console.error(`[Public Locations] Erro ao buscar locais para '${slug}':`, error)
    res.status(500).json({ message: 'Não foi possível carregar os locais de atendimento.' })
  }
})

// Retorna configuração de horários/vagas para o agendamento público (sem auth)
router.get('/public/horarios/:slug', async (req, res) => {
  const { slug } = req.params
  try {
    const tenantResult = await query(
      'SELECT id FROM prefeituras WHERE slug = $1 LIMIT 1',
      [slug]
    )
    const tenantRow = tenantResult.rows[0] as { id: number } | undefined
    if (!tenantRow) {
      return res.json({ workingHours: null, maxAppointmentsPerSlot: 2, bookingWindowDays: 60 })
    }

    const hResult = await query(
      `SELECT horarios_disponiveis, max_agendamentos_por_horario, periodo_liberado_dias
       FROM horarios_config WHERE prefeitura_id = $1 LIMIT 1`,
      [tenantRow.id]
    )

    if (hResult.rows.length === 0) {
      return res.json({ workingHours: null, maxAppointmentsPerSlot: 2, bookingWindowDays: 60 })
    }

    const row = hResult.rows[0] as {
      horarios_disponiveis: string
      max_agendamentos_por_horario: number
      periodo_liberado_dias: number
    }

    const workingHours = row.horarios_disponiveis
      ? row.horarios_disponiveis.split(',').map((h: string) => h.trim()).filter(Boolean)
      : null

    return res.json({
      workingHours,
      maxAppointmentsPerSlot: row.max_agendamentos_por_horario ?? 2,
      bookingWindowDays: row.periodo_liberado_dias ?? 60
    })
  } catch (error) {
    console.error('[Public Horarios] Erro:', error)
    return res.json({ workingHours: null, maxAppointmentsPerSlot: 2, bookingWindowDays: 60 })
  }
})

router.get('/public/appointments/:slug', async (req, res) => {
  const { slug } = req.params

  try {
    const tenantResult = await query('SELECT id FROM prefeituras WHERE slug = $1 LIMIT 1', [slug])
    const tenantRow = tenantResult.rows[0] as { id: number } | undefined

    if (!tenantRow) {
      return res.json([])
    }

    const result = await query(
      `SELECT id, local_id, data_agendamento, hora_agendamento, status
         FROM agendamentos
        WHERE prefeitura_id = $1`,
      [tenantRow.id]
    )

    const payload = result.rows.map((row) => {
      const typedRow = row as PublicAppointmentRow
      return {
        id: String(typedRow.id),
        locationId: typedRow.local_id != null ? String(typedRow.local_id) : '',
        date:
          typedRow.data_agendamento instanceof Date
            ? typedRow.data_agendamento.toISOString().slice(0, 10)
            : String(typedRow.data_agendamento),
        time: typedRow.hora_agendamento ? String(typedRow.hora_agendamento).slice(0, 5) : '00:00',
        status: typedRow.status ?? 'pending'
      }
    })

    return res.json(payload)
  } catch (error) {
    console.error(`[Public Appointments] Erro ao buscar agendamentos para '${slug}':`, error)
    return res.status(500).json({ message: 'Não foi possível carregar os agendamentos públicos.' })
  }
})

router.get('/public/blocked-dates/:slug', async (req, res) => {
  const { slug } = req.params

  try {
    const tenantResult = await query('SELECT id FROM prefeituras WHERE slug = $1 LIMIT 1', [slug])
    const tenantRow = tenantResult.rows[0] as { id: number } | undefined

    if (!tenantRow) {
      return res.json([])
    }

    const result = await query(
      `SELECT id, data, motivo, tipo_bloqueio, horarios_bloqueados, criado_por, criado_em
         FROM datas_bloqueadas
        WHERE prefeitura_id = $1
        ORDER BY data ASC`,
      [tenantRow.id]
    )

    const payload = result.rows.map((row) => {
      const typedRow = row as PublicBlockedDateRow
      const blockedTimes = Array.isArray(typedRow.horarios_bloqueados)
        ? typedRow.horarios_bloqueados
        : []

      return {
        id: String(typedRow.id),
        date:
          typedRow.data instanceof Date
            ? typedRow.data.toISOString().slice(0, 10)
            : String(typedRow.data),
        reason: typedRow.motivo ?? '',
        blockType: (typedRow.tipo_bloqueio as 'full-day' | 'specific-times' | null) ?? 'full-day',
        blockedSlots: blockedTimes,
        createdBy: typedRow.criado_por ?? '',
        createdAt:
          typedRow.criado_em instanceof Date
            ? typedRow.criado_em.toISOString()
            : typedRow.criado_em
      }
    })

    return res.json(payload)
  } catch (error) {
    console.error(`[Public Blocked Dates] Erro ao buscar bloqueios para '${slug}':`, error)
    return res.status(500).json({ message: 'Não foi possível carregar as datas bloqueadas públicas.' })
  }
})

router.get('/public/tenant/:slug/chamadas', async (req, res) => {
  const { slug } = req.params

  if (!slug) {
    res.status(400).json({ message: 'Slug do tenant é obrigatório.' })
    return
  }

  try {
    const tenantResult = await query(
      `SELECT p.id, p.nome, b.logo_path, b.cor_principal
         FROM prefeituras p
    LEFT JOIN tenant_branding b ON b.prefeitura_id = p.id
        WHERE p.slug = $1
        LIMIT 1`,
      [slug]
    )
    const tenant = tenantResult.rows[0] as TenantBrandingRow | undefined

    if (!tenant) {
      res.status(404).json({ message: 'Tenant não encontrado.' })
      return
    }

    const columnsResult = await query(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_name = 'agendamentos'
          AND column_name IN ('sala', 'guiche')`
    )
    const availableColumns = new Set(columnsResult.rows.map((row: any) => String(row.column_name)))
    const hasSala = availableColumns.has('sala')
    const hasGuiche = availableColumns.has('guiche')

    const locationColumnsResult = await query(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_name = 'locais_atendimento'
          AND column_name IN ('nome_local', 'nome', 'endereco')`
    )
    const availableLocationColumns = new Set(locationColumnsResult.rows.map((row: any) => String(row.column_name)))
    const hasNomeLocal = availableLocationColumns.has('nome_local')
    const hasNome = availableLocationColumns.has('nome')
    const hasEndereco = availableLocationColumns.has('endereco')

    const localNomeExpr = hasNomeLocal
      ? 'l.nome_local'
      : hasNome
        ? 'l.nome'
        : 'NULL::text'
    const localEnderecoExpr = hasEndereco ? 'l.endereco' : 'NULL::text'

    const callsResult = await query(
      `SELECT a.id,
              a.cidadao_nome,
              a.cidadao_cpf,
              a.data_agendamento,
              a.hora_agendamento,
              a.status,
              ${hasSala ? 'a.sala' : 'NULL::text AS sala'},
              ${hasGuiche ? 'a.guiche' : 'NULL::text AS guiche'},
                  ${localNomeExpr} AS local_nome,
                  ${localEnderecoExpr} AS local_endereco
         FROM agendamentos a
    LEFT JOIN locais_atendimento l ON l.id = a.local_id
        WHERE a.prefeitura_id = $1
          AND (a.data_agendamento >= CURRENT_DATE - INTERVAL '1 day')
        ORDER BY a.data_agendamento ASC, a.hora_agendamento ASC
        LIMIT 50`,
      [tenant.id]
    )

    const callsConfigResult = await query(
      `SELECT voz_tipo, voz_idioma, voz_genero, voz_velocidade, voz_volume,
              template_chamada, cor_fundo_chamada, cor_texto_chamada, cor_destaque_chamada
         FROM chamadas_config
        WHERE prefeitura_id = $1
        LIMIT 1`,
      [tenant.id]
    )
    const callsConfig = (callsConfigResult.rows[0] as TenantCallsConfigRow | undefined) || undefined

    const chamadas = callsResult.rows.map((row) => {
      const typed = row as TenantCallRow
      const appointmentDate =
        typed.data_agendamento instanceof Date
          ? typed.data_agendamento.toISOString().slice(0, 10)
          : typed.data_agendamento ?? null
      return {
        id: String(typed.id),
        nome: typed.cidadao_nome,
        cpf: typed.cidadao_cpf,
        data: appointmentDate,
        hora: typed.hora_agendamento,
        status: typed.status ?? 'pending',
        prioridade: 'normal' as const,
        local: typed.local_nome ?? typed.local_endereco ?? 'Local não informado',
        sala: (row as any).sala ?? null,
        guiche: (row as any).guiche ?? null,
        slug: slug
      }
    })

    const proximoAtendimento =
      chamadas.find((entrada) => ['confirmed', 'pending'].includes((entrada.status ?? '').toLowerCase())) ||
      chamadas[0] ||
      null

    // Fallback de logo para slugs conhecidos quando o banco não possui logo_path
    let logoUrl: string | null = tenant.logo_path ?? null
    if (!logoUrl) {
      const fb = fallbackResponse(slug)
      logoUrl = fb.logo ?? null
    }

    res.json({
      slug,
      nome: tenant.nome,
      logoUrl,
      primaryColor: tenant.cor_principal ?? '#059669',
      chamadasConfig: {
        vozTipo: callsConfig?.voz_tipo ?? 'google',
        vozIdioma: callsConfig?.voz_idioma ?? 'pt-BR',
        vozGenero: callsConfig?.voz_genero ?? 'feminino',
        vozVelocidade: callsConfig?.voz_velocidade ?? 1,
        vozVolume: callsConfig?.voz_volume ?? 1,
        templateChamada: callsConfig?.template_chamada ?? 'Chamando {name}. Sala {sala}.',
        corFundoChamada: callsConfig?.cor_fundo_chamada ?? '#ffffff',
        corTextoChamada: callsConfig?.cor_texto_chamada ?? '#0f172a',
        corDestaqueChamada: callsConfig?.cor_destaque_chamada ?? (tenant.cor_principal ?? '#059669')
      },
      atualizadoEm: new Date().toISOString(),
      proximoAtendimento,
      chamadas
    })
  } catch (error) {
    console.error(`[Public Tenant Calls] Erro ao buscar chamadas para '${slug}':`, error)
    res.status(500).json({ message: 'Não foi possível carregar as chamadas.' })
  }
})

export default router
