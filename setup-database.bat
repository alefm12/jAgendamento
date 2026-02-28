@echo off
echo ========================================
echo   CONFIGURACAO DO BANCO DE DADOS
echo   Sistema de Agendamento CIN
echo ========================================
echo.

echo [1/3] Verificando PostgreSQL...
psql --version
if %errorlevel% neq 0 (
    echo ERRO: PostgreSQL nao encontrado!
    echo Instale o PostgreSQL antes de continuar.
    pause
    exit /b 1
)

echo.
echo [2/3] Criando banco de dados 'jagendamento'...
psql -U postgres -c "CREATE DATABASE jagendamento;" 2>nul
if %errorlevel% equ 0 (
    echo Banco de dados criado com sucesso!
) else (
    echo Banco de dados ja existe ou erro ao criar.
)

echo.
echo [3/3] Executando migrations...
cd server\migrations
psql -U postgres -d jagendamento -f 006_sistema_agendamento_completo.sql
if %errorlevel% neq 0 (
    echo ERRO ao executar migrations!
    pause
    exit /b 1
)

echo.
echo ========================================
echo   BANCO DE DADOS CONFIGURADO!
echo ========================================
echo.
echo Tabelas criadas:
psql -U postgres -d jagendamento -c "\dt"

echo.
echo Proximo passo: Execute 'npm run server:dev' para iniciar o servidor
echo.
pause
