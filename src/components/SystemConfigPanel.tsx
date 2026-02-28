import { useState, useEffect, type ChangeEvent } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { SecretaryUserManagement } from '@/components/SecretaryUserManagement';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { 
  Buildings,
  ListChecks, 
  Clock, 
  Bell, 
  Gear, 
  Users,
  SpeakerHigh,
  FloppyDisk,
  ArrowCounterClockwise,
  Plus,
  Trash,
  PencilSimple,
  Eye,
  Check,
  X,
  UploadSimple,
  Phone,
  IdentificationCard,
  UserCircle,
  Palette,
  WifiHigh,
  CheckCircle,
  XCircle,
  Warning,
} from '@phosphor-icons/react';
import type { SystemConfig, CustomField, Location } from '@/lib/types';

interface SystemConfigPanelProps {
  config: SystemConfig;
  onUpdateConfig: (config: SystemConfig) => void;
  currentUser?: any;
  systemName?: string;
  secretaryUsers?: any[];
  locations?: Location[];
  onAddSecretaryUser?: (userData: any) => Promise<void>;
  onUpdateSecretaryUser?: (userId: string, updates: any) => Promise<void>;
  onDeleteSecretaryUser?: (userId: string) => Promise<void>;
}

interface NotificationTemplate {
  emailAtivo: boolean;
  whatsappAtivo: boolean;
  emailAssunto: string;
  emailCorpo: string;
}

interface ReminderNotificationTemplate extends NotificationTemplate {
  lembreteAntecedenciaDias: number;
  lembreteAntecedenciaDiasList?: number[];
}

interface NotificationsConfigState {
  agendamento: NotificationTemplate;
  reagendamento: NotificationTemplate;
  lembrete: ReminderNotificationTemplate;
  cancelamento: NotificationTemplate;
  concluido: NotificationTemplate;
  cin_pronta: NotificationTemplate;
  cin_entregue: NotificationTemplate;
}

interface GeralConfigState {
  nomeSecretaria: string;
  enderecoCompleto: string;
  telefoneContato: string;
  emailContato: string;
  horarioFuncionamento: string;
  relatoriosAtivos: string[];
  backupAtivo: boolean;
  backupPeriodicidade: 'diario' | 'semanal' | 'mensal';
  backupHorario: string;
  backupRetencaoDias: number;
  backupEmailNotificacao: string;
  backupOutputDir: string;
  backupUltimoEm: string;
  smtpHost?: string;
  smtpPort?: string;
  smtpUser?: string;
  smtpPassword?: string;
  smtpFromName?: string;
  smtpFromEmail?: string;
  smtpSecure?: boolean;
  whatsappApiUrl?: string;
  whatsappApiToken?: string;
  whatsappInstanceId?: string;
  whatsappFromNumber?: string;
  whatsappEnabled?: boolean;
}

// Sub-componente para preview de cor
const ColorPreview = ({ color, label }: { color: string; label: string }) => (
  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
    <div 
      className="w-12 h-12 rounded-md border-2 border-border shadow-sm" 
      style={{ backgroundColor: color }}
    />
    <div className="flex-1">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground font-mono">{color}</p>
    </div>
  </div>
);

