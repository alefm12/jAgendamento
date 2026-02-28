import { pool } from '../config/db';
import axios from 'axios';

export interface MessagingProviderConfig {
  api_url?: string;
  instance_id: string;
  api_token: string;
  client_token?: string;
  numero_origem?: string;
  ativo: boolean;
}

interface CancellationCode {
  code: string;
  appointmentId: number;
  expiresAt: Date;
}

const cancellationCodes = new Map<number, CancellationCode>();

const formatPhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('55') ? digits : `55${digits}`;
};

const maskPhoneForLog = (phone: string): string => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return 'não informado';
  if (digits.length <= 4) return '*'.repeat(digits.length);
  return `${digits.slice(0, 2)}${'*'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-2)}`;
};

const normalizeBaseUrl = (apiUrl?: string) => {
  const raw = (apiUrl || 'https://api.ultramsg.com').trim();
  const withoutQuery = raw.split('?')[0].split('#')[0];
  return withoutQuery.replace(/\/+$/, '');
};

const buildProviderBase = (instanceId: string, apiUrl?: string) =>
  `${normalizeBaseUrl(apiUrl)}/${instanceId}`;

type MessagingProvider = 'zapi' | 'ultramsg' | 'evolution'

const detectProvider = (apiUrl?: string): MessagingProvider => {
  const normalized = (apiUrl || '').toLowerCase()
  if (normalized.includes('z-api')) return 'zapi'
  if (normalized.includes('evolution')) return 'evolution'
  return 'zapi'
}

const normalizeZapiBase = (instanceId: string, token: string, apiUrl?: string) => {
  const raw = (apiUrl || 'https://api.z-api.io').trim().replace(/\/+$/, '')
  if (/\/instances\/[^/]+\/token\/[^/]+$/i.test(raw)) {
    return raw
  }
  return `${raw}/instances/${encodeURIComponent(instanceId)}/token/${encodeURIComponent(token)}`
}

