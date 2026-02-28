import { query } from '../config/db';
import { Request } from 'express';
import os from 'os';

interface AuditLogData {
  userId?: number;
  userEmail?: string;
  userName?: string;
  userRole?: string;
  action: string;
  actionCategory?: string;
  description?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  entityType?: string;
  entityId?: string;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string;
  userAgent?: string;
  deviceType?: string;
  browser?: string;
  os?: string;
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  sessionId?: string;
  requestId?: string;
  tenantId?: number;
  tenantName?: string;
  status?: 'success' | 'failed' | 'error';
  errorMessage?: string;
}

// Parser de User-Agent para extrair informações do dispositivo
function parseUserAgent(userAgent: string): { deviceType: string; browser: string; os: string } {
  const ua = userAgent.toLowerCase();
  
  // Detectar tipo de dispositivo
  let deviceType = 'desktop';
  if (/mobile|android|iphone|ipod|blackberry|opera mini|iemobile/i.test(ua)) {
    deviceType = 'mobile';
  } else if (/tablet|ipad|playbook|silk/i.test(ua)) {
    deviceType = 'tablet';
  }
  
  // Detectar navegador
  let browser = 'Unknown';
  if (ua.includes('edg')) browser = 'Edge';
  else if (ua.includes('chrome') && !ua.includes('edg')) browser = 'Chrome';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('opera') || ua.includes('opr')) browser = 'Opera';
  else if (ua.includes('trident') || ua.includes('msie')) browser = 'Internet Explorer';
  
  // Detectar sistema operacional
  let os = 'Unknown';
  if (ua.includes('windows nt 10.0')) os = 'Windows 10';
  else if (ua.includes('windows nt 6.3')) os = 'Windows 8.1';
  else if (ua.includes('windows nt 6.2')) os = 'Windows 8';
  else if (ua.includes('windows nt 6.1')) os = 'Windows 7';
  else if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('mac os x')) os = 'macOS';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';
  else if (ua.includes('linux')) os = 'Linux';
  
  return { deviceType, browser, os };
}

// Obter IP real do request (considerando proxies)
function getRealIP(req: Request): string {
  const headerCandidates = [
    req.headers['x-forwarded-for'],
    req.headers['x-real-ip'],
    req.headers['cf-connecting-ip'],
    req.headers['x-client-ip'],
    req.headers['x-forwarded'],
  ];

  for (const candidate of headerCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      const first = candidate.split(',')[0].trim();
      if (first && first !== 'unknown') {
        return normalizeIp(first);
      }
    }
  }

  const socketIp = req.socket?.remoteAddress || req.connection.remoteAddress || req.ip || 'Unknown';
  return normalizeIp(socketIp);
}

function normalizeIp(raw: string): string {
  if (!raw) return 'Unknown';

  let ip = raw.trim();
  if (ip.startsWith('::ffff:')) {
    ip = ip.replace('::ffff:', '');
  }

  if (ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') {
    const interfaces = os.networkInterfaces();
    for (const entries of Object.values(interfaces)) {
      if (!entries) continue;
      for (const entry of entries) {
        if (entry.family === 'IPv4' && !entry.internal && entry.address) {
          // Prefer IP local de rede (192.168.x.x / 10.x.x.x / 172.16-31.x.x)
          if (
            entry.address.startsWith('192.168.') ||
            entry.address.startsWith('10.') ||
            /^172\.(1[6-9]|2\d|3[0-1])\./.test(entry.address)
          ) {
            return entry.address;
          }
        }
      }
    }
  }

  return ip;
}

function isPrivateOrLoopbackIp(ip?: string): boolean {
  if (!ip) return true;
  const value = ip.trim();
  return (
    value === '::1' ||
    value === '127.0.0.1' ||
    value === 'localhost' ||
    value.startsWith('10.') ||
    value.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(value) ||
    value.startsWith('169.254.')
  );
}

let cachedPublicIp: { value: string; fetchedAt: number } | null = null;
const PUBLIC_IP_CACHE_TTL_MS = 5 * 60 * 1000;
const GEO_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const geolocationCache = new Map<string, { fetchedAt: number; data: {
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
} }>();

