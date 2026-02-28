import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Users, Trash, ShieldCheck, User, EnvelopeSimple, Lock } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'
import type { SecretaryUser } from '@/lib/types'
import { validateEmail } from '@/lib/validators'

interface UserManagementProps {
  users: SecretaryUser[]
  currentUser: SecretaryUser
  onUpdateUser: (userId: string, updates: Partial<SecretaryUser>) => void
  onDeleteUser: (userId: string) => void
}

export function UserManagement({ users, currentUser, onUpdateUser, onDeleteUser }: UserManagementProps) {
  const [editingUser, setEditingUser] = useState<SecretaryUser | null>(null)
  const [editData, setEditData] = useState({
    fullName: '',
    email: '',
    password: ''
  })

  const handleEdit = (user: SecretaryUser) => {
    setEditingUser(user)
    setEditData({
      fullName: user.fullName,
      email: user.email,
      password: ''
    })
  }

  const handleSaveEdit = () => {
    if (!editingUser) return

    if (!editData.fullName.trim()) {
      toast.error('Nome completo é obrigatório')
      return
    }

    if (!validateEmail(editData.email)) {
      toast.error('Email inválido')
      return
    }

    if (editData.password && editData.password.length < 6) {
      toast.error('Senha deve ter pelo menos 6 caracteres')
      return
    }

    const updates: Partial<SecretaryUser> = {
      fullName: editData.fullName,
      email: editData.email,
      ...(editData.password && { password: editData.password })
    }

    onUpdateUser(editingUser.id, updates)
    setEditingUser(null)
    toast.success('Usuário atualizado com sucesso')
  }

  const handleToggleAdmin = (userId: string, isAdmin: boolean) => {
    if (userId === currentUser.id) {
      toast.error('Você não pode remover seu próprio acesso de administrador')
      return
    }
    onUpdateUser(userId, { isAdmin })
    toast.success(isAdmin ? 'Permissões de admin concedidas' : 'Permissões de admin removidas')
  }

  const handleDelete = (userId: string) => {
    if (userId === currentUser.id) {
      toast.error('Você não pode excluir sua própria conta')
      return
    }
    onDeleteUser(userId)
    toast.success('Usuário excluído')
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="text-primary" size={24} weight="duotone" />
            <CardTitle>Gerenciar Usuários</CardTitle>
          </div>
          <CardDescription>
            Visualize e gerencie os usuários da secretaria
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.fullName}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User size={16} className="text-muted-foreground" />
                      {user.username}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <EnvelopeSimple size={16} className="text-muted-foreground" />
                      {user.email}
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.isAdmin ? (
                      <Badge variant="default" className="gap-1">
                        <ShieldCheck size={14} />
                        Admin
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Secretaria</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(parseISO(user.createdAt), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(user)}
                          >
                            Editar
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Editar Usuário</DialogTitle>
                            <DialogDescription>
                              Atualize as informações do usuário
                            </DialogDescription>
                          </DialogHeader>
                          {editingUser?.id === user.id && (
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor="edit-fullname">Nome Completo</Label>
                                <Input
                                  id="edit-fullname"
                                  value={editData.fullName}
                                  onChange={(e) => setEditData(prev => ({ ...prev, fullName: e.target.value }))}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="edit-email">Email</Label>
                                <Input
                                  id="edit-email"
                                  type="email"
                                  value={editData.email}
                                  onChange={(e) => setEditData(prev => ({ ...prev, email: e.target.value }))}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="edit-password">Nova Senha (opcional)</Label>
                                <Input
                                  id="edit-password"
                                  type="password"
                                  value={editData.password}
                                  onChange={(e) => setEditData(prev => ({ ...prev, password: e.target.value }))}
                                  placeholder="Deixe em branco para manter a atual"
                                />
                              </div>
                              <Button onClick={handleSaveEdit} className="w-full">
                                Salvar Alterações
                              </Button>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                      
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={user.isAdmin}
                          onCheckedChange={(checked) => handleToggleAdmin(user.id, checked)}
                          disabled={user.id === currentUser.id}
                        />
                        <span className="text-xs text-muted-foreground">Admin</span>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(user.id)}
                        disabled={user.id === currentUser.id}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash size={18} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {users.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Users size={48} className="mx-auto mb-4 opacity-50" />
              <p>Nenhum usuário cadastrado</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
