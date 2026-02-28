# 🎯 INSTRUÇÕES PARA ADICIONAR A IMAGEM DA AYLA

## Passos para adicionar a imagem:

### OPÇÃO 1: Copiar manualmente (RECOMENDADO)

1. Localize a imagem da Ayla que foi fornecida (personagem 3D com cabelo cacheado, óculos e camisa roxa JEOS)

2. **Renomeie** a imagem para: `ayla-avatar.png`

3. **Copie** o arquivo para a pasta:
   ```
   C:\Users\alefm\Desktop\jAgendamento\public\
   ```

4. O caminho final deve ser:
   ```
   C:\Users\alefm\Desktop\jAgendamento\public\ayla-avatar.png
   ```

5. Recarregue a página no navegador (Ctrl+F5)

### OPÇÃO 2: Usar PowerShell (se a imagem estiver na área de transferência)

Execute no PowerShell:
```powershell
# Se você tiver a imagem na área de transferência ou Downloads
Copy-Item "C:\Users\alefm\Downloads\ayla-avatar.png" "C:\Users\alefm\Desktop\jAgendamento\public\ayla-avatar.png"
```

## ✅ Como verificar se funcionou:

1. Abra o navegador em: http://localhost:5000/iraucuba
2. Procure o botão da Ayla no **canto inferior direito**
3. O avatar deve aparecer com a imagem da personagem
4. Clique no botão para abrir o chat

## 🎨 Especificações da imagem:

- Formato: PNG (com fundo transparente preferencialmente)
- Tamanho recomendado: 400x400 pixels ou maior
- Qualidade: Alta resolução

## 🔧 Correções aplicadas:

✅ Botão agora fica fixo no canto inferior direito (não no centro)
✅ Locais de atendimento aparecem corretamente no chat
✅ Z-index ajustado para evitar sobreposição
