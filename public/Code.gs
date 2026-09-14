/**
 * ===================================================================
 *  NemApi - Passerelle & Gestionnaire de Licences Google Apps Script
 *  Base de données centralisée sur Google Sheets
 * ===================================================================
 */

const SHEET_NAMES = {
  USERS: "Users",
  LICENSES: "Licenses",
  SUBSCRIPTIONS: "Subscriptions",
  LOGS: "UsageLogs"
};

// Schéma et En-têtes des 4 feuilles
const HEADERS = {
  [SHEET_NAMES.USERS]: [
    "id", "name", "email", "organization", "receiveAnnouncements", 
    "registeredAt", "role", "status", "lastActiveAt"
  ],
  [SHEET_NAMES.LICENSES]: [
    "key", "tier", "plan_name", "user_id", "user_email", 
    "status", "activated_at", "expires_at", "daily_quota", "used_today", "notes"
  ],
  [SHEET_NAMES.SUBSCRIPTIONS]: [
    "id", "user_id", "user_email", "plan", "plan_name", 
    "product_key", "created_at", "expires_at", "status"
  ],
  [SHEET_NAMES.LOGS]: [
    "id", "timestamp", "user_id", "provider", "model", 
    "prompt_tokens", "completion_tokens", "cost_saved", "status"
  ]
};

/**
 * Point d'entrée HTTP GET
 */
function doGet(e) {
  return handleRequest(e, "GET");
}

/**
 * Point d'entrée HTTP POST
 */
function doPost(e) {
  return handleRequest(e, "POST");
}

/**
 * Gestionnaire unifié des requêtes API
 */
function handleRequest(e, method) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

    let params = {};
    if (e && e.postData && e.postData.contents) {
      try {
        params = JSON.parse(e.postData.contents);
      } catch (err) {
        params = e.parameter || {};
      }
    } else if (e && e.parameter) {
      params = e.parameter;
    }

    const action = (params.action || (e && e.parameter ? e.parameter.action : "ping")).toLowerCase();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    ensureStructure(ss);

    let responseData = {};

    switch (action) {
      case "ping":
      case "health":
        responseData = { ok: true, message: "NemApi Sheets DB active", timestamp: new Date().toISOString() };
        break;

      case "init_db":
        ensureStructure(ss, true);
        responseData = { ok: true, message: "Structure des 4 feuilles vérifiée et initialisée" };
        break;

      case "get_all_data":
        responseData = {
          ok: true,
          users: getSheetData(ss.getSheetByName(SHEET_NAMES.USERS)),
          licenses: getSheetData(ss.getSheetByName(SHEET_NAMES.LICENSES)),
          subscriptions: getSheetData(ss.getSheetByName(SHEET_NAMES.SUBSCRIPTIONS)),
          logs: getSheetData(ss.getSheetByName(SHEET_NAMES.LOGS)).slice(-50)
        };
        break;

      case "register_user":
      case "upsert_user":
      case "claim":
        responseData = upsertUser(ss, params.user || params);
        break;

      case "get_user":
      case "user":
        responseData = getUser(ss, params.name || params.user || params.id || params.email);
        break;

      case "create_license":
        responseData = createLicense(ss, params);
        break;

      case "validate_license":
      case "verify":
        responseData = validateLicense(ss, params.key || (params.payload && params.payload.key));
        break;

      case "activate_license":
      case "activate":
        responseData = activateLicenseForUser(ss, params);
        break;

      case "deactivate_license":
      case "deactivate":
        responseData = deactivateLicenseForUser(ss, params);
        break;

      case "get_user_licenses":
        responseData = getUserLicenses(ss, params.user_id || params.user || params.email);
        break;

      case "create_subscription":
        responseData = createSubscription(ss, params);
        break;

      case "log_usage":
      case "usage":
        responseData = recordUsageLog(ss, params.log || params);
        break;

      default:
        responseData = { ok: false, error: "Action inconnue: " + action };
    }

    return ContentService.createTextOutput(JSON.stringify(responseData))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      ok: false,
      error: error.message || error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    try {
      lock.releaseLock();
    } catch (_) {}
  }
}

/**
 * Initialise ou répare les 4 feuilles et styles
 */
function ensureStructure(ss, forceSeed) {
  Object.keys(HEADERS).forEach(function(sheetName) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    
    if (sheet.getLastRow() === 0) {
      const headerRow = HEADERS[sheetName];
      sheet.getRange(1, 1, 1, headerRow.length).setValues([headerRow]);
      sheet.getRange(1, 1, 1, headerRow.length)
        .setBackground("#0c1c38")
        .setFontColor("#38bdf8")
        .setFontWeight("bold")
        .setFontFamily("Consolas");
      sheet.setFrozenRows(1);
    }
  });

  const defaultSheet = ss.getSheetByName("Feuille 1") || ss.getSheetByName("Sheet1");
  if (defaultSheet && ss.getSheets().length > 1 && defaultSheet.getLastRow() === 0) {
    try { ss.deleteSheet(defaultSheet); } catch(_) {}
  }

  if (forceSeed) {
    seedInitialData(ss);
  }
}

