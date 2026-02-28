import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Plus, Buildings, Pencil, Trash, SignOut, CheckCircle, XCircle, ArrowRight, Palette, Users, CircleNotch } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import type { Tenant, SuperAdmin } from '@/lib/types'

interface SuperAdminPanelProps {
  tenants: Tenant[]
  isLoadingTenants: boolean
  currentAdmin: SuperAdmin
  onAddTenant: (tenant: Omit<Tenant, 'id' | 'createdAt'>) => Promise<void>
  onUpdateTenant: (tenantId: string, updates: Partial<Tenant>) => Promise<void>
  onDeleteTenant: (tenantId: string) => Promise<void>
  onSelectTenant: (tenant: Tenant) => void
  onConfigureTenant: (tenant: Tenant) => void
  onManageUsers: (tenant: Tenant) => void
  onLogout: () => void
}

export function SuperAdminPanel({
  tenants,
  isLoadingTenants,
  currentAdmin,
  onAddTenant,
  onUpdateTenant,
  onDeleteTenant,
  onSelectTenant,
  onConfigureTenant,
  onManageUsers,
  onLogout
}: SuperAdminPanelProps) {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    cityName: ''
  })
  const [isSavingTenant, setIsSavingTenant] = useState(false)
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const handleFormChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    if (field === 'name' && !editingTenant) {
      const slug = value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()
      setFormData(prev => ({ ...prev, slug }))
    }
  }

  const handleSubmit = async () => {
    if (!formData.name || !formData.slug || !formData.cityName) {
      toast.error('Preencha todos os campos')
      return
    }

    setIsSavingTenant(true)

    try {
      if (!editingTenant) {
        const existingSlug = tenants.find(t => t.slug === formData.slug)
        if (existingSlug) {
          toast.error('Já existe uma prefeitura com este slug')
          return
        }

        await onAddTenant({
          name: formData.name,
          slug: formData.slug,
          cityName: formData.cityName,
          createdBy: currentAdmin.fullName,
          isActive: true
        })
        toast.success('Prefeitura criada com sucesso!')
      } else {
        await onUpdateTenant(editingTenant.id, {
          name: formData.name,
          cityName: formData.cityName
        })
        toast.success('Prefeitura atualizada!')
      }

      setIsAddDialogOpen(false)
      setEditingTenant(null)
      setFormData({ name: '', slug: '', cityName: '' })
    } catch (error) {
      console.error('[tenants] Falha ao salvar prefeitura', error)
      const message = error instanceof Error ? error.message : 'Erro inesperado ao salvar prefeitura'
      toast.error(message)
    } finally {
      setIsSavingTenant(false)
    }
  }

  const handleEdit = (tenant: Tenant) => {
    setEditingTenant(tenant)
    setFormData({
      name: tenant.name,
      slug: tenant.slug,
      cityName: tenant.cityName
    })
    setIsAddDialogOpen(true)
  }

  const handleToggleActive = async (tenant: Tenant) => {
    setPendingToggleId(tenant.id)
    try {
      await onUpdateTenant(tenant.id, { isActive: !tenant.isActive })
      toast.success(tenant.isActive ? 'Prefeitura desativada' : 'Prefeitura ativada')
    } catch (error) {
      console.error('[tenants] Falha ao alterar status', error)
      const message = error instanceof Error ? error.message : 'Erro ao alterar status da prefeitura'
      toast.error(message)
    } finally {
      setPendingToggleId(null)
    }
  }

  const handleDelete = async (tenantId: string) => {
    setPendingDeleteId(tenantId)
    try {
      await onDeleteTenant(tenantId)
      toast.success('Prefeitura excluída')
    } catch (error) {
      console.error('[tenants] Falha ao excluir prefeitura', error)
      const message = error instanceof Error ? error.message : 'Erro ao excluir prefeitura'
      toast.error(message)
    } finally {
      setPendingDeleteId(null)
    }
  }

  const handleDialogClose = (open: boolean) => {
    setIsAddDialogOpen(open)
    if (!open) {
      setEditingTenant(null)
      setFormData({ name: '', slug: '', cityName: '' })
      setIsSavingTenant(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="border-b bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                <Buildings size={24} weight="duotone" className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Painel do Administrador Geral</h1>
                <p className="text-sm text-gray-600">Gerenciamento de Prefeituras</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900">{currentAdmin.fullName}</p>
                <p className="text-xs text-gray-600">Super Administrador</p>
              </div>
              <Button variant="ghost" size="icon" onClick={onLogout}>
                <SignOut size={20} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Prefeituras Cadastradas</h2>
            <p className="text-gray-600 mt-1">
              {tenants.length} {tenants.length === 1 ? 'prefeitura cadastrada' : 'prefeituras cadastradas'}
            </p>
          </div>

          <Dialog open={isAddDialogOpen} onOpenChange={handleDialogClose}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2 shadow-lg" disabled={isLoadingTenants}>
                <Plus size={20} weight="bold" />
                Nova Prefeitura
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="text-2xl">
                  {editingTenant ? 'Editar Prefeitura' : 'Cadastrar Nova Prefeitura'}
                </DialogTitle>
                <DialogDescription>
                  {editingTenant 
                    ? 'Atualize as informações da prefeitura' 
                    : 'Crie um novo banco de dados para uma prefeitura'
                  }
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Prefeitura *</Label>
                  <Input
                    id="name"
                    placeholder="Ex: Prefeitura de Irauçuba"
                    value={formData.name}
                    onChange={(e) => handleFormChange('name', e.target.value)}
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="slug">
                    Identificador (Slug) *
                    {!editingTenant && (
                      <span className="text-xs text-muted-foreground ml-2">
                        (gerado automaticamente)
                      </span>
                    )}
                  </Label>
                  <Input
                    id="slug"
                    placeholder="Ex: iraucuba"
                    value={formData.slug}
                    onChange={(e) => handleFormChange('slug', e.target.value)}
                    disabled={!!editingTenant}
                    className="h-11 disabled:opacity-50"
                  />
                  {!editingTenant && (
                    <p className="text-xs text-muted-foreground">
                      Este identificador será usado na URL e não pode ser alterado depois
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cityName">Nome da Cidade *</Label>
                  <Input
                    id="cityName"
                    placeholder="Ex: Irauçuba"
                    value={formData.cityName}
                    onChange={(e) => handleFormChange('cityName', e.target.value)}
                    className="h-11"
                  />
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
                  className="flex-1 gap-2"
                  disabled={isSavingTenant || !formData.name || !formData.slug || !formData.cityName}
                >
                  {isSavingTenant ? (
                    <>
                      <CircleNotch size={16} className="animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    editingTenant ? 'Atualizar' : 'Criar Prefeitura'
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoadingTenants ? (
          <Card className="border-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
              <CircleNotch size={40} className="animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">Carregando prefeituras...</p>
            </CardContent>
          </Card>
        ) : tenants.length === 0 ? (
          <Card className="border-2 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-4">
                <Buildings size={40} weight="duotone" className="text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Nenhuma prefeitura cadastrada</h3>
              <p className="text-muted-foreground text-center max-w-md mb-6">
                Comece criando o primeiro banco de dados para uma prefeitura
              </p>
              <Button size="lg" className="gap-2" onClick={() => setIsAddDialogOpen(true)}>
                <Plus size={20} weight="bold" />
                Criar Primeira Prefeitura
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tenants.map((tenant) => {
              const isToggling = pendingToggleId === tenant.id
              const isDeleting = pendingDeleteId === tenant.id

              return (
                <Card key={tenant.id} className={`relative overflow-hidden transition-all hover:shadow-lg ${!tenant.isActive ? 'opacity-60' : ''}`}>
                <div className={`absolute top-0 left-0 right-0 h-1 ${tenant.isActive ? 'bg-gradient-to-r from-green-500 to-emerald-500' : 'bg-gray-400'}`} />
                
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{tenant.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {tenant.cityName}
                      </CardDescription>
                    </div>
                    <Badge variant={tenant.isActive ? "default" : "secondary"} className="flex-shrink-0">
                      {tenant.isActive ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Slug:</span>
                      <code className="px-2 py-0.5 bg-muted rounded text-xs font-mono">
                        {tenant.slug}
                      </code>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Criado em:</span>
                      <span className="font-medium">
                        {format(new Date(tenant.createdAt), 'dd/MM/yyyy')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Por:</span>
                      <span className="font-medium truncate max-w-[150px]" title={tenant.createdBy}>
                        {tenant.createdBy}
                      </span>
                    </div>
                  </div>

                  <div className="pt-4 border-t space-y-2">
                    <Button 
                      className="w-full gap-2"
                      onClick={() => onSelectTenant(tenant)}
                      disabled={!tenant.isActive}
                    >
                      Acessar Sistema
                      <ArrowRight size={16} weight="bold" />
                    </Button>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => onConfigureTenant(tenant)}
                      >
                        <Palette size={16} />
                        Configurar
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => onManageUsers(tenant)}
                      >
                        <Users size={16} />
                        Usuários
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => handleEdit(tenant)}
                      >
                        <Pencil size={16} />
                        Editar
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => handleToggleActive(tenant)}
                        disabled={isToggling || isDeleting}
                      >
                        {isToggling ? (
                          <>
                            <CircleNotch size={16} className="animate-spin" />
                            Atualizando...
                          </>
                        ) : tenant.isActive ? (
                          <>
                            <XCircle size={16} />
                            Desativar
                          </>
                        ) : (
                          <>
                            <CheckCircle size={16} />
                            Ativar
                          </>
                        )}
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="col-span-2">
                            <Trash size={16} className="text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir Prefeitura?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita. Todos os dados desta prefeitura 
                              (usuários, agendamentos, configurações) serão permanentemente excluídos.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(tenant.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              disabled={isDeleting}
                            >
                              {isDeleting ? 'Excluindo...' : 'Excluir'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
