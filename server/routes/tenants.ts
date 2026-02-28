import fs from "fs"
import path from "path"
import multer from "multer"
import { Router } from "express"
import { query } from "../db"

const router = Router()

const DEFAULT_TITLE_COLOR = "#166534"
const DEFAULT_PRIMARY_BUTTON_COLOR = "#00A859"
const DEFAULT_SECONDARY_BUTTON_COLOR = "#1E40AF"
const DEFAULT_SUBTITLE = "SERVIÇO DE AGENDAMENTO DE CIN"

const uploadsDir = path.join(process.cwd(), "client", "public", "uploads")

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (req, file, cb) => {
    const tenantId = req.params.tenantId ?? "tenant"
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1_000_000)}`
    cb(null, `tenant-${tenantId}-${uniqueSuffix}${path.extname(file.originalname)}`)
  }
})

const upload = multer({ storage })

async function ensureBrandingTable() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS tenant_branding (
        prefeitura_id INT PRIMARY KEY REFERENCES prefeituras(id) ON DELETE CASCADE,
        nome_exibicao TEXT,
        subtitulo TEXT,
        telefone_contato TEXT,
        cor_principal TEXT,
        cor_botao_agendar TEXT,
        cor_botao_consultar TEXT,
        logo_path TEXT,
        fundo_path TEXT,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
  } catch (error) {
    console.warn("[tenants] Não foi possível garantir tabela tenant_branding:", error)
  }
}

void ensureBrandingTable()

type BrandingRow = {
  id: number
  nome: string
  slug: string
  nome_exibicao: string | null
  subtitulo: string | null
  telefone_contato: string | null
  cor_principal: string | null
  cor_botao_agendar: string | null
  cor_botao_consultar: string | null
  logo_path: string | null
  fundo_path: string | null
}

function normalizeBrandingResponse(row: BrandingRow) {
  return {
    id: row.id,
    name: row.nome,
    slug: row.slug,
    nome_exibicao: row.nome_exibicao ?? row.nome,
    subtitulo: row.subtitulo ?? DEFAULT_SUBTITLE,
    telefone_contato: row.telefone_contato ?? null,
    cor_principal: row.cor_principal ?? DEFAULT_TITLE_COLOR,
    cor_botao_agendar: row.cor_botao_agendar ?? DEFAULT_PRIMARY_BUTTON_COLOR,
    cor_botao_consultar: row.cor_botao_consultar ?? DEFAULT_SECONDARY_BUTTON_COLOR,
    url_logo: row.logo_path ?? null,
    url_fundo: row.fundo_path ?? null
  }
}

async function fetchBrandingByPrefeituraId(prefeituraId: number) {
  const result = await query(
    `SELECT
      p.id,
      p.nome,
      p.slug,
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
    WHERE p.id = $1
    LIMIT 1`,
    [prefeituraId]
  )

  const row = result.rows[0] as BrandingRow | undefined
  return row ?? null
}

async function deleteFileIfExists(relativePath?: string | null) {
  if (!relativePath) return
  const normalized = relativePath.replace(/^\/+/, "")
  const absolutePath = path.join(process.cwd(), "client", "public", normalized)

  try {
    await fs.promises.unlink(absolutePath)
  } catch {
    // Arquivo já removido ou inexistente; ignorar silenciosamente.
  }
}

router.get("/", async (_req, res) => {
  try {
    const result = await query("SELECT id, nome, slug, ativo, criado_em FROM prefeituras ORDER BY criado_em DESC")
    res.json(result.rows)
  } catch (error) {
    console.warn("Aviso: Tabela 'prefeituras' não encontrada ou erro de conexão. Usando dados temporários.", error)
    res.json([
      {
        id: 1,
        nome: "Prefeitura de Itapajé",
        slug: "prefeitura-de-itapaje",
        ativo: true,
        criado_em: new Date().toISOString()
      },
      {
        id: 2,
        nome: "Prefeitura de Irauçuba",
        slug: "iraucuba",
        ativo: true,
        criado_em: new Date().toISOString()
      }
    ])
  }
})

router.get("/:tenantId/config-details", async (req, res) => {
  const prefeituraId = Number(req.params.tenantId)

  if (Number.isNaN(prefeituraId)) {
    return res.status(400).json({ message: "ID inválido" })
  }

  try {
    const branding = await fetchBrandingByPrefeituraId(prefeituraId)

    if (!branding) {
      return res.status(404).json({ message: "Prefeitura não encontrada" })
    }

    res.json(normalizeBrandingResponse(branding))
  } catch (error) {
    console.error(`[tenants] Falha ao carregar identidade visual da prefeitura ${prefeituraId}`, error)
    res.status(500).json({ message: "Não foi possível carregar as configurações visuais." })
  }
})

router.put(
  "/:tenantId/config",
  upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "fundo", maxCount: 1 }
  ]),
  async (req, res) => {
    const prefeituraId = Number(req.params.tenantId)

    if (Number.isNaN(prefeituraId)) {
      return res.status(400).json({ message: "ID inválido" })
    }

    try {
      const prefeitura = await query(
        "SELECT id, nome, slug FROM prefeituras WHERE id = $1 LIMIT 1",
        [prefeituraId]
      )

      const prefeituraRow = prefeitura.rows[0] as { id: number; nome: string; slug: string } | undefined

      if (!prefeituraRow) {
        return res.status(404).json({ message: "Prefeitura não encontrada" })
      }

      const previousBranding = await fetchBrandingByPrefeituraId(prefeituraId)

      const normalizeText = (value?: string | null) => {
        const trimmed = value?.trim()
        return trimmed && trimmed.length > 0 ? trimmed : null
      }
      const colorOrDefault = (value: string | undefined, fallback: string) => {
        const trimmed = value?.trim()
        return trimmed && trimmed.length > 0 ? trimmed : fallback
      }

      const fields = req.body as Record<string, string | undefined>
      const files = req.files as Record<string, Express.Multer.File[]> | undefined
      const logoFile = files?.logo?.[0]
      const fundoFile = files?.fundo?.[0]

      const logoPath = logoFile ? `/uploads/${logoFile.filename}` : null
      const fundoPath = fundoFile ? `/uploads/${fundoFile.filename}` : null

      await query(
        `INSERT INTO tenant_branding (
          prefeitura_id,
          nome_exibicao,
          subtitulo,
          telefone_contato,
          cor_principal,
          cor_botao_agendar,
          cor_botao_consultar,
          logo_path,
          fundo_path,
          updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
        ON CONFLICT (prefeitura_id) DO UPDATE SET
          nome_exibicao = EXCLUDED.nome_exibicao,
          subtitulo = EXCLUDED.subtitulo,
          telefone_contato = EXCLUDED.telefone_contato,
          cor_principal = EXCLUDED.cor_principal,
          cor_botao_agendar = EXCLUDED.cor_botao_agendar,
          cor_botao_consultar = EXCLUDED.cor_botao_consultar,
          logo_path = COALESCE(EXCLUDED.logo_path, tenant_branding.logo_path),
          fundo_path = COALESCE(EXCLUDED.fundo_path, tenant_branding.fundo_path),
          updated_at = NOW()
        `,
        [
          prefeituraId,
          normalizeText(fields.nome_exibicao) ?? prefeituraRow.nome,
          normalizeText(fields.subtitulo) ?? DEFAULT_SUBTITLE,
          normalizeText(fields.telefone_contato),
          colorOrDefault(fields.cor_principal ?? undefined, DEFAULT_TITLE_COLOR),
          colorOrDefault(fields.cor_botao_agendar ?? undefined, DEFAULT_PRIMARY_BUTTON_COLOR),
          colorOrDefault(fields.cor_botao_consultar ?? undefined, DEFAULT_SECONDARY_BUTTON_COLOR),
          logoPath,
          fundoPath
        ]
      )

      const updatedBranding = await fetchBrandingByPrefeituraId(prefeituraId)

      if (!updatedBranding) {
        throw new Error("Configuração salva, mas não foi possível recuperá-la")
      }

      if (logoFile && previousBranding?.logo_path && previousBranding.logo_path !== updatedBranding.logo_path) {
        await deleteFileIfExists(previousBranding.logo_path)
      }

      if (fundoFile && previousBranding?.fundo_path && previousBranding.fundo_path !== updatedBranding.fundo_path) {
        await deleteFileIfExists(previousBranding.fundo_path)
      }

      res.json(normalizeBrandingResponse(updatedBranding))
    } catch (error) {
      console.error(`[tenants] Falha ao salvar identidade visual da prefeitura ${prefeituraId}`, error)
      res.status(500).json({ message: "Não conseguimos salvar suas alterações." })
    }
  }
)

export default router
