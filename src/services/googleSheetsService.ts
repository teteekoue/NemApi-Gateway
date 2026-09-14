/**
 * Service d'intégration Google Sheets & Google Apps Script
 * Gère la création de la feuille sur le compte Google et la communication bidirectionnelle
 */

import { UserAccount, SubscriptionState, UserAssignedLicense } from '../types';

export interface SheetRowUser {
  id: string;
  name: string;
  email: string;
  organization: string;
  receiveAnnouncements: string;
  registeredAt: string;
  role: string;
  status: string;
  lastActiveAt?: string;
}

export interface SheetRowLicense {
  key: string;
  tier: string;
  plan_name: string;
  user_id: string;
  user_email: string;
  status: string;
  activated_at: string;
  expires_at: string;
  daily_quota: string;
  used_today: string;
  notes: string;
}

export interface SheetRowSubscription {
  id: string;
  user_id: string;
  user_email: string;
  plan: string;
  plan_name: string;
  product_key: string;
  created_at: string;
  expires_at: string;
  status: string;
}

export interface SheetRowLog {
  id: string;
  timestamp: string;
  user_id: string;
  provider: string;
  model: string;
  prompt_tokens: string;
  completion_tokens: string;
  cost_saved: string;
  status: string;
}

export interface GoogleSheetsConfig {
  spreadsheetId: string;
  spreadsheetUrl: string;
  webAppUrl: string;
  isConnected: boolean;
  lastSyncedAt?: string;
}

export const DEFAULT_WEB_APP_URL =
  'https://script.google.com/macros/s/AKfycbx0lq7N7gM8NLwnJVAB5-RoaoXKZX7RzX_KRV5Fa5wOemUrwZsJ121bRme2I4kvo_2B6g/exec';

const STORAGE_KEY_CONFIG = 'nemapi_sheets_config';

export function loadSavedSheetsConfig(): GoogleSheetsConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.webAppUrl) return parsed;
    }
  } catch (_) {}
  return {
    spreadsheetId: '',
    spreadsheetUrl: '',
    webAppUrl: DEFAULT_WEB_APP_URL,
    isConnected: true,
    lastSyncedAt: 'Configuré',
  };
}

export function saveSheetsConfig(config: GoogleSheetsConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
  } catch (_) {}
}

/**
 * Création automatique de la feuille Google Sheets via l'API REST Google Sheets
 */
export async function createGoogleSheetsDatabase(accessToken: string): Promise<{
  ok: boolean;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  error?: string;
}> {
  try {
    const createBody = {
      properties: {
        title: `NemApi Database - Comptes & Licences (${new Date().toLocaleDateString('fr-FR')})`,
      },
      sheets: [
        {
          properties: {
            title: 'Users',
            gridProperties: { rowCount: 100, columnCount: 10, frozenRowCount: 1 },
          },
        },
        {
          properties: {
            title: 'Licenses',
            gridProperties: { rowCount: 100, columnCount: 12, frozenRowCount: 1 },
          },
        },
        {
          properties: {
            title: 'Subscriptions',
            gridProperties: { rowCount: 100, columnCount: 10, frozenRowCount: 1 },
          },
        },
        {
          properties: {
            title: 'UsageLogs',
            gridProperties: { rowCount: 500, columnCount: 10, frozenRowCount: 1 },
          },
        },
      ],
    };

    const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(createBody),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      return {
        ok: false,
        error: errJson.error?.message || `Erreur HTTP ${res.status} lors de la création du Google Sheet.`,
      };
    }

    const createdSheet = await res.json();
    const spreadsheetId = createdSheet.spreadsheetId;
    const spreadsheetUrl = createdSheet.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

    // Peupler les en-têtes et les données initiales
    const valuesBatch = {
      valueInputOption: 'USER_ENTERED',
      data: [
        {
          range: 'Users!A1:I2',
          values: [
            ['id', 'name', 'email', 'organization', 'receiveAnnouncements', 'registeredAt', 'role', 'status', 'lastActiveAt'],
            ['USR-ADMIN-001', 'Administrateur Principal', 'admin@nemapi.local', 'NemApi Core', 'TRUE', new Date().toLocaleDateString('fr-FR'), 'admin', 'active', new Date().toISOString()],
          ],
        },
        {
          range: 'Licenses!A1:K3',
          values: [
            ['key', 'tier', 'plan_name', 'user_id', 'user_email', 'status', 'activated_at', 'expires_at', 'daily_quota', 'used_today', 'notes'],
            ['PAC8GVLYHPAG7XBL', 'premium_annual', 'Premium Annuel (1 An)', 'USR-ADMIN-001', 'admin@nemapi.local', 'active', new Date().toLocaleDateString('fr-FR'), '2027-09-12', '100000', '0', 'Licence Annuelle Officielle'],
            ['PLB6X2VUTCXT3SXZ', 'premium_lifetime', 'Premium À Vie (Lifetime)', 'USR-ADMIN-001', 'admin@nemapi.local', 'active', new Date().toLocaleDateString('fr-FR'), 'Illimité', 'Illimité', '0', 'Licence Permanente Officielle'],
          ],
        },
        {
          range: 'Subscriptions!A1:I2',
          values: [
            ['id', 'user_id', 'user_email', 'plan', 'plan_name', 'product_key', 'created_at', 'expires_at', 'status'],
            ['SUB-INIT-001', 'USR-ADMIN-001', 'admin@nemapi.local', 'premium_lifetime', 'Premium À Vie', 'PLB6X2VUTCXT3SXZ', new Date().toISOString(), 'Illimité', 'active'],
          ],
        },
        {
          range: 'UsageLogs!A1:I1',
          values: [
            ['id', 'timestamp', 'user_id', 'provider', 'model', 'prompt_tokens', 'completion_tokens', 'cost_saved', 'status'],
          ],
        },
      ],
    };

    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(valuesBatch),
    });

    return {
      ok: true,
      spreadsheetId,
      spreadsheetUrl,
    };
  } catch (err: any) {
    return { ok: false, error: err.message || 'Impossible de créer la feuille Google Sheets.' };
  }
}

