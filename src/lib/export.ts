import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Appointment } from './types'

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Pendente',
    confirmed: 'Confirmado',
    completed: 'Concluído',
    cancelled: 'Cancelado',
    'awaiting-issuance': 'Aguardando Emissão',
    'cin-ready': 'CIN Pronta',
    'cin-delivered': 'CIN Entregue'
  }
  return labels[status] || status
}

function getPriorityLabel(priority: string): string {
  const labels: Record<string, string> = {
    normal: 'Normal',
    high: 'Alta',
    urgent: 'Urgente'
  }
  return labels[priority] || priority
}

export function exportToCSV(appointments: Appointment[]): string {
  const headers = [
    'Protocolo',
    'Nome Completo',
    'CPF',
    'CIN',
    'Telefone',
    'Email',
    'Data',
    'Horário',
    'Status',
    'Prioridade',
    'Criado Em',
    'Última Modificação',
    'Total de Alterações'
  ]

  const rows = appointments.map(apt => [
    apt.protocol,
    apt.fullName,
    apt.cpf,
    apt.rg || '',
    apt.phone,
    apt.email,
    format(parseISO(apt.date), 'dd/MM/yyyy'),
    apt.time,
    getStatusLabel(apt.status),
    getPriorityLabel(apt.priority || 'normal'),
    format(new Date(apt.createdAt), "dd/MM/yyyy HH:mm"),
    apt.lastModified ? format(new Date(apt.lastModified), "dd/MM/yyyy HH:mm") : '-',
    apt.statusHistory ? apt.statusHistory.length.toString() : '0'
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n')

  return csvContent
}

export function downloadCSV(appointments: Appointment[], filename = 'agendamentos.csv') {
  const csv = exportToCSV(appointments)
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function generatePrintableHTML(appointments: Appointment[]): string {
  const now = new Date()
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Relatório de Agendamentos - CIN</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          padding: 40px;
          color: #333;
        }
        h1 {
          color: #2c3e50;
          border-bottom: 3px solid #3498db;
          padding-bottom: 10px;
        }
        .meta {
          color: #666;
          margin-bottom: 30px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
          table-layout: auto;
          font-size: 14px;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 10px 12px;
          text-align: left;
          vertical-align: middle;
        }
        th {
          background-color: #3498db;
          color: white;
          font-weight: bold;
          white-space: nowrap;
        }
        tr:nth-child(even) {
          background-color: #f9f9f9;
        }
        .col-protocol { white-space: nowrap; }
        .col-name { white-space: nowrap; }
        .col-cpf { white-space: nowrap; min-width: 130px; }
        .col-phone { white-space: nowrap; min-width: 130px; }
        .col-date { white-space: nowrap; min-width: 95px; }
        .col-time { white-space: nowrap; min-width: 70px; }
        .col-status { white-space: nowrap; min-width: 120px; }
        .status {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
          white-space: nowrap;
          display: inline-block;
        }
        .status-pending { background-color: #fff3cd; color: #856404; }
        .status-confirmed { background-color: #d1ecf1; color: #0c5460; }
        .status-completed { background-color: #d4edda; color: #155724; }
        .status-cancelled { background-color: #f8d7da; color: #721c24; }
        .status-awaiting-issuance { background-color: #ede9fe; color: #5b21b6; }
        .status-cin-ready { background-color: #e0e7ff; color: #3730a3; }
        .status-cin-delivered { background-color: #ccfbf1; color: #115e59; }
        @media print {
          body { padding: 20px; }
          table { font-size: 12px; }
          th, td { padding: 8px 10px; }
        }
      </style>
    </head>
    <body>
      <h1>Relatório de Agendamentos - CIN</h1>
      <div class="meta">
        <p><strong>Data do Relatório:</strong> ${format(now, "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}</p>
        <p><strong>Total de Agendamentos:</strong> ${appointments.length}</p>
      </div>
      
      <table>
        <thead>
          <tr>
            <th>Protocolo</th>
            <th>Nome</th>
            <th>CPF</th>
            <th>Telefone</th>
            <th>Data</th>
            <th>Horário</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${appointments.map(apt => `
            <tr>
              <td class="col-protocol">${apt.protocol}</td>
              <td class="col-name">${apt.fullName}</td>
              <td class="col-cpf">${apt.cpf}</td>
              <td class="col-phone">${apt.phone}</td>
              <td class="col-date">${format(parseISO(apt.date), 'dd/MM/yyyy')}</td>
              <td class="col-time">${apt.time}</td>
              <td class="col-status"><span class="status status-${apt.status}">${getStatusLabel(apt.status)}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `
}

export function printAppointments(appointments: Appointment[]) {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    alert('Por favor, permita pop-ups para imprimir o relatório')
    return
  }
  
  const html = generatePrintableHTML(appointments)
  printWindow.document.write(html)
  printWindow.document.close()
  
  setTimeout(() => {
    printWindow.print()
  }, 250)
}
