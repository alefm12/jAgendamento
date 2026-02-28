export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'awaiting-issuance'
  | 'cin-ready'
  | 'cin-delivered'
export type AppointmentPriority = 'normal' | 'high' | 'urgent'

export interface AppointmentNote {
  id: string
  text: string
  author: string
  timestamp: string
  contextLabel?: string
}

export interface RGDelivery {
  id: string
  deliveredAt: string
  deliveredBy: string
  receivedByName: string
  receivedByDocument: string
  notes?: string
  deliveryConfirmedBy?: string
  deliveryConfirmedAt?: string
}

export interface LGPDConsent {
  id: string
  userId: string
  userCPF: string
  consentDate: string
  consentVersion: string
  dataUsageAccepted: boolean
  notificationAccepted: boolean
  ipAddress?: string
  country?: string
  region?: string
  city?: string
  latitude?: number
  longitude?: number
  userAgent?: string
}

export interface DataRetentionLog {
  id: string
  action: 'access' | 'export' | 'delete' | 'anonymize'
  targetType: 'appointment' | 'user' | 'secretary'
  targetId: string
  performedBy: string
  performedAt: string
  reason?: string
  ipAddress?: string
}

export interface StatusChangeHistory {
  id: string
  from: AppointmentStatus | null
  to: AppointmentStatus
  changedBy: string
  changedAt: string
  reason?: string
  metadata?: {
    oldDate?: string
    oldTime?: string
    newDate?: string
    newTime?: string
    cancellationCategory?: 'user-request' | 'no-show' | 'other'
    cancellationReasonText?: string
  }
}

export interface Location {
  id: string
  name: string
  address: string
  city?: string
  type?: string
  googleMapsUrl?: string
  isActive?: boolean
  createdAt: string
}

export interface OriginLocality {
  id: string
  name: string
  createdAt: string
  neighborhoodCount?: number
}

export interface Neighborhood {
  id: string
  localityId: string
  name: string
  createdAt: string
}

export interface Appointment {
  id: string
  protocol: string
  fullName: string
  cpf: string
  rg?: string
  phone: string
  email: string
  gender?: string
  locationId: string
  locationName?: string | null
  street?: string
  number?: string
  neighborhood?: string
  regionType?: string
  regionName?: string
  districtId?: string
  sedeId?: string
  neighborhoodId?: string
  date: string
  time: string
  status: AppointmentStatus
  createdAt: string
  notes?: AppointmentNote[]
  reminderSent?: boolean
  reminderSentOffsets?: number[]
  lastModified?: string
  priority?: AppointmentPriority
  cancelledBy?: 'user' | 'secretary'
  cancellationReason?: string
  statusHistory?: StatusChangeHistory[]
  customFieldValues?: Record<string, any>
  rgDelivery?: RGDelivery
  completedAt?: string
  completedBy?: string
  lgpdConsent?: LGPDConsent
  rgReadyNotificationSent?: boolean
  rgReadyNotificationSentAt?: string
  rgReadyRemindersSent?: number
  rgType?: '1ª via' | '2ª via'
}

export type ReportFilterType = 
  | 'status' 
  | 'period' 
  | 'location' 
  | 'neighborhood' 
  | 'priority' 
  | 'rgType' 
  | 'dateRange'

export interface ReportFilter {
  type: ReportFilterType
  value: any
  label: string
}

export interface ReportColumn {
  id: string
  label: string
  field: keyof Appointment | 'locationName' | 'statusLabel' | 'priorityLabel' | 'rgTypeLabel'
  enabled: boolean
  width?: number
}

export interface ReportTemplate {
  id: string
  name: string
  description?: string
  createdBy: string
  createdAt: string
  lastModified?: string
  filters: ReportFilter[]
  columns: ReportColumn[]
  sortBy?: {
    field: string
    order: 'asc' | 'desc'
  }
  groupBy?: 'location' | 'neighborhood' | 'status' | 'rgType' | 'date' | 'none'
  includeCharts?: boolean
  chartTypes?: ('pie' | 'bar' | 'line' | 'donut')[]
  exportFormat?: 'pdf' | 'excel' | 'csv' | 'json'
  isPublic?: boolean
  tags?: string[]
}

export interface TimeSlot {
  time: string
  available: boolean
  count: number
}

export interface AppointmentStats {
  total: number
  pending: number
  confirmed: number
  completed: number
  cancelled: number
  today: number
  thisWeek: number
  thisMonth: number
}

export interface SecretaryPermissions {
  canConfirmAppointment?: boolean
  canCompleteAppointment?: boolean
  canReschedule?: boolean
  canCancel?: boolean
  canDeleteAppointment?: boolean
  canChangePriority?: boolean
  canAddNotes?: boolean
  canViewReports?: boolean
  canExportData?: boolean
  canBlockDates?: boolean
  canManageLocations?: boolean
  canChangeColors?: boolean
  canChangeSystemSettings?: boolean
  canManageCustomFields?: boolean
  canChangeWorkingHours?: boolean
  canManageUsers?: boolean
  canBulkDelete?: boolean
  allowedLocationIds?: string[]
  canViewAllLocations?: boolean
  hiddenTabs?: string[]
}

