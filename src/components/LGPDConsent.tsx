import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ShieldCheck, FileText, Info } from '@phosphor-icons/react'
import type { SystemConfig } from '@/lib/types'

interface LGPDConsentProps {
  config?: SystemConfig
}

export function LGPDConsent({ config }: LGPDConsentProps) {
  const dpoInfo = config?.lgpdSettings?.dataProtectionOfficer

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-lg bg-primary/10">
          <ShieldCheck size={32} className="text-primary" weight="duotone" />
        </div>
        <div>
          <p className="text-sm font-semibold text-primary">Lei nº 13.709/2018</p>
          <h2 className="text-2xl font-bold text-gray-900">Consentimento de Dados - LGPD</h2>
          <p className="text-sm text-muted-foreground">
            Leia atentamente o conteúdo abaixo antes de confirmar seu consentimento.
          </p>
        </div>
      </div>

      <ScrollArea className="h-[460px] w-full rounded-2xl border border-gray-200 bg-white p-5 shadow-inner">
        <div className="space-y-5 text-sm">
          <div>
            <h3 className="mb-2 flex items-center gap-2 text-base font-semibold">
              <Info size={20} className="text-primary" />
              Coleta e Uso de Dados Pessoais
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              De acordo com a Lei Geral de Proteção de Dados Pessoais (LGPD - Lei nº 13.709/2018),
              informamos que coletaremos e processaremos seus dados pessoais para as seguintes finalidades:
            </p>
          </div>

          <div className="space-y-3 pl-4">
            <section>
              <h4 className="font-medium">1. Dados coletados</h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Nome completo, CPF e CIN</li>
                <li>Telefone e email para contato</li>
                <li>Endereço (rua, número, bairro)</li>
                <li>Unidade escolhida para atendimento</li>
                <li>Data e horário do agendamento</li>
              </ul>
            </section>

            <section>
              <h4 className="font-medium">2. Finalidade do tratamento</h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Processamento e gerenciamento do agendamento</li>
                <li>Comunicação sobre o status do atendimento</li>
                <li>Envio de lembretes e notificações importantes</li>
                <li>Notificação quando a CIN estiver disponível para retirada</li>
                <li>Controle de entrega do documento e auditorias internas</li>
                <li>Geração de relatórios estatísticos com dados anonimizados</li>
              </ul>
            </section>

            <section>
              <h4 className="font-medium">3. Base legal (Art. 7º da LGPD)</h4>
              <p className="text-muted-foreground">
                O tratamento dos seus dados é necessário para a execução do serviço público de emissão de CIN,
                fundamentado no cumprimento de obrigação legal e regulatória (inciso II) e na execução de políticas
                públicas (inciso III).
              </p>
            </section>

            <section>
              <h4 className="font-medium">4. Compartilhamento</h4>
              <p className="text-muted-foreground">
                Seus dados serão compartilhados apenas com servidores autorizados da prefeitura responsáveis pelo
                atendimento e emissão do documento. Não compartilhamos seus dados com terceiros para fins comerciais.
              </p>
            </section>

            <section>
              <h4 className="font-medium">5. Armazenamento e retenção</h4>
              <p className="text-muted-foreground">
                Os dados serão armazenados de forma segura pelo período de {config?.lgpdSettings?.dataRetentionDays || 90} dias
                após a conclusão do atendimento. Após esse período, os dados serão anonimizados ou excluídos conforme a
                legislação aplicável.
              </p>
            </section>

            <section>
              <h4 className="font-medium">6. Direitos do titular (Art. 18)</h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Confirmação da existência de tratamento</li>
                <li>Acesso aos dados pessoais</li>
                <li>Correção de dados incompletos ou desatualizados</li>
                <li>Anonimização, bloqueio ou eliminação de dados desnecessários</li>
                <li>Portabilidade dos dados a outro fornecedor</li>
                <li>Eliminação dos dados tratados com consentimento</li>
                <li>Informações sobre o compartilhamento de dados</li>
                <li>Revogação do consentimento</li>
              </ul>
            </section>

            <section>
              <h4 className="font-medium">7. Segurança</h4>
              <p className="text-muted-foreground">
                Adotamos medidas técnicas e administrativas para proteger seus dados pessoais contra acessos não
                autorizados, situações acidentais ou ilícitas de destruição, perda, alteração ou comunicação.
              </p>
            </section>

            {dpoInfo && (
              <section>
                <h4 className="font-medium">8. Encarregado de Proteção de Dados (DPO)</h4>
                <div className="space-y-1 text-muted-foreground">
                  {dpoInfo.name && <p>Nome: {dpoInfo.name}</p>}
                  {dpoInfo.email && <p>Email: {dpoInfo.email}</p>}
                  {dpoInfo.phone && <p>Telefone: {dpoInfo.phone}</p>}
                </div>
              </section>
            )}
          </div>

          {config?.lgpdSettings?.privacyPolicyUrl && (
            <div className="mt-5 border-t pt-4">
              <a
                href={config.lgpdSettings.privacyPolicyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-primary hover:underline"
              >
                <FileText size={18} />
                Leia nossa Política de Privacidade completa
              </a>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
