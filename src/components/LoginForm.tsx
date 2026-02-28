import { useState, type FormEvent } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Lock, User, SignIn } from '@phosphor-icons/react'
import { toast } from 'sonner'
import type { SecretaryUser } from '@/lib/types'
import { authService } from '@/lib/auth-service'

interface LoginFormProps {
  onLogin: (user: SecretaryUser) => void
  hasUsers: boolean
}

export function LoginForm({ onLogin, hasUsers }: LoginFormProps) {
  const [loginData, setLoginData] = useState({ username: '', password: '' })
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    if (!loginData.username || !loginData.password) {
      toast.error('Preencha todos os campos')
      return
    }

    setIsLoading(true)
    try {
      const user = await authService.loginTenantUser(loginData.username, loginData.password)
      onLogin(user)
      toast.success(`Bem-vindo(a), ${user.fullName}!`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível autenticar'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Lock className="text-primary" size={32} weight="duotone" />
            </div>
          </div>
          <CardTitle className="text-2xl">Área Restrita</CardTitle>
          <CardDescription>Acesso para Secretaria e Administradores</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-username">Nome de Usuário</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  id="login-username"
                  placeholder="seu_usuario"
                  autoComplete="username"
                  value={loginData.username}
                  onChange={(e) => setLoginData(prev => ({ ...prev, username: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="login-password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={loginData.password}
                  onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>

            <Button type="submit" className="w-full h-11 gap-2" disabled={isLoading}>
              <SignIn size={18} />
              {isLoading ? 'Entrando...' : 'Entrar'}
            </Button>

            {!hasUsers && (
              <div className="text-center text-sm text-muted-foreground mt-4 p-4 rounded-lg bg-muted/50">
                <p className="font-medium">Nenhum usuário cadastrado</p>
                <p className="mt-1">Entre em contato com o administrador do sistema</p>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