async function getPublicIpCached(): Promise<string | undefined> {
  const now = Date.now();
  if (cachedPublicIp && now - cachedPublicIp.fetchedAt < PUBLIC_IP_CACHE_TTL_MS) {
    return cachedPublicIp.value;
  }

  const providers = [
    'https://api.ipify.org?format=json',
    'https://ifconfig.me/all.json'
  ];

  for (const provider of providers) {
    try {
      const response = await fetch(provider);
      if (!response.ok) continue;
      const data: any = await response.json();
      const ip = normalizeIp(String(data.ip_addr || data.ip || ''));
      if (ip && !isPrivateOrLoopbackIp(ip)) {
        cachedPublicIp = { value: ip, fetchedAt: now };
        return ip;
      }
    } catch {
      // tenta próximo provider
    }
  }

  return undefined;
}

// Obter geolocalização do IP por provedores externos (cidade/estado/país)
async function getGeolocation(ip: string): Promise<{
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}> {
  if (!ip || ip === 'Unknown' || isPrivateOrLoopbackIp(ip)) {
    return {};
  }

  const cached = geolocationCache.get(ip);
  const now = Date.now();
  if (cached && now - cached.fetchedAt < GEO_CACHE_TTL_MS) {
    return cached.data;
  }

  const providers = [
    `https://ipwho.is/${ip}`,
    `https://ipapi.co/${ip}/json/`
  ];

  for (const provider of providers) {
    try {
      const response = await fetch(provider);
      if (!response.ok) continue;
      const data: any = await response.json();

      const normalized = {
        country: data.country || data.country_name || undefined,
        region: data.region || data.regionName || data.region_name || undefined,
        city: data.city || undefined,
        latitude: typeof data.latitude === 'number' ? data.latitude : (typeof data.lat === 'number' ? data.lat : undefined),
        longitude: typeof data.longitude === 'number' ? data.longitude : (typeof data.lon === 'number' ? data.lon : undefined)
      };

      if (normalized.city || normalized.region || normalized.country) {
        geolocationCache.set(ip, { fetchedAt: now, data: normalized });
        return normalized;
      }
    } catch {
      // tenta próximo provider
    }
  }

  return {};
}

