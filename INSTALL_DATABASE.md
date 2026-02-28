# 🚀 GUIA RÁPIDO DE INSTALAÇÃO DO BANCO DE DADOS

## ⚡ Instalação Rápida (3 passos)

### PASSO 1: Execute o script de configuração

**Windows:**
```bash
setup-database.bat
```

**Linux/Mac:**
```bash
chmod +x setup-database.sh
./setup-database.sh
```

### PASSO 2: Inicie o servidor backend
```bash
npm run server:dev
```

### PASSO 3: Inicie o frontend
```bash
npm run dev
```

## ✅ Pronto!

Seu sistema agora está com banco de dados PostgreSQL configurado. 

**Os dados serão salvos permanentemente e não serão mais perdidos ao reiniciar!**

---

## 🔍 Como verificar se está funcionando

1. Faça um novo agendamento no sistema
2. Reinicie o servidor backend (Ctrl+C e depois `npm run server:dev`)
3. Recarregue a página do frontend
4. **O agendamento deve continuar lá!** ✅

---

## 📊 Tabelas criadas

- ✅ `appointments` - Agendamentos
- ✅ `locations` - Locais de atendimento
- ✅ `secretary_users` - Usuários da secretaria
- ✅ `blocked_dates` - Datas bloqueadas
- ✅ `audit_logs` - Logs de auditoria
- ✅ `reminder_history` - Histórico de lembretes
- ✅ `system_config` - Configurações do sistema
- ✅ `report_templates` - Templates de relatórios
- ✅ `scheduled_reports` - Relatórios agendados
- ✅ `report_execution_logs` - Logs de execução

---

## 🆘 Problemas?

### Erro: "psql não reconhecido"
➡️ Adicione o PostgreSQL ao PATH do Windows ou use o caminho completo:
```
C:\Program Files\PostgreSQL\14\bin\psql.exe
```

### Erro: "senha incorreta"
➡️ Edite o arquivo `server/db.ts` e ajuste a senha:
```typescript
password: '123', // ALTERE para sua senha do PostgreSQL
```

### Ver documentação completa
➡️ Leia o arquivo `DATABASE_SETUP.md`

---

## 🎯 Próximos passos

Agora que o banco está configurado, você pode:

1. ✅ Criar agendamentos - serão salvos permanentemente
2. ✅ Gerenciar locais de atendimento
3. ✅ Configurar usuários da secretaria
4. ✅ Bloquear datas
5. ✅ Ver histórico completo de auditoria
6. ✅ Gerar relatórios avançados

**Tudo será persistido no PostgreSQL!** 🎉
