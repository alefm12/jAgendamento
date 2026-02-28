# ⚡ SETUP RÁPIDO DO BANCO - COPIE E COLE

## PASSO 1: Abrir o PostgreSQL

Procure por **"SQL Shell (psql)"** no Windows ou abra o **pgAdmin**.

## PASSO 2: Criar o Banco

Cole este comando:

```sql
CREATE DATABASE jagendamento;
```

## PASSO 3: Conectar ao Banco

```sql
\c jagendamento
```

## PASSO 4: Copiar e Colar o SQL Completo

Abra o arquivo: `server/migrations/006_sistema_agendamento_completo.sql`

**SELECIONE TODO O CONTEÚDO** (Ctrl+A) e **COLE** no SQL Shell.

Pressione Enter.

## ✅ PRONTO!

Agora execute:

```bash
npm run server:dev
```

E em outro terminal:

```bash
npm run dev
```

## 🧪 TESTAR

1. Faça um agendamento
2. Vá em "Secretaria" no menu
3. Você deve ver o agendamento listado
4. Reinicie o servidor (`Ctrl+C` e `npm run server:dev` novamente)
5. **O agendamento deve continuar aparecendo!**

---

## 🔍 Verificar se funcionou

No SQL Shell, execute:

```sql
\c jagendamento
SELECT * FROM appointments;
```

Se aparecer seus agendamentos, está funcionando perfeitamente! ✅
