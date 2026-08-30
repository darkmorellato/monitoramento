// ═══════════════════════════════════════════════════════════════
// TYPES - Strict Mode Compliant
// ═══════════════════════════════════════════════════════════════

/**
 * Entrada de log de preço
 * Representa um registro de preço capturado via OCR ou entrada manual
 */
export interface LogEntry {
  /** Identificador único do registro */
  id: number;
  /** Data no formato YYYY-MM-DD */
  date: string;
  /** Hora no formato HH:MM */
  time: string;
  /** Valor total em reais */
  total: number;
  /** Avaliação de 1-5 ou null se não avaliado */
  rating: number | null;
  /** Diferença em reais em relação à regressão */
  diff: number;
  /** Percentual de diferença */
  pct: number;
  /** Notas adicionais */
  notes: string;
  /** Imagem em base64 (null se não houver) */
  image: string | null;
  /** URL da imagem no Firebase Storage */
  imageUrl: string | null;
}

/**
 * Representação de uma loja/cadeia varejista
 */
export interface Store {
  /** Identificador único */
  id: string;
  /** Nome exibido */
  name: string;
  /** URL do logo ou emoji */
  logo: string;
  /** Cor tema em formato CSS */
  color: string;
}

/**
 * Status de saúde baseado em métricas calculadas
 */
export interface HealthStatus {
  /** Texto descritivo do status */
  label: string;
  /** Emoji representativo */
  icon: string;
  /** Classe CSS para estilização */
  cls: 'health-good' | 'health-warning' | 'health-bad' | 'health-neutral';
}

/**
 * Indicador-chave de performance
 */
export interface KPI {
  /** Rótulo descritivo */
  label: string;
  /** Valor formatado para exibição */
  value: string;
  /** Subtítulo contextual */
  sub: string;
  /** Ícone/emoji */
  icon: string;
}

/**
 * Tipo de insight gerado pela análise
 */
export type InsightType = 'drop' | 'gain' | 'neutral' | 'warn';

/**
 * Insight sobre tendência de preço
 */
export interface Insight {
  /** Tipo de insight */
  type: InsightType;
  /** Texto descritivo */
  text: string;
}

/**
 * Resultado de regressão linear
 */
export interface Regression {
  /** Coeficiente angular (inclinação) */
  slope: number;
  /** Intercepto */
  intercept: number;
  /** Coeficiente de determinação R² */
  r2: number;
}

/**
 * Configuração do Firebase
 */
export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId: string;
}

/**
 * Configuração de rate limiting
 */
export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

/**
 * Entrada de log de auditoria
 */
export interface AuditLogEntry {
  timestamp: number;
  action: string;
  storeName?: string;
  recordId?: string | number;
  details?: Record<string, unknown>;
  userAgent: string;
}

/**
 * Dados extraídos via OCR
 */
export interface OCRResult {
  /** Valor total extraído */
  total: number | null;
  /** Data extraída (YYYY-MM-DD) */
  date: string | null;
  /** Hora extraída (HH:MM) */
  time: string | null;
  /** Confiança geral (0-100) */
  confidence: number;
  /** Campos individuais detectados */
  fields: OCRField[];
  /** Texto bruto do OCR */
  rawText: string;
}

/**
 * Campo detectado no OCR
 */
export interface OCRField {
  /** Tipo do campo */
  type: 'total' | 'date' | 'time' | 'currency' | 'unknown';
  /** Valor extraído */
  value: string;
  /** Posição no texto (índice) */
  position: number;
  /** Confiança específica (0-100) */
  confidence: number;
}

/**
 * Estado da aplicação
 */
export interface AppState {
  /** Loja atualmente selecionada */
  currentStore: Store | null;
  /** Lista de registros */
  logs: LogEntry[];
  /** Flag de carregamento */
  isLoading: boolean;
  /** Mensagem de erro atual */
  error: string | null;
}

/**
 * Configuração de toast/notification
 */
export interface ToastConfig {
  /** Mensagem a exibir */
  message: string;
  /** Tipo de toast */
  type: 'success' | 'error' | 'warning' | 'info';
  /** Duração em ms */
  duration?: number;
}

/**
 * Opções de exportação
 */
export interface ExportOptions {
  /** Formato do arquivo */
  format: 'csv' | 'pdf';
  /** Período a exportar (dias) */
  period?: number;
  /** Incluir imagens */
  includeImages?: boolean;
}

/**
 * Configuração de estratégia OCR por loja
 */
export interface OCRStrategy {
  /** Nome da loja */
  storeName: string;
  /** Padrões regex específicos */
  patterns: {
    total: RegExp[];
    date: RegExp[];
    time: RegExp[];
  };
  /** Palavras-chave para identificação */
  keywords: string[];
  /** Normalização específica */
  normalize: (text: string) => string;
}

/**
 * Erro tipado da aplicação
 */
export class AppError extends Error {
  /** Código do erro */
  code: string;
  /** Dados adicionais */
  data?: Record<string, unknown>;

  constructor(message: string, code: string, data?: Record<string, unknown>) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.data = data;
  }
}

/**
 * Resultado de operação async
 */
export type Result<T, E = AppError> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Função de validação
 */
export type Validator<T> = (value: unknown) => value is T;

/**
 * Predicado tipado
 */
export type Predicate<T> = (value: T) => boolean;

/**
 * Comparador para ordenação
 */
export type Comparator<T> = (a: T, b: T) => number;

/**
 * Handler de evento tipado
 */
export type EventHandler<T = void> = (payload: T) => void | Promise<void>;

/**
 * Unsubscriber para eventos
 */
export type Unsubscribe = () => void;

// ═══════════════════════════════════════════════════════════════
// TYPE GUARDS
// ═══════════════════════════════════════════════════════════════

/**
 * Verifica se é um LogEntry válido
 */
export function isLogEntry(value: unknown): value is LogEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof (value as LogEntry).id === 'number' &&
    'date' in value &&
    typeof (value as LogEntry).date === 'string' &&
    'total' in value &&
    typeof (value as LogEntry).total === 'number'
  );
}

/**
 * Verifica se é um Store válido
 */
export function isStore(value: unknown): value is Store {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    typeof (value as Store).id === 'string' &&
    'name' in value &&
    typeof (value as Store).name === 'string'
  );
}

/**
 * Verifica se é um OCRResult válido
 */
export function isOCRResult(value: unknown): value is OCRResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'total' in value &&
    'date' in value &&
    'confidence' in value &&
    typeof (value as OCRResult).confidence === 'number'
  );
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

/** Formatos de data aceitos */
export const DATE_FORMATS = ['YYYY-MM-DD', 'DD/MM/YYYY', 'MM/DD/YYYY'] as const;

/** Formatos de hora aceitos */
export const TIME_FORMATS = ['HH:MM', 'HH:MM:SS'] as const;

/** Limites de validação */
export const VALIDATION_LIMITS = {
  MAX_TOTAL: 100000,
  MIN_TOTAL: 0,
  MAX_RATING: 5,
  MIN_RATING: 1,
} as const;

/** Configurações de OCR */
export const OCR_CONFIG = {
  MIN_CONFIDENCE: 60,
  MAX_RETRIES: 3,
  TIMEOUT_MS: 30000,
} as const;
