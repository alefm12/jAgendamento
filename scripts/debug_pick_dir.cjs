const { execFile } = require('child_process')

const script = [
  "Add-Type -AssemblyName System.Windows.Forms",
  "$dialog = New-Object System.Windows.Forms.OpenFileDialog",
  "$dialog.Title = 'Selecione a pasta de destino para backups automáticos'",
  "$dialog.Filter = 'Pastas|*.none'",
  "$dialog.CheckFileExists = $false",
  "$dialog.CheckPathExists = $true",
  "$dialog.ValidateNames = $false",
  "$dialog.FileName = 'Selecione esta pasta'",
  "if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {",
  "  $selectedPath = [System.IO.Path]::GetDirectoryName($dialog.FileName)",
  "  if ($selectedPath) { [Console]::Out.Write($selectedPath) }",
  "}"
].join('; ')

execFile(
  'powershell',
  ['-NoProfile', '-STA', '-Command', script],
  { windowsHide: false, timeout: 30000 },
  (error, stdout, stderr) => {
    console.log('error:', error ? {
      message: error.message,
      code: error.code,
      signal: error.signal,
      killed: error.killed
    } : null)
    console.log('stdout:', stdout)
    console.log('stderr:', stderr)
  }
)
