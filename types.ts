export interface LogEntry {
  id: number;
  date: string; // formato YYYY-MM-DD
  time: string; // formato HH:MM
  total: number;
  rating: number | null;
  diff: number;
  pct: number;
  notes: string;
  image: string | null; // base64
  imageUrl?: string | null; // URL do Firestore (opcional)
}

export interface Store {
  id: string;
  name: string;
  logo: string;
  color: string;
}

export interface HealthStatus {
  label: string;
  icon: string;
  cls: string;
}

export interface KPI {
  label: string;
  value: string;
  sub: string;
  icon: string;
}

export interface Insight {
  type: 'drop' | 'gain' | 'neutral' | 'warn';
  text: string;
}

export interface Regression {
  slope: number;
  intercept: number;
}
