export interface ProviderInfo {
  id: string;
  name: string;
  logo: string;
  url: string;
  loginUrl: string;
  canonicalModel: string;
  models: string[];
  aliases: string[];
  badgeColor: string;
  promptPrice: number; // per 1k tokens
  completionPrice: number; // per 1k tokens
  description: string;
  status: 'ready' | 'idle' | 'busy' | 'offline';
  features: string[];
  freeAllowed: boolean;
}

export interface SubscriptionState {
  plan: 'free' | 'premium_annual' | 'premium_lifetime';
  plan_name: string;
  product_key?: string;
  activated_at?: string;
  expires_at?: string;
  user?: string;
  source?: 'local' | 'sheets';
}

export interface UsageStats {
  requests: number;
  prompt_tokens: number;
  completion_tokens: number;
  estimated_cost: number;
  providers: Record<string, { requests: number; prompt_tokens: number; completion_tokens: number; cost?: number }>;
  updated_at: string;
}

export interface ProductKey {
  key: string;
  tier: 'PRO' | 'DEV' | 'FREE' | 'ANNUAL' | 'LIFETIME';
  valid: boolean;
  checksum: string;
  expiresAt: string;
  dailyQuota: number;
  usedToday: number;
  notes?: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
  provider?: string;
  model?: string;
  durationMs?: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatTestResult {
  id: string;
  model: string;
  provider: string;
  content: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  costSaved: number;
  finishReason: string;
  timestamp: string;
  tokensPerSec: number;
  httpStatus: number;
  responseBytes: number;
  systemPrompt?: string;
  userPrompt?: string;
  rawJson?: string;
}

export interface ModelQuotaConfig {
  modelId: string;
  providerId: string;
  dailyLimitTokens: number;
  warnThresholdPercent: number; // e.g. 80 for 80%
  fallbackModelId?: string;
  fallbackProviderId?: string;
  autoFallbackEnabled: boolean;
  rateLimitPerMinute: number;
}

export interface ProxyHealthStatus {
  online: boolean;
  port: number;
  host: string;
  latencyMs: number;
  lastChecked: string;
  uptimeSeconds: number;
  engine: string;
}

export interface UserAssignedLicense {
  key: string;
  plan: 'free' | 'premium_annual' | 'premium_lifetime';
  plan_name: string;
  activatedAt: string;
  expiresAt?: string;
  status: 'active' | 'expired' | 'revoked';
  notes?: string;
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  receiveAnnouncements: boolean;
  registeredAt: string;
  organization?: string;
  assignedLicenses: UserAssignedLicense[];
}
