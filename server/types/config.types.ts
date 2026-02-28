// Tipos para o sistema de configurações

export interface LayoutConfig {
  id?: number;
  prefeituraId: number;
  area: 'public' | 'secretary' | 'attendance';
  
  // Cores principais
  corPrimaria: string;
  corSecundaria: string;
  corDestaque: string;
  corFundo: string;
  corTexto: string;
  corTextoSecundario: string;
  
  // Cores de botões
  corBotaoPrincipal: string;
  corBotaoPrincipalHover: string;
  corBotaoSecundario: string;
  corBotaoSecundarioHover: string;
  corBotaoCancelar: string;
  corBotaoCancelarHover: string;
  
  // Cores de status
  corStatusPendente: string;
  corStatusConfirmado: string;
  corStatusChamado: string;
  corStatusConcluido: string;
  corStatusCancelado: string;
  
  atualizadoEm?: string;
  atualizadoPor?: number;
}

export interface HorariosConfig {
  id?: number;
  prefeituraId: number;
  horariosDisponiveis: string;
  maxAgendamentosPorHorario: number;
  periodoLiberadoDias: number;
  atualizadoEm?: string;
  atualizadoPor?: number;
}

export interface NotificacoesConfig {
  id?: number;
  prefeituraId: number;
  tipo: 'agendamento' | 'lembrete' | 'cancelamento' | 'concluido' | 'cin_pronta' | 'cin_entregue';
  
  emailAtivo: boolean;
  whatsappAtivo: boolean;
  smsAtivo: boolean;
  
  lembreteAntecedenciaDias?: number;
  
  emailAssunto?: string;
  emailCorpo?: string;
  whatsappMensagem?: string;
  smsMensagem?: string;
  
  smtpHost?: string;
  smtpPort?: number;
  smtpUsuario?: string;
  smtpSenha?: string;
  smtpDeEmail?: string;
  smtpDeNome?: string;
  
  whatsappApiUrl?: string;
  whatsappApiToken?: string;
  whatsappNumeroOrigem?: string;
  
  atualizadoEm?: string;
  atualizadoPor?: number;
}

export interface ChamadasConfig {
  id?: number;
  prefeituraId: number;
  
  vozTipo: 'google' | 'azure' | 'aws';
  vozIdioma: string;
  vozGenero: 'masculino' | 'feminino';
  vozVelocidade: number;
  vozVolume: number;
  vozTom: number;
  
  corFundoChamada: string;
  corTextoChamada: string;
  corDestaqueChamada: string;
  corBotaoChamar: string;
  corBotaoChamarHover: string;
  
  templateChamada: string;
  
  repetirChamada: boolean;
  numeroRepeticoes: number;
  intervaloRepeticoesSegundos: number;
  
  atualizadoEm?: string;
  atualizadoPor?: number;
}

export interface GeralConfig {
  id?: number;
  prefeituraId: number;
  
  nomeSecretaria?: string;
  enderecoCompleto?: string;
  telefoneContato?: string;
  emailContato?: string;
  siteUrl?: string;
  horarioFuncionamento?: string;
  
  relatoriosAtivos: string[];
  
  backupAtivo: boolean;
  backupPeriodicidade: 'diario' | 'semanal' | 'mensal';
  backupHorario: string;
  backupRetencaoDias: number;
  backupEmailNotificacao?: string;
  
  logAuditoriaAtivo: boolean;
  logAuditoriaRetencaoDias: number;
  
  atualizadoEm?: string;
  atualizadoPor?: number;
}

export interface UsuarioPermissoes {
  id?: number;
  usuarioId: number;
  prefeituraId: number;
  
  secretariaVisualizar: boolean;
  secretariaConfirmarAgendamento: boolean;
  secretariaAdicionarNotas: boolean;
  secretariaFiltrarDatas: boolean;
  secretariaExportar: boolean;
  
  atendimentoVisualizar: boolean;
  atendimentoChamar: boolean;
  atendimentoConcluir: boolean;
  atendimentoMarcarCinPronta: boolean;
  atendimentoMarcarCinEntregue: boolean;
  
  analyticsVisualizar: boolean;
  analyticsExportar: boolean;
  
  entregaCinVisualizar: boolean;
  entregaCinMarcarEntregue: boolean;
  
  adminGerenciarUsuarios: boolean;
  adminConfigurarSistema: boolean;
  adminBloquearDatas: boolean;
  adminGerenciarLocais: boolean;
  adminVisualizarLogs: boolean;
  
  locaisPermitidos?: number[] | null;
  
  criadoEm?: string;
  atualizadoEm?: string;
}

export interface CampoPersonalizado {
  id?: number;
  prefeituraId: number;
  nomeCampo: string;
  labelCampo: string;
  tipoCampo: 'text' | 'number' | 'email' | 'tel' | 'date' | 'select' | 'checkbox' | 'textarea';
  placeholder?: string;
  textoAjuda?: string;
  obrigatorio: boolean;
  ativo: boolean;
  opcoes?: string[];
  ordem: number;
  criadoEm?: string;
  atualizadoEm?: string;
}
