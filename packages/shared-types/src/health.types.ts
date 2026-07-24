export interface HealthStatusDto { status: string; database?: string; databaseLatencyMs?: number; kafka?: string; uptime?: number; timestamp?: string; }
export interface LivenessStatusDto { status: 'live'; uptime: number; timestamp: string; }
export interface DependencyHealthDto { status: 'connected' | 'unavailable'; latencyMs?: number; }
export interface ReadinessStatusDto { status: 'ready' | 'degraded' | 'unavailable'; ready: boolean; database: DependencyHealthDto; kafka: DependencyHealthDto; uptime: number; timestamp: string; }
