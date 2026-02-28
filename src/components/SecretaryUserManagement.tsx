import { useState } from 'react'
import { useConfirm } from '@/components/ConfirmDialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { UserPlus, Trash, PencilSimple, ShieldCheck, User } from '@phosphor-icons/react'
import { format, parseISO } from 'date-fns'
import type { SecretaryUser, SecretaryPermissions, Location } from '@/lib/types'
import { toast } from 'sonner'
import { isValidCPF } from '@utils/validators'

const CPF_LENGTH = 11
const PHONE_MIN_LENGTH = 10
const PHONE_MAX_LENGTH = 11
const CPF_CONFLICT_MESSAGE = 'CPF JÁ CADASTRADO'

type SidebarTabKey =
  | 'user'
  | 'secretary'
  | 'atendimento'
  | 'rg-delivery'
  | 'analytics'
  | 'import-export'
  | 'report-templates'
  | 'scheduled-reports'
  | 'execution-history'
  | 'audit-logs'
  | 'reminder-history'
  | 'notification-test'
  | 'locations'
  | 'blocked-dates'
  | 'admin'

const sidebarTabs: Array<{ key: SidebarTabKey; label: string }> = [
  { key: 'user', label: 'Página Pública' },
  { key: 'secretary', label: 'Secretaria' },
  { key: 'atendimento', label: 'Atendimento' },
  { key: 'rg-delivery', label: 'Entrega CIN' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'import-export', label: 'Importar/Exportar' },
  { key: 'report-templates', label: 'Templates' },
  { key: 'scheduled-reports', label: 'Agendamentos' },
  { key: 'execution-history', label: 'Histórico' },
  { key: 'audit-logs', label: 'Logs de Auditoria' },
  { key: 'reminder-history', label: 'Histórico de Lembretes' },
  { key: 'notification-test', label: 'Testar Notificações' },
  { key: 'locations', label: 'Localidades' },
  { key: 'blocked-dates', label: 'Bloqueio de Datas' },
  { key: 'admin', label: 'Administração' }
]

const normalizeDigits = (value: string, maxLength: number) => value.replace(/\D/g, '').slice(0, maxLength)

