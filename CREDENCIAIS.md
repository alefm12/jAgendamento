# Credenciais do Sistema Multi-Prefeituras

## Super Administrador (Administrador Geral)

O Super Administrador é o usuário principal que gerencia todas as prefeituras no sistema.

### Credenciais Padrão

```
Usuário: admin
Senha: admin123
```

### Acesso

1. Ao abrir o sistema, você verá a tela de login do Super Admin
2. Digite as credenciais acima
3. Após o login, você terá acesso ao painel para:
   - Criar novas prefeituras
   - Editar prefeituras existentes
   - Excluir prefeituras
   - Acessar o sistema de cada prefeitura

## Estrutura do Sistema

### Super Admin (Administrador Geral)
- **Função**: Gerencia múltiplas prefeituras
- **Acesso**: Login com usuário e senha
- **Permissões**: Criar, editar e excluir prefeituras/tenants

### Prefeitura Individual (Tenant)
Cada prefeitura tem seu próprio banco de dados isolado com:

#### Administrador Local
- **Acesso**: Proprietário do GitHub (isOwner) ou usuário marcado como Admin
- **Permissões**: 
  - Configurar sistema (cores, logo, nome, etc.)
  - Gerenciar usuários da secretaria
  - Definir permissões dos usuários
  - Configurar campos customizados
  - Gerenciar localidades

#### Usuários da Secretaria
- **Acesso**: Login com usuário e senha (criados pelo Admin Local)
- **Permissões configuráveis**:
  - Visualizar agendamentos
  - Alterar status de agendamentos
  - Gerenciar localidades (se permitido)
  - Bloquear datas (se permitido)
  - Reagendar/cancelar (se permitido)
  - Alterar prioridades (se permitido)

#### Público
- **Acesso**: Sem autenticação
- **Permissões**: Criar agendamentos, visualizar seus próprios agendamentos

## Alterando a Senha do Super Admin

⚠️ **IMPORTANTE**: Por questões de segurança, você deve alterar a senha padrão após o primeiro acesso.

Atualmente, a alteração da senha precisa ser feita modificando o código em `src/AppMultiTenant.tsx`, linhas 812-820.

Em futuras versões, será implementada uma funcionalidade para alterar a senha diretamente pelo painel do Super Admin.

## Recomendações de Segurança

1. ✅ Altere a senha padrão imediatamente após o primeiro acesso
2. ✅ Use senhas fortes com pelo menos 12 caracteres
3. ✅ Não compartilhe as credenciais do Super Admin
4. ✅ Crie usuários separados para cada funcionário da secretaria
5. ✅ Atribua apenas as permissões necessárias para cada usuário
6. ✅ Revise periodicamente os usuários ativos no sistema

## Suporte

Em caso de perda de senha do Super Admin, será necessário redefinir manualmente através do código ou do banco de dados.