export default function SystemConfigPanel({ 
  config, 
  onUpdateConfig, 
  currentUser, 
  systemName,
  secretaryUsers = [],
  locations = [],
  onAddSecretaryUser,
  onUpdateSecretaryUser,
  onDeleteSecretaryUser,
}: SystemConfigPanelProps) {
  const [activeTab, setActiveTab] = useState('institucional');
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isImportingBackup, setIsImportingBackup] = useState(false);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);
  const [availableBackups, setAvailableBackups] = useState<Array<{
    fileName: string
    sizeBytes: number
    createdAt: string
    downloadUrl: string
    isLatest: boolean
  }>>([])
  const [selectedBackupFile, setSelectedBackupFile] = useState('')
  const [isLoadingBackups, setIsLoadingBackups] = useState(false)
  const [isPickingBackupDir, setIsPickingBackupDir] = useState(false)
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null)
  const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false)
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false)
  const [restoreMode, setRestoreMode] = useState<'latest' | 'selected'>('latest')

  // Estado da aba Institucional — inicializado a partir do config recebido
  const [institucional, setInstitucional] = useState({
    nomePrefeitura:  config?.systemName || '',
    nomeSecretaria:  config?.contactInfo?.secretariaName || '',
    cnpj:            config?.contactInfo?.cnpj || '',
    responsavel:     config?.contactInfo?.responsibleName || '',
    telefone:        config?.contactInfo?.phone || '',
    logo:            config?.logo || '' as string,
  });

  // Sincroniza se o config mudar externamente (ex: carregamento do banco)
  useEffect(() => {
    setInstitucional({
      nomePrefeitura:  config?.systemName || '',
      nomeSecretaria:  config?.contactInfo?.secretariaName || '',
      cnpj:            config?.contactInfo?.cnpj || '',
      responsavel:     config?.contactInfo?.responsibleName || '',
      telefone:        config?.contactInfo?.phone || '',
      logo:            config?.logo || '',
    });
  }, [config?.systemName, config?.logo, config?.contactInfo?.cnpj,
      config?.contactInfo?.responsibleName, config?.contactInfo?.phone,
      config?.contactInfo?.secretariaName]);
  const [layoutSubTab, setLayoutSubTab] = useState('public');
  const [notificationSubTab, setNotificationSubTab] = useState('agendamento');
  const prefeituraId = 1;

  // Estados para Layout
  const [layoutConfig, setLayoutConfig] = useState({
    public: {
      corPrimaria: '#059669',
      corSecundaria: '#1d4ed8',
      corDestaque: '#f59e0b',
      corBotaoPrincipal: '#2563eb',
      corBotaoSecundario: '#10b981'
    },
    secretary: {
      corPrimaria: '#059669',
      corSecundaria: '#1d4ed8',
      corDestaque: '#f59e0b',
      corBotaoPrincipal: '#2563eb',
      corBotaoSecundario: '#10b981'
    },
    attendance: {
      corPrimaria: '#059669',
      corSecundaria: '#1d4ed8',
      corDestaque: '#f59e0b',
      corBotaoPrincipal: '#2563eb',
      corBotaoSecundario: '#10b981'
    }
  });

  // Estados para Campos Personalizados
  const [customFields, setCustomFields] = useState<any[]>([]);
  const [isAddingField, setIsAddingField] = useState(false);
  const [newField, setNewField] = useState({
    nomeCampo: '',
    labelCampo: '',
    tipoCampo: 'text',
    obrigatorio: false,
    ativo: true
  });

  // Estados para Horários
  const [horariosConfig, setHorariosConfig] = useState({
    horariosDisponiveis: '08:00, 08:30, 09:00, 09:30, 10:00, 10:30, 11:00, 11:30, 13:00, 13:30, 14:00, 14:30, 15:00, 15:30, 16:00, 16:30, 17:00',
    maxAgendamentosPorHorario: 2,
    periodoLiberadoDias: 60
  });

  // Estados para Notificações — WhatsApp ativo por padrão
  const [notificationsConfig, setNotificationsConfig] = useState<NotificationsConfigState>({
    agendamento: {
      emailAtivo: true,
      whatsappAtivo: true,
      emailAssunto: 'Agendamento Confirmado',
      emailCorpo: 'Olá {nome}, seu agendamento foi confirmado para {data} às {hora}.'
    },
    reagendamento: {
      emailAtivo: true,
      whatsappAtivo: true,
      emailAssunto: 'Reagendamento Confirmado – Protocolo {protocolo}',
      emailCorpo: 'Olá {nome}! 😊\n\nSeu atendimento foi reagendado com sucesso.\n\n📅 Data: {data}\n🕐 Horário: {hora}\n📍 Local de Atendimento: {local}\n🏠 Endereço: {endereco}\n🗺️ Mapa: {link_local}'
    },
    lembrete: {
      emailAtivo: true,
      whatsappAtivo: true,
      lembreteAntecedenciaDias: 1,
      emailAssunto: 'Lembrete de Agendamento',
      emailCorpo: 'Olá {nome}, lembramos que você tem agendamento amanhã às {hora}.'
    },
    cancelamento: {
      emailAtivo: true,
      whatsappAtivo: true,
      emailAssunto: 'Agendamento Cancelado',
      emailCorpo: 'Olá {nome}, seu agendamento foi cancelado.'
    },
    concluido: {
      emailAtivo: true,
      whatsappAtivo: true,
      emailAssunto: 'Atendimento Concluído',
      emailCorpo: 'Olá {nome}, seu atendimento foi concluído com sucesso.'
    },
    cin_pronta: {
      emailAtivo: true,
      whatsappAtivo: true,
      emailAssunto: 'CIN Pronta para Retirada',
      emailCorpo: 'Olá {nome}, sua CIN está pronta para retirada.'
    },
    cin_entregue: {
      emailAtivo: true,
      whatsappAtivo: true,
      emailAssunto: 'CIN Entregue',
      emailCorpo: 'Olá {nome}, sua CIN foi entregue com sucesso.'
    }
  });

  // Estados para Chamadas
  const [chamadasConfig, setChamadasConfig] = useState({
    vozTipo: 'padrao',
    vozIdioma: 'pt-BR',
    vozGenero: 'feminino',
    vozVelocidade: 1.0,
    vozVolume: 1.0,
    corFundoChamada: '#ffffff',
    corTextoChamada: '#0f172a',
    corDestaqueChamada: '#059669',
    templateChamada: '{NOME DO CIDADAO} comparecer a Sala {numero da sala} guiche {numero do guiche}'
  });

  // Estados para Geral
  const [geralConfig, setGeralConfig] = useState<GeralConfigState>({
    nomeSecretaria: 'Secretaria Municipal',
    enderecoCompleto: '',
    telefoneContato: '',
    emailContato: '',
    horarioFuncionamento: '08:00 às 17:00',
    relatoriosAtivos: ['agendamentos', 'localidade', 'bairro', 'status'],
    backupAtivo: true,
    backupPeriodicidade: 'diario',
    backupHorario: '02:00',
    backupRetencaoDias: 30,
    backupEmailNotificacao: '',
    backupOutputDir: '',
    backupUltimoEm: '',
  });

  const [smtpConfig, setSmtpConfig] = useState({
    smtp_host: '',
    smtp_port: 587,
    smtp_user: '',
    smtp_password: '',
    smtp_from_name: '',
    smtp_from_email: '',
    smtp_secure: true,
    ativo: false
  });

  const [smtpDiagResult, setSmtpDiagResult] = useState<null | {
    success: boolean
    steps: Array<{ step: string; ok: boolean; detail: string }>
  }>(null);
  const [smtpDiagLoading, setSmtpDiagLoading] = useState(false);

  const [zapiDiagResult, setZapiDiagResult] = useState<null | {
    success: boolean
    steps: Array<{ step: string; ok: boolean; detail: string }>
  }>(null);
  const [zapiDiagLoading, setZapiDiagLoading] = useState(false);
  const [zapiTestPhone, setZapiTestPhone] = useState('');
  const [zapiTestLoading, setZapiTestLoading] = useState(false);
  const [reminderDaysInput, setReminderDaysInput] = useState('1');

  const [whatsappConfig, setWhatsappConfig] = useState({
    api_url: '',
    api_token: '',
    client_token: '',
    instance_id: '',
    numero_origem: '',
    ativo: true
  });

  const mapApiCustomFieldToSystemConfig = (field: any): CustomField => ({
    id: String(field.nomeCampo || field.nome_campo || field.id),
    name: String(field.nomeCampo || field.nome_campo || field.id),
    label: String(field.labelCampo || field.label_campo || field.nomeCampo || field.nome_campo || 'Campo'),
    type: (field.tipoCampo || field.tipo_campo || 'text') as any,
    required: Boolean(field.obrigatorio),
    placeholder: field.placeholder || '',
    options: Array.isArray(field.opcoes) ? field.opcoes : [],
    order: Number(field.ordem || 0),
    helpText: field.textoAjuda || field.texto_ajuda || '',
    enabled: field.ativo !== false
  })

  // Carregar configurações do backend
  useEffect(() => {
    loadConfigurations();
  }, []);

  useEffect(() => {
    const savedTemplates = config?.notificationTemplates as any
    const savedReminderSettings = config?.reminderSettings as any
    if (savedTemplates) {
      setNotificationsConfig((prev) => ({
        ...prev,
        ...savedTemplates,
        lembrete: {
          ...prev.lembrete,
          ...(savedTemplates.lembrete || {})
        }
      }))
    }
    if (savedReminderSettings) {
      const savedDays = Array.isArray(savedReminderSettings.reminderDays)
        ? savedReminderSettings.reminderDays
        : [Math.max(1, Math.round((savedReminderSettings.hoursBeforeAppointment || 24) / 24))]
      setNotificationsConfig((prev) => ({
        ...prev,
        lembrete: {
          ...prev.lembrete,
          lembreteAntecedenciaDiasList: savedDays,
          lembreteAntecedenciaDias: savedDays[0],
          emailCorpo: savedTemplates?.lembrete?.emailCorpo || savedReminderSettings.customMessage || prev.lembrete.emailCorpo
        }
      }))
    }
  }, [config])

  const loadConfigurations = async () => {
    try {
      // Carregar Layout
      const layoutRes = await fetch(`/api/config/layout/${prefeituraId}`);
      if (layoutRes.ok) {
        const layouts = await layoutRes.json();
        const newLayoutConfig: any = {};
        layouts.forEach((l: any) => {
          newLayoutConfig[l.area] = {
            corPrimaria: l.corPrimaria,
            corSecundaria: l.corSecundaria,
            corDestaque: l.corDestaque,
            corBotaoPrincipal: l.corBotaoPrincipal,
            corBotaoSecundario: l.corBotaoSecundario
          };
        });
        setLayoutConfig(prev => ({ ...prev, ...newLayoutConfig }));
      }

      // Carregar Campos Personalizados
      const camposRes = await fetch(`/api/config/campos/${prefeituraId}`);
      if (camposRes.ok) {
        const campos = await camposRes.json();
        setCustomFields(campos);
        onUpdateConfig({
          ...config,
          customFields: (campos || []).map(mapApiCustomFieldToSystemConfig)
        });
      }

      // Carregar Horários
      const horariosRes = await fetch(`/api/config/horarios/${prefeituraId}`);
      if (horariosRes.ok) {
        const horarios = await horariosRes.json();
        if (horarios) {
          setHorariosConfig({
            horariosDisponiveis: horarios.horariosDisponiveis || '08:00, 08:30, 09:00, 09:30, 10:00, 10:30, 11:00, 11:30, 13:00, 13:30, 14:00, 14:30, 15:00, 15:30, 16:00, 16:30, 17:00',
            maxAgendamentosPorHorario: horarios.maxAgendamentosPorHorario ?? 2,
            periodoLiberadoDias: horarios.periodoLiberadoDias ?? 60
          });
        }
      }

      // Carregar Geral
      const geralRes = await fetch(`/api/config/geral/${prefeituraId}`);
      if (geralRes.ok) {
        const geral = await geralRes.json();
        if (geral) {
          setGeralConfig(prev => ({
            ...prev,
            ...geral,
            backupHorario: String(geral.backupHorario || prev.backupHorario).slice(0, 5),
            backupRetencaoDias: Number(geral.backupRetencaoDias ?? prev.backupRetencaoDias),
            backupOutputDir: String(geral.backupOutputDir || ''),
            backupUltimoEm: String(geral.backupUltimoEm || ''),
          }));
        }
      }

      // Carregar SMTP
      const smtpRes = await fetch(`/api/system-config/smtp/${prefeituraId}`);
      if (smtpRes.ok) {
        const smtp = await smtpRes.json();
        if (smtp) setSmtpConfig(prev => ({ ...prev, ...smtp }));
      }

      // Carregar WhatsApp — mantém ativo=true como padrão se não vier do banco
      const whatsappRes = await fetch(`/api/system-config/whatsapp/${prefeituraId}`);
      if (whatsappRes.ok) {
        const whatsapp = await whatsappRes.json();
        if (whatsapp) {
          setWhatsappConfig(prev => ({
            ...prev,
            ...whatsapp,
            ativo: whatsapp.ativo !== false // só desativa se explicitamente false no banco
          }));
        }
      }

      // Carregar Configurações de Chamadas
      const chamadasRes = await fetch(`/api/config/chamadas/${prefeituraId}`);
      if (chamadasRes.ok) {
        const chamadas = await chamadasRes.json();
        if (chamadas) {
          setChamadasConfig(prev => ({
            ...prev,
            ...chamadas,
            vozTipo: 'padrao',
            vozIdioma: String(chamadas.vozIdioma || prev.vozIdioma),
            vozGenero: String(chamadas.vozGenero || prev.vozGenero),
            vozVelocidade: Number(chamadas.vozVelocidade ?? prev.vozVelocidade),
            vozVolume: Number(chamadas.vozVolume ?? prev.vozVolume),
            corFundoChamada: String(chamadas.corFundoChamada || prev.corFundoChamada),
            corTextoChamada: String(chamadas.corTextoChamada || prev.corTextoChamada),
            corDestaqueChamada: String(chamadas.corDestaqueChamada || prev.corDestaqueChamada),
            templateChamada: String(chamadas.templateChamada || prev.templateChamada),
          }));
        }
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      toast.error('Falha ao carregar configurações do servidor.');
    }
  };

  // Salvar Layout
  const handleSaveLayout = async () => {
    try {
      const area = layoutSubTab;
      const colors = layoutConfig[area as keyof typeof layoutConfig];
      
      const response = await fetch(`/api/config/layout/${prefeituraId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ area, ...colors })
      });

      if (response.ok) {
        toast.success('Cores salvas com sucesso!');
      } else {
        toast.error('Erro ao salvar cores');
      }
    } catch (error) {
      toast.error('Erro ao salvar cores');
    }
  };

  // Restaurar padrões de Layout
  const handleRestoreLayoutDefaults = async () => {
    try {
      const response = await fetch(`/api/config/layout/${prefeituraId}/restaurar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ area: layoutSubTab })
      });

      if (response.ok) {
        await loadConfigurations();
        toast.success('Cores restauradas para os padrões!');
      }
    } catch (error) {
      toast.error('Erro ao restaurar padrões');
    }
  };

  // Salvar Horários
  const handleSaveHorarios = async () => {
    try {
      const response = await fetch(`/api/config/horarios/${prefeituraId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(horariosConfig)
      });

      if (response.ok) {
        toast.success('Horários salvos com sucesso!');
      } else {
        toast.error('Erro ao salvar horários');
      }
    } catch (error) {
      toast.error('Erro ao salvar horários');
    }
  };

  // Adicionar Campo Personalizado
  const handleAddCustomField = async () => {
    if (!newField.nomeCampo || !newField.labelCampo) {
      toast.error('Preencha o nome e label do campo');
      return;
    }

    try {
      const response = await fetch(`/api/config/campos/${prefeituraId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newField,
          ordem: customFields.length
        })
      });

      if (response.ok) {
        await loadConfigurations();
        setIsAddingField(false);
        setNewField({
          nomeCampo: '',
          labelCampo: '',
          tipoCampo: 'text',
          obrigatorio: false,
          ativo: true
        });
        toast.success('Campo adicionado com sucesso!');
      }
    } catch (error) {
      toast.error('Erro ao adicionar campo');
    }
  };

  // Excluir Campo Personalizado
  const handleDeleteField = async (id: number) => {
    try {
      const response = await fetch(`/api/config/campos/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await loadConfigurations();
        toast.success('Campo excluído!');
      }
    } catch (error) {
      toast.error('Erro ao excluir campo');
    }
  };

  // Salvar Geral
  const buildGeralPayload = (overrideBackupOutputDir?: string) => ({
    ...geralConfig,
    backupHorario: (geralConfig.backupHorario || '02:00').slice(0, 5),
    backupRetencaoDias: Math.max(1, Number(geralConfig.backupRetencaoDias || 30)),
    backupOutputDir: String(overrideBackupOutputDir ?? geralConfig.backupOutputDir ?? '').trim(),
  })

  const persistGeralConfig = async (payload: any) => {
    const response = await fetch(`/api/config/geral/${prefeituraId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const raw = await response.text()
      throw new Error(raw || 'Erro ao salvar configurações gerais')
    }

    return response
  }

  const handleSaveGeral = async () => {
    try {
      const payload = buildGeralPayload()

      if (payload.backupAtivo && !payload.backupOutputDir) {
        toast.error('A pasta de destino é obrigatória para backup automático')
        return
      }

      await persistGeralConfig(payload)

      toast.success('Automação de backup salva!');
      await loadConfigurations();
    } catch (error) {
      toast.error('Erro ao salvar configurações gerais');
    }
  };

  const handleBackupOutputDirBlur = async () => {
    const trimmed = String(geralConfig.backupOutputDir || '').trim()
    if (trimmed !== geralConfig.backupOutputDir) {
      setGeralConfig(prev => ({ ...prev, backupOutputDir: trimmed }))
    }

    if (geralConfig.backupAtivo && !trimmed) {
      toast.error('A pasta de destino é obrigatória para backup automático')
      return
    }

    if (!trimmed) return

    try {
      await persistGeralConfig(buildGeralPayload(trimmed))
      toast.success('Pasta de destino salva!')
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao salvar pasta de destino')
    }
  }
  
  // Diagnóstico UltraMsg por etapas
  const handleZapiDiagnose = async () => {
    setZapiDiagLoading(true)
    setZapiDiagResult(null)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/notifications/provider-diagnose', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          prefeituraId,
          api_url: whatsappConfig.api_url,
          api_token: whatsappConfig.api_token,
          client_token: whatsappConfig.client_token,
          instance_id: whatsappConfig.instance_id,
          ativo: whatsappConfig.ativo
        })
      })
      const data = await response.json()
      setZapiDiagResult(data)
    } catch {
      setZapiDiagResult({ success: false, steps: [{ step: 'Erro', ok: false, detail: 'Não foi possível contatar o servidor.' }] })
    } finally {
      setZapiDiagLoading(false)
    }
  }

  const handleZapiTestSend = async () => {
    if (!zapiTestPhone) { toast.error('Informe o número para teste'); return }
    setZapiTestLoading(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/notifications/test-whatsapp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          prefeituraId,
          phone: zapiTestPhone,
          api_url: whatsappConfig.api_url,
          api_token: whatsappConfig.api_token,
          client_token: whatsappConfig.client_token,
          instance_id: whatsappConfig.instance_id,
          ativo: whatsappConfig.ativo
        })
      })
      const data = await response.json()
      if (response.ok) {
        toast.success('Mensagem enviada!', { description: data.message })
      } else {
        toast.error('Falha no envio', { description: data.message })
      }
    } catch {
      toast.error('Erro ao enviar mensagem de teste')
    } finally {
      setZapiTestLoading(false)
    }
  }

  // Diagnóstico SMTP por etapas
  const handleSmtpDiagnose = async () => {
    setSmtpDiagLoading(true)
    setSmtpDiagResult(null)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/notifications/smtp-diagnose', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ prefeituraId })
      })
      const data = await response.json()
      setSmtpDiagResult(data)
    } catch (error) {
      setSmtpDiagResult({ success: false, steps: [{ step: 'Erro', ok: false, detail: 'Não foi possível contatar o servidor.' }] })
    } finally {
      setSmtpDiagLoading(false)
    }
  }
  
  // Salvar SMTP
  const handleSaveSmtp = async () => {
    try {
      const response = await fetch(`/api/system-config/smtp/${prefeituraId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(smtpConfig)
      });

      if (response.ok) {
        toast.success('Configurações de SMTP salvas!');
      } else {
        toast.error('Erro ao salvar SMTP');
      }
    } catch (error) {
      toast.error('Erro ao salvar SMTP');
    }
  };

  // Salvar WhatsApp
  const handleSaveWhatsapp = async () => {
    try {
      const response = await fetch(`/api/system-config/whatsapp/${prefeituraId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : {})
        },
        body: JSON.stringify(whatsappConfig)
      });

      if (response.ok) {
        const saved = await response.json()
        setWhatsappConfig((prev) => ({
          ...prev,
          ...saved
        }))
        toast.success('Configurações de WhatsApp salvas!');
      } else {
        const raw = await response.text()
        toast.error(`Erro ao salvar WhatsApp: ${raw || response.statusText}`);
      }
    } catch (error) {
      toast.error('Erro ao salvar WhatsApp');
    }
  };

  const handleBackupNow = async () => {
    try {
      setIsBackingUp(true);
      const response = await fetch('/api/system/backup', { method: 'POST' });
      const raw = await response.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(data?.message || 'Falha ao gerar backup. Verifique se o servidor da API está ativo.');
      }

      if (data?.downloadUrl) {
        window.open(data.downloadUrl, '_blank');
      }

      await loadBackupsList();
      toast.success('Backup gerado com sucesso!');
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao gerar backup');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleImportBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.zip')) {
      toast.error('Selecione um arquivo de backup .zip');
      return;
    }

    setPendingImportFile(file)
    setIsImportConfirmOpen(true)
  };

  const confirmImportBackup = async () => {
    const fileToImport = pendingImportFile
    if (!fileToImport) {
      toast.error('Selecione um arquivo de backup para importar')
      return
    }

    try {
      setIsImportingBackup(true);
      const formData = new FormData();
      formData.append('backupFile', fileToImport);

      const response = await fetch('/api/system/backup/import', {
        method: 'POST',
        body: formData,
      });

      const raw = await response.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(data?.message || 'Falha ao importar backup');
      }

      const importedFileName = String(data?.fileName || '')
      if (!importedFileName) {
        throw new Error('Arquivo importado sem identificação para restauração')
      }

      setSelectedBackupFile(importedFileName)
      toast.message('Backup importado. Iniciando restauração automática...')

      setIsRestoringBackup(true)
      const restoreResponse = await fetch('/api/system/backup/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fileName: importedFileName })
      })

      const restoreRaw = await restoreResponse.text()
      let restoreData: any = {}
      try {
        restoreData = restoreRaw ? JSON.parse(restoreRaw) : {}
      } catch {
        restoreData = {}
      }

      if (!restoreResponse.ok) {
        throw new Error(restoreData?.message || 'Backup importado, mas falhou ao restaurar automaticamente')
      }

      await loadBackupsList();
      if (data?.fileName) {
        setSelectedBackupFile(String(data.fileName))
      }
      toast.success('Backup importado e restaurado com sucesso! Recarregue a página para atualizar os dados.');
      setIsImportConfirmOpen(false)
      setPendingImportFile(null)
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao importar backup');
    } finally {
      setIsRestoringBackup(false)
      setIsImportingBackup(false);
    }
  };

  const handleRestoreLatestBackup = async () => {
    setRestoreMode('latest')
    setIsRestoreConfirmOpen(true)
  };

  const confirmRestoreLatestBackup = async () => {

    try {
      setIsRestoringBackup(true);
      const response = await fetch('/api/system/backup/restore-latest', { method: 'POST' });

      const raw = await response.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(data?.message || 'Falha ao restaurar último backup');
      }

      await loadBackupsList();
      toast.success('Restauração concluída! Recarregue a página para atualizar os dados.');
      setIsRestoreConfirmOpen(false)
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao restaurar backup');
    } finally {
      setIsRestoringBackup(false);
    }
  };

  const formatBackupSize = (sizeBytes: number) => {
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB']
    let value = sizeBytes
    let unitIndex = 0
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024
      unitIndex += 1
    }
    return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`
  }

  const loadBackupsList = async () => {
    try {
      setIsLoadingBackups(true)
      const response = await fetch('/api/system/backup/list')
      const raw = await response.text()

      let data: any = {}
      try {
        data = raw ? JSON.parse(raw) : {}
      } catch {
        data = {}
      }

      if (!response.ok) {
        throw new Error(data?.message || 'Falha ao listar backups')
      }

      const backups = Array.isArray(data?.backups) ? data.backups : []
      setAvailableBackups(backups)
      const recentBackups = backups.slice(0, 5)

      if (backups.length === 0) {
        setSelectedBackupFile('')
      } else if (!recentBackups.some((backup: any) => backup.fileName === selectedBackupFile)) {
        const latest = recentBackups.find((backup: any) => backup.isLatest)
        setSelectedBackupFile(latest?.fileName || recentBackups[0].fileName)
      }
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao carregar lista de backups')
    } finally {
      setIsLoadingBackups(false)
    }
  }

  const handleRestoreSelectedBackup = async () => {
    if (!selectedBackupFile) {
      toast.error('Selecione um backup da lista para restaurar')
      return
    }

    setRestoreMode('selected')
    setIsRestoreConfirmOpen(true)
  }

  const handlePickBackupOutputDir = async () => {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), 180000)
    try {
      setIsPickingBackupDir(true)
      const response = await fetch('/api/system/backup/pick-output-dir', {
        method: 'POST',
        signal: controller.signal
      })
      const raw = await response.text()
      let data: any = {}
      try {
        data = raw ? JSON.parse(raw) : {}
      } catch {
        data = {}
      }

      if (!response.ok) {
        throw new Error(data?.message || 'Falha ao abrir seletor de pasta')
      }

      const selectedPath = String(data?.selectedPath || '')
      if (!selectedPath) {
        toast.message('Seleção de pasta cancelada')
        return
      }

      await persistGeralConfig(buildGeralPayload(selectedPath))

      setGeralConfig(prev => ({ ...prev, backupOutputDir: selectedPath }))
      toast.success('Pasta de destino salva com sucesso!')
    } catch (error: any) {
      const aborted = error?.name === 'AbortError'
      toast.error(aborted ? 'Tempo limite ao abrir seletor de pasta' : (error?.message || 'Erro ao selecionar pasta de destino'))
    } finally {
      window.clearTimeout(timeoutId)
      setIsPickingBackupDir(false)
    }
  }

  const confirmRestoreSelectedBackup = async () => {
    if (!selectedBackupFile) {
      setIsRestoreConfirmOpen(false)
      return
    }

    try {
      setIsRestoringBackup(true)
      const response = await fetch('/api/system/backup/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fileName: selectedBackupFile })
      })

      const raw = await response.text()
      let data: any = {}
      try {
        data = raw ? JSON.parse(raw) : {}
      } catch {
        data = {}
      }

      if (!response.ok) {
        throw new Error(data?.message || 'Falha ao restaurar backup selecionado')
      }

      await loadBackupsList()
      toast.success('Restauração do backup selecionado concluída! Recarregue a página para atualizar os dados.')
    } catch (error: any) {
      toast.error(error?.message || 'Erro ao restaurar backup selecionado')
    } finally {
      setIsRestoringBackup(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'geral') {
      loadBackupsList()
    }
  }, [activeTab])

  const addReminderDay = () => {
    const day = Math.max(1, Number(reminderDaysInput || '1'))
    setNotificationsConfig((prev: any) => {
      const current = prev.lembrete.lembreteAntecedenciaDiasList || []
      const next = Array.from(new Set([...current, day])).sort((a: number, b: number) => a - b)
      return {
        ...prev,
        lembrete: {
          ...prev.lembrete,
          lembreteAntecedenciaDiasList: next,
          lembreteAntecedenciaDias: next[0]
        }
      }
    })
  }

  const removeReminderDay = (day: number) => {
    setNotificationsConfig((prev: any) => {
      const current = prev.lembrete.lembreteAntecedenciaDiasList || []
      const next = current.filter((d: number) => d !== day)
      return {
        ...prev,
        lembrete: {
          ...prev.lembrete,
          lembreteAntecedenciaDiasList: next,
          lembreteAntecedenciaDias: next[0]
        }
      }
    })
  }

  const handleSaveNotifications = () => {
    const reminderDays =
      notificationsConfig.lembrete.lembreteAntecedenciaDiasList?.length
        ? notificationsConfig.lembrete.lembreteAntecedenciaDiasList
        : []

    onUpdateConfig({
      ...config,
      reminderSettings: {
        ...(config.reminderSettings || {}),
        enabled:
          (notificationsConfig.lembrete.emailAtivo ||
          notificationsConfig.lembrete.whatsappAtivo) &&
          reminderDays.length > 0,
        hoursBeforeAppointment: reminderDays.length > 0 ? Math.max(...reminderDays) * 24 : 24,
        reminderDays,
        customMessage: notificationsConfig.lembrete.emailCorpo
      },
      notificationTemplates: notificationsConfig as any
    } as any)

    toast.success('Notificações salvas com sucesso!')
  }

  const handleSaveChamadas = async () => {
    try {
      const response = await fetch(`/api/config/chamadas/${prefeituraId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(localStorage.getItem('token') ? { 'Authorization': `Bearer ${localStorage.getItem('token')}` } : {})
        },
        body: JSON.stringify({
          ...chamadasConfig,
          vozTipo: 'padrao',
          repetirChamada: false,
          numeroRepeticoes: 1,
          intervaloRepeticoesSegundos: 2,
          vozTom: 0
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Erro ao salvar configurações de chamadas');
      }

      const savedConfig = await response.json();
      setChamadasConfig(prev => ({
        ...prev,
        ...savedConfig,
        vozVelocidade: Number(savedConfig.vozVelocidade ?? prev.vozVelocidade),
        vozVolume: Number(savedConfig.vozVolume ?? prev.vozVolume),
      }));

      toast.success('Configurações de chamadas salvas!');
    } catch (error) {
      setIsRestoreConfirmOpen(false)
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar configurações de chamadas');
    }
  }

  const resolveVoiceProfile = (voiceType: string) => {
    const normalized = String(voiceType || 'padrao').toLowerCase();
    if (normalized === 'padrao') {
      return { providerHints: [], rateBoost: 0, pitchBoost: 0 };
    }
    const isAzure = normalized.includes('azure');
    const isAws = normalized.includes('aws');
    const providerHints = isAzure
      ? ['microsoft', 'azure', 'zira', 'david']
      : isAws
      ? ['amazon', 'aws', 'polly']
      : ['google', 'gtts'];

    const providerRateBoost = isAzure ? -0.12 : isAws ? -0.03 : 0.06;
    const providerPitchBoost = isAzure ? -0.1 : isAws ? -0.03 : 0.1;

    if (normalized.includes('jovem')) return { providerHints, rateBoost: providerRateBoost + 0.1, pitchBoost: providerPitchBoost + 0.2 };
    if (normalized.includes('orador')) return { providerHints, rateBoost: providerRateBoost - 0.05, pitchBoost: providerPitchBoost - 0.1 };
    if (normalized.includes('animada')) return { providerHints, rateBoost: providerRateBoost + 0.15, pitchBoost: providerPitchBoost + 0.25 };
    if (normalized.includes('formal')) return { providerHints, rateBoost: providerRateBoost - 0.08, pitchBoost: providerPitchBoost - 0.05 };
    return { providerHints, rateBoost: providerRateBoost, pitchBoost: providerPitchBoost };
  }

  const selectBestVoice = (
    voices: SpeechSynthesisVoice[],
    voiceType: string,
    voiceGender: string,
    voiceLanguage: string,
  ) => {
    const { providerHints } = resolveVoiceProfile(voiceType);
    const normalizedGender = String(voiceGender || 'feminino').toLowerCase();
    const langBase = String(voiceLanguage || 'pt-BR').toLowerCase().split('-')[0];

    const femininePatterns = /(female|feminina|woman|mulher|maria|helena|clara|luciana|brenda|sofia|camila)/i;
    const masculinePatterns = /(male|masculino|man|homem|joa[oõ]|paulo|ricardo|carlos|mateus|daniel)/i;

    const byLanguage = voices.filter((voice) => {
      const lang = String(voice.lang || '').toLowerCase();
      return lang.startsWith(langBase);
    });
    const preferredPool = byLanguage.length ? byLanguage : voices;

    const byProvider = preferredPool.filter((voice) =>
      providerHints.some((hint) => String(voice.name || '').toLowerCase().includes(hint)),
    );
    const providerPool = byProvider.length ? byProvider : preferredPool;

    const byFemale = preferredPool.filter((voice) => femininePatterns.test(String(voice.name || '')));
    const byMale = preferredPool.filter((voice) => masculinePatterns.test(String(voice.name || '')));

    const scoreVoice = (voice: SpeechSynthesisVoice) => {
      const name = String(voice.name || '');
      let score = 0;
      if (providerHints.some((hint) => String(name).toLowerCase().includes(hint))) score += 2;
      if (normalizedGender === 'feminino') {
        if (femininePatterns.test(name)) score += 6;
        if (masculinePatterns.test(name)) score -= 5;
      }
      if (normalizedGender === 'masculino') {
        if (masculinePatterns.test(name)) score += 6;
        if (femininePatterns.test(name)) score -= 5;
      }
      return score;
    };

    const ranked = [...preferredPool].sort((a, b) => scoreVoice(b) - scoreVoice(a));

    if (normalizedGender === 'feminino') {
      return byFemale[0] || ranked[0] || providerPool.find((voice) => !masculinePatterns.test(String(voice.name || ''))) || providerPool[0] || voices[0];
    }
    if (normalizedGender === 'masculino') {
      return byMale[0] || ranked[0] || providerPool.find((voice) => !femininePatterns.test(String(voice.name || ''))) || providerPool[0] || voices[0];
    }

    return providerPool[0] || voices[0];
  }

  const handleTestVoice = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      toast.error('Seu navegador não suporta síntese de voz.');
      return;
    }

    const voiceType = String(chamadasConfig.vozTipo || 'google').toLowerCase();
    const voiceGender = String(chamadasConfig.vozGenero || 'feminino').toLowerCase();
    const voiceLanguage = String(chamadasConfig.vozIdioma || 'pt-BR');
    const text = 'Teste de voz do painel de chamadas.';

    const speakNow = () => {
      const allVoices = window.speechSynthesis.getVoices();
      const profile = resolveVoiceProfile(voiceType);
      const selectedVoice = selectBestVoice(allVoices, voiceType, voiceGender, voiceLanguage);

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = voiceLanguage;
      utterance.rate = Math.max(0.5, Math.min(2, Number(chamadasConfig.vozVelocidade ?? 1) + profile.rateBoost));
      const basePitch = voiceGender === 'feminino' ? 1.3 : 0.65;
      utterance.pitch = Math.max(0.1, Math.min(2, basePitch + profile.pitchBoost));
      utterance.volume = Number(chamadasConfig.vozVolume ?? 1);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      window.speechSynthesis.speak(utterance);
    }

    if (!window.speechSynthesis.getVoices().length) {
      const originalHandler = window.speechSynthesis.onvoiceschanged;
      window.speechSynthesis.onvoiceschanged = () => {
        speakNow();
        window.speechSynthesis.onvoiceschanged = originalHandler;
      };
      return;
    }

    speakNow();
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Administração do Sistema</h2>
        <p className="text-sm sm:text-base text-muted-foreground">
          Gerencie todas as configurações do sistema
        </p>
      </div>

      {/* Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 gap-2 h-auto p-1 bg-muted/50">
          <TabsTrigger value="institucional" className="flex items-center gap-2 text-xs sm:text-sm py-2 sm:py-3">
            <Buildings size={16} weight="duotone" />
            <span className="hidden sm:inline">Institucional</span>
          </TabsTrigger>
          <TabsTrigger value="campos" className="flex items-center gap-2 text-xs sm:text-sm py-2 sm:py-3">
            <ListChecks size={16} weight="duotone" />
            <span className="hidden sm:inline">Campos</span>
          </TabsTrigger>
          <TabsTrigger value="horarios" className="flex items-center gap-2 text-xs sm:text-sm py-2 sm:py-3">
            <Clock size={16} weight="duotone" />
            <span className="hidden sm:inline">Horários</span>
          </TabsTrigger>
          <TabsTrigger value="notificacoes" className="flex items-center gap-2 text-xs sm:text-sm py-2 sm:py-3">
            <Bell size={16} weight="duotone" />
            <span className="hidden sm:inline">Notificações</span>
          </TabsTrigger>
          <TabsTrigger value="chamadas" className="flex items-center gap-2 text-xs sm:text-sm py-2 sm:py-3">
            <SpeakerHigh size={16} weight="duotone" />
            <span className="hidden sm:inline">Chamadas</span>
          </TabsTrigger>
          <TabsTrigger value="geral" className="flex items-center gap-2 text-xs sm:text-sm py-2 sm:py-3">
            <Users size={16} weight="duotone" />
            <span className="hidden sm:inline">Geral</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB: INSTITUCIONAL */}
        <TabsContent value="institucional" className="space-y-6">
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Buildings className="text-primary" size={24} weight="duotone" />
                Dados Institucionais
              </CardTitle>
              <CardDescription>
                Informações oficiais do município exibidas nos relatórios e documentos gerados pelo sistema.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">

              {/* Logo */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2 text-sm font-semibold">
                  <UploadSimple size={16} weight="duotone" className="text-primary" />
                  Logo do Município
                </Label>
                <div className="flex items-start gap-6">
                  {/* Preview */}
                  <div className="w-28 h-28 rounded-xl border-2 border-dashed border-border bg-muted/40 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {institucional.logo ? (
                      <img src={institucional.logo} alt="Logo" className="w-full h-full object-contain p-2" />
                    ) : (
                      <div className="text-center p-2">
                        <Buildings size={28} className="text-muted-foreground mx-auto mb-1" />
                        <span className="text-xs text-muted-foreground">Sem logo</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 flex-1">
                    <Label
                      htmlFor="logo-upload"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-background hover:bg-muted text-sm font-medium cursor-pointer transition-colors"
                    >
                      <UploadSimple size={16} />
                      Enviar imagem (PNG, JPG, SVG)
                    </Label>
                    <input
                      id="logo-upload"
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        const reader = new FileReader()
                        reader.onload = (ev) => {
                          setInstitucional(prev => ({ ...prev, logo: ev.target?.result as string }))
                        }
                        reader.readAsDataURL(file)
                      }}
                    />
                    {institucional.logo && (
                      <button
                        type="button"
                        onClick={() => setInstitucional(prev => ({ ...prev, logo: '' }))}
                        className="flex items-center gap-1 text-xs text-destructive hover:underline"
                      >
                        <Trash size={12} /> Remover logo
                      </button>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Recomendado: 200×200px, fundo transparente.
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Campos */}
              <div className="grid gap-6 sm:grid-cols-2">

                {/* Nome da Prefeitura */}
                <div className="space-y-2">
                  <Label htmlFor="nome-prefeitura" className="flex items-center gap-2 text-sm font-semibold">
                    <Buildings size={15} weight="duotone" className="text-primary" />
                    Nome da Prefeitura
                  </Label>
                  <Input
                    id="nome-prefeitura"
                    placeholder="Ex.: Prefeitura Municipal de Irauçuba"
                    value={institucional.nomePrefeitura}
                    onChange={(e) => setInstitucional(prev => ({ ...prev, nomePrefeitura: e.target.value }))}
                  />
                </div>

                {/* Nome da Secretaria */}
                <div className="space-y-2">
                  <Label htmlFor="nome-secretaria" className="flex items-center gap-2 text-sm font-semibold">
                    <Buildings size={15} weight="duotone" className="text-primary" />
                    Nome da Secretaria
                  </Label>
                  <Input
                    id="nome-secretaria"
                    placeholder="Ex.: Secretaria de Inclusão e Promoção Social"
                    value={institucional.nomeSecretaria}
                    onChange={(e) => setInstitucional(prev => ({ ...prev, nomeSecretaria: e.target.value }))}
                  />
                </div>

                {/* CNPJ */}
                <div className="space-y-2">
                  <Label htmlFor="cnpj" className="flex items-center gap-2 text-sm font-semibold">
                    <IdentificationCard size={15} weight="duotone" className="text-primary" />
                    CNPJ
                  </Label>
                  <Input
                    id="cnpj"
                    placeholder="00.000.000/0000-00"
                    maxLength={18}
                    value={institucional.cnpj}
                    onChange={(e) => {
                      // Formata automaticamente: 00.000.000/0000-00
                      let v = e.target.value.replace(/\D/g, '').slice(0, 14)
                      if (v.length > 12) v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2}).*/, '$1.$2.$3/$4-$5')
                      else if (v.length > 8) v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{0,4}).*/, '$1.$2.$3/$4')
                      else if (v.length > 5) v = v.replace(/^(\d{2})(\d{3})(\d{0,3}).*/, '$1.$2.$3')
                      else if (v.length > 2) v = v.replace(/^(\d{2})(\d{0,3}).*/, '$1.$2')
                      setInstitucional(prev => ({ ...prev, cnpj: v }))
                    }}
                  />
                  <p className="text-xs text-muted-foreground">Máximo 18 caracteres (com pontuação).</p>
                </div>

                {/* Responsável */}
                <div className="space-y-2">
                  <Label htmlFor="responsavel" className="flex items-center gap-2 text-sm font-semibold">
                    <UserCircle size={15} weight="duotone" className="text-primary" />
                    Responsável
                  </Label>
                  <Input
                    id="responsavel"
                    placeholder="Nome do(a) responsável pela secretaria"
                    value={institucional.responsavel}
                    onChange={(e) => setInstitucional(prev => ({ ...prev, responsavel: e.target.value }))}
                  />
                </div>

                {/* Telefone */}
                <div className="space-y-2">
                  <Label htmlFor="telefone" className="flex items-center gap-2 text-sm font-semibold">
                    <Phone size={15} weight="duotone" className="text-primary" />
                    Telefone
                  </Label>
                  <Input
                    id="telefone"
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                    value={institucional.telefone}
                    onChange={(e) => {
                      // Formata: (00) 00000-0000 ou (00) 0000-0000
                      let v = e.target.value.replace(/\D/g, '').slice(0, 11)
                      if (v.length > 6) v = v.replace(/^(\d{2})(\d{4,5})(\d{0,4}).*/, '($1) $2-$3')
                      else if (v.length > 2) v = v.replace(/^(\d{2})(\d{0,5}).*/, '($1) $2')
                      else if (v.length > 0) v = v.replace(/^(\d{0,2}).*/, '($1')
                      setInstitucional(prev => ({ ...prev, telefone: v }))
                    }}
                  />
                </div>
              </div>

              <Separator />

              {/* Botão salvar */}
              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    onUpdateConfig({
                      ...config,
                      systemName: institucional.nomePrefeitura || config.systemName,
                      logo: institucional.logo,
                      contactInfo: {
                        ...config.contactInfo,
                        cnpj:            institucional.cnpj,
                        responsibleName: institucional.responsavel,
                        phone:           institucional.telefone,
                        secretariaName:  institucional.nomeSecretaria,
                      },
                    })
                    toast.success('Dados institucionais salvos com sucesso!')
                  }}
                >
                  <FloppyDisk size={18} className="mr-2" />
                  Salvar Dados Institucionais
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setInstitucional({ nomePrefeitura: '', nomeSecretaria: '', cnpj: '', responsavel: '', telefone: '', logo: '' })}
                >
                  <ArrowCounterClockwise size={18} className="mr-2" />
                  Limpar
                </Button>
              </div>

            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: LAYOUT (Cores) — mantido mas sem trigger visível, acessível via URL se necessário */}
        <TabsContent value="layout" className="space-y-6">
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="text-primary" size={24} weight="duotone" />
                Layout - Alteração de Cores do Sistema
              </CardTitle>
              <CardDescription>
                Configure as cores para cada área do sistema. As alterações são aplicadas em tempo real.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Sub-tabs para áreas */}
              <Tabs value={layoutSubTab} onValueChange={setLayoutSubTab}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="public">Página Pública</TabsTrigger>
                  <TabsTrigger value="secretary">Secretaria</TabsTrigger>
                  <TabsTrigger value="attendance">Atendimento</TabsTrigger>
                </TabsList>

                {/* Conteúdo das sub-tabs */}
                {(['public', 'secretary', 'attendance'] as const).map(area => (
                  <TabsContent key={area} value={area} className="space-y-6 mt-6">
                    <div className="grid gap-6 md:grid-cols-2">
                      {/* Inputs de Cores */}
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor={`${area}-primary`}>Cor Primária</Label>
                          <div className="flex gap-2">
                            <Input
                              id={`${area}-primary`}
                              type="color"
                              value={layoutConfig[area].corPrimaria}
                              onChange={(e) => setLayoutConfig(prev => ({
                                ...prev,
                                [area]: { ...prev[area], corPrimaria: e.target.value }
                              }))}
                              className="w-20 h-10"
                            />
                            <Input
                              value={layoutConfig[area].corPrimaria}
                              onChange={(e) => setLayoutConfig(prev => ({
                                ...prev,
                                [area]: { ...prev[area], corPrimaria: e.target.value }
                              }))}
                              className="flex-1 font-mono"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`${area}-secondary`}>Cor Secundária</Label>
                          <div className="flex gap-2">
                            <Input
                              id={`${area}-secondary`}
                              type="color"
                              value={layoutConfig[area].corSecundaria}
                              onChange={(e) => setLayoutConfig(prev => ({
                                ...prev,
                                [area]: { ...prev[area], corSecundaria: e.target.value }
                              }))}
                              className="w-20 h-10"
                            />
                            <Input
                              value={layoutConfig[area].corSecundaria}
                              onChange={(e) => setLayoutConfig(prev => ({
                                ...prev,
                                [area]: { ...prev[area], corSecundaria: e.target.value }
                              }))}
                              className="flex-1 font-mono"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`${area}-accent`}>Cor de Destaque</Label>
                          <div className="flex gap-2">
                            <Input
                              id={`${area}-accent`}
                              type="color"
                              value={layoutConfig[area].corDestaque}
                              onChange={(e) => setLayoutConfig(prev => ({
                                ...prev,
                                [area]: { ...prev[area], corDestaque: e.target.value }
                              }))}
                              className="w-20 h-10"
                            />
                            <Input
                              value={layoutConfig[area].corDestaque}
                              onChange={(e) => setLayoutConfig(prev => ({
                                ...prev,
                                [area]: { ...prev[area], corDestaque: e.target.value }
                              }))}
                              className="flex-1 font-mono"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`${area}-btn-primary`}>Cor Botão Principal</Label>
                          <div className="flex gap-2">
                            <Input
                              id={`${area}-btn-primary`}
                              type="color"
                              value={layoutConfig[area].corBotaoPrincipal}
                              onChange={(e) => setLayoutConfig(prev => ({
                                ...prev,
                                [area]: { ...prev[area], corBotaoPrincipal: e.target.value }
                              }))}
                              className="w-20 h-10"
                            />
                            <Input
                              value={layoutConfig[area].corBotaoPrincipal}
                              onChange={(e) => setLayoutConfig(prev => ({
                                ...prev,
                                [area]: { ...prev[area], corBotaoPrincipal: e.target.value }
                              }))}
                              className="flex-1 font-mono"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`${area}-btn-secondary`}>Cor Botão Secundário</Label>
                          <div className="flex gap-2">
                            <Input
                              id={`${area}-btn-secondary`}
                              type="color"
                              value={layoutConfig[area].corBotaoSecundario}
                              onChange={(e) => setLayoutConfig(prev => ({
                                ...prev,
                                [area]: { ...prev[area], corBotaoSecundario: e.target.value }
                              }))}
                              className="w-20 h-10"
                            />
                            <Input
                              value={layoutConfig[area].corBotaoSecundario}
                              onChange={(e) => setLayoutConfig(prev => ({
                                ...prev,
                                [area]: { ...prev[area], corBotaoSecundario: e.target.value }
                              }))}
                              className="flex-1 font-mono"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Preview */}
                      <div className="space-y-4">
                        <div className="p-6 rounded-lg border-2 bg-card space-y-4">
                          <h4 className="font-semibold text-sm text-muted-foreground">Preview em Tempo Real</h4>
                          <Separator />
                          
                          {/* Preview de elementos */}
                          <div className="space-y-3">
                            <div 
                              className="p-4 rounded-lg text-white font-medium"
                              style={{ backgroundColor: layoutConfig[area].corPrimaria }}
                            >
                              Cor Primária - Cabeçalhos e Destaques
                            </div>
                            
                            <div 
                              className="p-4 rounded-lg text-white font-medium"
                              style={{ backgroundColor: layoutConfig[area].corSecundaria }}
                            >
                              Cor Secundária - Elementos Secundários
                            </div>
                            
                            <div 
                              className="p-4 rounded-lg text-white font-medium"
                              style={{ backgroundColor: layoutConfig[area].corDestaque }}
                            >
                              Cor de Destaque - Alertas e Notificações
                            </div>

                            <div className="flex gap-2">
                              <button 
                                className="flex-1 px-4 py-2 rounded-md text-white font-medium"
                                style={{ backgroundColor: layoutConfig[area].corBotaoPrincipal }}
                              >
                                Botão Principal
                              </button>
                              <button 
                                className="flex-1 px-4 py-2 rounded-md text-white font-medium"
                                style={{ backgroundColor: layoutConfig[area].corBotaoSecundario }}
                              >
                                Botão Secundário
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                ))}

                {/* Tab: Configuração (SMTP e WhatsApp API) */}
                <TabsContent value="configuracao" className="space-y-6 mt-4">
                  {/* Configuração SMTP */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Gear size={20} weight="duotone" className="text-primary" />
                      <h4 className="font-semibold text-lg">Configuração do Servidor SMTP</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Configure o servidor SMTP para envio de e-mails automáticos
                    </p>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Servidor SMTP (Host)</Label>
                        <Input
                          placeholder="smtp.exemplo.com"
                          value={geralConfig.smtpHost || ''}
                          onChange={(e) => setGeralConfig(prev => ({ ...prev, smtpHost: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Porta SMTP</Label>
                        <Input
                          type="number"
                          placeholder="587"
                          value={geralConfig.smtpPort || ''}
                          onChange={(e) => setGeralConfig(prev => ({ ...prev, smtpPort: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Usuário / E-mail</Label>
                        <Input
                          type="email"
                          placeholder="seu-email@exemplo.com"
                          value={geralConfig.smtpUser || ''}
                          onChange={(e) => setGeralConfig(prev => ({ ...prev, smtpUser: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Senha</Label>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          value={geralConfig.smtpPassword || ''}
                          onChange={(e) => setGeralConfig(prev => ({ ...prev, smtpPassword: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Nome do Remetente</Label>
                        <Input
                          placeholder="Prefeitura Municipal"
                          value={geralConfig.smtpFromName || ''}
                          onChange={(e) => setGeralConfig(prev => ({ ...prev, smtpFromName: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>E-mail do Remetente</Label>
                        <Input
                          type="email"
                          placeholder="noreply@prefeitura.gov.br"
                          value={geralConfig.smtpFromEmail || ''}
                          onChange={(e) => setGeralConfig(prev => ({ ...prev, smtpFromEmail: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={geralConfig.smtpSecure || false}
                        onCheckedChange={(checked) => setGeralConfig(prev => ({ ...prev, smtpSecure: checked }))}
                      />
                      <Label>Usar conexão segura (TLS/SSL)</Label>
                    </div>
                  </div>

                  <Separator />

                  {/* Configuração WhatsApp API */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Gear size={20} weight="duotone" className="text-primary" />
                      <h4 className="font-semibold text-lg">Configuração da API do WhatsApp</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Configure a API do WhatsApp para envio de mensagens automáticas
                    </p>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>URL da API</Label>
                        <Input
                          placeholder="https://api.whatsapp.com/send"
                          value={geralConfig.whatsappApiUrl || ''}
                          onChange={(e) => setGeralConfig(prev => ({ ...prev, whatsappApiUrl: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Token de Autenticação</Label>
                        <Input
                          type="password"
                          placeholder="••••••••••••••••"
                          value={geralConfig.whatsappApiToken || ''}
                          onChange={(e) => setGeralConfig(prev => ({ ...prev, whatsappApiToken: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>ID da Instância</Label>
                        <Input
                          placeholder="instance-12345"
                          value={geralConfig.whatsappInstanceId || ''}
                          onChange={(e) => setGeralConfig(prev => ({ ...prev, whatsappInstanceId: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Número de Origem</Label>
                        <Input
                          placeholder="5585999999999"
                          value={geralConfig.whatsappFromNumber || ''}
                          onChange={(e) => setGeralConfig(prev => ({ ...prev, whatsappFromNumber: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={geralConfig.whatsappEnabled || false}
                        onCheckedChange={(checked) => setGeralConfig(prev => ({ ...prev, whatsappEnabled: checked }))}
                      />
                      <Label>Ativar envio de WhatsApp</Label>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button onClick={handleSaveGeral}>
                      <FloppyDisk size={18} className="mr-2" />
                      Salvar Configurações
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Botões de Ação */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <Button onClick={handleSaveLayout} className="flex-1 sm:flex-none">
                  <FloppyDisk size={18} className="mr-2" />
                  Salvar Cores
                </Button>
                <Button variant="outline" onClick={handleRestoreLayoutDefaults} className="flex-1 sm:flex-none">
                  <ArrowCounterClockwise size={18} className="mr-2" />
                  Restaurar Padrões
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: CAMPOS PERSONALIZADOS */}
        <TabsContent value="campos" className="space-y-6">
          <Card className="border-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2">
                    <ListChecks className="text-primary" size={24} weight="duotone" />
                    Campos Personalizados
                  </CardTitle>
                  <CardDescription>
                    Adicione campos customizados ao formulário de agendamento
                  </CardDescription>
                </div>
                <Button onClick={() => setIsAddingField(true)} size="sm">
                  <Plus size={18} className="mr-2" />
                  Adicionar Campo
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Formulário de novo campo */}
              {isAddingField && (
                <Card className="border-2 border-primary/20 bg-primary/5">
                  <CardHeader>
                    <CardTitle className="text-lg">Novo Campo</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="field-name">Nome do Campo (identificador)</Label>
                        <Input
                          id="field-name"
                          placeholder="nome_mae"
                          value={newField.nomeCampo}
                          onChange={(e) => setNewField(prev => ({ ...prev, nomeCampo: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="field-label">Label (texto exibido)</Label>
                        <Input
                          id="field-label"
                          placeholder="Nome da Mãe"
                          value={newField.labelCampo}
                          onChange={(e) => setNewField(prev => ({ ...prev, labelCampo: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="field-type">Tipo de Campo</Label>
                        <Select 
                          value={newField.tipoCampo}
                          onValueChange={(value) => setNewField(prev => ({ ...prev, tipoCampo: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Texto</SelectItem>
                            <SelectItem value="number">Número</SelectItem>
                            <SelectItem value="email">E-mail</SelectItem>
                            <SelectItem value="tel">Telefone</SelectItem>
                            <SelectItem value="date">Data</SelectItem>
                            <SelectItem value="select">Seleção</SelectItem>
                            <SelectItem value="textarea">Texto Longo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Switch 
                            checked={newField.obrigatorio}
                            onCheckedChange={(checked) => setNewField(prev => ({ ...prev, obrigatorio: checked }))}
                          />
                          <Label>Obrigatório</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch 
                            checked={newField.ativo}
                            onCheckedChange={(checked) => setNewField(prev => ({ ...prev, ativo: checked }))}
                          />
                          <Label>Ativo</Label>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleAddCustomField}>
                        <Check size={18} className="mr-2" />
                        Adicionar
                      </Button>
                      <Button variant="outline" onClick={() => setIsAddingField(false)}>
                        <X size={18} className="mr-2" />
                        Cancelar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Lista de campos */}
              <div className="space-y-3">
                {customFields.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ListChecks size={48} className="mx-auto mb-4 opacity-50" />
                    <p>Nenhum campo personalizado cadastrado ainda</p>
                    <p className="text-sm">Clique em "Adicionar Campo" para começar</p>
                  </div>
                ) : (
                  customFields.map((field) => (
                    <Card key={field.id} className="border">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{field.labelCampo}</span>
                              {field.obrigatorio && (
                                <Badge variant="destructive" className="text-xs">Obrigatório</Badge>
                              )}
                              {!field.ativo && (
                                <Badge variant="secondary" className="text-xs">Inativo</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Tipo: {field.tipoCampo} • ID: {field.nomeCampo}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm">
                              <PencilSimple size={18} />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => handleDeleteField(field.id)}
                            >
                              <Trash size={18} className="text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: HORÁRIOS */}
        <TabsContent value="horarios" className="space-y-6">
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="text-primary" size={24} weight="duotone" />
                Horários de Funcionamento
              </CardTitle>
              <CardDescription>
                Configure os horários disponíveis para agendamento e regras de limite
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="horarios">Horários Disponíveis (separados por vírgula)</Label>
                <Textarea
                  id="horarios"
                  rows={4}
                  value={horariosConfig.horariosDisponiveis}
                  onChange={(e) => setHorariosConfig(prev => ({ ...prev, horariosDisponiveis: e.target.value }))}
                  placeholder="08:00, 08:30, 09:00, 09:30, 10:00..."
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Exemplo: 08:00, 08:30, 09:00, 09:30, 10:00, 10:30, 11:00, 11:30, 13:00, 13:30, 14:00, 14:30, 15:00, 15:30, 16:00, 16:30, 17:00
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="max-appointments">Máximo de Agendamentos por Horário</Label>
                  <Input
                    id="max-appointments"
                    type="number"
                    min="1"
                    value={horariosConfig.maxAgendamentosPorHorario}
                    onChange={(e) => setHorariosConfig(prev => ({ 
                      ...prev, 
                      maxAgendamentosPorHorario: parseInt(e.target.value) 
                    }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="booking-period">Período Liberado para Agendamentos</Label>
                  <Select
                    value={horariosConfig.periodoLiberadoDias.toString()}
                    onValueChange={(value) => setHorariosConfig(prev => ({ 
                      ...prev, 
                      periodoLiberadoDias: parseInt(value) 
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 dia</SelectItem>
                      <SelectItem value="7">1 semana (7 dias)</SelectItem>
                      <SelectItem value="15">15 dias</SelectItem>
                      <SelectItem value="30">30 dias (1 mês)</SelectItem>
                      <SelectItem value="60">60 dias (2 meses)</SelectItem>
                      <SelectItem value="90">90 dias (3 meses)</SelectItem>
                      <SelectItem value="180">180 dias (6 meses)</SelectItem>
                      <SelectItem value="365">365 dias (1 ano)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button onClick={handleSaveHorarios}>
                  <FloppyDisk size={18} className="mr-2" />
                  Salvar Horários
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: NOTIFICAÇÕES */}
        <TabsContent value="notificacoes" className="space-y-6">
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="text-primary" size={24} weight="duotone" />
                Configurações de Notificações
              </CardTitle>
              <CardDescription>
                Configure mensagens automáticas enviadas por e-mail e WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Sub-tabs para tipos de notificação */}
              <Tabs value={notificationSubTab} onValueChange={setNotificationSubTab}>
                <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8 gap-1">
                  <TabsTrigger value="agendamento" className="text-xs px-2">Agendamento</TabsTrigger>
                  <TabsTrigger value="reagendamento" className="text-xs px-2">Reagendamento</TabsTrigger>
                  <TabsTrigger value="lembrete" className="text-xs px-2">Lembrete</TabsTrigger>
                  <TabsTrigger value="cancelamento" className="text-xs px-2">Cancelamento</TabsTrigger>
                  <TabsTrigger value="concluido" className="text-xs px-2">Concluído</TabsTrigger>
                  <TabsTrigger value="cin_pronta" className="text-xs px-2">CIN Pronta</TabsTrigger>
                  <TabsTrigger value="cin_entregue" className="text-xs px-2">CIN Entregue</TabsTrigger>
                  <TabsTrigger value="configuracao" className="text-xs px-2 flex items-center gap-1">
                    <Gear size={14} weight="duotone" />
                    Configuração
                  </TabsTrigger>
                </TabsList>

                {(['agendamento', 'reagendamento', 'lembrete', 'cancelamento', 'concluido', 'cin_pronta', 'cin_entregue'] as const).map(tipo => (
                  <TabsContent key={tipo} value={tipo} className="space-y-4 mt-4">
                    <div className="flex gap-4 mb-4">
                      <div className="flex items-center gap-2">
                        <Switch 
                          checked={notificationsConfig[tipo].emailAtivo}
                          onCheckedChange={(checked) => setNotificationsConfig(prev => ({
                            ...prev,
                            [tipo]: { ...prev[tipo], emailAtivo: checked }
                          }))}
                        />
                        <Label>E-mail</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch 
                          checked={notificationsConfig[tipo].whatsappAtivo}
                          onCheckedChange={(checked) => setNotificationsConfig(prev => ({
                            ...prev,
                            [tipo]: { ...prev[tipo], whatsappAtivo: checked }
                          }))}
                        />
                        <Label>WhatsApp</Label>
                      </div>
                    </div>

                    {tipo === 'reagendamento' && (
                      <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                        Esta notificação é enviada automaticamente quando um atendimento é reagendado na Secretaria/Atendimento.
                      </div>
                    )}

                    {tipo === 'lembrete' && (
                      <div className="space-y-3">
                        <Label>Lembretes automáticos (você pode adicionar vários):</Label>
                        <div className="flex flex-wrap gap-2">
                          {(notificationsConfig.lembrete.lembreteAntecedenciaDiasList || []).map((day: number) => (
                            <Badge key={day} variant="outline" className="gap-2 px-3 py-1">
                              {day === 1 ? '1 dia antes' : `${day} dias antes`}
                              <button
                                type="button"
                                className="text-red-500 hover:text-red-700"
                                onClick={() => removeReminderDay(day)}
                                aria-label={`Remover lembrete de ${day} dias`}
                              >
                                ×
                              </button>
                            </Badge>
                          ))}
                          {(!notificationsConfig.lembrete.lembreteAntecedenciaDiasList ||
                            notificationsConfig.lembrete.lembreteAntecedenciaDiasList.length === 0) && (
                            <p className="text-xs text-muted-foreground">
                              Nenhum lembrete configurado no momento.
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2 items-center">
                          <Input
                            type="number"
                            min={1}
                            value={reminderDaysInput}
                            onChange={(e) => setReminderDaysInput(e.target.value)}
                            className="max-w-[140px]"
                            placeholder="Dias"
                          />
                          <Button type="button" variant="outline" onClick={addReminderDay}>
                            + Adicionar lembrete
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Assunto do E-mail</Label>
                      <Input
                        value={notificationsConfig[tipo].emailAssunto}
                        onChange={(e) => setNotificationsConfig(prev => ({
                          ...prev,
                          [tipo]: { ...prev[tipo], emailAssunto: e.target.value }
                        }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Mensagem</Label>
                      <Textarea
                        rows={6}
                        value={notificationsConfig[tipo].emailCorpo}
                        onChange={(e) => setNotificationsConfig(prev => ({
                          ...prev,
                          [tipo]: { ...prev[tipo], emailCorpo: e.target.value }
                        }))}
                      />
                      <p className="text-xs text-muted-foreground">
                        Variáveis: <code className="bg-muted px-1 rounded">{'{nome}'}</code>{' '}
                        <code className="bg-muted px-1 rounded">{'{data}'}</code>{' '}
                        <code className="bg-muted px-1 rounded">{'{hora}'}</code>{' '}
                        <code className="bg-muted px-1 rounded">{'{protocolo}'}</code>{' '}
                        <code className="bg-muted px-1 rounded">{'{local}'}</code> <span className="text-muted-foreground/70">(nome do local)</span>{' '}
                        <code className="bg-muted px-1 rounded">{'{endereco}'}</code> <span className="text-muted-foreground/70">(rua/endereço)</span>{' '}
                        <code className="bg-muted px-1 rounded">{'{link_local}'}</code> <span className="text-muted-foreground/70">(mapa)</span>{' '}
                        <code className="bg-muted px-1 rounded">{'{antecedencia_texto}'}</code> <span className="text-muted-foreground/70">(lembretes)</span>{' '}
                        <code className="bg-muted px-1 rounded">{'{tipo_rg}'}</code>
                      </p>
                    </div>

                    {/* Pré-visualizações */}
                    <div className="grid gap-4 md:grid-cols-2 pt-2">
                      {/* Preview Email */}
                      {notificationsConfig[tipo].emailAtivo && (
                        <div className="space-y-2">
                          <p className="text-sm font-semibold flex items-center gap-2">
                            <span className="inline-block w-3 h-3 rounded-full bg-blue-500" />
                            Prévia — E-mail
                          </p>
                          <div className="rounded-lg border border-blue-200 bg-white overflow-hidden text-sm shadow-sm">
                            <div className="bg-blue-600 px-4 py-2 text-white text-xs font-medium flex items-center gap-2">
                              <span>✉</span>
                              <span>{notificationsConfig[tipo].emailAssunto
                                .replace(/\{nome\}/g, 'João Silva')
                                .replace(/\{data\}/g, '25/02/2026')
                                .replace(/\{hora\}/g, '09:00')
                                .replace(/\{protocolo\}/g, 'RGML1234')
                                .replace(/\{local\}/g, 'Secretaria 10')
                                .replace(/\{endereco\}/g, 'Rua Principal, 100')
                                .replace(/\{link_local\}/g, 'https://maps.google.com')
                                .replace(/\{antecedencia_texto\}/g, 'amanhã às 09:00')
                                .replace(/\{tipo_rg\}/g, '1ª via') || 'Sem assunto'}</span>
                            </div>
                            <div className="px-4 py-3 text-gray-700 whitespace-pre-wrap leading-relaxed" style={{ color: '#374151', minHeight: '80px' }}>
                              {(notificationsConfig[tipo].emailCorpo || 'Nenhuma mensagem configurada.')
                                .replace(/\{nome\}/g, 'João Silva')
                                .replace(/\{data\}/g, '25/02/2026')
                                .replace(/\{hora\}/g, '09:00')
                                .replace(/\{protocolo\}/g, 'RGML1234')
                                .replace(/\{local\}/g, 'Secretaria 10')
                                .replace(/\{endereco\}/g, 'Rua Principal, 100')
                                .replace(/\{link_local\}/g, 'https://maps.google.com')
                                .replace(/\{antecedencia_texto\}/g, 'amanhã às 09:00')
                                .replace(/\{tipo_rg\}/g, '1ª via')}
                            </div>
                            <div className="px-4 py-2 border-t text-xs text-gray-400 bg-gray-50" style={{ color: '#9CA3AF' }}>
                              Esta é uma mensagem automática. Não responda este e-mail.
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Preview WhatsApp */}
                      {notificationsConfig[tipo].whatsappAtivo && (
                        <div className="space-y-2">
                          <p className="text-sm font-semibold flex items-center gap-2">
                            <span className="inline-block w-3 h-3 rounded-full bg-green-500" />
                            Prévia — WhatsApp
                          </p>
                          <div className="rounded-lg border border-green-200 overflow-hidden shadow-sm" style={{ backgroundColor: '#e5ddd5' }}>
                            <div className="bg-green-600 px-4 py-2 text-white text-xs font-medium flex items-center gap-2">
                              <span>💬</span>
                              <span>Mensagem Automática</span>
                            </div>
                            <div className="p-3">
                              <div className="inline-block rounded-lg px-3 py-2 text-sm max-w-xs shadow-sm" style={{ backgroundColor: '#ffffff', color: '#111827' }}>
                                <p className="whitespace-pre-wrap leading-relaxed" style={{ color: '#111827' }}>
                                  {(notificationsConfig[tipo].emailCorpo || 'Nenhuma mensagem configurada.')
                                    .replace(/\{nome\}/g, 'João Silva')
                                    .replace(/\{data\}/g, '25/02/2026')
                                    .replace(/\{hora\}/g, '09:00')
                                    .replace(/\{protocolo\}/g, 'RGML1234')
                                    .replace(/\{local\}/g, 'Secretaria 10')
                                    .replace(/\{endereco\}/g, 'Rua Principal, 100')
                                    .replace(/\{link_local\}/g, 'https://maps.google.com')
                                    .replace(/\{antecedencia_texto\}/g, 'amanhã às 09:00')
                                    .replace(/\{tipo_rg\}/g, '1ª via')}
                                </p>
                                <p className="text-right text-xs mt-1" style={{ color: '#6B7280' }}>09:00 ✓✓</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {!notificationsConfig[tipo].emailAtivo && !notificationsConfig[tipo].whatsappAtivo && (
                        <p className="text-xs text-muted-foreground col-span-2 italic">
                          Ative E-mail ou WhatsApp acima para visualizar a prévia da mensagem.
                        </p>
                      )}
                    </div>
                  </TabsContent>
                ))}

                {/* Tab: Configuração (SMTP e WhatsApp API) */}
                <TabsContent value="configuracao" className="space-y-6 mt-4">
                  {/* Configuração SMTP */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Gear size={20} weight="duotone" className="text-primary" />
                      <h4 className="font-semibold text-lg">Configuração do Servidor SMTP</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Configure o servidor SMTP para envio de e-mails automáticos
                    </p>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Servidor SMTP (Host)</Label>
                        <Input
                          placeholder="smtp.exemplo.com"
                          value={smtpConfig.smtp_host || ''}
                          onChange={(e) => setSmtpConfig(prev => ({ ...prev, smtp_host: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Porta SMTP</Label>
                        <Input
                          type="number"
                          placeholder="587"
                          value={smtpConfig.smtp_port || ''}
                          onChange={(e) => setSmtpConfig(prev => ({ ...prev, smtp_port: Number(e.target.value) }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Usuário / E-mail</Label>
                        <Input
                          type="email"
                          placeholder="seu-email@exemplo.com"
                          value={smtpConfig.smtp_user || ''}
                          onChange={(e) => setSmtpConfig(prev => ({ ...prev, smtp_user: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Senha</Label>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          value={smtpConfig.smtp_password || ''}
                          onChange={(e) => setSmtpConfig(prev => ({ ...prev, smtp_password: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Nome do Remetente</Label>
                        <Input
                          placeholder="Prefeitura Municipal"
                          value={smtpConfig.smtp_from_name || ''}
                          onChange={(e) => setSmtpConfig(prev => ({ ...prev, smtp_from_name: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>E-mail do Remetente</Label>
                        <Input
                          type="email"
                          placeholder="noreply@prefeitura.gov.br"
                          value={smtpConfig.smtp_from_email || ''}
                          onChange={(e) => setSmtpConfig(prev => ({ ...prev, smtp_from_email: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={smtpConfig.smtp_secure || false}
                        onCheckedChange={(checked) => setSmtpConfig(prev => ({ ...prev, smtp_secure: checked }))}
                      />
                      <Label>Usar conexão segura (TLS/SSL)</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={smtpConfig.ativo || false}
                        onCheckedChange={(checked) => setSmtpConfig(prev => ({ ...prev, ativo: checked }))}
                      />
                      <Label>Ativar envio de E-mail</Label>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                    <Button onClick={handleSaveSmtp}>
                      <FloppyDisk size={18} className="mr-2" />
                      Salvar SMTP
                    </Button>
                      <Button
                        variant="outline"
                        onClick={handleSmtpDiagnose}
                        disabled={smtpDiagLoading}
                      >
                        <WifiHigh size={18} className="mr-2" />
                        {smtpDiagLoading ? 'Testando conexão...' : 'Testar Conexão SMTP'}
                      </Button>
                    </div>

                    {smtpDiagResult && (
                      <div className="mt-4 rounded-lg border bg-muted/40 p-4 space-y-3">
                        <div className="flex items-center gap-2 font-semibold text-sm">
                          {smtpDiagResult.success ? (
                            <CheckCircle size={18} className="text-green-600" />
                          ) : (
                            <Warning size={18} className="text-yellow-600" />
                          )}
                          Diagnóstico SMTP — {smtpDiagResult.success ? 'Tudo OK!' : 'Verifique os itens abaixo'}
                        </div>
                        <div className="space-y-2">
                          {smtpDiagResult.steps.map((s, i) => (
                            <div key={i} className={`flex items-start gap-3 rounded-md px-3 py-2 text-sm ${s.ok ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                              {s.ok
                                ? <CheckCircle size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                                : <XCircle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />
                              }
                              <div>
                                <span className="font-medium">{s.step}:</span>{' '}
                                <span className={s.ok ? 'text-green-800' : 'text-red-800'}>{s.detail}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Configuração Z-API (WhatsApp) */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Gear size={20} weight="duotone" className="text-primary" />
                      <h4 className="font-semibold text-lg">Configuração Z-API (WhatsApp)</h4>
                    </div>

                    {/* Guia rápido */}
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm space-y-2">
                      <p className="font-semibold text-blue-800">Como configurar a Z-API:</p>
                      <ol className="list-decimal list-inside space-y-1 text-blue-700">
                        <li>Acesse <strong>app.z-api.io</strong> → sua instância → aba <strong>Informações</strong></li>
                        <li>Copie o <strong>ID da Instância</strong> e o <strong>Token</strong></li>
                        <li>Se sua conta exigir <em>Security Token</em>, acesse a aba <strong>Security Token</strong> e copie-o para o campo <strong>Client Token</strong> abaixo</li>
                        <li>Salve e clique em <strong>Testar Conexão</strong></li>
                      </ol>
                      <p className="text-amber-700 font-medium mt-1">⚠️ O campo <strong>Client Token</strong> deve conter apenas o token de segurança (ex.: <code>F75c8abc...</code>), nunca uma URL.</p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2 md:col-span-2">
                        <Label>URL Base da API (opcional)</Label>
                        <Input
                          placeholder="Ex: https://api.z-api.io"
                          value={whatsappConfig.api_url || ''}
                          onChange={(e) => setWhatsappConfig(prev => ({ ...prev, api_url: e.target.value }))}
                        />
                        <p className="text-xs text-muted-foreground">Se deixar vazio, o sistema usa https://api.z-api.io.</p>
                      </div>

                      <div className="space-y-2">
                        <Label>ID da Instância <span className="text-red-500">*</span></Label>
                        <Input
                          placeholder="Ex: 3D4A5F6B7C8D9E"
                          value={whatsappConfig.instance_id || ''}
                          onChange={(e) => setWhatsappConfig(prev => ({ ...prev, instance_id: e.target.value }))}
                        />
                        <p className="text-xs text-muted-foreground">ID da instância na Z-API.</p>
                      </div>

                      <div className="space-y-2">
                        <Label>Token <span className="text-red-500">*</span></Label>
                        <Input
                          type="password"
                          placeholder="••••••••••••••••••••"
                          value={whatsappConfig.api_token || ''}
                          onChange={(e) => setWhatsappConfig(prev => ({ ...prev, api_token: e.target.value }))}
                        />
                        <p className="text-xs text-muted-foreground">Token de autenticação da instância na Z-API.</p>
                      </div>

                      <div className="space-y-2">
                        <Label>Client Token / Security Token (Z-API)</Label>
                        <Input
                          type="password"
                          placeholder="Ex: F75c8abc123... (apenas o token, não a URL)"
                          value={whatsappConfig.client_token || ''}
                          onChange={(e) => setWhatsappConfig(prev => ({ ...prev, client_token: e.target.value }))}
                          className={/^https?:\/\//i.test(whatsappConfig.client_token || '') ? 'border-red-400 focus-visible:ring-red-400' : ''}
                        />
                        {/^https?:\/\//i.test(whatsappConfig.client_token || '') && (
                          <p className="text-xs text-red-600 font-medium">
                            ⚠️ Parece que você colou uma URL aqui. O Client Token é apenas o token de segurança (encontrado em app.z-api.io → sua instância → aba Security Token). Limpe este campo e cole somente o token.
                          </p>
                        )}
                        {!/^https?:\/\//i.test(whatsappConfig.client_token || '') && (
                          <p className="text-xs text-muted-foreground">
                            Obrigatório se a sua conta Z-API exige Security Token. Encontre em: <strong>app.z-api.io → instância → Security Token</strong>.
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>Número de Origem (opcional)</Label>
                        <Input
                          placeholder="5588999999999"
                          value={whatsappConfig.numero_origem || ''}
                          onChange={(e) => setWhatsappConfig(prev => ({ ...prev, numero_origem: e.target.value }))}
                        />
                        <p className="text-xs text-muted-foreground">Com DDD e código do país (55 para Brasil)</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={whatsappConfig.ativo || false}
                        onCheckedChange={(checked) => setWhatsappConfig(prev => ({ ...prev, ativo: checked }))}
                      />
                      <Label>Ativar envio de WhatsApp</Label>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                    <Button onClick={handleSaveWhatsapp}>
                      <FloppyDisk size={18} className="mr-2" />
                      Salvar WhatsApp
                    </Button>
                      <Button variant="outline" onClick={handleZapiDiagnose} disabled={zapiDiagLoading}>
                        <WifiHigh size={18} className="mr-2" />
                        {zapiDiagLoading ? 'Verificando...' : 'Testar Conexão Z-API'}
                      </Button>
                    </div>

                    {/* Resultado diagnóstico UltraMsg */}
                    {zapiDiagResult && (
                      <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                        <div className="flex items-center gap-2 font-semibold text-sm">
                          {zapiDiagResult.success
                            ? <CheckCircle size={18} className="text-green-600" />
                            : <Warning size={18} className="text-yellow-600" />}
                          Diagnóstico Z-API — {zapiDiagResult.success ? 'Tudo OK!' : 'Verifique os itens abaixo'}
                        </div>
                        <div className="space-y-2">
                          {zapiDiagResult.steps.map((s, i) => (
                            <div key={i} className={`flex items-start gap-3 rounded-md px-3 py-2 text-sm ${s.ok ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                              {s.ok
                                ? <CheckCircle size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                                : <XCircle size={16} className="text-red-600 mt-0.5 flex-shrink-0" />}
                              <div>
                                <span className="font-medium">{s.step}:</span>{' '}
                                <span className={s.ok ? 'text-green-800' : 'text-red-800'}>{s.detail}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Teste de envio real */}
                    {zapiDiagResult?.success && (
                      <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-3">
                        <p className="font-semibold text-sm text-green-800">Enviar mensagem de teste</p>
                        <div className="flex gap-2 items-end">
                          <div className="flex-1 space-y-1">
                            <Label className="text-xs">Número destino (com DDD)</Label>
                            <Input
                              placeholder="5588999999999"
                              value={zapiTestPhone}
                              onChange={(e) => setZapiTestPhone(e.target.value)}
                            />
                          </div>
                          <Button onClick={handleZapiTestSend} disabled={zapiTestLoading} className="bg-green-600 hover:bg-green-700">
                            {zapiTestLoading ? 'Enviando...' : 'Enviar Teste'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>

              <Separator />

              <div className="flex gap-3 pt-4">
                <Button onClick={handleSaveNotifications}>
                  <FloppyDisk size={18} className="mr-2" />
                  Salvar Notificações
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: CHAMADAS */}
        <TabsContent value="chamadas" className="space-y-6">
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SpeakerHigh className="text-primary" size={24} weight="duotone" />
                Sistema de Chamadas de Voz
              </CardTitle>
              <CardDescription>
                Configure a voz e o layout da interface de chamadas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <h4 className="font-semibold">Configurações de Voz</h4>
                  
                  <div className="space-y-2">
                    <Label>Tipo de Voz</Label>
                    <Select
                      value={chamadasConfig.vozTipo}
                      onValueChange={(value) => setChamadasConfig(prev => ({ ...prev, vozTipo: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="padrao">Padrão</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Gênero da Voz</Label>
                    <Select
                      value={chamadasConfig.vozGenero}
                      onValueChange={(value) => setChamadasConfig(prev => ({ ...prev, vozGenero: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="masculino">Masculino</SelectItem>
                        <SelectItem value="feminino">Feminino</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Velocidade: {chamadasConfig.vozVelocidade}x</Label>
                    <input
                      type="range"
                      min="0.5"
                      max="2"
                      step="0.1"
                      value={chamadasConfig.vozVelocidade}
                      onChange={(e) => setChamadasConfig(prev => ({ 
                        ...prev, 
                        vozVelocidade: parseFloat(e.target.value) 
                      }))}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Volume: {chamadasConfig.vozVolume}x</Label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={chamadasConfig.vozVolume}
                      onChange={(e) => setChamadasConfig(prev => ({ 
                        ...prev, 
                        vozVolume: parseFloat(e.target.value) 
                      }))}
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold">Layout da Interface</h4>
                  
                  <div className="space-y-2">
                    <Label>Cor de Fundo</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={chamadasConfig.corFundoChamada}
                        onChange={(e) => setChamadasConfig(prev => ({ 
                          ...prev, 
                          corFundoChamada: e.target.value 
                        }))}
                        className="w-20 h-10"
                      />
                      <Input
                        value={chamadasConfig.corFundoChamada}
                        onChange={(e) => setChamadasConfig(prev => ({ 
                          ...prev, 
                          corFundoChamada: e.target.value 
                        }))}
                        className="flex-1 font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Cor do Texto</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={chamadasConfig.corTextoChamada}
                        onChange={(e) => setChamadasConfig(prev => ({ 
                          ...prev, 
                          corTextoChamada: e.target.value 
                        }))}
                        className="w-20 h-10"
                      />
                      <Input
                        value={chamadasConfig.corTextoChamada}
                        onChange={(e) => setChamadasConfig(prev => ({ 
                          ...prev, 
                          corTextoChamada: e.target.value 
                        }))}
                        className="flex-1 font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Cor de Destaque (linhas)</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={chamadasConfig.corDestaqueChamada}
                        onChange={(e) => setChamadasConfig(prev => ({
                          ...prev,
                          corDestaqueChamada: e.target.value
                        }))}
                        className="w-20 h-10"
                      />
                      <Input
                        value={chamadasConfig.corDestaqueChamada}
                        onChange={(e) => setChamadasConfig(prev => ({
                          ...prev,
                          corDestaqueChamada: e.target.value
                        }))}
                        className="flex-1 font-mono"
                      />
                    </div>
                  </div>

                  {/* Preview */}
                  <div 
                    className="p-6 rounded-lg text-center"
                    style={{ 
                      backgroundColor: chamadasConfig.corFundoChamada,
                      color: chamadasConfig.corTextoChamada
                    }}
                  >
                    <div className="text-4xl font-bold mb-2">A001</div>
                    <div className="text-lg">João Silva</div>
                    <div className="text-sm opacity-75 mt-2">Guichê 3</div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Template da Mensagem</Label>
                <Input
                  value={chamadasConfig.templateChamada}
                  onChange={(e) => setChamadasConfig(prev => ({ ...prev, templateChamada: e.target.value }))}
                  placeholder="{NOME DO CIDADAO} comparecer a Sala {numero da sala} guiche {numero do guiche}"
                />
                <p className="text-xs text-muted-foreground">
                  Variáveis: {'{NOME DO CIDADAO}'}, {'{numero da sala}'}, {'{numero do guiche}'} (ou {'{name}'}, {'{sala}'}, {'{guiche}'})
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={handleTestVoice}>
                  <SpeakerHigh size={18} className="mr-2" />
                  Escutar Voz
                </Button>
                <Button onClick={handleSaveChamadas}>
                  <FloppyDisk size={18} className="mr-2" />
                  Salvar Configurações
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: GERAL - Cadastro Usuário */}
        <TabsContent value="geral" className="space-y-6">
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FloppyDisk className="text-primary" size={22} weight="duotone" />
                Backup Completo do Sistema
              </CardTitle>
              <CardDescription>
                Proteja o sistema com backup completo: banco, uploads e arquivos essenciais de configuração.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <input
                id="full-backup-import"
                type="file"
                accept=".zip"
                className="hidden"
                onChange={handleImportBackup}
              />

              <div className="rounded-lg border border-border/60 p-3 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Backup automático</p>
                    <p className="text-xs text-muted-foreground">Configure execução automática para evitar perda de dados.</p>
                  </div>
                  <Switch
                    checked={Boolean(geralConfig.backupAtivo)}
                    onCheckedChange={(checked) => setGeralConfig(prev => ({ ...prev, backupAtivo: checked }))}
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Periodicidade</Label>
                    <Select
                      value={String(geralConfig.backupPeriodicidade || 'diario')}
                      onValueChange={(value) => setGeralConfig(prev => ({ ...prev, backupPeriodicidade: value as 'diario' | 'semanal' | 'mensal' }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="diario">Diário</SelectItem>
                        <SelectItem value="semanal">Semanal (segunda-feira)</SelectItem>
                        <SelectItem value="mensal">Mensal (dia 1)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Horário</Label>
                    <Input
                      type="time"
                      value={String(geralConfig.backupHorario || '02:00').slice(0, 5)}
                      onChange={(e) => setGeralConfig(prev => ({ ...prev, backupHorario: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Retenção (dias)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={Number(geralConfig.backupRetencaoDias || 30)}
                      onChange={(e) => setGeralConfig(prev => ({ ...prev, backupRetencaoDias: Number(e.target.value || 1) }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Pasta de destino *</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Ex.: C:/Backups/jAgendamento"
                        value={String(geralConfig.backupOutputDir || '')}
                        onChange={(e) => setGeralConfig(prev => ({ ...prev, backupOutputDir: e.target.value }))}
                        onBlur={handleBackupOutputDirBlur}
                        required
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handlePickBackupOutputDir}
                        disabled={isPickingBackupDir}
                      >
                        {isPickingBackupDir ? 'Abrindo...' : 'Procurar'}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    {geralConfig.backupUltimoEm
                      ? `Último backup automático: ${format(new Date(geralConfig.backupUltimoEm), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`
                      : 'Nenhum backup automático executado ainda.'}
                  </p>
                  <Button variant="outline" onClick={handleSaveGeral}>
                    <FloppyDisk size={18} className="mr-2" />
                    Salvar Automação
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={handleBackupNow} disabled={isBackingUp || isImportingBackup || isRestoringBackup}>
                  <FloppyDisk size={18} className="mr-2" />
                  {isBackingUp ? 'Gerando backup...' : 'Gerar Backup'}
                </Button>

                <Button
                  variant="outline"
                  disabled={isImportingBackup || isBackingUp || isRestoringBackup}
                  onClick={() => {
                    const input = document.getElementById('full-backup-import') as HTMLInputElement | null;
                    input?.click();
                  }}
                >
                  <UploadSimple size={18} className="mr-2" />
                  {isImportingBackup ? 'Importando...' : 'Importar Backup'}
                </Button>

                <Button
                  variant="secondary"
                  disabled={isRestoringBackup || isBackingUp || isImportingBackup}
                  onClick={handleRestoreLatestBackup}
                >
                  <ArrowCounterClockwise size={18} className="mr-2" />
                  {isRestoringBackup ? 'Restaurando...' : 'Restaurar ao Último Backup'}
                </Button>
              </div>

              <div className="space-y-2 rounded-lg border border-border/60 p-3">
                <Label>Restaurar backup específico</Label>
                <div className="flex flex-wrap gap-2">
                  <Select
                    value={selectedBackupFile || undefined}
                    onValueChange={setSelectedBackupFile}
                    disabled={isLoadingBackups || availableBackups.length === 0 || isRestoringBackup || isBackingUp || isImportingBackup}
                  >
                    <SelectTrigger className="min-w-[320px] flex-1">
                      <SelectValue placeholder={isLoadingBackups ? 'Carregando backups...' : 'Selecione um backup'} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableBackups.slice(0, 5).map((backup) => (
                        <SelectItem key={backup.fileName} value={backup.fileName}>
                          {backup.fileName}
                          {backup.isLatest ? ' (último)' : ''}
                          {' • '}
                          {format(new Date(backup.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                          {' • '}
                          {formatBackupSize(backup.sizeBytes)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    disabled={!selectedBackupFile || isLoadingBackups || isRestoringBackup || isBackingUp || isImportingBackup}
                    onClick={handleRestoreSelectedBackup}
                  >
                    <ArrowCounterClockwise size={18} className="mr-2" />
                    {isRestoringBackup ? 'Restaurando...' : 'Restaurar Selecionado'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {availableBackups.length === 0
                    ? 'Nenhum backup completo encontrado ainda.'
                    : `Mostrando os 5 mais recentes (${availableBackups.length} no total).`}
                </p>
              </div>

              <p className="text-xs text-muted-foreground">
              </p>
            </CardContent>
          </Card>

          {onAddSecretaryUser && onUpdateSecretaryUser && onDeleteSecretaryUser ? (
            <SecretaryUserManagement
              users={secretaryUsers}
              locations={locations}
              onAddUser={onAddSecretaryUser}
              onUpdateUser={onUpdateSecretaryUser}
              onDeleteUser={onDeleteSecretaryUser}
            />
          ) : (
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="text-primary" size={24} weight="duotone" />
                  Cadastro Usuário
              </CardTitle>
              <CardDescription>
                  Gerencie usuários da secretaria com permissões específicas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center py-12 text-muted-foreground">
                <Users size={48} weight="duotone" className="mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">Cadastro Usuário</p>
                  <p className="text-sm mt-2">Configure os handlers necessários para gerenciar usuários.</p>
              </div>
            </CardContent>
          </Card>
          )}
        </TabsContent>

      </Tabs>

      <AlertDialog
        open={isRestoreConfirmOpen}
        onOpenChange={(open) => {
          if (!isRestoringBackup) setIsRestoreConfirmOpen(open)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar restauração de backup</AlertDialogTitle>
            <AlertDialogDescription>
              {restoreMode === 'latest'
                ? 'Tem certeza que deseja restaurar o último backup? Esta ação pode sobrescrever dados atuais.'
                : `Tem certeza que deseja restaurar o backup ${selectedBackupFile}? Esta ação pode sobrescrever dados atuais.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRestoringBackup}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isRestoringBackup}
              onClick={(event) => {
                event.preventDefault()
                if (restoreMode === 'latest') {
                  void confirmRestoreLatestBackup()
                } else {
                  void confirmRestoreSelectedBackup()
                }
              }}
            >
              {isRestoringBackup ? 'Restaurando...' : 'Confirmar restauração'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={isImportConfirmOpen}
        onOpenChange={(open) => {
          if (!isImportingBackup) {
            setIsImportConfirmOpen(open)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar importação e restauração</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingImportFile
                ? `Deseja importar e restaurar o backup ${pendingImportFile.name}?`
                : 'Selecione um arquivo de backup para importar e restaurar.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isImportingBackup}
              onClick={() => {
                if (!isImportingBackup) {
                  setPendingImportFile(null)
                  setIsImportConfirmOpen(false)
                }
              }}
            >
              Cancelar
            </AlertDialogCancel>
            <Button
              disabled={!pendingImportFile || isImportingBackup || isRestoringBackup}
              onClick={() => {
                void confirmImportBackup()
              }}
            >
              {isImportingBackup || isRestoringBackup ? 'Processando...' : 'Importar e restaurar'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