export interface SecretaryUser {
  id: string
  username: string
  password?: string
  fullName: string
  email: string
  cpf?: string
  phone?: string
  createdAt: string
  isAdmin: boolean
  adminType?: 'system' | 'local' | 'none'
  permissions?: SecretaryPermissions
  isActive?: boolean
}

export type FieldType = 'text' | 'email' | 'phone' | 'cpf' | 'number' | 'textarea' | 'select' | 'date'

export interface CustomField {
  id: string
  name: string
  label: string
  type: FieldType
  required: boolean
  placeholder?: string
  options?: string[]
  order: number
  validationPattern?: string
  helpText?: string
  defaultValue?: string
  enabled: boolean
}

export interface BlockedDate {
  id: string
  date: string
  reason: string
  createdBy: string
  createdAt: string
  blockType?: 'full-day' | 'specific-times'
  blockedTimes?: string[]
  locationId?: string | null
}

export type ReportType = 'appointments' | 'by-location' | 'by-neighborhood' | 'by-status' | 'by-period' | 'audit-log'

export interface SecretaryConfig {
  dashboardColor?: string
  accentColor?: string
  enabledReports?: ReportType[]
  allowDateBlocking?: boolean
  allowReschedule?: boolean
  allowCancel?: boolean
  allowPriorityChange?: boolean
}

export interface SystemConfig {
  systemName: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
  defaultTheme?: 'light' | 'dark'
  logo?: string
  logoSize?: number
  titleSize?: number
  subtitleSize?: number
  buttonSize?: number
  borderRadiusPreview?: number
  titleFont?: string
  bodyFont?: string
  contactInfo?: {
    responsibleName?: string
    responsibleRole?: string
    phone?: string
    email?: string
    address?: string
    cnpj?: string
    secretariaName?: string
  }
  reminderMessage?: string
  workingHours?: string[]
  maxAppointmentsPerSlot?: number
  bookingWindowDays?: number
  customFields?: CustomField[]
  emailSettings?: {
    enabled?: boolean
    senderName?: string
    replyTo?: string
  }
  smsSettings?: {
    enabled?: boolean
  }
  whatsappSettings?: {
    enabled?: boolean
    businessNumber?: string
    apiKey?: string
  }
  appointmentSettings?: {
    allowUserCancellation?: boolean
    cancellationDeadlineHours?: number
    reminderHoursBefore?: number
    autoConfirm?: boolean
  }
  reminderSettings?: {
    enabled?: boolean
    hoursBeforeAppointment?: number
    reminderDays?: number[]
    customMessage?: string
  }
  notificationTemplates?: {
    agendamento?: { emailAtivo?: boolean; whatsappAtivo?: boolean; emailAssunto?: string; emailCorpo?: string }
    reagendamento?: { emailAtivo?: boolean; whatsappAtivo?: boolean; emailAssunto?: string; emailCorpo?: string }
    lembrete?: { emailAtivo?: boolean; whatsappAtivo?: boolean; lembreteAntecedenciaDias?: number; lembreteAntecedenciaDiasList?: number[]; emailAssunto?: string; emailCorpo?: string }
    cancelamento?: { emailAtivo?: boolean; whatsappAtivo?: boolean; emailAssunto?: string; emailCorpo?: string }
    concluido?: { emailAtivo?: boolean; whatsappAtivo?: boolean; emailAssunto?: string; emailCorpo?: string }
    cin_pronta?: { emailAtivo?: boolean; whatsappAtivo?: boolean; emailAssunto?: string; emailCorpo?: string }
    cin_entregue?: { emailAtivo?: boolean; whatsappAtivo?: boolean; emailAssunto?: string; emailCorpo?: string }
  }
  secretaryConfig?: SecretaryConfig
  lgpdSettings?: {
    enabled?: boolean
    consentVersion?: string
    dataRetentionDays?: number
    privacyPolicyUrl?: string
    dataProtectionOfficer?: {
      name?: string
      email?: string
      phone?: string
    }
  }
  rgDeliverySettings?: {
    reminderAfterDays?: number
    autoReminderEnabled?: boolean
  }
}

export interface Tenant {
  id: string
  name: string
  slug: string
  cityName: string
  createdAt: string
  createdBy: string
  isActive: boolean
  config?: SystemConfig
}

export interface SuperAdmin {
  id: string
  fullName: string
  email: string
  createdAt?: string
  token?: string
  tenantId?: number
  role?: string
  permissions?: string[]
}

export type ScheduledReportFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'
export type ScheduledReportFormat = 'pdf' | 'excel' | 'csv' | 'json'
export type ScheduledReportDeliveryMethod = 'email' | 'download' | 'both'