/**
 * Appel de l'API Google Apps Script Web App
 */
export async function callAppsScriptApi<T = any>(
  webAppUrl: string,
  payload: Record<string, any>
): Promise<{ ok: boolean; data?: T; error?: string }> {
  if (!webAppUrl || !webAppUrl.startsWith('http')) {
    return { ok: false, error: 'URL Google Apps Script non configurée.' };
  }

  try {
    const res = await fetch(webAppUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8', // Apps Script CORS friendly
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      return { ok: false, error: `Erreur HTTP ${res.status} depuis l'Apps Script.` };
    }

    const data = await res.json();
    return { ok: data.ok !== false, data, error: data.error };
  } catch (err: any) {
    return { ok: false, error: `Échec d'appel Apps Script : ${err.message}` };
  }
}

/**
 * Récupère l'ensemble des données (Users, Licenses, Subscriptions, Logs) depuis l'Apps Script
 */
export async function fetchAllSheetsData(webAppUrl: string): Promise<{
  ok: boolean;
  users?: SheetRowUser[];
  licenses?: SheetRowLicense[];
  subscriptions?: SheetRowSubscription[];
  logs?: SheetRowLog[];
  error?: string;
}> {
  const result = await callAppsScriptApi(webAppUrl, { action: 'get_all_data' });
  if (result.ok && result.data) {
    return {
      ok: true,
      users: result.data.users || [],
      licenses: result.data.licenses || [],
      subscriptions: result.data.subscriptions || [],
      logs: result.data.logs || [],
    };
  }
  return { ok: false, error: result.error || 'Erreur lors du chargement des données.' };
}

/**
 * Synchronise un compte utilisateur avec Google Sheets
 */
export async function syncUserWithSheets(
  webAppUrl: string,
  account: UserAccount
): Promise<{ ok: boolean; error?: string }> {
  const url = webAppUrl || DEFAULT_WEB_APP_URL;
  if (!url) return { ok: false, error: 'URL Apps Script absente.' };
  
  const userPayload = {
    id: account.id,
    name: account.name,
    email: account.email || '',
    organization: account.organization || '',
    receiveAnnouncements: String(account.receiveAnnouncements),
    registeredAt: account.registeredAt,
    role: 'user',
    status: 'active',
    lastActiveAt: new Date().toISOString(),
  };

  const res = await callAppsScriptApi(url, {
    action: 'upsert_user',
    payload: userPayload,
    user: userPayload, // compatibilité
  });
  return { ok: res.ok, error: res.error };
}

/**
 * Valide une clé de licence directement dans la base de données
 */
