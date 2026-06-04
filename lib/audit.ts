export type AuditSeverity = 'info' | 'warning' | 'critical';

export type AuditEvent = {
  action: string;
  actor?: string;
  resource?: string;
  severity?: AuditSeverity;
  status?: 'success' | 'failure' | 'attempt';
  ip?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
};

type StoredAuditEvent = Omit<AuditEvent, 'resource' | 'ip' | 'userAgent'> & {
  id: string;
  timestamp: string;
  resource: string | null;
  ip: string | null;
  userAgent: string | null;
  details: Record<string, unknown>;
};

const AUDIT_BUFFER_LIMIT = 500;
const globalAuditState = globalThis as typeof globalThis & {
  __promptgptAuditBuffer?: StoredAuditEvent[];
};

function getAuditBuffer() {
  if (!globalAuditState.__promptgptAuditBuffer) {
    globalAuditState.__promptgptAuditBuffer = [];
  }

  return globalAuditState.__promptgptAuditBuffer;
}

function createAuditEntry(event: AuditEvent): StoredAuditEvent {
  return {
    id:
      globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `audit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    timestamp: new Date().toISOString(),
    severity: event.severity || 'info',
    status: event.status || 'success',
    action: event.action,
    actor: event.actor || 'system',
    resource: event.resource || null,
    ip: event.ip || null,
    userAgent: event.userAgent || null,
    details: event.details || {},
  };
}

export async function writeAuditEvent(event: AuditEvent) {
  try {
    const entry = createAuditEntry(event);
    const buffer = getAuditBuffer();

    buffer.push(entry);
    if (buffer.length > AUDIT_BUFFER_LIMIT) {
      buffer.splice(0, buffer.length - AUDIT_BUFFER_LIMIT);
    }

    console.log('[AUDIT]', JSON.stringify(entry));
  } catch (err: any) {
    // Never throw - audit is best-effort logging only.
    console.warn('[AUDIT] write skipped:', err?.message || err);
  }
}

export async function readAuditEvents(limit = 200) {
  try {
    const buffer = getAuditBuffer();
    const safeLimit = Math.max(1, Math.min(limit, AUDIT_BUFFER_LIMIT));
    return buffer.slice(-safeLimit).reverse();
  } catch {
    return [];
  }
}
