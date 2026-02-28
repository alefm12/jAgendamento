import { useState, type FormEvent } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ShieldCheck } from '@phosphor-icons/react'
import { toast } from 'sonner'
import type { SuperAdmin } from '@/lib/types'
import { authService } from '@/lib/auth-service'

interface SuperAdminLoginProps {
  onLogin: (admin: SuperAdmin) => void
}

export function SuperAdminLogin({ onLogin }: SuperAdminLoginProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const admin = await authService.loginSuperAdmin(email, password)
      onLogin(admin)
      toast.success(`Bem-vindo, ${admin.fullName}!`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao autenticar'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/10 p-6">
      <Card className="w-full max-w-md shadow-xl border-2">
        <CardHeader className="space-y-4 text-center pb-8">
          <div className="mx-auto w-20 h-20 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center shadow-lg">
            <ShieldCheck size={40} weight="duotone" className="text-white" />
          </div>
          <div>
            <CardTitle className="text-3xl font-bold">Administrador Geral</CardTitle>
            <CardDescription className="text-base mt-2">
              Acesso ao painel de gerenciamento de prefeituras
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Digite seu e-mail"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">
                Senha
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Digite sua senha"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11"
              />
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 text-base font-semibold"
              disabled={isLoading || !email || !password}
            >
              {isLoading ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
