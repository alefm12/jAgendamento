import html2canvas from 'html2canvas'
import { toPng } from 'html-to-image'
import jsPDF from 'jspdf'
import { toast } from 'sonner'

export interface ChartExportOptions {
  filename?: string
  format: 'png' | 'pdf'
  quality?: number
  scale?: number
  backgroundColor?: string
  title?: string
  subtitle?: string
  includeTimestamp?: boolean
}

const DEFAULT_OPTIONS: Partial<ChartExportOptions> = {
  quality: 0.95,
  scale: 1.5,
  backgroundColor: '#ffffff',
  includeTimestamp: true
}

export async function exportChartElement(
  element: HTMLElement,
  options: ChartExportOptions
): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  
  try {
    toast.loading('Gerando exportação...', { id: 'chart-export' })

    const dataUrl = await captureElementDataUrl(element, opts)

    if (opts.format === 'png') {
      await exportAsPNG(dataUrl, opts)
    } else if (opts.format === 'pdf') {
      await exportAsPDF(dataUrl, opts)
    }

    toast.success('Gráfico exportado com sucesso!', { id: 'chart-export' })
  } catch (error) {
    console.error('Erro ao exportar gráfico:', error)
    toast.error('Erro ao exportar gráfico', { id: 'chart-export' })
    throw error
  }
}

async function exportAsPNG(
  dataUrl: string,
  options: Partial<ChartExportOptions>
): Promise<void> {
  const link = document.createElement('a')
  
  const timestamp = options.includeTimestamp 
    ? `_${new Date().toISOString().split('T')[0]}_${new Date().toTimeString().split(' ')[0].replace(/:/g, '-')}`
    : ''
  
  link.download = `${options.filename || 'grafico'}${timestamp}.png`
  link.href = dataUrl
  link.click()
}

async function exportAsPDF(
  dataUrl: string,
  options: Partial<ChartExportOptions>
): Promise<void> {
  const dimensions = await getImageDimensions(dataUrl)
  const imgWidth = dimensions.width
  const imgHeight = dimensions.height

  const pdf = new jsPDF({
    orientation: imgWidth > imgHeight ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  const pdfWidth = pdf.internal.pageSize.getWidth()
  const pdfHeight = pdf.internal.pageSize.getHeight()
  
  const margin = 20
  const availableWidth = pdfWidth - (margin * 2)
  const availableHeight = pdfHeight - (margin * 3)

  const ratio = Math.min(availableWidth / imgWidth, availableHeight / imgHeight)
  
  const scaledWidth = imgWidth * ratio
  const scaledHeight = imgHeight * ratio
  
  const x = (pdfWidth - scaledWidth) / 2
  let y = margin

  if (options.title) {
    pdf.setFontSize(18)
    pdf.setFont('helvetica', 'bold')
    pdf.text(options.title, pdfWidth / 2, y, { align: 'center' })
    y += 10
  }

  if (options.subtitle) {
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'normal')
    pdf.text(options.subtitle, pdfWidth / 2, y, { align: 'center' })
    y += 10
  }

  if (options.includeTimestamp) {
    const timestamp = new Date().toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short'
    })
    pdf.setFontSize(10)
    pdf.setTextColor(100)
    pdf.text(`Gerado em: ${timestamp}`, pdfWidth / 2, y, { align: 'center' })
    y += 10
  }

  pdf.addImage(dataUrl, 'PNG', x, y, scaledWidth, scaledHeight)

  const filenameTimestamp = options.includeTimestamp 
    ? `_${new Date().toISOString().split('T')[0]}_${new Date().toTimeString().split(' ')[0].replace(/:/g, '-')}`
    : ''
  
  pdf.save(`${options.filename || 'grafico'}${filenameTimestamp}.pdf`)
}

