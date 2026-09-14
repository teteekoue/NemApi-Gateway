import React, { useState } from 'react';
import {
  Menu,
  X,
  LayoutDashboard,
  Terminal,
  KeyRound,
  CreditCard,
  User,
  ScrollText,
  ShieldCheck,
  Radio,
  ChevronRight,
  SlidersHorizontal,
  ExternalLink,
  Laptop,
  BarChart3,
  ShieldAlert,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { SubscriptionState, UserAccount, ProxyHealthStatus } from '../types';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  subscription: SubscriptionState;
  account: UserAccount;
  proxyConnected: boolean;
  proxyHealth?: ProxyHealthStatus;
  totalRequests: number;
  apiKeysEnabled: boolean;
  onOpenAuthModal: () => void;
  onOpenQuotaModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  subscription,
  account,
  proxyConnected,
  proxyHealth,
  totalRequests,
  apiKeysEnabled,
  onOpenAuthModal,
  onOpenQuotaModal,
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showHealthTooltip, setShowHealthTooltip] = useState(false);

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      desc: 'Vue d\'ensemble, métriques & moteurs IA',
      icon: LayoutDashboard,
    },
    {
      id: 'console',
      label: 'Console Interactive',
      desc: 'Tests en direct & analyse latence',
      icon: Terminal,
    },
    {
      id: 'analytics',
      label: 'Statistiques & Coûts',
      desc: 'Analyse des tokens, latence et économies',
      icon: BarChart3,
    },
    {
      id: 'keys',
      label: 'Clés API Gateway',
      desc: 'Gestion des tokens d\'accès',
      icon: KeyRound,
    },
    {
      id: 'subscription',
      label: 'Abonnements & Licences',
      desc: 'Activation des clés Pro & Lifetime',
      icon: CreditCard,
    },
    {
      id: 'logs',
      label: 'Journaux Système',
      desc: 'Trafic et télémétrie locale en temps réel',
      icon: ScrollText,
    },
    {
      id: 'privacy',
      label: 'Confidentialité',
      desc: 'Politique 100% locale sans cloud',
      icon: ShieldCheck,
    },
  ];

  const handleSelectTab = (tabId: string) => {
    setActiveTab(tabId);
    setDrawerOpen(false);
  };

  const isPremium = subscription.plan !== 'free';

  return (
    <>
      {/* Barre de navigation supérieure moderne */}
      <header className="sticky top-0 z-30 border-b border-sky-800/40 bg-[#071124]/90 backdrop-blur-xl shadow-lg shadow-sky-950/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between gap-4">
          {/* Gauche : Bouton Hamburger moderne & Logo NemApi */}
          <div className="flex items-center gap-3.5">
            <button
              onClick={() => setDrawerOpen(true)}
              className="p-2.5 rounded-2xl border border-sky-700/50 bg-[#091730] hover:bg-sky-900/60 hover:border-sky-500/60 text-sky-200 hover:text-white transition-all duration-200 flex items-center justify-center cursor-pointer shadow-md shadow-sky-950/40 group"
              aria-label="Ouvrir le menu de navigation"
              title="Menu principal"
            >
              <SlidersHorizontal className="w-5 h-5 text-sky-300 group-hover:scale-110 transition-transform" />
            </button>

            <div
              className="flex items-center gap-3 cursor-pointer select-none group"
              onClick={() => setActiveTab('dashboard')}
            >
              <div className="relative">
                <img
                  src="/logo.svg"
                  alt="NemApi Logo"
                  className="w-9 h-9 rounded-2xl shadow-md border border-sky-500/40 bg-[#0b1b36] p-0.5 group-hover:border-sky-400 transition-all duration-300 group-hover:shadow-sky-500/20 group-hover:shadow-lg"
                />
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#071124]" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-white tracking-tight text-lg bg-gradient-to-r from-white via-sky-100 to-sky-300 bg-clip-text text-transparent">
                    NemApi
                  </span>
                </div>
                <span className="text-[11px] text-sky-300/70 hidden sm:inline font-medium">
                  Passerelle IA Locale • 8 Moteurs
                </span>
              </div>
            </div>
          </div>

          {/* Navigation directe desktop (barre d'onglets épurée) */}
          <nav className="hidden xl:flex items-center gap-1.5 p-1 rounded-2xl bg-[#09152b]/80 border border-sky-800/40">
            {navItems.slice(0, 5).map((item) => {
              const isActive = activeTab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 flex items-center gap-2 cursor-pointer ${
                    isActive
                      ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/25 font-bold'
                      : 'text-sky-200/80 hover:text-white hover:bg-sky-900/40'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-slate-950' : 'text-sky-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Droite : Statut Port Interactif, Bouton Quotas, Compte Utilisateur & Licence */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Statut Passerelle Locale 8090 Interactif */}
            <div className="relative">
              <button
                onClick={() => setShowHealthTooltip(!showHealthTooltip)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-2xl border text-xs shadow-inner cursor-pointer transition-all duration-200 ${
                  proxyConnected
                    ? 'border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300'
                    : 'border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300'
                }`}
                title="Cliquer pour afficher les détails de connectivité du proxy"
              >
                <span className="relative flex h-2 w-2">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                      proxyConnected ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}
                  />
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 ${
                      proxyConnected ? 'bg-emerald-400' : 'bg-amber-400'
                    }`}
                  />
                </span>
                <span className="font-mono text-[11px] font-bold">
                  {proxyConnected ? '127.0.0.1:8090' : 'Proxy Arrêté'}
                </span>
                {proxyHealth && proxyConnected && (
                  <span className="hidden lg:inline text-[10px] font-mono text-emerald-400/80 bg-emerald-950/60 px-1.5 py-0.2 rounded">
                    {proxyHealth.latencyMs}ms
                  </span>
                )}
              </button>

              {/* Popover Détails Santé Proxy */}
              {showHealthTooltip && (
                <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl bg-[#0a1832] border border-sky-600/40 p-3.5 shadow-2xl shadow-sky-950/90 z-50 animate-in fade-in zoom-in-95 duration-150 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-sky-800/40">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      {proxyConnected ? <Wifi className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5 text-amber-400" />}
                      <span>Statut Pont Local</span>
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        proxyConnected ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {proxyConnected ? 'Opérationnel' : 'Non détecté'}
                    </span>
                  </div>

                  <div className="py-2.5 space-y-1.5 font-mono text-[11px] text-sky-200">
                    <div className="flex justify-between">
                      <span className="text-sky-400/70">Adresse :</span>
                      <span>127.0.0.1:8090</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sky-400/70">Latence ping :</span>
                      <span className="text-emerald-300 font-bold">{proxyHealth?.latencyMs || 28} ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sky-400/70">Navigateur :</span>
                      <span>Chromium Intégré</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sky-400/70">Moteurs IA :</span>
                      <span>7 Connecteurs Actifs</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-sky-800/40 text-[10px] text-sky-300/70">
                    {proxyConnected
                      ? 'Toutes les requêtes de vos IDE (Cursor, Cline, Python) sont acheminées à haute vitesse.'
                      : 'Le proxy démarre automatiquement avec votre binaire embarqué.'}
                  </div>
                </div>
              )}
            </div>

            {/* Bouton Quotas & Fallbacks */}
            {onOpenQuotaModal && (
              <button
                onClick={onOpenQuotaModal}
                className="p-2 sm:px-3 sm:py-1.5 rounded-2xl border border-sky-700/50 bg-[#09152b] hover:bg-sky-900/60 hover:border-sky-500/60 text-sky-300 hover:text-white transition-all duration-200 flex items-center gap-1.5 cursor-pointer shadow-sm text-xs font-bold"
                title="Gérer les quotas & alertes par modèle"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Quotas & Fallback</span>
              </button>
            )}

            {/* Raccourci Profil Compte avec Avatar */}
            <button
              onClick={() => setActiveTab('account')}
              className={`flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-2xl border text-xs font-semibold transition-all duration-200 cursor-pointer shadow-sm ${
                activeTab === 'account'
                  ? 'border-sky-400 bg-sky-500/25 text-white shadow-sky-500/20 shadow-md'
                  : 'border-sky-700/50 bg-[#09152b] text-sky-200 hover:border-sky-500/60 hover:bg-[#0c1c38]'
              }`}
              title="Gérer mon compte & licences"
            >
              <div className="w-6 h-6 rounded-xl bg-gradient-to-br from-sky-400 to-cyan-400 text-slate-950 flex items-center justify-center text-[11px] font-extrabold shadow-sm">
                {(account.name.trim() || 'U')[0].toUpperCase()}
              </div>
              <div className="hidden md:flex flex-col text-left">
                <span className="text-xs font-bold text-white max-w-[110px] truncate leading-tight">
                  {account.name.trim() || 'Mon Compte'}
                </span>
                <span className="text-[9px] text-sky-300/70 uppercase tracking-wider font-semibold">
                  Local
                </span>
              </div>
            </button>

            {/* Badge Abonnement & Licence */}
            <button
              onClick={() => setActiveTab('subscription')}
              className={`px-3 py-1.5 rounded-2xl text-xs font-bold border transition-all duration-200 flex items-center gap-1.5 cursor-pointer shadow-sm ${
                isPremium
                  ? 'border-amber-400/40 bg-gradient-to-r from-amber-400/15 to-amber-500/10 text-amber-300 hover:border-amber-400/70 shadow-amber-400/10'
                  : 'border-sky-700/50 bg-[#09152b] text-sky-300 hover:bg-sky-900/60'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>{subscription.plan_name}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Barre de navigation latérale moderne (Drawer / Sidebar rétractable) */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* Voile d'obscurcissement flouté avec dégradé bleu ciel */}
          <div
            className="fixed inset-0 bg-[#040914]/85 backdrop-blur-md transition-opacity duration-300"
            onClick={() => setDrawerOpen(false)}
          />

          {/* Tiroir de navigation latéral moderne aux coins adoucis */}
          <div className="relative w-84 max-w-[88vw] bg-gradient-to-b from-[#09152b] to-[#060e1f] border-r border-sky-700/40 flex flex-col h-full z-10 shadow-2xl shadow-sky-950 animate-in slide-in-from-left duration-250">
            {/* Haut de la sidebar : Logo & Bouton Fermer */}
            <div className="p-5 border-b border-sky-800/40 bg-[#071124]/90 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src="/logo.svg"
                  alt="NemApi Logo"
                  className="w-8 h-8 rounded-2xl border border-sky-500/40 bg-[#0a1832] p-0.5 shadow-md"
                />
                <div>
                  <h3 className="font-extrabold text-white text-sm tracking-tight flex items-center gap-1.5">
                    <span>NemApi</span>
                  </h3>
                  <p className="text-[11px] text-sky-300/70">Panneau de Contrôle Local</p>
                </div>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="p-2 rounded-xl text-sky-300 hover:text-white hover:bg-sky-800/40 transition-colors cursor-pointer"
                aria-label="Fermer le menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Corps du menu : Liste des onglets avec icônes et descriptions */}
            <div className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
              <div className="px-3 pb-2 text-[10px] font-bold text-sky-400 uppercase tracking-wider flex items-center justify-between">
                <span>Modules Passerelle</span>
                <span className="font-mono text-[9px] text-sky-400/60">Local</span>
              </div>

              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    id={`drawer-nav-${item.id}`}
                    onClick={() => handleSelectTab(item.id)}
                    className={`w-full text-left p-3 rounded-2xl transition-all duration-150 flex items-center gap-3 cursor-pointer group ${
                      isActive
                        ? 'bg-gradient-to-r from-sky-500 to-cyan-500 text-slate-950 font-bold shadow-lg shadow-sky-500/25'
                        : 'text-sky-200/80 hover:text-white hover:bg-[#0c1c38] border border-transparent hover:border-sky-800/40'
                    }`}
                  >
                    <div
                      className={`p-2 rounded-xl flex items-center justify-center shrink-0 ${
                        isActive
                          ? 'bg-slate-950/20 text-slate-950'
                          : 'bg-sky-950/60 text-sky-400 group-hover:bg-sky-900/60 group-hover:text-white border border-sky-800/40'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold leading-tight truncate">
                        {item.label}
                      </div>
                      <div
                        className={`text-[10px] truncate mt-0.5 ${
                          isActive ? 'text-slate-950/80 font-medium' : 'text-sky-300/60'
                        }`}
                      >
                        {item.desc}
                      </div>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 shrink-0 transition-transform ${
                        isActive
                          ? 'text-slate-950 translate-x-0.5'
                          : 'text-sky-500/40 group-hover:text-sky-300 group-hover:translate-x-0.5'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {/* ONGLET COMPTE ANCRÉ EN BAS (Strictement en bas de la navigation avec icône et statut) */}
            <div className="mt-auto p-4 border-t border-sky-800/50 bg-[#071124] space-y-3">
              {/* Carte profil utilisateur moderne en bas de la sidebar */}
              <div
                onClick={() => handleSelectTab('account')}
                className={`p-3.5 rounded-2xl border transition-all duration-200 flex items-center justify-between cursor-pointer group ${
                  activeTab === 'account'
                    ? 'border-sky-400 bg-sky-500/20 shadow-md shadow-sky-500/20'
                    : 'border-sky-800/50 bg-[#09152b] hover:border-sky-600/60 hover:bg-[#0c1c38]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-400 to-cyan-500 text-slate-950 font-extrabold text-sm flex items-center justify-center shadow-md">
                      {(account.name.trim() || 'U')[0].toUpperCase()}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#071124]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-bold text-white truncate">
                        {account.name.trim() || 'Utilisateur Local'}
                      </p>
                    </div>
                    <p className="text-[10px] text-sky-300/70 truncate flex items-center gap-1 mt-0.5">
                      <User className="w-3 h-3 text-sky-400" />
                      <span>Compte & Licences</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-sky-400 group-hover:text-sky-200">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/20 border border-sky-400/30">
                    {subscription.plan === 'free' ? 'Free' : 'Pro'}
                  </span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              {/* Bouton secondaire pour basculer de profil local */}
              <div className="flex items-center justify-between px-1 text-[11px] text-sky-400/80">
                <button
                  onClick={() => {
                    setDrawerOpen(false);
                    onOpenAuthModal();
                  }}
                  className="hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 py-1"
                >
                  <Laptop className="w-3.5 h-3.5 text-sky-400" />
                  <span>Changer d'utilisateur local</span>
                </button>
                <span className="font-mono text-[10px] text-sky-300/60">
                  {proxyConnected ? '8090 ACTIF' : '8090 STOP'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
