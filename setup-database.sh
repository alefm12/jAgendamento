#!/bin/bash

echo "========================================"
echo "  CONFIGURACAO DO BANCO DE DADOS"
echo "  Sistema de Agendamento CIN"
echo "========================================"
echo ""

echo "[1/3] Verificando PostgreSQL..."
if ! command -v psql &> /dev/null; then
    echo "ERRO: PostgreSQL não encontrado!"
    echo "Instale o PostgreSQL antes de continuar."
    exit 1
fi
psql --version

echo ""
echo "[2/3] Criando banco de dados 'jagendamento'..."
psql -U postgres -c "CREATE DATABASE jagendamento;" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "Banco de dados criado com sucesso!"
else
    echo "Banco de dados já existe ou erro ao criar."
fi

echo ""
echo "[3/3] Executando migrations..."
cd server/migrations
psql -U postgres -d jagendamento -f 006_sistema_agendamento_completo.sql
if [ $? -ne 0 ]; then
    echo "ERRO ao executar migrations!"
    exit 1
fi

echo ""
echo "========================================"
echo "  BANCO DE DADOS CONFIGURADO!"
echo "========================================"
echo ""
echo "Tabelas criadas:"
psql -U postgres -d jagendamento -c "\dt"

echo ""
echo "Próximo passo: Execute 'npm run server:dev' para iniciar o servidor"
echo ""
