# Script para adicionar a imagem da Ayla
# Execute este script após copiar a imagem para a pasta Downloads

$downloadPath = "$env:USERPROFILE\Downloads\ayla-avatar.png"
$destinationPath = "C:\Users\alefm\Desktop\jAgendamento\public\ayla-avatar.png"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  INSTALADOR DE IMAGEM DA AYLA" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar se existe na pasta Downloads
if (Test-Path $downloadPath) {
    Write-Host "✓ Imagem encontrada em Downloads!" -ForegroundColor Green
    Copy-Item $downloadPath $destinationPath -Force
    Write-Host "✓ Imagem copiada com sucesso!" -ForegroundColor Green
    Write-Host ""
    Write-Host "A Ayla está pronta! Recarregue a página no navegador." -ForegroundColor Green
} else {
    Write-Host "✗ Imagem não encontrada em Downloads" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Por favor:" -ForegroundColor White
    Write-Host "1. Salve a imagem da Ayla como: ayla-avatar.png" -ForegroundColor White
    Write-Host "2. Coloque na pasta: $env:USERPROFILE\Downloads" -ForegroundColor White
    Write-Host "3. Execute este script novamente" -ForegroundColor White
    Write-Host ""
    Write-Host "OU" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Copie manualmente para:" -ForegroundColor White
    Write-Host "$destinationPath" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Pressione qualquer tecla para sair..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