export interface ScheduledReportRecipient {
  name: string
  email: string
  role?: string
}

export interface AttachedReportConfig {
  id: string
  templateId?: string
  name: string
  filters: ReportFilter[]
  columns: ReportColumn[]
  sortBy?: {
    field: string
    order: 'asc' | 'desc'
  }
  groupBy?: 'location' | 'neighborhood' | 'status' | 'rgType' | 'date' | 'none'
  includeCharts?: boolean
  chartTypes?: ('pie' | 'bar' | 'line' | 'donut')[]
  format: ScheduledReportFormat
}

export interface ScheduledReport {
  id: string
  name: string
  description?: string
  templateId?: string
  createdBy: string
  createdAt: string
  lastModified?: string
  isActive: boolean
  
  frequency: ScheduledReportFrequency
  startDate: string
  endDate?: string
  
  timeOfDay: string
  dayOfWeek?: number
  dayOfMonth?: number
  
  filters: ReportFilter[]
  columns: ReportColumn[]
  sortBy?: {
    field: string
    order: 'asc' | 'desc'
  }
  groupBy?: 'location' | 'neighborhood' | 'status' | 'rgType' | 'date' | 'none'
  includeCharts?: boolean
  chartTypes?: ('pie' | 'bar' | 'line' | 'donut')[]
  
  format: ScheduledReportFormat
  deliveryMethod: ScheduledReportDeliveryMethod
  recipients: ScheduledReportRecipient[]
  
  emailSubject?: string
  emailBody?: string
  
  attachedReports?: AttachedReportConfig[]
  combineIntoSingleFile?: boolean
  
  lastExecuted?: string
  nextExecution?: string
  executionCount?: number
  
  tags?: string[]
}

export type ReportExecutionStatus = 'success' | 'failed' | 'partial' | 'cancelled'
export type ReportExecutionTrigger = 'manual' | 'scheduled' | 'api' | 'template'
export type ReportExecutionSource = 'agendamento' | 'template' | 'analytics' | 'importacao_exportacao' | 'sistema'

export interface ReportExecutionLog {
  id: string
  reportId?: string
  reportName: string
  reportType: 'scheduled' | 'template' | 'custom' | 'export'
  source?: ReportExecutionSource
  
  executedBy: string
  executedAt: string
  executionDuration: number
  
  status: ReportExecutionStatus
  trigger: ReportExecutionTrigger
  
  filters?: ReportFilter[]
  totalRecords: number
  recordsProcessed: number
  
  format: ScheduledReportFormat
  fileSize?: number
  filePath?: string
  
  deliveryMethod?: ScheduledReportDeliveryMethod
  recipients?: ScheduledReportRecipient[]
  emailsSent?: number
  emailsFailed?: number
  
  error?: string
  errorDetails?: string
  warnings?: string[]
  
  parameters?: Record<string, any>
  metadata?: Record<string, any>
  
  userAgent?: string
  ipAddress?: string
}

export type AuditActionType = 
  | 'appointment_created'
  | 'appointment_updated'
  | 'appointment_deleted'
  | 'appointment_status_changed'
  | 'appointment_rescheduled'
  | 'appointment_cancelled'
  | 'appointment_note_added'
  | 'appointment_note_deleted'
  | 'appointment_priority_changed'
  | 'appointment_bulk_deleted'
  | 'appointment_personal_info_updated'
  | 'location_created'
  | 'location_updated'
  | 'location_deleted'
  | 'user_created'
  | 'user_updated'
  | 'user_deleted'
  | 'user_login'
  | 'user_logout'
  | 'blocked_date_created'
  | 'blocked_date_deleted'
  | 'config_updated'
  | 'data_exported'
  | 'data_imported'
  | 'report_generated'
  | 'report_template_created'
  | 'report_template_updated'
  | 'report_template_deleted'
  | 'scheduled_report_created'
  | 'scheduled_report_updated'
  | 'scheduled_report_deleted'
  | 'rg_marked_as_delivered'
  | 'rg_notification_sent'
  | 'reminder_sent'
  | 'system_settings_changed'

export type AuditSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface AuditLog {
  id: string
  action: AuditActionType
  actionLabel: string
  description: string
  
  performedBy: string
  performedByRole: 'user' | 'secretary' | 'admin' | 'system'
  performedAt: string
  
  targetType: 'appointment' | 'location' | 'user' | 'blocked_date' | 'config' | 'report' | 'system' | 'data'
  targetId?: string
  targetName?: string
  
  severity: AuditSeverity
  
  oldValue?: any
  newValue?: any
  changes?: Record<string, { from: any; to: any }>
  
  ipAddress?: string
  userAgent?: string
  sessionId?: string
  requestId?: string
  status?: 'success' | 'failed' | 'error'
  errorMessage?: string
  
  metadata?: Record<string, any>
  tags?: string[]
  
  isReversible?: boolean
  reversedAt?: string
  reversedBy?: string
}