export async function validateLicenseWithSheets(
  webAppUrl: string,
  key: string
): Promise<{
  ok: boolean;
  valid?: boolean;
  license?: SheetRowLicense;
  message?: string;
  error?: string;
}> {
  const url = webAppUrl || DEFAULT_WEB_APP_URL;
  if (!url) return { ok: false, error: 'URL de base de données non configurée.' };

  const normalizedKey = key.trim().toUpperCase();

  // 1. Tenter l'action directe validate_license
  try {
    const res = await callAppsScriptApi(url, {
      action: 'validate_license',
      payload: { key: normalizedKey },
      key: normalizedKey,
    });

    if (res.ok && res.data && res.data.valid && res.data.license) {
      return {
        ok: true,
        valid: true,
        license: res.data.license,
        message: res.data.message || 'Clé validée dans la base de données',
      };
    }
  } catch (_) {}

  // 2. Recherche directe dans l'ensemble des licences de la base de données
  try {
    const allDataRes = await fetchAllSheetsData(url);
    if (allDataRes.ok && allDataRes.licenses && allDataRes.licenses.length > 0) {
      const cleanKeyTarget = normalizedKey.replace(/[\s-_]/g, '');
      const found = allDataRes.licenses.find((l) => {
        const rowKey = (l.key || '').trim().toUpperCase();
        const cleanRowKey = rowKey.replace(/[\s-_]/g, '');
        return rowKey === normalizedKey || cleanRowKey === cleanKeyTarget;
      });

      if (found) {
        const isNotExpired = !found.status || found.status.toLowerCase() === 'active';
        return {
          ok: true,
          valid: isNotExpired,
          license: found,
          message: isNotExpired ? 'Clé validée dans la base de données' : 'Licence expirée ou désactivée',
        };
      }
    }
  } catch (_) {}

  return { ok: false, error: 'Clé introuvable dans la base de données.' };
}

/**
 * Enregistre une souscription dans la feuille Subscriptions
 */
export async function recordSubscriptionWithSheets(
  webAppUrl: string,
  subscription: {
    id?: string;
    user_id: string;
    user_email?: string;
    plan: string;
    plan_name: string;
    product_key: string;
    created_at?: string;
    expires_at?: string;
    status?: string;
  }
): Promise<{ ok: boolean; error?: string }> {
  const url = webAppUrl || DEFAULT_WEB_APP_URL;
  if (!url) return { ok: false, error: 'URL Apps Script absente.' };

  const subPayload = {
    id: subscription.id || `SUB-${Date.now().toString(36).toUpperCase()}`,
    user_id: subscription.user_id,
    user_email: subscription.user_email || '',
    plan: subscription.plan,
    plan_name: subscription.plan_name,
    product_key: subscription.product_key,
    created_at: subscription.created_at || new Date().toISOString().slice(0, 10),
    expires_at: subscription.expires_at || (subscription.plan === 'premium_lifetime' ? 'Illimité' : '1 An'),
    status: subscription.status || 'active',
  };

  const res = await callAppsScriptApi(url, {
    action: 'create_subscription',
    payload: subPayload,
  });
  return { ok: res.ok, error: res.error };
}

/**
 * Enregistre une clé de licence dans le Google Sheet
 */
export async function saveLicenseToSheets(
  webAppUrl: string,
  license: {
    key: string;
    tier: string;
    plan_name: string;
    user_id?: string;
    user_email?: string;
    notes?: string;
  }
): Promise<{ ok: boolean; error?: string }> {
  const url = webAppUrl || DEFAULT_WEB_APP_URL;
  if (!url) return { ok: false, error: 'URL Apps Script absente.' };

  const licPayload = {
    key: license.key,
    tier: license.tier,
    plan_name: license.plan_name,
    user_id: license.user_id || '',
    user_email: license.user_email || '',
    status: 'active',
    activated_at: new Date().toLocaleDateString('fr-FR'),
    expires_at: license.tier === 'premium_lifetime' ? 'Illimité' : '1 An',
    daily_quota: 'Illimité',
    used_today: '0',
    notes: license.notes || '',
  };

  const res = await callAppsScriptApi(url, {
    action: 'create_license',
    payload: licPayload,
  });
  return { ok: res.ok, error: res.error };
}

/**
 * Journalise une consommation dans la feuille UsageLogs
 */
export async function logUsageToSheets(
  webAppUrl: string,
  logData: {
    id?: string;
    timestamp?: string;
    user_id?: string;
    provider: string;
    model: string;
    prompt_tokens: number;
    completion_tokens: number;
    cost_saved?: number;
    status?: string;
  }
): Promise<{ ok: boolean; error?: string }> {
  const url = webAppUrl || DEFAULT_WEB_APP_URL;
  if (!url) return { ok: false, error: 'URL Apps Script absente.' };

  const logPayload = {
    id: logData.id || `LOG-${Date.now().toString(36)}`,
    timestamp: logData.timestamp || new Date().toISOString(),
    user_id: logData.user_id || 'USR-CURRENT',
    provider: logData.provider,
    model: logData.model,
    prompt_tokens: String(logData.prompt_tokens),
    completion_tokens: String(logData.completion_tokens),
    cost_saved: String(logData.cost_saved || '0.00'),
    status: logData.status || 'success',
  };

  const res = await callAppsScriptApi(url, {
    action: 'log_usage',
    payload: logPayload,
  });
  return { ok: res.ok, error: res.error };
}
