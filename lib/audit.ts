import { appendFile, mkdir, readFile } from 'fs/promises';
import path from 'path';

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

const AUDIT_FILE = path.join(process.cwd(), 'lib', 'data', 'audit.log');
async function ensureAuditDir() {
  await mkdir(path.dirname(AUDIT_FILE), { recursive: true });
}

export async function writeAuditEvent(event: AuditEvent) {
  await ensureAuditDir();

  const entry = {
    id: globalThis.crypto.randomUUID(),
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

  await appendFile(AUDIT_FILE, `${JSON.stringify(entry)}\n`, 'utf-8');
}

export async function readAuditEvents(limit = 200) {
  try {
    const data = await readFile(AUDIT_FILE, 'utf-8');
    const lines = data.split('\n').filter(Boolean);
    const slice = lines.slice(-Math.max(1, Math.min(limit, 500)));
    return slice
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .reverse();
  } catch {
    return [];
  }
}