function getClientLocationFromHeaders(req: Request): {
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
} {
  const parseHeaderNumber = (value: unknown) => {
    const parsed = Number(Array.isArray(value) ? value[0] : value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  const readHeaderString = (value: unknown) => {
    const str = Array.isArray(value) ? value[0] : value;
    return typeof str === 'string' && str.trim() ? str.trim() : undefined;
  };

  return {
    latitude: parseHeaderNumber(req.headers['x-client-latitude']),
    longitude: parseHeaderNumber(req.headers['x-client-longitude']),
    city: readHeaderString(req.headers['x-client-city']),
    region: readHeaderString(req.headers['x-client-region']),
    country: readHeaderString(req.headers['x-client-country'])
  };
}

// Criar log de auditoria
export async function createAuditLog(data: AuditLogData, req?: Request): Promise<void> {
  try {
    let ipAddress = data.ipAddress;
    let userAgent = data.userAgent;
    let deviceType = data.deviceType;
    let browser = data.browser;
    let os = data.os;
    let geolocation: any = {};
    
    // Se req foi fornecido, extrair informações
    if (req) {
      ipAddress = ipAddress || getRealIP(req);
      userAgent = userAgent || req.headers['user-agent'] || '';
      
      // Parser user-agent
      const parsed = parseUserAgent(userAgent);
      deviceType = deviceType || parsed.deviceType;
      browser = browser || parsed.browser;
      os = os || parsed.os;
    }

    // Se vier IP local/loopback, tenta resolver IP público real.
    if (isPrivateOrLoopbackIp(ipAddress)) {
      const publicIp = await getPublicIpCached();
      if (publicIp) {
        ipAddress = publicIp;
      }
    }

    geolocation = await getGeolocation(ipAddress || '');
    if (req) {
      const clientGeo = getClientLocationFromHeaders(req);
      geolocation = {
        country: clientGeo.country || geolocation.country,
        region: clientGeo.region || geolocation.region,
        city: clientGeo.city || geolocation.city,
        latitude: clientGeo.latitude ?? geolocation.latitude,
        longitude: clientGeo.longitude ?? geolocation.longitude
      };
    }
    
    await query(
      `INSERT INTO audit_logs (
        user_id, user_email, user_name, user_role,
        action, action_category, description, severity,
        entity_type, entity_id, old_values, new_values,
        ip_address, user_agent, device_type, browser, os,
        country, region, city, latitude, longitude,
        session_id, request_id, tenant_id, tenant_name,
        status, error_message
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18, $19, $20, $21, $22,
        $23, $24, $25, $26, $27, $28
      )`,
      [
        data.userId || null,
        data.userEmail || null,
        data.userName || null,
        data.userRole || null,
        data.action,
        data.actionCategory || null,
        data.description || null,
        data.severity || 'LOW',
        data.entityType || null,
        data.entityId || null,
        data.oldValues ? JSON.stringify(data.oldValues) : null,
        data.newValues ? JSON.stringify(data.newValues) : null,
        ipAddress || null,
        userAgent || null,
        deviceType || null,
        browser || null,
        os || null,
        geolocation.country || data.country || null,
        geolocation.region || data.region || null,
        geolocation.city || data.city || null,
        geolocation.latitude || data.latitude || null,
        geolocation.longitude || data.longitude || null,
        data.sessionId || null,
        data.requestId || null,
        data.tenantId || null,
        data.tenantName || null,
        data.status || 'success',
        data.errorMessage || null
      ]
    );
  } catch (error) {
    console.error('Erro ao criar log de auditoria:', error);
  }
}

// Funções auxiliares para logs específicos

export async function logLogin(user: any, req: Request): Promise<void> {
  await createAuditLog({
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    userRole: user.role,
    action: 'LOGIN',
    actionCategory: 'AUTH',
    description: `Usuário ${user.email} fez login com sucesso`,
    severity: 'LOW',
    tenantId: user.tenantId,
    tenantName: user.tenantName,
    status: 'success'
  }, req);
}

export async function logLoginFailed(email: string, reason: string, req: Request): Promise<void> {
  await createAuditLog({
    userEmail: email,
    action: 'LOGIN_FAILED',
    actionCategory: 'AUTH',
    description: `Tentativa de acesso inválida para ${email}: ${reason}`,
    severity: 'CRITICAL',
    status: 'failed',
    errorMessage: reason
  }, req);
}

export async function logLogout(user: any, req: Request): Promise<void> {
  await createAuditLog({
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    userRole: user.role,
    action: 'LOGOUT',
    actionCategory: 'AUTH',
    description: `Usuário ${user.email} fez logout`,
    severity: 'LOW',
    tenantId: user.tenantId,
    status: 'success'
  }, req);
}

export async function logAppointmentCreate(user: any, appointment: any, req: Request): Promise<void> {
  const protocol = appointment.protocolo || appointment.protocol || 'N/A';
  const citizenName = appointment.cidadao_nome || appointment.fullName || 'N/A';
  
  await createAuditLog({
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    userRole: user.role,
    action: 'CREATE_APPOINTMENT',
    actionCategory: 'APPOINTMENT',
    description: `Agendamento criado - Protocolo: ${protocol} | Cidadão: ${citizenName} | Usuário: ${user.name || user.email}`,
    severity: 'LOW',
    entityType: 'appointment',
    entityId: appointment.id?.toString(),
    newValues: appointment,
    tenantId: user.tenantId,
    status: 'success'
  }, req);
}

export async function logAppointmentUpdate(
  user: any,
  appointmentId: string,
  oldData: any,
  newData: any,
  req: Request
): Promise<void> {
  const protocol = newData.protocolo || newData.protocol || oldData.protocolo || oldData.protocol || 'N/A';
  const citizenName = newData.cidadao_nome || newData.fullName || oldData.cidadao_nome || oldData.fullName || 'N/A';
  
  await createAuditLog({
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    userRole: user.role,
    action: 'UPDATE_APPOINTMENT',
    actionCategory: 'APPOINTMENT',
    description: `Agendamento atualizado - Protocolo: ${protocol} | Cidadão: ${citizenName} | Usuário: ${user.name || user.email}`,
    severity: 'MEDIUM',
    entityType: 'appointment',
    entityId: appointmentId,
    oldValues: oldData,
    newValues: newData,
    tenantId: user.tenantId,
    status: 'success'
  }, req);
}

export async function logAppointmentStatusChange(
  user: any,
  appointmentId: string,
  protocol: string,
  citizenName: string,
  oldStatus: string,
  newStatus: string,
  req: Request
): Promise<void> {
  await createAuditLog({
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    userRole: user.role,
    action: 'UPDATE_APPOINTMENT_STATUS',
    actionCategory: 'APPOINTMENT',
    description: `Status alterado de "${oldStatus}" para "${newStatus}" - Protocolo: ${protocol} | Cidadão: ${citizenName} | Usuário: ${user.name || user.email}`,
    severity: 'MEDIUM',
    entityType: 'appointment',
    entityId: appointmentId,
    oldValues: { status: oldStatus },
    newValues: { status: newStatus },
    tenantId: user.tenantId,
    status: 'success'
  }, req);
}

export async function logAppointmentDelete(user: any, appointmentId: string, appointmentData: any, req: Request): Promise<void> {
  const protocol = appointmentData.protocolo || appointmentData.protocol || 'N/A';
  const citizenName = appointmentData.cidadao_nome || appointmentData.fullName || 'N/A';
  
  await createAuditLog({
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    userRole: user.role,
    action: 'DELETE_APPOINTMENT',
    actionCategory: 'APPOINTMENT',
    description: `Agendamento excluído - Protocolo: ${protocol} | Cidadão: ${citizenName} | Usuário: ${user.name || user.email}`,
    severity: 'HIGH',
    entityType: 'appointment',
    entityId: appointmentId,
    oldValues: appointmentData,
    tenantId: user.tenantId,
    status: 'success'
  }, req);
}

export async function logUserCreate(admin: any, newUser: any, req: Request): Promise<void> {
  await createAuditLog({
    userId: admin.id,
    userEmail: admin.email,
    userName: admin.name,
    userRole: admin.role,
    action: 'CREATE_USER',
    actionCategory: 'USER_MANAGEMENT',
    description: `Criado usuário ${newUser.email} (${newUser.role})`,
    severity: 'MEDIUM',
    entityType: 'user',
    entityId: newUser.id?.toString(),
    newValues: { email: newUser.email, role: newUser.role, name: newUser.name },
    tenantId: admin.tenantId,
    status: 'success'
  }, req);
}

export async function logUserUpdate(admin: any, userId: string, oldData: any, newData: any, req: Request): Promise<void> {
  await createAuditLog({
    userId: admin.id,
    userEmail: admin.email,
    userName: admin.name,
    userRole: admin.role,
    action: 'UPDATE_USER',
    actionCategory: 'USER_MANAGEMENT',
    description: `Atualizado usuário ${userId}`,
    severity: 'MEDIUM',
    entityType: 'user',
    entityId: userId,
    oldValues: oldData,
    newValues: newData,
    tenantId: admin.tenantId,
    status: 'success'
  }, req);
}

export async function logUserDelete(admin: any, userId: string, userData: any, req: Request): Promise<void> {
  await createAuditLog({
    userId: admin.id,
    userEmail: admin.email,
    userName: admin.name,
    userRole: admin.role,
    action: 'DELETE_USER',
    actionCategory: 'USER_MANAGEMENT',
    description: `Excluído usuário ${userData.email}`,
    severity: 'HIGH',
    entityType: 'user',
    entityId: userId,
    oldValues: userData,
    tenantId: admin.tenantId,
    status: 'success'
  }, req);
}

export async function logSystemConfigChange(user: any, configType: string, oldValue: any, newValue: any, req: Request): Promise<void> {
  await createAuditLog({
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    userRole: user.role,
    action: 'UPDATE_SYSTEM_CONFIG',
    actionCategory: 'SYSTEM_CONFIG',
    description: `Atualizada configuração do sistema: ${configType}`,
    severity: 'HIGH',
    entityType: 'system_config',
    entityId: configType,
    oldValues: oldValue,
    newValues: newValue,
    tenantId: user.tenantId,
    status: 'success'
  }, req);
}