/**
 * Données de départ
 */
function seedInitialData(ss) {
  const usersSheet = ss.getSheetByName(SHEET_NAMES.USERS);
  const licensesSheet = ss.getSheetByName(SHEET_NAMES.LICENSES);

  if (usersSheet.getLastRow() === 1) {
    usersSheet.appendRow([
      "USR-ADMIN-001", "Administrateur Local", "admin@nemapi.local", 
      "NemApi Core Team", "true", new Date().toLocaleDateString("fr-FR"), 
      "admin", "active", new Date().toISOString()
    ]);
  }

  if (licensesSheet.getLastRow() === 1) {
    licensesSheet.appendRow([
      "PAC8GVLYHPAG7XBL", "premium_annual", "Premium Annuel (1 An)", 
      "USR-ADMIN-001", "admin@nemapi.local", "active", 
      new Date().toLocaleDateString("fr-FR"), "2027-09-12", "100000", "0", "Licence test annuelle officielle"
    ]);
    licensesSheet.appendRow([
      "PLB6X2VUTCXT3SXZ", "premium_lifetime", "Premium À Vie (Lifetime)", 
      "USR-ADMIN-001", "admin@nemapi.local", "active", 
      new Date().toLocaleDateString("fr-FR"), "Illimité", "Illimité", "0", "Licence test permanente officielle"
    ]);
  }
}

function getSheetData(sheet) {
  if (!sheet) return [];
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol === 0) return [];

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  return rows.map(function(row) {
    const obj = {};
    headers.forEach(function(header, idx) {
      let val = row[idx];
      if (val instanceof Date) {
        val = val.toISOString().slice(0, 10);
      }
      obj[header] = val !== undefined && val !== null ? String(val) : "";
    });
    return obj;
  });
}

function upsertUser(ss, user) {
  const sheet = ss.getSheetByName(SHEET_NAMES.USERS);
  const data = getSheetData(sheet);
  const id = user.id || ("USR-" + Math.floor(1000 + Math.random() * 9000));
  const email = user.email || "";

  let rowIndex = -1;
  for (let i = 0; i < data.length; i++) {
    if (data[i].id === id || (email && data[i].email && data[i].email.toLowerCase() === email.toLowerCase())) {
      rowIndex = i + 2;
      break;
    }
  }

  const rowData = [
    id,
    user.name || "Utilisateur",
    email,
    user.organization || "",
    String(user.receiveAnnouncements !== false),
    user.registeredAt || new Date().toLocaleDateString("fr-FR"),
    user.role || "user",
    user.status || "active",
    new Date().toISOString()
  ];

  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
  } else {
    sheet.appendRow(rowData);
  }

  return { ok: true, user: { id: id, name: user.name, email: email, registeredAt: rowData[5] } };
}

function getUser(ss, query) {
  const sheet = ss.getSheetByName(SHEET_NAMES.USERS);
  const data = getSheetData(sheet);
  const qStr = String(query || "").toLowerCase();
  const user = data.find(function(u) {
    return (u.id && u.id.toLowerCase() === qStr) || 
           (u.name && u.name.toLowerCase() === qStr) ||
           (u.email && u.email.toLowerCase() === qStr);
  });

  if (!user) {
    return { ok: false, error: "Utilisateur non trouvé" };
  }
  return { ok: true, user: user };
}

function createLicense(ss, params) {
  const sheet = ss.getSheetByName(SHEET_NAMES.LICENSES);
  const key = params.key;
  if (!key) return { ok: false, error: "Clé manquante" };

  const tier = params.tier || (key.startsWith("PL") ? "premium_lifetime" : "premium_annual");
  const planName = params.plan_name || (tier === "premium_lifetime" ? "Premium À Vie" : "Premium Annuel");

  const row = [
    key,
    tier,
    planName,
    params.user_id || "",
    params.user_email || "",
    params.status || "active",
    params.activated_at || new Date().toLocaleDateString("fr-FR"),
    params.expires_at || (tier === "premium_lifetime" ? "Illimité" : "1 An"),
    params.daily_quota || "Illimité",
    "0",
    params.notes || "Générée via NemApi"
  ];

  sheet.appendRow(row);
  return { ok: true, license: { key: key, tier: tier, plan_name: planName } };
}

function validateLicense(ss, key) {
  if (!key) return { ok: false, valid: false, reason: "empty_key", message: "Clé vide" };
  const cleanKey = String(key).trim().toUpperCase();
  const sheet = ss.getSheetByName(SHEET_NAMES.LICENSES);
  const data = getSheetData(sheet);

  const lic = data.find(function(l) { return l.key && l.key.toUpperCase() === cleanKey; });
  if (!lic) {
    return { ok: false, valid: false, reason: "invalid_key", message: "Clé introuvable dans la base Google Sheets" };
  }

  if (lic.status !== "active") {
    return { ok: false, valid: false, reason: "key_disabled", message: "Cette clé a été révoquée ou désactivée (" + lic.status + ")" };
  }

  return {
    ok: true,
    valid: true,
    plan: lic.tier,
    plan_name: lic.plan_name,
    license: lic,
    message: "Clé valide"
  };
}