const extractClientTokenFromApiUrl = (apiUrl?: string): string | undefined => {
  if (!apiUrl || !apiUrl.includes('?')) return undefined
  try {
    const parsed = new URL(apiUrl)
    const token = parsed.searchParams.get('clientToken') || parsed.searchParams.get('client_token')
    return token || undefined
  } catch {
    const match = apiUrl.match(/[?&](clientToken|client_token)=([^&#]+)/i)
    return match?.[2] ? decodeURIComponent(match[2]) : undefined
  }
}

const isValidClientToken = (value?: string): boolean => {
  if (!value || value.trim() === '') return false
  // Rejeita valores que parecem URLs (não são tokens válidos)
  const trimmed = value.trim()
  if (/^https?:\/\//i.test(trimmed)) return false
  if (trimmed.length < 4) return false
  return true
}

const resolveClientToken = (explicitClientToken?: string, apiUrl?: string): string | undefined => {
  if (isValidClientToken(explicitClientToken)) return explicitClientToken!.trim()
  const fromUrl = extractClientTokenFromApiUrl(apiUrl)
  if (isValidClientToken(fromUrl)) return fromUrl
  return undefined
}

export class WhatsappService {
  static async getWhatsappConfig(prefeituraId: number): Promise<MessagingProviderConfig | null> {
    try {
      const result = await pool.query(
        'SELECT * FROM whatsapp_config WHERE prefeitura_id = $1 AND ativo = true',
        [prefeituraId]
      );
      if (result.rows.length === 0) return null;
      return result.rows[0] as MessagingProviderConfig;
    } catch (error) {
      console.error('[WhatsappService] Erro ao buscar configuração:', error);
      return null;
    }
  }

  /**
   * Verifica status da instância na plataforma configurada.
   */
  static async checkInstanceStatus(instanceId: string, token: string, apiUrl?: string, clientToken?: string): Promise<{
    connected: boolean;
    status: string;
    phone?: string;
    error?: string;
  }> {
    const provider = detectProvider(apiUrl)
    try {
      if (provider === 'zapi') {
        const base = normalizeZapiBase(instanceId, token, apiUrl)
        const resolvedClientToken = resolveClientToken(clientToken, apiUrl)
        const url = `${base}/status`
        const response = await axios.get(url, {
          headers: resolvedClientToken ? { 'Client-Token': resolvedClientToken } : undefined,
          timeout: 10000
        })
        const data = response.data || {}
        const connected =
          data?.connected === true ||
          data?.status === 'CONNECTED' ||
          data?.status === 'ONLINE' ||
          data?.status === 'connected'

        return {
          connected,
          status: String(data?.status || data?.session || 'unknown'),
          phone: data?.phone || data?.number || data?.me?.phone || undefined
        }
      }

      if (provider === 'evolution') {
        if (!apiUrl) {
          return {
            connected: false,
            status: 'error',
            error: 'Para Evolution API, informe a URL base da API.'
          }
        }

        const baseUrl = normalizeBaseUrl(apiUrl)
        const url = `${baseUrl}/instance/connectionState/${encodeURIComponent(instanceId)}`
        const response = await axios.get(url, {
          headers: { apikey: token },
          timeout: 10000
        })
        const data = response.data || {}
        const state =
          data?.instance?.state ||
          data?.state ||
          data?.status ||
          'unknown'
        const connected = ['open', 'connected', 'online'].includes(String(state).toLowerCase())

        return {
          connected,
          status: String(state),
          phone: data?.instance?.ownerJid || data?.instance?.number || data?.phone || undefined
        }
      }

      const url = `${buildProviderBase(instanceId, apiUrl)}/instance/status`;
      const response = await axios.get(url, {
        params: { token },
        timeout: 10000
      });
      const data = response.data;

      // Compatível com UltraMsg e respostas comuns de APIs de mensageria
      const statusObj = typeof data?.status === 'object' ? data.status : null;
      const statusStr = typeof data?.status === 'string' ? data.status : '';

      const authenticated =
        statusObj?.authenticated === true ||
        statusObj?.accountStatus?.status === 'authenticated' ||
        statusObj?.status === 'authenticated' ||
        statusObj?.status === 'connected' ||
        statusStr === 'authenticated' ||
        statusStr === 'connected' ||
        data?.connected === true ||
        data?.instanceStatus === 'authenticated';

      const phone =
        statusObj?.phone ||
        statusObj?.phoneConnected ||
        data?.phone ||
        undefined;

      // Resolve string legível do status para exibição
      const displayStatus =
        statusObj?.accountStatus?.status ||
        statusObj?.status ||
        statusStr ||
        data?.instanceStatus ||
        'unknown';

      return {
        connected: authenticated,
        status: displayStatus,
        phone
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const httpStatus = error.response?.status;
        const msg = error.response?.data?.message || error.response?.data?.error || error.message;
        if (httpStatus === 401 || httpStatus === 403) {
          return { connected: false, status: 'auth_error', error: 'Token inválido ou instância não encontrada.' };
        }
        return { connected: false, status: 'error', error: `Erro ${httpStatus || ''}: ${msg}` };
      }
      return {
        connected: false,
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Envia mensagem de texto pela plataforma configurada (padrão UltraMsg).
   */
  static async sendMessage(
    config: MessagingProviderConfig,
    phoneNumber: string,
    message: string
  ): Promise<boolean> {
    const provider = detectProvider(config.api_url)
    try {
      const phone = formatPhone(phoneNumber);
      const maskedPhone = maskPhoneForLog(phone);

      let response
      if (provider === 'zapi') {
        const base = normalizeZapiBase(config.instance_id, config.api_token, config.api_url)
        const resolvedClientToken = resolveClientToken(config.client_token, config.api_url)
        const url = `${base}/send-text`
        response = await axios.post(
          url,
          { phone, message },
          {
            headers: {
              'Content-Type': 'application/json',
              ...(resolvedClientToken ? { 'Client-Token': resolvedClientToken } : {})
            },
            timeout: 15000
          }
        )
      } else
      if (provider === 'evolution') {
        if (!config.api_url) {
          console.error('[WhatsappService] Evolution API requer URL base configurada.')
          return false
        }
        const baseUrl = normalizeBaseUrl(config.api_url)
        const url = `${baseUrl}/message/sendText/${encodeURIComponent(config.instance_id)}`
        response = await axios.post(
          url,
          { number: phone, text: message },
          {
            headers: {
              'Content-Type': 'application/json',
              apikey: config.api_token
            },
            timeout: 15000
          }
        )
      } else {
        const url = `${buildProviderBase(config.instance_id, config.api_url)}/messages/chat`;
        response = await axios.post(
          url,
          new URLSearchParams({
            token: config.api_token,
            to: phone,
            body: message
          }),
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 15000
          }
        );
      }

      const data = response.data;
      const ok =
        data?.sent === 'true' ||
        data?.sent === true ||
        data?.status === 'PENDING' ||
        data?.status === 'SENT' ||
        response.status === 200 ||
        response.status === 201;
      console.log('[WhatsappService] Envio de mensagem:', {
        provider,
        phone: maskedPhone,
        status: data?.status || response.status,
        success: ok
      });
      return ok;
    } catch (error) {
      const maskedPhone = maskPhoneForLog(formatPhone(phoneNumber));
      if (axios.isAxiosError(error)) {
        console.error('[WhatsappService] Erro ao enviar:', {
          provider,
          phone: maskedPhone,
          status: error.response?.status,
          message: error.response?.data?.message || error.response?.data?.error || error.message
        });
      } else {
        console.error('[WhatsappService] Erro desconhecido ao enviar:', {
          provider,
          phone: maskedPhone,
          message: error instanceof Error ? error.message : String(error)
        });
      }
      return false;
    }
  }

  /**
   * Envia mensagem de teste pela plataforma configurada.
   */
  static async sendTestMessage(
    instanceId: string,
    token: string,
    phoneNumber: string,
    customMessage?: string,
    apiUrl?: string,
    clientToken?: string
  ): Promise<{ success: boolean; error?: string }> {
    const provider = detectProvider(apiUrl)
    try {
      const phone = formatPhone(phoneNumber);
      const message = customMessage?.trim() || '✅ Mensagem de teste do Sistema de Agendamento CIN. Configuração do WhatsApp funcionando corretamente!';

      let response
      if (provider === 'zapi') {
        const base = normalizeZapiBase(instanceId, token, apiUrl)
        const resolvedClientToken = resolveClientToken(clientToken, apiUrl)
        const url = `${base}/send-text`
        response = await axios.post(
          url,
          { phone, message },
          {
            headers: {
              'Content-Type': 'application/json',
              ...(resolvedClientToken ? { 'Client-Token': resolvedClientToken } : {})
            },
            timeout: 15000
          }
        )
      } else
      if (provider === 'evolution') {
        if (!apiUrl) {
          return { success: false, error: 'Para Evolution API, informe a URL base da API.' }
        }
        const baseUrl = normalizeBaseUrl(apiUrl)
        const url = `${baseUrl}/message/sendText/${encodeURIComponent(instanceId)}`
        response = await axios.post(
          url,
          { number: phone, text: message },
          {
            headers: {
              'Content-Type': 'application/json',
              apikey: token
            },
            timeout: 15000
          }
        )
      } else {
        const url = `${buildProviderBase(instanceId, apiUrl)}/messages/chat`;
        response = await axios.post(
          url,
          new URLSearchParams({ token, to: phone, body: message }),
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 15000
          }
        );
      }

      const data = response.data;
      const ok =
        data?.sent === 'true' ||
        data?.sent === true ||
        data?.status === 'PENDING' ||
        data?.status === 'SENT' ||
        response.status === 200 ||
        response.status === 201;
      if (ok) return { success: true };
      return { success: false, error: data?.message || data?.error || 'A plataforma não confirmou o envio.' };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const msg = error.response?.data?.message || error.response?.data?.error || error.message;
        return { success: false, error: msg };
      }
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  static generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  static storeCancellationCode(appointmentId: number): string {
    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    cancellationCodes.set(appointmentId, { code, appointmentId, expiresAt });
    return code;
  }

  static validateCancellationCode(appointmentId: number, code: string, consumeOnSuccess: boolean = true): boolean {
    const stored = cancellationCodes.get(appointmentId);
    if (!stored) return false;
    if (new Date() > stored.expiresAt) { cancellationCodes.delete(appointmentId); return false; }
    if (stored.code !== code) return false;
    if (consumeOnSuccess) {
      cancellationCodes.delete(appointmentId);
    }
    return true;
  }

  static consumeCancellationCode(appointmentId: number): void {
    cancellationCodes.delete(appointmentId);
  }

  static async sendCancellationCode(
    prefeituraId: number,
    phoneNumber: string,
    code: string,
    appointmentData: { name: string; date: string; time: string; protocol?: string }
  ): Promise<boolean> {
    const config = await this.getWhatsappConfig(prefeituraId);
    if (!config) {
      console.error('[WhatsappService] Configuração não encontrada para prefeitura:', prefeituraId);
      return false;
    }

    const message =
      `🔐 *Código de Cancelamento*\n\n` +
      `Olá, ${appointmentData.name}!\n\n` +
      `Seu código para cancelar o agendamento é: *${code}*\n\n` +
      `📅 Data: ${appointmentData.date}\n` +
      `🕐 Horário: ${appointmentData.time}\n` +
      (appointmentData.protocol ? `📋 Protocolo: ${appointmentData.protocol}\n\n` : '\n') +
      `⚠️ Este código é válido por *15 minutos*.\n\n` +
      `Digite este código no sistema para confirmar o cancelamento.`;

    return await this.sendMessage(config, phoneNumber, message);
  }
}
