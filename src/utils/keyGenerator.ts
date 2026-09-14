import { ProductKey } from '../types';

/**
 * Calcul du checksum conforme à proxy.py :
 * payload = key.rsplit("-", 1)[0]
 * chk = f"{sum(ord(c) for c in payload) % 997:03x}"
 */
export function calculateChecksum(payload: string): string {
  let sum = 0;
  for (let i = 0; i < payload.length; i++) {
    sum += payload.charCodeAt(i);
  }
  return (sum % 997).toString(16).padStart(3, '0');
}

export function validateProductKey(rawKey: string): { valid: boolean; tier: 'PRO' | 'DEV' | 'FREE'; reason?: string } {
  const key = rawKey.trim();
  if (!key.startsWith('NEM-')) {
    return { valid: false, tier: 'FREE', reason: 'Doit commencer par NEM-' };
  }

  const parts = key.split('-');
  if (parts.length < 4) {
    return { valid: false, tier: 'FREE', reason: 'Format invalide (attendu: NEM-TIER-RANDOM-CHKSUM)' };
  }

  const tier = parts[1].toUpperCase() as 'PRO' | 'DEV' | 'FREE';
  const lastPart = parts[parts.length - 1].toLowerCase();
  const payload = parts.slice(0, -1).join('-');
  const expectedChk = calculateChecksum(payload);

  if (lastPart !== expectedChk) {
    return { valid: false, tier, reason: `Checksum invalide (attendu: ${expectedChk}, reçu: ${lastPart})` };
  }

  return { valid: true, tier };
}

export function generateNewKey(tier: 'PRO' | 'DEV' | 'FREE' = 'PRO', notes: string = 'Générée via NemApi Web Hub'): ProductKey {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 16; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const payload = `NEM-${tier}-${rand.slice(0, 4)}-${rand.slice(4, 8)}-${rand.slice(8, 12)}`;
  const chk = calculateChecksum(payload);
  const fullKey = `${payload}-${chk}`;

  const today = new Date();
  const expires = new Date();
  expires.setDate(today.getDate() + (tier === 'PRO' ? 365 : tier === 'DEV' ? 90 : 30));

  return {
    key: fullKey,
    tier,
    valid: true,
    checksum: chk,
    expiresAt: expires.toISOString().split('T')[0],
    dailyQuota: tier === 'PRO' ? 10000 : tier === 'DEV' ? 2000 : 500,
    usedToday: 0,
    notes,
  };
}