const formatCPF = (value: string) => {
  const digits = normalizeDigits(value, CPF_LENGTH)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

const formatPhone = (value: string) => {
  const digits = normalizeDigits(value, PHONE_MAX_LENGTH)
  if (digits.length === 0) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

const showUserErrorToast = (message: string) => {
  if (message?.toUpperCase() === CPF_CONFLICT_MESSAGE) {
    toast.error(message, {
      className: 'border border-red-300 bg-red-50 text-red-700 font-semibold'
    })
  } else {
    toast.error(message)
  }
}

interface SecretaryUserManagementProps {
  users: SecretaryUser[]
  locations: Location[]
  onAddUser: (userData: Omit<SecretaryUser, 'id' | 'createdAt'>) => Promise<void>
  onUpdateUser: (userId: string, updates: Partial<SecretaryUser>) => Promise<void>
  onDeleteUser: (userId: string) => Promise<void>
}

const defaultPermissions: SecretaryPermissions = {
  canConfirmAppointment: true,
  canCompleteAppointment: true,
  canReschedule: true,
  canCancel: true,
  canDeleteAppointment: false,
  canChangePriority: true,
  canAddNotes: true,
  canViewReports: true,
  canExportData: true,
  canBlockDates: false,
  canManageLocations: false,
  canChangeColors: false,
  canChangeSystemSettings: false,
  canManageCustomFields: false,
  canChangeWorkingHours: false,
  canManageUsers: false,
  canBulkDelete: false
}

export function SecretaryUserManagement({
  users,
  locations,
  onAddUser,
  onUpdateUser,
  onDeleteUser
}: SecretaryUserManagementProps) {
  const { confirm, ConfirmDialogNode } = useConfirm()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<SecretaryUser | null>(null)
  
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    fullName: '',
    email: '',
    cpf: '',
    phone: '',
    isAdmin: false,
    adminType: 'none' as 'system' | 'local' | 'none',
    allowedLocationId: ''
  })

  const [permissions, setPermissions] = useState<SecretaryPermissions>(defaultPermissions)
  const [hiddenTabs, setHiddenTabs] = useState<SidebarTabKey[]>([])
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false)
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false)
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)
  const isCpfValid = isValidCPF(formData.cpf)
  const requiresAssignedLocation = formData.adminType !== 'system'

  const toggleHiddenTab = (tab: SidebarTabKey, hidden: boolean) => {
    setHiddenTabs((prev) => {
      if (hidden) {
        if (prev.includes(tab)) return prev
        return [...prev, tab]
      }
      return prev.filter((current) => current !== tab)
    })
  }

  const handleAddUser = async () => {
    if (!formData.username.trim() || !formData.password.trim() || !formData.fullName.trim() || !formData.email.trim()) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }

    if (!isCpfValid) {
      toast.error('CPF Inválido. Verifique os números.')
      return
    }

    if (formData.phone.length < PHONE_MIN_LENGTH) {
      toast.error('Informe um telefone válido')
      return
    }

    if (requiresAssignedLocation && !formData.allowedLocationId) {
      toast.error('Selecione um local de atendimento para o usuário')
      return
    }

    const existingUser = users.find(u => u.username.toLowerCase() === formData.username.toLowerCase())
    if (existingUser) {
      toast.error('Nome de usuário já existe')
      return
    }

    setIsSubmittingAdd(true)
    try {
      await onAddUser({
        ...formData,
        isAdmin: formData.adminType !== 'none',
        adminType: formData.adminType,
        permissions: {
          ...(formData.adminType === 'system' ? {} : permissions),
          allowedLocationIds: formData.adminType === 'system' ? [] : [formData.allowedLocationId],
          canViewAllLocations: formData.adminType === 'system',
          hiddenTabs
        }
      })

      setFormData({
        username: '',
        password: '',
        fullName: '',
        email: '',
        cpf: '',
        phone: '',
        isAdmin: false,
        adminType: 'none',
        allowedLocationId: ''
      })
      setPermissions(defaultPermissions)
      setHiddenTabs([])
      setIsAddDialogOpen(false)
      toast.success('Usuário criado com sucesso!')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao criar usuário'
      showUserErrorToast(message)
    } finally {
      setIsSubmittingAdd(false)
    }
  }

  const handleEditUser = async () => {
    if (!editingUser) return

    if (!formData.fullName.trim() || !formData.email.trim()) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }

    if (!isCpfValid) {
      toast.error('CPF Inválido. Verifique os números.')
      return
    }

    if (formData.phone.length < PHONE_MIN_LENGTH) {
      toast.error('Informe um telefone válido')
      return
    }

    if (requiresAssignedLocation && !formData.allowedLocationId) {
      toast.error('Selecione um local de atendimento para o usuário')
      return
    }

    setIsSubmittingEdit(true)
    try {
      await onUpdateUser(editingUser.id, {
        fullName: formData.fullName,
        email: formData.email,
        cpf: formData.cpf,
        phone: formData.phone,
        isAdmin: formData.adminType !== 'none',
        adminType: formData.adminType,
        permissions: {
          ...(formData.adminType === 'system' ? {} : permissions),
          allowedLocationIds: formData.adminType === 'system' ? [] : [formData.allowedLocationId],
          canViewAllLocations: formData.adminType === 'system',
          hiddenTabs
        },
        ...(formData.password ? { password: formData.password } : {})
      })

      setEditingUser(null)
      setIsEditDialogOpen(false)
      toast.success('Usuário atualizado com sucesso!')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao atualizar usuário'
      showUserErrorToast(message)
    } finally {
      setIsSubmittingEdit(false)
    }
  }

  const openEditDialog = (user: SecretaryUser) => {
    setEditingUser(user)
    setFormData({
      username: user.username,
      password: '',
      fullName: user.fullName,
      email: user.email,
      cpf: user.cpf ? normalizeDigits(user.cpf, CPF_LENGTH) : '',
      phone: user.phone ? normalizeDigits(user.phone, PHONE_MAX_LENGTH) : '',
      isAdmin: user.isAdmin,
      adminType: user.adminType || (user.isAdmin ? 'system' : 'none'),
      allowedLocationId: user.permissions?.allowedLocationIds?.[0] || ''
    })
    setPermissions(user.permissions || defaultPermissions)
    setHiddenTabs(
      Array.isArray(user.permissions?.hiddenTabs)
        ? user.permissions.hiddenTabs.filter((tab): tab is SidebarTabKey => sidebarTabs.some((entry) => entry.key === tab))
        : []
    )
    setIsEditDialogOpen(true)
  }

  const handleDeleteUser = async (userId: string) => {
    const ok = await confirm({
      title: 'Excluir usuário',
      description: 'Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.',
      confirmLabel: 'Excluir',
      variant: 'danger',
    })
    if (!ok) return

    setDeletingUserId(userId)
    try {
      await onDeleteUser(userId)
      toast.success('Usuário excluído com sucesso!')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao excluir usuário'
      toast.error(message)
    } finally {
      setDeletingUserId(null)
    }
  }

  const permissionLabels: Partial<Record<keyof SecretaryPermissions, string>> = {
    canConfirmAppointment: 'Confirmar agendamentos',
    canCompleteAppointment: 'Concluir atendimentos (envia para fila de entrega)',
    canReschedule: 'Reagendar compromissos',
    canCancel: 'Cancelar compromissos',
    canDeleteAppointment: 'Excluir agendamentos permanentemente',
    canChangePriority: 'Alterar prioridade dos agendamentos',
    canAddNotes: 'Adicionar e remover notas dos agendamentos',
    canViewReports: 'Visualizar relatórios e estatísticas',
    canExportData: 'Exportar dados em diversos formatos',
    canBlockDates: 'Bloquear datas de atendimento',
    canManageLocations: 'Gerenciar localidades (sedes e distritos)',
    canChangeColors: 'Alterar cores do sistema',
    canChangeSystemSettings: 'Alterar configurações gerais do sistema',
    canManageCustomFields: 'Gerenciar campos personalizados',
    canChangeWorkingHours: 'Alterar horários de funcionamento',
    canManageUsers: 'Gerenciar usuários da secretaria',
    canBulkDelete: 'Excluir múltiplos agendamentos de uma vez',
    canViewAllLocations: 'Acesso a todos os locais'
  }

  return (
    <>
    {ConfirmDialogNode}
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <User size={24} weight="duotone" />
              Gerenciamento de Usuários da Secretaria
            </CardTitle>
            <CardDescription>
              Crie e gerencie usuários da secretaria com permissões específicas
            </CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <UserPlus size={18} weight="bold" />
                Adicionar Usuário
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Adicionar Novo Usuário</DialogTitle>
                <DialogDescription>
                  Crie um novo usuário da secretaria e defina suas permissões
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="add-username">Nome de Usuário *</Label>
                    <Input
                      id="add-username"
                      placeholder="usuario123"
                      value={formData.username}
                      onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="add-password">Senha *</Label>
                    <Input
                      id="add-password"
                      type="password"
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="add-fullName">Nome Completo *</Label>
                    <Input
                      id="add-fullName"
                      placeholder="João Silva"
                      value={formData.fullName}
                      onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="add-email">E-mail *</Label>
                    <Input
                      id="add-email"
                      type="email"
                      placeholder="joao@exemplo.com"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="add-cpf">CPF *</Label>
                    <Input
                      id="add-cpf"
                      placeholder="000.000.000-00"
                      value={formatCPF(formData.cpf)}
                      onChange={(e) => setFormData(prev => ({ ...prev, cpf: normalizeDigits(e.target.value, CPF_LENGTH) }))}
                      maxLength={14}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="add-phone">Telefone *</Label>
                    <Input
                      id="add-phone"
                      placeholder="(00) 00000-0000"
                      value={formatPhone(formData.phone)}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: normalizeDigits(e.target.value, PHONE_MAX_LENGTH) }))}
                      maxLength={15}
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="add-adminType">Tipo de Acesso *</Label>
                  <Select
                    value={formData.adminType}
                    onValueChange={(value: 'system' | 'local' | 'none') =>
                      setFormData(prev => ({
                        ...prev,
                        adminType: value,
                        isAdmin: value !== 'none',
                        allowedLocationId: value === 'system' ? '' : prev.allowedLocationId
                      }))
                    }
                  >
                    <SelectTrigger id="add-adminType">
                      <SelectValue placeholder="Selecione o tipo de acesso" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="system">Administrador Sistema</SelectItem>
                      <SelectItem value="local">Administrador Local</SelectItem>
                      <SelectItem value="none">Usuário Local</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {requiresAssignedLocation && (
                  <div className="space-y-2">
                    <Label htmlFor="add-location">Local de Atendimento *</Label>
                    <Select
                      value={formData.allowedLocationId}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, allowedLocationId: value }))}
                    >
                      <SelectTrigger id="add-location">
                        <SelectValue placeholder="Selecione o local" />
                      </SelectTrigger>
                      <SelectContent>
                        {locations.map((location) => (
                          <SelectItem key={location.id} value={String(location.id)}>
                            {location.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <ShieldCheck size={24} weight="duotone" className="text-primary" />
                    <div>
                      <Label htmlFor="add-isAdmin" className="text-base font-semibold cursor-pointer">
                        Administrador do Sistema
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Administradores têm acesso total a todas as funcionalidades
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="add-isAdmin"
                    checked={formData.adminType !== 'none'}
                    onCheckedChange={(checked) =>
                      setFormData(prev => ({
                        ...prev,
                        isAdmin: checked,
                        adminType: checked ? 'local' : 'none'
                      }))
                    }
                  />
                </div>

                {formData.adminType !== 'system' && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <h4 className="font-semibold text-sm">Permissões do Usuário</h4>
                      
                      <div className="space-y-3">
                        <h5 className="text-sm font-medium text-muted-foreground">Gerenciamento de Agendamentos</h5>
                        <div className="space-y-2">
                          {['canConfirmAppointment', 'canCompleteAppointment', 'canReschedule', 'canCancel', 'canDeleteAppointment'].map((key) => (
                            <div key={key} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                              <Label htmlFor={`perm-${key}`} className="cursor-pointer text-sm">
                                {permissionLabels[key as keyof SecretaryPermissions]}
                              </Label>
                              <Switch
                                id={`perm-${key}`}
                                checked={permissions[key as keyof SecretaryPermissions] || false}
                                onCheckedChange={(checked) => 
                                  setPermissions(prev => ({ ...prev, [key]: checked }))
                                }
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <Separator className="my-3" />

                      <div className="space-y-3">
                        <h5 className="text-sm font-medium text-muted-foreground">Recursos Básicos</h5>
                        <div className="space-y-2">
                          {['canChangePriority', 'canAddNotes', 'canViewReports', 'canExportData'].map((key) => (
                            <div key={key} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                              <Label htmlFor={`perm-${key}`} className="cursor-pointer text-sm">
                                {permissionLabels[key as keyof SecretaryPermissions]}
                              </Label>
                              <Switch
                                id={`perm-${key}`}
                                checked={permissions[key as keyof SecretaryPermissions] || false}
                                onCheckedChange={(checked) => 
                                  setPermissions(prev => ({ ...prev, [key]: checked }))
                                }
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <Separator className="my-3" />

                      <div className="space-y-3">
                        <h5 className="text-sm font-medium text-muted-foreground">Administração Avançada</h5>
                        <div className="space-y-2">
                          {['canBlockDates', 'canManageLocations', 'canChangeColors', 'canChangeSystemSettings', 'canManageCustomFields', 'canChangeWorkingHours', 'canManageUsers', 'canBulkDelete'].map((key) => (
                            <div key={key} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                              <Label htmlFor={`perm-${key}`} className="cursor-pointer text-sm">
                                {permissionLabels[key as keyof SecretaryPermissions]}
                              </Label>
                              <Switch
                                id={`perm-${key}`}
                                checked={permissions[key as keyof SecretaryPermissions] || false}
                                onCheckedChange={(checked) => 
                                  setPermissions(prev => ({ ...prev, [key]: checked }))
                                }
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <Separator />
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm">Ocultar abas (Sidebar)</h4>
                  <p className="text-xs text-muted-foreground">
                    Ative para esconder a aba desse usuário.
                  </p>
                  <div className="space-y-2">
                    {sidebarTabs.map((tab) => (
                      <div key={tab.key} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                        <Label htmlFor={`hide-tab-${tab.key}`} className="cursor-pointer text-sm">
                          {tab.label}
                        </Label>
                        <Switch
                          id={`hide-tab-${tab.key}`}
                          checked={hiddenTabs.includes(tab.key)}
                          onCheckedChange={(checked) => toggleHiddenTab(tab.key, checked)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAddDialogOpen(false)
                    setFormData({
                      username: '',
                      password: '',
                      fullName: '',
                      email: '',
                      cpf: '',
                      phone: '',
                      isAdmin: false,
                      adminType: 'none',
                      allowedLocationId: ''
                    })
                    setPermissions(defaultPermissions)
                    setHiddenTabs([])
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleAddUser}
                  disabled={
                    isSubmittingAdd ||
                    !isCpfValid ||
                    formData.phone.length < PHONE_MIN_LENGTH ||
                    (requiresAssignedLocation && !formData.allowedLocationId)
                  }
                >
                  {isSubmittingAdd ? 'Salvando...' : 'Criar Usuário'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>

      <CardContent>
        {users.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <User size={48} className="mx-auto mb-3 opacity-50" />
            <p>Nenhum usuário cadastrado</p>
            <p className="text-sm mt-1">Adicione usuários da secretaria para gerenciar o sistema</p>
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      {user.isAdmin ? (
                        <ShieldCheck size={20} weight="fill" className="text-primary" />
                      ) : (
                        <User size={20} weight="duotone" className="text-muted-foreground" />
                      )}
                      <span className="font-semibold">{user.fullName}</span>
                    </div>
                    {user.isAdmin && (
                      <Badge variant="default">Administrador</Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>Usuário: <span className="font-mono">{user.username}</span></p>
                    <p>E-mail: {user.email}</p>
                    <p className="text-xs">Criado em {format(parseISO(user.createdAt), "dd/MM/yyyy 'às' HH:mm")}</p>
                  </div>
                  {!user.isAdmin && user.permissions && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(Object.keys(user.permissions) as Array<keyof SecretaryPermissions>).map((key) => (
                        typeof user.permissions![key] === 'boolean' && user.permissions![key] && permissionLabels[key] && (
                          <Badge key={key} variant="secondary" className="text-xs">
                            {permissionLabels[key]}
                          </Badge>
                        )
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditDialog(user)}
                  >
                    <PencilSimple size={18} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteUser(user.id)}
                    disabled={deletingUserId === user.id}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash size={18} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>
              Atualize as informações e permissões do usuário
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome de Usuário</Label>
                <Input
                  value={formData.username}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">O nome de usuário não pode ser alterado</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-email">E-mail *</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-cpf">CPF *</Label>
                <Input
                  id="edit-cpf"
                  placeholder="000.000.000-00"
                  value={formatCPF(formData.cpf)}
                  onChange={(e) => setFormData(prev => ({ ...prev, cpf: normalizeDigits(e.target.value, CPF_LENGTH) }))}
                  maxLength={14}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-phone">Telefone *</Label>
                <Input
                  id="edit-phone"
                  placeholder="(00) 00000-0000"
                  value={formatPhone(formData.phone)}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: normalizeDigits(e.target.value, PHONE_MAX_LENGTH) }))}
                  maxLength={15}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-fullName">Nome Completo *</Label>
              <Input
                id="edit-fullName"
                value={formData.fullName}
                onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="edit-adminType">Tipo de Acesso *</Label>
              <Select
                value={formData.adminType}
                onValueChange={(value: 'system' | 'local' | 'none') =>
                  setFormData(prev => ({
                    ...prev,
                    adminType: value,
                    isAdmin: value !== 'none',
                    allowedLocationId: value === 'system' ? '' : prev.allowedLocationId
                  }))
                }
              >
                <SelectTrigger id="edit-adminType">
                  <SelectValue placeholder="Selecione o tipo de acesso" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">Administrador Sistema</SelectItem>
                  <SelectItem value="local">Administrador Local</SelectItem>
                  <SelectItem value="none">Usuário Local</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {requiresAssignedLocation && (
              <div className="space-y-2">
                <Label htmlFor="edit-location">Local de Atendimento *</Label>
                <Select
                  value={formData.allowedLocationId}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, allowedLocationId: value }))}
                >
                  <SelectTrigger id="edit-location">
                    <SelectValue placeholder="Selecione o local" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={String(location.id)}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-3">
                <ShieldCheck size={24} weight="duotone" className="text-primary" />
                <div>
                  <Label htmlFor="edit-isAdmin" className="text-base font-semibold cursor-pointer">
                    Administrador do Sistema
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Administradores têm acesso total a todas as funcionalidades
                  </p>
                </div>
              </div>
              <Switch
                id="edit-isAdmin"
                checked={formData.adminType !== 'none'}
                onCheckedChange={(checked) =>
                  setFormData(prev => ({
                    ...prev,
                    isAdmin: checked,
                    adminType: checked ? 'local' : 'none'
                  }))
                }
              />
            </div>

            {formData.adminType !== 'system' && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h4 className="font-semibold text-sm">Permissões do Usuário</h4>
                  
                  <div className="space-y-3">
                    <h5 className="text-sm font-medium text-muted-foreground">Gerenciamento de Agendamentos</h5>
                    <div className="space-y-2">
                      {['canConfirmAppointment', 'canCompleteAppointment', 'canReschedule', 'canCancel', 'canDeleteAppointment'].map((key) => (
                        <div key={key} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                          <Label htmlFor={`edit-perm-${key}`} className="cursor-pointer text-sm">
                            {permissionLabels[key as keyof SecretaryPermissions]}
                          </Label>
                          <Switch
                            id={`edit-perm-${key}`}
                            checked={permissions[key as keyof SecretaryPermissions] || false}
                            onCheckedChange={(checked) => 
                              setPermissions(prev => ({ ...prev, [key]: checked }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator className="my-3" />

                  <div className="space-y-3">
                    <h5 className="text-sm font-medium text-muted-foreground">Recursos Básicos</h5>
                    <div className="space-y-2">
                      {['canChangePriority', 'canAddNotes', 'canViewReports', 'canExportData'].map((key) => (
                        <div key={key} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                          <Label htmlFor={`edit-perm-${key}`} className="cursor-pointer text-sm">
                            {permissionLabels[key as keyof SecretaryPermissions]}
                          </Label>
                          <Switch
                            id={`edit-perm-${key}`}
                            checked={permissions[key as keyof SecretaryPermissions] || false}
                            onCheckedChange={(checked) => 
                              setPermissions(prev => ({ ...prev, [key]: checked }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator className="my-3" />

                  <div className="space-y-3">
                    <h5 className="text-sm font-medium text-muted-foreground">Administração Avançada</h5>
                    <div className="space-y-2">
                      {['canBlockDates', 'canManageLocations', 'canChangeColors', 'canChangeSystemSettings', 'canManageCustomFields', 'canChangeWorkingHours', 'canManageUsers', 'canBulkDelete'].map((key) => (
                        <div key={key} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                          <Label htmlFor={`edit-perm-${key}`} className="cursor-pointer text-sm">
                            {permissionLabels[key as keyof SecretaryPermissions]}
                          </Label>
                          <Switch
                            id={`edit-perm-${key}`}
                            checked={permissions[key as keyof SecretaryPermissions] || false}
                            onCheckedChange={(checked) => 
                              setPermissions(prev => ({ ...prev, [key]: checked }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            <Separator />
            <div className="space-y-4">
              <h4 className="font-semibold text-sm">Ocultar abas (Sidebar)</h4>
              <p className="text-xs text-muted-foreground">
                Ative para esconder a aba desse usuário.
              </p>
              <div className="space-y-2">
                {sidebarTabs.map((tab) => (
                  <div key={tab.key} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                    <Label htmlFor={`edit-hide-tab-${tab.key}`} className="cursor-pointer text-sm">
                      {tab.label}
                    </Label>
                    <Switch
                      id={`edit-hide-tab-${tab.key}`}
                      checked={hiddenTabs.includes(tab.key)}
                      onCheckedChange={(checked) => toggleHiddenTab(tab.key, checked)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsEditDialogOpen(false)
                setEditingUser(null)
              }}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleEditUser}
              disabled={
                isSubmittingEdit ||
                !isCpfValid ||
                formData.phone.length < PHONE_MIN_LENGTH ||
                (requiresAssignedLocation && !formData.allowedLocationId)
              }
            >
              {isSubmittingEdit ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
    </>
  )
}
