import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Download, FileCsv, Printer, FileText } from '@phosphor-icons/react'
import { downloadCSV, printAppointments } from '@/lib/export'
import { toast } from 'sonner'
import type { Appointment } from '@/lib/types'

interface ExportMenuProps {
  appointments: Appointment[]
  selectedAppointments?: Appointment[]
  label?: string
}

export function ExportMenu({ appointments, selectedAppointments, label = 'Exportar' }: ExportMenuProps) {
  const [isLoading, setIsLoading] = useState(false)

  const dataToExport = selectedAppointments && selectedAppointments.length > 0 
    ? selectedAppointments 
    : appointments

  const hasData = dataToExport && dataToExport.length > 0

  const handleExportCSV = () => {
    if (!hasData) {
      toast.error('Não há dados para exportar')
      return
    }
    try {
      setIsLoading(true)
      downloadCSV(dataToExport, `agendamentos_${new Date().toISOString().split('T')[0]}.csv`)
      toast.success(`${dataToExport.length} agendamento(s) exportado(s) com sucesso!`)
    } catch (error) {
      toast.error('Erro ao exportar dados')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePrint = () => {
    try {
      setIsLoading(true)
      printAppointments(dataToExport)
      toast.success('Preparando impressão...')
    } catch (error) {
      toast.error('Erro ao preparar impressão')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleExportJSON = () => {
    if (!hasData) {
      toast.error('Não há dados para exportar')
      return
    }
    try {
      setIsLoading(true)
      const jsonData = JSON.stringify(dataToExport, null, 2)
      const blob = new Blob([jsonData], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `agendamentos_${new Date().toISOString().split('T')[0]}.json`
      link.click()
      URL.revokeObjectURL(url)
      toast.success(`${dataToExport.length} agendamento(s) exportado(s) em JSON!`)
    } catch (error) {
      toast.error('Erro ao exportar JSON')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={isLoading || !hasData} className="gap-2">
          <Download size={18} />
          {label}
          {selectedAppointments && selectedAppointments.length > 0 && (
            <span className="bg-primary text-primary-foreground text-xs px-1.5 py-0.5 rounded-full">
              {selectedAppointments.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          Exportar {dataToExport.length} agendamento(s)
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleExportCSV} className="gap-2 cursor-pointer">
          <FileCsv size={18} />
          Exportar como CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportJSON} className="gap-2 cursor-pointer">
          <FileText size={18} />
          Exportar como JSON
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handlePrint} className="gap-2 cursor-pointer">
          <Printer size={18} />
          Imprimir Relatório
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