export async function exportMultipleCharts(
  elements: Array<{ element: HTMLElement; title?: string }>,
  options: Omit<ChartExportOptions, 'title'>
): Promise<void> {
  if (options.format === 'png') {
    toast.error('Exportação múltipla só está disponível em PDF')
    return
  }

  try {
    toast.loading('Gerando PDF com múltiplos gráficos...', { id: 'multi-chart-export' })

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    })

    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = pdf.internal.pageSize.getHeight()
    const margin = 15

    for (let i = 0; i < elements.length; i++) {
      const { element, title } = elements[i]

      if (i > 0) {
        pdf.addPage()
      }

      let y = margin

      if (title) {
        pdf.setFontSize(16)
        pdf.setFont('helvetica', 'bold')
        pdf.text(title, pdfWidth / 2, y, { align: 'center' })
        y += 10
      }

      const imgData = await captureElementDataUrl(element, {
        format: 'png',
        scale: options.scale || 2,
        backgroundColor: options.backgroundColor || '#ffffff',
        quality: options.quality || 0.95
      })
      const dimensions = await getImageDimensions(imgData)
      
      const availableWidth = pdfWidth - (margin * 2)
      const availableHeight = pdfHeight - y - margin

      const imgWidth = dimensions.width
      const imgHeight = dimensions.height
      const ratio = Math.min(availableWidth / imgWidth, availableHeight / imgHeight)
      
      const scaledWidth = imgWidth * ratio
      const scaledHeight = imgHeight * ratio
      
      const x = (pdfWidth - scaledWidth) / 2

      pdf.addImage(imgData, 'PNG', x, y, scaledWidth, scaledHeight)
    }

    if (options.includeTimestamp) {
      const totalPages = pdf.getNumberOfPages()
      const timestamp = new Date().toLocaleString('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
      })
      
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i)
        pdf.setFontSize(8)
        pdf.setTextColor(150)
        pdf.text(`Página ${i} de ${totalPages}`, margin, pdfHeight - 5)
        pdf.text(`Gerado em: ${timestamp}`, pdfWidth - margin, pdfHeight - 5, { align: 'right' })
      }
    }

    const filenameTimestamp = options.includeTimestamp 
      ? `_${new Date().toISOString().split('T')[0]}`
      : ''
    
    pdf.save(`${options.filename || 'relatorio_graficos'}${filenameTimestamp}.pdf`)

    toast.success('PDF com múltiplos gráficos exportado!', { id: 'multi-chart-export' })
  } catch (error) {
    console.error('Erro ao exportar múltiplos gráficos:', error)
    toast.error('Erro ao exportar gráficos', { id: 'multi-chart-export' })
    throw error
  }
}

export async function captureChartAsDataURL(
  element: HTMLElement,
  options?: Partial<Pick<ChartExportOptions, 'scale' | 'backgroundColor' | 'quality'>>
): Promise<string> {
  return captureElementDataUrl(element, {
    format: 'png',
    scale: options?.scale || 2,
    backgroundColor: options?.backgroundColor || '#ffffff',
    quality: options?.quality || 0.95
  })
}

async function captureElementDataUrl(
  element: HTMLElement,
  options: Partial<ChartExportOptions>
): Promise<string> {
  await waitForNextFrame()
  await wait(60)

  try {
    return await toPng(element, {
      pixelRatio: options.scale || 1.5,
      cacheBust: true,
      skipFonts: true,
      backgroundColor: options.backgroundColor || '#ffffff'
    })
  } catch (primaryError) {
    console.warn('[chart-export] html-to-image falhou, tentando html2canvas', primaryError)

    try {
      const canvas = await html2canvas(element, {
        scale: options.scale || 2,
        backgroundColor: options.backgroundColor || '#ffffff',
        logging: false,
        useCORS: true,
        allowTaint: false,
        windowWidth: Math.max(element.scrollWidth, element.clientWidth),
        windowHeight: Math.max(element.scrollHeight, element.clientHeight),
        onclone: (clonedDoc) => {
          const styles = clonedDoc.querySelectorAll('style')
          styles.forEach((styleTag) => {
            if (!styleTag.textContent) return
            styleTag.textContent = styleTag.textContent
              .replace(/oklch\([^\)]+\)/g, 'rgb(255, 255, 255)')
              .replace(/oklab\([^\)]+\)/g, 'rgb(255, 255, 255)')
          })
        }
      })

      return canvas.toDataURL('image/png', options.quality || 0.95)
    } catch (secondaryError) {
      console.warn('[chart-export] html2canvas padrão falhou, tentando fallback simplificado', secondaryError)

      const fallbackCanvas = await html2canvas(element, {
        scale: 1,
        backgroundColor: options.backgroundColor || '#ffffff',
        logging: false,
        useCORS: false,
        allowTaint: false,
        windowWidth: Math.max(element.scrollWidth, element.clientWidth),
        windowHeight: Math.max(element.scrollHeight, element.clientHeight)
      })

      return fallbackCanvas.toDataURL('image/png', options.quality || 0.92)
    }
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}
async function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => reject(new Error('Não foi possível ler as dimensões da imagem exportada'))
    image.src = dataUrl
  })
}
