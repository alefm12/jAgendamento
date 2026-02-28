import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Briefcase, Palette, FileText, CheckCircle } from '@phosphor-icons/react'
import { toast } from 'sonner'
import type { SecretaryConfig, ReportType } from '@/lib/types'

interface SecretaryConfigPanelProps {
  config: SecretaryConfig
  onUpdateConfig: (config: SecretaryConfig) => void
}

const AVAILABLE_REPORTS: { type: ReportType; label: string; description: string }[] = [
  { 
    type: 'appointments', 
    label: 'Relatório de Agendamentos', 
    description: 'Lista completa de todos os agendamentos' 
  },
  { 
    type: 'by-location', 
    label: 'Relatório por Localidade', 
    description: 'Agendamentos agrupados por sede/distrito' 
  },
  { 
    type: 'by-neighborhood', 
    label: 'Relatório por Bairro/Comunidade', 
    description: 'Agendamentos agrupados por bairro/comunidade' 
  },
  { 
    type: 'by-status', 
    label: 'Relatório por Status', 
    description: 'Agendamentos agrupados por status' 
  },
  { 
    type: 'by-period', 
    label: 'Relatório por Período', 
    description: 'Análise de agendamentos em períodos específicos' 
  },
  { 
    type: 'audit-log', 
    label: 'Log de Auditoria', 
    description: 'Histórico completo de alterações' 
  }
]

export function SecretaryConfigPanel({ config, onUpdateConfig }: SecretaryConfigPanelProps) {
  const [localConfig, setLocalConfig] = useState<SecretaryConfig>(config)

  const handleColorChange = (field: 'dashboardColor' | 'accentColor', value: string) => {
    setLocalConfig(prev => ({ ...prev, [field]: value }))
  }

  const handleToggleReport = (reportType: ReportType) => {
    setLocalConfig(prev => {
      const currentReports = prev.enabledReports || []
      const isEnabled = currentReports.includes(reportType)
      
      return {
        ...prev,
        enabledReports: isEnabled
          ? currentReports.filter(r => r !== reportType)
          : [...currentReports, reportType]
      }
    })
  }

  const handleTogglePermission = (field: keyof SecretaryConfig) => {
    setLocalConfig(prev => ({ ...prev, [field]: !prev[field] }))
  }

  const handleSave = () => {
    onUpdateConfig(localConfig)
    toast.success('Configurações da secretaria atualizadas!')
  }

  const isReportEnabled = (reportType: ReportType) => {
    return (localConfig.enabledReports || []).includes(reportType)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase size={24} weight="duotone" />
          Configurações da Secretaria
        </CardTitle>
        <CardDescription>
          Personalize a interface e permissões do painel da secretaria
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Palette size={18} />
            Cores do Painel da Secretaria
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dashboard-color">Cor do Dashboard</Label>
              <div className="flex gap-2">
                <Input
                  id="dashboard-color"
                  type="color"
                  value={localConfig.dashboardColor || '#3b82f6'}
                  onChange={(e) => handleColorChange('dashboardColor', e.target.value)}
                  className="w-20 h-10 cursor-pointer"
                />
                <Input
                  type="text"
                  value={localConfig.dashboardColor || '#3b82f6'}
                  onChange={(e) => handleColorChange('dashboardColor', e.target.value)}
                  className="flex-1 font-mono text-sm"
                  placeholder="#3b82f6"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Cor principal do painel da secretaria
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accent-color">Cor de Destaque</Label>
              <div className="flex gap-2">
                <Input
                  id="accent-color"
                  type="color"
                  value={localConfig.accentColor || '#10b981'}
                  onChange={(e) => handleColorChange('accentColor', e.target.value)}
                  className="w-20 h-10 cursor-pointer"
                />
                <Input
                  type="text"
                  value={localConfig.accentColor || '#10b981'}
                  onChange={(e) => handleColorChange('accentColor', e.target.value)}
                  className="flex-1 font-mono text-sm"
                  placeholder="#10b981"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Cor para destaques e ações importantes
              </p>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <FileText size={18} />
            Tipos de Relatórios Disponíveis
          </div>

          <div className="space-y-2">
            {AVAILABLE_REPORTS.map((report) => (
              <div
                key={report.type}
                className="flex items-start justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{report.label}</span>
                    {isReportEnabled(report.type) && (
                      <Badge variant="default" className="text-xs">
                        <CheckCircle size={12} className="mr-1" weight="fill" />
                        Ativo
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{report.description}</p>
                </div>
                <Switch
                  checked={isReportEnabled(report.type)}
                  onCheckedChange={() => handleToggleReport(report.type)}
                />
              </div>
            ))}
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="text-sm font-semibold">Permissões da Secretaria</div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div className="flex-1">
                <Label htmlFor="allow-date-blocking" className="cursor-pointer">
                  Permitir Bloqueio de Datas
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Secretaria pode bloquear datas (feriados, facultativos)
                </p>
              </div>
              <Switch
                id="allow-date-blocking"
                checked={localConfig.allowDateBlocking ?? true}
                onCheckedChange={() => handleTogglePermission('allowDateBlocking')}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div className="flex-1">
                <Label htmlFor="allow-reschedule" className="cursor-pointer">
                  Permitir Reagendamento
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Secretaria pode reagendar compromissos
                </p>
              </div>
              <Switch
                id="allow-reschedule"
                checked={localConfig.allowReschedule ?? true}
                onCheckedChange={() => handleTogglePermission('allowReschedule')}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div className="flex-1">
                <Label htmlFor="allow-cancel" className="cursor-pointer">
                  Permitir Cancelamento
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Secretaria pode cancelar agendamentos
                </p>
              </div>
              <Switch
                id="allow-cancel"
                checked={localConfig.allowCancel ?? true}
                onCheckedChange={() => handleTogglePermission('allowCancel')}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div className="flex-1">
                <Label htmlFor="allow-priority" className="cursor-pointer">
                  Permitir Alteração de Prioridade
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Secretaria pode alterar a prioridade dos agendamentos
                </p>
              </div>
              <Switch
                id="allow-priority"
                checked={localConfig.allowPriorityChange ?? true}
                onCheckedChange={() => handleTogglePermission('allowPriorityChange')}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={handleSave} className="gap-2">
            <CheckCircle size={18} weight="fill" />
            Salvar Configurações
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