function activateLicenseForUser(ss, params) {
  const key = String(params.key || "").trim().toUpperCase();
  const userId = params.user_id || params.user || "";
  const userEmail = params.user_email || params.email || "";

  const sheet = ss.getSheetByName(SHEET_NAMES.LICENSES);
  const data = getSheetData(sheet);

  let targetIndex = -1;
  let licData = null;

  for (let i = 0; i < data.length; i++) {
    if (data[i].key && data[i].key.toUpperCase() === key) {
      targetIndex = i + 2;
      licData = data[i];
      break;
    }
  }

  const nowIso = new Date().toISOString();
  const todayFr = new Date().toLocaleDateString("fr-FR");

  if (targetIndex === -1) {
    const isLifetime = key.startsWith("PL");
    const tier = isLifetime ? "premium_lifetime" : "premium_annual";
    const planName = isLifetime ? "Premium À Vie" : "Premium Annuel";
    const expiresAt = isLifetime ? "Illimité" : new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
    
    sheet.appendRow([
      key, tier, planName, userId, userEmail, "active",
      todayFr, expiresAt,
      "Illimité", "0", "Activée par " + (params.user_name || userId || "utilisateur")
    ]);
    
    return {
      ok: true,
      plan: tier,
      plan_name: planName,
      product_key: key,
      activated_at: nowIso,
      expires_at: expiresAt,
      subscription: {
        plan: tier,
        plan_name: planName,
        product_key: key,
        activated_at: nowIso,
        expires_at: expiresAt
      }
    };
  }

  sheet.getRange(targetIndex, 4).setValue(userId);
  sheet.getRange(targetIndex, 5).setValue(userEmail);
  sheet.getRange(targetIndex, 6).setValue("active");
  sheet.getRange(targetIndex, 7).setValue(todayFr);

  return {
    ok: true,
    plan: licData.tier,
    plan_name: licData.plan_name,
    product_key: key,
    activated_at: nowIso,
    expires_at: licData.expires_at || (licData.tier === "premium_lifetime" ? "Illimité" : "1 An"),
    subscription: {
      plan: licData.tier,
      plan_name: licData.plan_name,
      product_key: key,
      activated_at: nowIso,
      expires_at: licData.expires_at
    }
  };
}

function deactivateLicenseForUser(ss, params) {
  const key = String(params.key || "").trim().toUpperCase();
  const userId = String(params.user_id || params.user || "").trim();
  const sheet = ss.getSheetByName(SHEET_NAMES.LICENSES);
  const data = getSheetData(sheet);

  for (let i = 0; i < data.length; i++) {
    if ((key && data[i].key && data[i].key.toUpperCase() === key) || (userId && data[i].user_id === userId)) {
      const rowIndex = i + 2;
      sheet.getRange(rowIndex, 4).setValue("");
      sheet.getRange(rowIndex, 5).setValue("");
      return { ok: true, message: "Licence libérée avec succès" };
    }
  }
  return { ok: true, message: "Aucune licence active associée trouvée à libérer" };
}

function getUserLicenses(ss, query) {
  const sheet = ss.getSheetByName(SHEET_NAMES.LICENSES);
  const data = getSheetData(sheet);
  const cleanQ = String(query).toLowerCase();

  const userLicenses = data.filter(function(l) {
    return (l.user_id && l.user_id.toLowerCase() === cleanQ) || 
           (l.user_email && l.user_email.toLowerCase() === cleanQ);
  });

  return { ok: true, licenses: userLicenses };
}

function createSubscription(ss, params) {
  const sheet = ss.getSheetByName(SHEET_NAMES.SUBSCRIPTIONS);
  const id = "SUB-" + Date.now();
  
  sheet.appendRow([
    id,
    params.user_id || "",
    params.user_email || "",
    params.plan || "free",
    params.plan_name || "Gratuit",
    params.product_key || "",
    new Date().toISOString(),
    params.expires_at || "",
    "active"
  ]);

  return { ok: true, subscription: { id: id, plan: params.plan, plan_name: params.plan_name } };
}

function recordUsageLog(ss, log) {
  const sheet = ss.getSheetByName(SHEET_NAMES.LOGS);
  const id = "LOG-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
  
  const promptTokens = Number(log.prompt_tokens || log.tokens || 0);
  const completionTokens = Number(log.completion_tokens || 0);
  const totalTokens = promptTokens + completionTokens;
  const costSaved = Number(log.cost_saved || (totalTokens * 0.000003).toFixed(4));

  sheet.appendRow([
    id,
    log.timestamp || log.day || new Date().toISOString(),
    log.user_id || log.user || "anonymous",
    log.provider || "nemapi",
    log.model || "nemapi-core",
    promptTokens,
    completionTokens,
    costSaved,
    log.status || "success"
  ]);

  return { ok: true, log_id: id };
}
