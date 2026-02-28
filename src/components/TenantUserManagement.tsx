import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Plus, User, Trash, Key, Shield, ArrowLeft, Buildings } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import type { SecretaryUser, Tenant } from '@/lib/types'
import { isValidCPF } from '@utils/validators'

const CPF_LENGTH = 11
const PHONE_MIN_LENGTH = 10
const PHONE_MAX_LENGTH = 11
const CPF_CONFLICT_MESSAGE = 'CPF JÁ CADASTRADO'

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

interface TenantUserManagementProps {
  tenant: Tenant
  users: SecretaryUser[]
  onAddUser: (userData: Omit<SecretaryUser, 'id' | 'createdAt'>) => Promise<void>
  onUpdateUser: (userId: string, updates: Partial<SecretaryUser>) => Promise<void>
  onDeleteUser: (userId: string) => Promise<void>
  onBack: () => void
}

export function TenantUserManagement({
  tenant,
  users,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  onBack
}: TenantUserManagementProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<SecretaryUser | null>(null)
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    password: '',
    email: '',
     cpf: '',
     phone: '',
    isAdmin: false,
    canManageLocations: false,
    canBlockDates: false,
    canExportData: false,
    canManageUsers: false,
    canChangeColors: false
  })

  const handleFormChange = (field: string, value: string | boolean) => {
    if (field === 'cpf' && typeof value === 'string') {
      setFormData(prev => ({ ...prev, cpf: normalizeDigits(value, CPF_LENGTH) }))
      return
    }
    if (field === 'phone' && typeof value === 'string') {
      setFormData(prev => ({ ...prev, phone: normalizeDigits(value, PHONE_MAX_LENGTH) }))
      return
    }
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUpdatingUser, setIsUpdatingUser] = useState(false)
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)

  const isCpfValid = isValidCPF(formData.cpf)
  const isPhoneValid = formData.phone.length >= PHONE_MIN_LENGTH

  const handleSubmit = async () => {
    if (!formData.fullName || !formData.username || (!editingUser && !formData.password) || !isPhoneValid) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }

    if (!isCpfValid) {
      toast.error('CPF Inválido. Verifique os números.')
      return
    }

    if (!editingUser) {
      const existingUser = users.find(u => u.username === formData.username)
      if (existingUser) {
        toast.error('Já existe um usuário com este nome de usuário')
        return
      }
      setIsSubmitting(true)
      try {
        await onAddUser({
          fullName: formData.fullName,
          username: formData.username,
          password: formData.password,
          email: formData.email,
          cpf: formData.cpf,
          phone: formData.phone,
          isAdmin: formData.isAdmin,
          permissions: {
            canManageLocations: formData.isAdmin ? true : formData.canManageLocations,
            canBlockDates: formData.isAdmin ? true : formData.canBlockDates,
            canExportData: formData.isAdmin ? true : formData.canExportData,
            canManageUsers: formData.isAdmin ? true : formData.canManageUsers,
            canChangeColors: formData.isAdmin ? true : formData.canChangeColors
          }
        })
        toast.success('Usuário cadastrado com sucesso!')
        setIsDialogOpen(false)
        setEditingUser(null)
        resetForm()
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao cadastrar usuário'
        showUserErrorToast(message)
      } finally {
        setIsSubmitting(false)
      }
    } else {
      setIsUpdatingUser(true)
      try {
        const updates: Partial<SecretaryUser> = {
          fullName: formData.fullName,
          email: formData.email,
          cpf: formData.cpf,
          phone: formData.phone,
          isAdmin: formData.isAdmin,
          permissions: {
            canManageLocations: formData.isAdmin ? true : formData.canManageLocations,
            canBlockDates: formData.isAdmin ? true : formData.canBlockDates,
            canExportData: formData.isAdmin ? true : formData.canExportData,
            canManageUsers: formData.isAdmin ? true : formData.canManageUsers,
            canChangeColors: formData.isAdmin ? true : formData.canChangeColors
          }
        }

        if (formData.password) {
          updates.password = formData.password
        }

        await onUpdateUser(editingUser.id, updates)
        toast.success('Usuário atualizado com sucesso!')
        setIsDialogOpen(false)
        setEditingUser(null)
        resetForm()
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Falha ao atualizar usuário'
        showUserErrorToast(message)
      } finally {
        setIsUpdatingUser(false)
      }
    }
  }

  const resetForm = () => {
    setFormData({
      fullName: '',
      username: '',
      password: '',
      email: '',
      cpf: '',
      phone: '',
      isAdmin: false,
      canManageLocations: false,
      canBlockDates: false,
      canExportData: false,
      canManageUsers: false,
      canChangeColors: false
    })
  }

  const handleEdit = (user: SecretaryUser) => {
    setEditingUser(user)
    setFormData({
      fullName: user.fullName,
      username: user.username,
      password: '',
      email: user.email || '',
       cpf: user.cpf ? normalizeDigits(user.cpf, CPF_LENGTH) : '',
       phone: user.phone ? normalizeDigits(user.phone, PHONE_MAX_LENGTH) : '',
      isAdmin: user.isAdmin || false,
      canManageLocations: user.permissions?.canManageLocations || false,
      canBlockDates: user.permissions?.canBlockDates || false,
      canExportData: user.permissions?.canExportData || false,
      canManageUsers: user.permissions?.canManageUsers || false,
      canChangeColors: user.permissions?.canChangeColors || false
    })
    setIsDialogOpen(true)
  }

  const handleDialogClose = (open: boolean) => {
    setIsDialogOpen(open)
    if (!open) {
      setEditingUser(null)
      resetForm()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="border-b bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
              >
                <ArrowLeft size={20} />
              </Button>
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <User size={24} weight="duotone" className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Gerenciar Usuários</h1>
                <p className="text-sm text-gray-600 flex items-center gap-2">
                  <Buildings size={16} />
                  {tenant.name}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Usuários Cadastrados</h2>
            <p className="text-gray-600 mt-1">
              {users.length} {users.length === 1 ? 'usuário cadastrado' : 'usuários cadastrados'}
            </p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2 shadow-lg">
                <Plus size={20} weight="bold" />
                Novo Usuário
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl">
                  {editingUser ? 'Editar Usuário' : 'Cadastrar Novo Usuário'}
                </DialogTitle>
                <DialogDescription>
                  {editingUser 
                    ? 'Atualize as informações e permissões do usuário' 
                    : 'Crie um novo usuário da secretaria ou administrador'
                  }
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 py-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome Completo *</Label>
                  <Input
                    id="fullName"
                    placeholder="Ex: Maria Silva"
                    value={formData.fullName}
                    onChange={(e) => handleFormChange('fullName', e.target.value)}
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username">Nome de Usuário *</Label>
                  <Input
                    id="username"
                    placeholder="Ex: maria.silva"
                    value={formData.username}
                    onChange={(e) => handleFormChange('username', e.target.value)}
                    disabled={!!editingUser}
                    className="h-11 disabled:opacity-50"
                  />
                  {editingUser && (
                    <p className="text-xs text-muted-foreground">
                      O nome de usuário não pode ser alterado
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">
                    Senha {editingUser ? '(deixe em branco para não alterar)' : '*'}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder={editingUser ? "Digite para alterar a senha" : "Digite a senha"}
                    value={formData.password}
                    onChange={(e) => handleFormChange('password', e.target.value)}
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Ex: maria.silva@prefeitura.gov.br"
                    value={formData.email}
                    onChange={(e) => handleFormChange('email', e.target.value)}
                    className="h-11"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cpf">CPF *</Label>
                    <Input
                      id="cpf"
                      placeholder="000.000.000-00"
                      value={formatCPF(formData.cpf)}
                      onChange={(e) => handleFormChange('cpf', e.target.value)}
                      className="h-11"
                      maxLength={14}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone *</Label>
                    <Input
                      id="phone"
                      placeholder="(00) 00000-0000"
                      value={formatPhone(formData.phone)}
                      onChange={(e) => handleFormChange('phone', e.target.value)}
                      className="h-11"
                      maxLength={15}
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base flex items-center gap-2">
                        <Shield size={18} weight="duotone" />
                        Administrador
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Acesso total ao sistema (ativa todas as permissões)
                      </p>
                    </div>
                    <Switch
                      checked={formData.isAdmin}
                      onCheckedChange={(checked) => handleFormChange('isAdmin', checked)}
                    />
                  </div>

                  {!formData.isAdmin && (
                    <>
                      <Separator />
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-muted-foreground">Permissões Específicas</p>
                        
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label>Gerenciar Localidades</Label>
                            <p className="text-xs text-muted-foreground">
                              Cadastrar e editar locais de atendimento
                            </p>
                          </div>
                          <Switch
                            checked={formData.canManageLocations}
                            onCheckedChange={(checked) => handleFormChange('canManageLocations', checked)}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label>Bloquear Datas</Label>
                            <p className="text-xs text-muted-foreground">
                              Bloquear dias de atendimento (feriados, etc)
                            </p>
                          </div>
                          <Switch
                            checked={formData.canBlockDates}
                            onCheckedChange={(checked) => handleFormChange('canBlockDates', checked)}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label>Exportar Dados</Label>
                            <p className="text-xs text-muted-foreground">
                              Gerar e baixar relatórios do sistema
                            </p>
                          </div>
                          <Switch
                            checked={formData.canExportData}
                            onCheckedChange={(checked) => handleFormChange('canExportData', checked)}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label>Gerenciar Usuários</Label>
                            <p className="text-xs text-muted-foreground">
                              Criar e editar outros usuários da secretaria
                            </p>
                          </div>
                          <Switch
                            checked={formData.canManageUsers}
                            onCheckedChange={(checked) => handleFormChange('canManageUsers', checked)}
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <Label>Alterar Cores e Tema</Label>
                            <p className="text-xs text-muted-foreground">
                              Modificar aparência visual do sistema
                            </p>
                          </div>
                          <Switch
                            checked={formData.canChangeColors}
                            onCheckedChange={(checked) => handleFormChange('canChangeColors', checked)}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => handleDialogClose(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSubmit}
                  className="flex-1"
                  disabled={!formData.fullName || !formData.username || (!editingUser && !formData.password) || !isCpfValid || !isPhoneValid}
                >
                  {editingUser ? 'Atualizar' : 'Criar Usuário'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {users.length === 0 ? (
          <Card className="border-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4">
                <User size={40} weight="duotone" className="text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Nenhum usuário cadastrado</h3>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                Comece criando o primeiro usuário para acessar o sistema desta prefeitura
              </p>
              <Button size="lg" className="gap-2" onClick={() => setIsDialogOpen(true)}>
                <Plus size={20} weight="bold" />
                Criar Primeiro Usuário
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {users.map((user) => (
              <Card key={user.id} className="relative overflow-hidden transition-all hover:shadow-lg">
                {user.isAdmin && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-orange-500" />
                )}
                
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{user.fullName}</CardTitle>
                      <CardDescription className="mt-1">
                        @{user.username}
                      </CardDescription>
                    </div>
                    <Badge variant={user.isAdmin ? "default" : "secondary"} className="flex-shrink-0">
                      {user.isAdmin ? 'Admin' : 'Secretaria'}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {user.email && (
                    <div className="text-sm text-muted-foreground truncate">
                      {user.email}
                    </div>
                  )}

                  {!user.isAdmin && user.permissions && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Permissões:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {user.permissions.canManageLocations && (
                          <Badge variant="outline" className="text-xs">Localidades</Badge>
                        )}
                        {user.permissions.canBlockDates && (
                          <Badge variant="outline" className="text-xs">Datas</Badge>
                        )}
                        {user.permissions.canExportData && (
                          <Badge variant="outline" className="text-xs">Exportar</Badge>
                        )}
                        {user.permissions.canManageUsers && (
                          <Badge variant="outline" className="text-xs">Usuários</Badge>
                        )}
                        {user.permissions.canChangeColors && (
                          <Badge variant="outline" className="text-xs">Tema</Badge>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground pt-2 border-t">
                    Criado em {format(new Date(user.createdAt), 'dd/MM/yyyy')}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 gap-2"
                      onClick={() => handleEdit(user)}
                    >
                      <Key size={16} />
                      Editar
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="px-3">
                          <Trash size={16} className="text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir Usuário?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. O usuário <strong>{user.fullName}</strong> será 
                            permanentemente removido e não poderá mais acessar o sistema.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => {
                              onDeleteUser(user.id)
                              toast.success('Usuário excluído com sucesso')
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
