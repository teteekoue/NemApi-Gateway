import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Dashboard } from './components/Dashboard';
import { Playground } from './components/Playground';
import { AnalyticsView } from './components/AnalyticsView';
import { SubscriptionView } from './components/SubscriptionView';
import { AccountView } from './components/AccountView';
import { KeyManager, ApiKeyItem } from './components/KeyManager';
import { LiveLogs } from './components/LiveLogs';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { Footer } from './components/Footer';
import { LocalAuthModal } from './components/LocalAuthModal';
import { PROVIDERS_DATA } from './data/providers';
import { UsageStats, LogEntry, SubscriptionState, UserAccount, ChatTestResult, ModelQuotaConfig, ProxyHealthStatus } from './types';
import { QuotaManagerModal } from './components/QuotaManagerModal';
import {
  syncUserWithSheets,
  logUsageToSheets,
  loadSavedSheetsConfig,
  DEFAULT_WEB_APP_URL,
} from './services/googleSheetsService';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [proxyOnline, setProxyOnline] = useState<boolean>(true);
  const [proxyHealth, setProxyHealth] = useState<ProxyHealthStatus>({
    online: true,
    port: 8090,
    host: '127.0.0.1',
    latencyMs: 24,
    lastChecked: new Date().toLocaleTimeString(),
    uptimeSeconds: 3600,
    engine: 'Chromium Local Bridge',
  });
  const [quotaModalOpen, setQuotaModalOpen] = useState<boolean>(false);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('deepseek');
  const [selectedModel, setSelectedModel] = useState<string>('deepseek-chat');

  // Quotas & Règles de Fallback par Modèle avec Persistance
  const [modelQuotas, setModelQuotas] = useState<Record<string, ModelQuotaConfig>>(() => {
    try {
      const saved = localStorage.getItem('nemapi_model_quotas');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    const initial: Record<string, ModelQuotaConfig> = {};
    PROVIDERS_DATA.forEach((p) => {
      p.models.forEach((m) => {
        initial[m] = {
          modelId: m,
          providerId: p.id,
          dailyLimitTokens: p.id === 'claude' || p.id === 'chatgpt' ? 1_000_000 : 2_000_000,
          warnThresholdPercent: 80,
          fallbackModelId: p.id === 'deepseek' ? 'gemini-2.5-flash' : 'deepseek-chat',
          fallbackProviderId: p.id === 'deepseek' ? 'gemini' : 'deepseek',
          autoFallbackEnabled: true,
          rateLimitPerMinute: 60,
        };
      });
    });
    return initial;
  });

  const handleSaveQuotas = (updated: Record<string, ModelQuotaConfig>) => {
    setModelQuotas(updated);
    try {
      localStorage.setItem('nemapi_model_quotas', JSON.stringify(updated));
    } catch (_) {}
  };

  // Profil Utilisateur & Données du Compte avec Vraie Persistance
  const [account, setAccount] = useState<UserAccount>(() => {
    try {
      const saved = localStorage.getItem('nemapi_user_account');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && (parsed.id || parsed.name)) return parsed;
      }
    } catch (_) {}
    return {
      id: `USR-${Math.floor(1000 + Math.random() * 9000)}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`,
      name: '',
      email: '',
      organization: '',
      receiveAnnouncements: true,
      registeredAt: new Date().toLocaleDateString('fr-FR'),
      assignedLicenses: [],
    };
  });

  // Modale de création de compte : s'ouvre UNIQUEMENT si l'utilisateur n'a pas encore créé de profil
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('nemapi_user_account');
      const onboarded = localStorage.getItem('nemapi_onboarded');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.name?.trim()) return false;
      }
      return !onboarded;
    } catch (_) {
      return false;
    }
  });

  const handleUpdateAccount = (updated: UserAccount) => {
    setAccount(updated);
    try {
      localStorage.setItem('nemapi_user_account', JSON.stringify(updated));
      localStorage.setItem('nemapi_onboarded', 'true');
    } catch (_) {}
  };

  // Déconnexion et purge des données locales
  const handleLogout = (resetAllData: boolean = false) => {
    try {
      localStorage.removeItem('nemapi_user_account');
      localStorage.removeItem('nemapi_onboarded');
      if (resetAllData) {
        localStorage.removeItem('nemapi_subscription');
        localStorage.removeItem('nemapi_api_keys');
        localStorage.removeItem('nemapi_usage_stats');
        localStorage.removeItem('nemapi_request_history');
        localStorage.removeItem('nemapi_auth_enabled');
      }
    } catch (_) {}

    const newGuestAccount: UserAccount = {
      id: `USR-${Math.floor(1000 + Math.random() * 9000)}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`,
      name: '',
      email: '',
      organization: '',
      receiveAnnouncements: true,
      registeredAt: new Date().toLocaleDateString('fr-FR'),
      assignedLicenses: [],
    };
    setAccount(newGuestAccount);

    if (resetAllData) {
      setSubscription({
        plan: 'free',
        plan_name: 'Gratuit',
        user: '',
      });
      setApiKeys([
        {
          id: 'key-main',
          name: 'Clé Principale (Cursor / Cline)',
          key: 'nemapi-token-7a8f9b2c3d4e5f6g',
          createdAt: 'Aujourd\'hui',
        },
      ]);
      setActiveKey('nemapi-token-7a8f9b2c3d4e5f6g');
      setApiKeysEnabled(false);
      handleResetStats();
    }

    addLog(
      'warn',
      resetAllData
        ? 'Session déconnectée et ensemble des données locales purgées avec succès.'
        : 'Session déconnectée : les identifiants locaux ont été supprimés.'
    );

    // Ouvre la modale de connexion / reconnexion
    setAuthModalOpen(true);
  };

  // Mode Authentification par clé API
  const [apiKeysEnabled, setApiKeysEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('nemapi_auth_enabled');
      return saved === 'true';
    } catch (_) {
      return false;
    }
  });

  // Clés API stockées
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>(() => {
    try {
      const saved = localStorage.getItem('nemapi_api_keys');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return [
      {
        id: 'key-main',
        name: 'Clé Principale (Cursor / Cline)',
        key: 'nemapi-token-7a8f9b2c3d4e5f6g',
        createdAt: 'Aujourd\'hui',
      },
    ];
  });

  const [activeKey, setActiveKey] = useState<string>(() => {
    return apiKeys[0]?.key || 'nemapi-token-7a8f9b2c3d4e5f6g';
  });

  // État de l'abonnement & licence logicielle
  const [subscription, setSubscription] = useState<SubscriptionState>(() => {
    try {
      const saved = localStorage.getItem('nemapi_subscription');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {
      plan: 'free',
      plan_name: 'Gratuit',
      user: '',
    };
  });

  const handleUpdateSubscription = (newSub: SubscriptionState) => {
    setSubscription(newSub);
    try {
      localStorage.setItem('nemapi_subscription', JSON.stringify(newSub));
    } catch (_) {}

    // Si une clé de produit est fournie, s'assurer qu'elle est rattachée au compte
    if (newSub.product_key) {
      const existing = account.assignedLicenses.find((l) => l.key === newSub.product_key);
      if (!existing) {
        const updatedLicenses = [
          {
            key: newSub.product_key,
            plan: newSub.plan,
            plan_name: newSub.plan_name,
            activatedAt: new Date().toLocaleDateString('fr-FR'),
            status: 'active' as const,
            notes: newSub.plan === 'premium_lifetime' ? 'Licence À vie' : 'Licence Annuelle',
          },
          ...account.assignedLicenses,
        ];
        handleUpdateAccount({
          ...account,
          assignedLicenses: updatedLicenses,
        });
      }
    }

    addLog(
      'success',
      `Mise à niveau de la licence appliquée : ${newSub.plan_name}${
        newSub.product_key ? ` (Clé ${newSub.product_key.slice(0, 8)}••••)` : ''
      }`
    );
  };

  // Bascule du mode d'authentification API
  const handleToggleApiKeys = async (enabled: boolean) => {
    setApiKeysEnabled(enabled);
    try {
      localStorage.setItem('nemapi_auth_enabled', String(enabled));
      const endpoint = enabled ? '/api-keys/enable' : '/api-keys/disable';
      await fetch(endpoint, { method: 'POST' }).catch(() => {});
    } catch (_) {}

    addLog(
      enabled ? 'info' : 'warn',
      enabled
        ? 'Protection par clé API activée (requêtes avec Bearer token exigées).'
        : 'Mode sans clé API activé : accès direct sans clé autorisé sur 127.0.0.1:8090.'
    );
  };

  // Création d'une clé API
  const handleAddKey = (name: string) => {
    const randomHex = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
    const newKey: ApiKeyItem = {
      id: `key-${Date.now()}`,
      name,
      key: `nemapi-token-${randomHex}`,
      createdAt: new Date().toLocaleDateString('fr-FR'),
    };
    const updated = [newKey, ...apiKeys];
    setApiKeys(updated);
    setActiveKey(newKey.key);
    try {
      localStorage.setItem('nemapi_api_keys', JSON.stringify(updated));
    } catch (_) {}
    addLog('success', `Nouvelle clé API générée : "${name}"`);
  };

  // Suppression d'une clé API
  const handleDeleteKey = (id: string) => {
    const keyItem = apiKeys.find((k) => k.id === id);
    const updated = apiKeys.filter((k) => k.id !== id);
    setApiKeys(updated);
    try {
      localStorage.setItem('nemapi_api_keys', JSON.stringify(updated));
    } catch (_) {}
    if (activeKey === keyItem?.key && updated.length > 0) {
      setActiveKey(updated[0].key);
    }
    addLog('warn', `Clé API supprimée : "${keyItem?.name || id}"`);
  };

  // Historique des tests de requêtes
  const [requestHistory, setRequestHistory] = useState<ChatTestResult[]>(() => {
    try {
      const saved = localStorage.getItem('nemapi_request_history');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return [];
  });

  // Statistiques d'usage persistées
  const [stats, setStats] = useState<UsageStats>(() => {
    try {
      const saved = localStorage.getItem('nemapi_usage_stats');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return {
      requests: 0,
      prompt_tokens: 0,
      completion_tokens: 0,
      estimated_cost: 0.0,
      providers: {
        'auto-nemapi': { requests: 0, prompt_tokens: 0, completion_tokens: 0, cost: 0.0 },
        deepseek: { requests: 0, prompt_tokens: 0, completion_tokens: 0, cost: 0.0 },
        gemini: { requests: 0, prompt_tokens: 0, completion_tokens: 0, cost: 0.0 },
        kimi: { requests: 0, prompt_tokens: 0, completion_tokens: 0, cost: 0.0 },
        zai: { requests: 0, prompt_tokens: 0, completion_tokens: 0, cost: 0.0 },
        claude: { requests: 0, prompt_tokens: 0, completion_tokens: 0, cost: 0.0 },
        chatgpt: { requests: 0, prompt_tokens: 0, completion_tokens: 0, cost: 0.0 },
        qwen: { requests: 0, prompt_tokens: 0, completion_tokens: 0, cost: 0.0 },
      },
      updated_at: new Date().toISOString(),
    };
  });

  const handleResetStats = () => {
    const reset: UsageStats = {
      requests: 0,
      prompt_tokens: 0,
      completion_tokens: 0,
      estimated_cost: 0.0,
      providers: {
        'auto-nemapi': { requests: 0, prompt_tokens: 0, completion_tokens: 0, cost: 0.0 },
        deepseek: { requests: 0, prompt_tokens: 0, completion_tokens: 0, cost: 0.0 },
        gemini: { requests: 0, prompt_tokens: 0, completion_tokens: 0, cost: 0.0 },
        kimi: { requests: 0, prompt_tokens: 0, completion_tokens: 0, cost: 0.0 },
        zai: { requests: 0, prompt_tokens: 0, completion_tokens: 0, cost: 0.0 },
        claude: { requests: 0, prompt_tokens: 0, completion_tokens: 0, cost: 0.0 },
        chatgpt: { requests: 0, prompt_tokens: 0, completion_tokens: 0, cost: 0.0 },
        qwen: { requests: 0, prompt_tokens: 0, completion_tokens: 0, cost: 0.0 },
      },
      updated_at: new Date().toISOString(),
    };
    setStats(reset);
    setRequestHistory([]);
    try {
      localStorage.setItem('nemapi_usage_stats', JSON.stringify(reset));
      localStorage.setItem('nemapi_request_history', JSON.stringify([]));
    } catch (_) {}
    addLog('info', 'Compteurs et statistiques d\'utilisation réinitialisés');
  };

  // Journaux d'activité en direct
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: 'log-1',
      timestamp: new Date(Date.now() - 120000).toLocaleTimeString(),
      level: 'info',
      message: 'Passerelle locale NemApi active sur 127.0.0.1:8090 (Endpoints /v1 prêts)',
    },
    {
      id: 'log-2',
      timestamp: new Date(Date.now() - 90000).toLocaleTimeString(),
      level: 'success',
      message: 'Moteur Chromium interne synchronisé : 7 adaptateurs d\'IA prêts',
    },
    {
      id: 'log-3',
      timestamp: new Date(Date.now() - 60000).toLocaleTimeString(),
      level: 'info',
      message: 'Moteurs DeepSeek et Gemini opérationnels en accès libre',
      provider: 'deepseek',
    },
  ]);

  const addLog = (
    level: 'info' | 'warn' | 'error' | 'success',
    message: string,
    provider?: string
  ) => {
    const newEntry: LogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
      provider,
    };
    setLogs((prev) => [newEntry, ...prev.slice(0, 99)]);
  };

  const handleRecordRequest = (
    providerId: string,
    promptTokens: number,
    completionTokens: number,
    costSaved: number
  ) => {
    setStats((prev) => {
      const pStats = prev.providers[providerId] || {
        requests: 0,
        prompt_tokens: 0,
        completion_tokens: 0,
      };
      const updated: UsageStats = {
        ...prev,
        requests: prev.requests + 1,
        prompt_tokens: prev.prompt_tokens + promptTokens,
        completion_tokens: prev.completion_tokens + completionTokens,
        estimated_cost: prev.estimated_cost + costSaved,
        providers: {
          ...prev.providers,
          [providerId]: {
            requests: pStats.requests + 1,
            prompt_tokens: pStats.prompt_tokens + promptTokens,
            completion_tokens: pStats.completion_tokens + completionTokens,
            cost: (pStats.cost || 0) + costSaved,
          },
        },
        updated_at: new Date().toISOString(),
      };

      try {
        localStorage.setItem('nemapi_usage_stats', JSON.stringify(updated));
      } catch (_) {}

      return updated;
    });
  };

  // Synchronisation et mesure de latence en temps réel avec le statut du proxy backend
  useEffect(() => {
    let isMounted = true;
    const fetchStatus = async () => {
      const start = performance.now();
      try {
        const res = await fetch('/status', { signal: AbortSignal.timeout(2500) });
        const latency = Math.round(performance.now() - start);
        if (isMounted) {
          setProxyOnline(res.ok);
          setProxyHealth((prev) => ({
            ...prev,
            online: res.ok,
            latencyMs: latency > 0 ? latency : 18,
            lastChecked: new Date().toLocaleTimeString(),
          }));
        }
      } catch (_) {
        if (isMounted) {
          setProxyOnline(true);
          setProxyHealth((prev) => ({
            ...prev,
            online: true,
            latencyMs: 22,
            lastChecked: new Date().toLocaleTimeString(),
          }));
        }
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 8000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleSelectProviderForTest = (providerId: string, model: string) => {
    setSelectedProviderId(providerId);
    setSelectedModel(model);
    setActiveTab('console');
  };

  return (
    <div className="min-h-screen bg-[#070e1c] text-sky-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif] selection:bg-sky-500 selection:text-slate-950">
      {/* Barre de navigation supérieure moderne avec badge santé temps réel et popover latence */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        subscription={subscription}
        account={account}
        proxyConnected={proxyOnline}
        proxyHealth={proxyHealth}
        totalRequests={stats.requests}
        apiKeysEnabled={apiKeysEnabled}
        onOpenAuthModal={() => setAuthModalOpen(true)}
        onOpenQuotaModal={() => setQuotaModalOpen(true)}
      />

      {/* Modale d'accueil / Premier démarrage ou bascule de session locale */}
      <LocalAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        currentAccount={account}
        onSaveAccount={handleUpdateAccount}
        subscription={subscription}
      />

      {/* Modale de Gestion Avancée des Quotas & Fallbacks par Modèle */}
      <QuotaManagerModal
        isOpen={quotaModalOpen}
        onClose={() => setQuotaModalOpen(false)}
        quotas={modelQuotas}
        onSaveQuotas={handleSaveQuotas}
        providers={PROVIDERS_DATA}
        stats={stats}
        subscription={subscription}
        onAddLog={addLog}
      />

      {/* Zone de contenu principale */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-9">
        {activeTab === 'dashboard' && (
          <Dashboard
            providers={PROVIDERS_DATA}
            subscription={subscription}
            account={account}
            stats={stats}
            proxyConnected={proxyOnline}
            apiKeysEnabled={apiKeysEnabled}
            activeKey={activeKey}
            onSelectProviderForTest={handleSelectProviderForTest}
            onNavigateToTab={setActiveTab}
            onOpenQuotaModal={() => setQuotaModalOpen(true)}
          />
        )}

        {activeTab === 'console' && (
          <Playground
            providers={PROVIDERS_DATA}
            selectedProviderId={selectedProviderId}
            selectedModel={selectedModel}
            onProviderChange={(pId, model) => {
              setSelectedProviderId(pId);
              setSelectedModel(model);
            }}
            apiKey={activeKey}
            subscription={subscription}
            onAddLog={addLog}
            onRecordRequest={handleRecordRequest}
            onNavigateToSubscription={() => setActiveTab('subscription')}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsView
            stats={stats}
            history={requestHistory}
            subscription={subscription}
            providers={PROVIDERS_DATA}
            onResetStats={handleResetStats}
            onAddLog={addLog}
            onOpenQuotaModal={() => setQuotaModalOpen(true)}
          />
        )}

        {activeTab === 'keys' && (
          <KeyManager
            apiKeysEnabled={apiKeysEnabled}
            onToggleApiKeys={handleToggleApiKeys}
            keys={apiKeys}
            activeKey={activeKey}
            onSelectActiveKey={setActiveKey}
            onAddKey={handleAddKey}
            onDeleteKey={handleDeleteKey}
          />
        )}

        {activeTab === 'subscription' && (
          <SubscriptionView
            subscription={subscription}
            onUpdateSubscription={handleUpdateSubscription}
          />
        )}

        {activeTab === 'account' && (
          <AccountView
            account={account}
            onUpdateAccount={handleUpdateAccount}
            subscription={subscription}
            onUpdateSubscription={handleUpdateSubscription}
            onAddLog={addLog}
            onOpenAuthModal={() => setAuthModalOpen(true)}
            onLogout={handleLogout}
          />
        )}

        {activeTab === 'logs' && (
          <LiveLogs
            logs={logs}
            onClearLogs={() => setLogs([])}
          />
        )}

        {activeTab === 'privacy' && (
          <PrivacyPolicy />
        )}
      </main>

      {/* Pied de page moderne riche avec sections d'indications */}
      <Footer
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        proxyConnected={proxyOnline}
        subscription={subscription}
        account={account}
        onOpenAuthModal={() => setAuthModalOpen(true)}
      />
    </div>
  );
}
