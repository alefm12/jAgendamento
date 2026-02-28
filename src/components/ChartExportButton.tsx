import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Download, Image as ImageIcon, FilePdf } from '@phosphor-icons/react'
import { exportChartElement, type ChartExportOptions } from '@/lib/chart-export'
import { cn } from '@/lib/utils'

interface ChartExportButtonProps {
  chartRef: React.RefObject<HTMLElement | null>
  filename?: string
  title?: string
  subtitle?: string
  variant?: 'default' | 'outline' | 'ghost' | 'icon'
  className?: string
  disabled?: boolean
}

export function ChartExportButton({
  chartRef,
  filename,
  title,
  subtitle,
  variant = 'outline',
  className,
  disabled = false
}: ChartExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = async (format: 'png' | 'pdf') => {
    if (!chartRef.current || isExporting) return

    setIsExporting(true)
    try {
      const options: ChartExportOptions = {
        filename: filename || 'grafico',
        format,
        title,
        subtitle,
        includeTimestamp: true,
        quality: 0.95,
        scale: 2,
        backgroundColor: '#ffffff'
      }

      await exportChartElement(chartRef.current, options)
    } catch (error) {
      console.error('Erro ao exportar:', error)
    } finally {
      setIsExporting(false)
    }
  }

  if (variant === 'icon') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            disabled={disabled || isExporting}
            className={cn('h-8 w-8', className)}
          >
            <Download size={18} weight={isExporting ? 'fill' : 'bold'} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Exportar Gráfico</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleExport('png')} className="gap-2">
            <ImageIcon size={16} />
            Exportar como PNG
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport('pdf')} className="gap-2">
            <FilePdf size={16} />
            Exportar como PDF
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size="sm"
          disabled={disabled || isExporting}
          className={cn('gap-2', className)}
        >
          <Download size={16} weight={isExporting ? 'fill' : 'bold'} />
          {isExporting ? 'Exportando...' : 'Exportar'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Formato de Exportação</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleExport('png')} className="gap-2">
          <ImageIcon size={16} />
          Imagem PNG
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('pdf')} className="gap-2">
          <FilePdf size={16} />
          Documento PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
