/**
 * UptimeTracker - Tracks API uptime history and incidents
 * 
 * Stores health check results for the past 90 days and automatically
 * detects/records incidents based on consecutive failures.
 */

export type HealthCheckResult = {
  timestamp: number;
  status: 'ok' | 'degraded' | 'down';
  latencyMs: number;
  providersUp: number;
  providersTotal: number;
};

export type UptimeDay = {
  date: string; // YYYY-MM-DD
  checksTotal: number;
  checksOk: number;
  checksDegraded: number;
  checksDown: number;
  avgLatencyMs: number;
  status: 'ok' | 'partial' | 'down';
};

export type Incident = {
  id: string;
  title: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  severity: 'minor' | 'major' | 'critical';
  startedAt: number;
  resolvedAt?: number;
  updates: IncidentUpdate[];
};

export type IncidentUpdate = {
  timestamp: number;
  status: Incident['status'];
  message: string;
};

export type UptimeStats = {
  uptimePercent: number;
  totalChecks: number;
  successfulChecks: number;
  avgLatencyMs: number;
  days: UptimeDay[];
};

const MAX_HISTORY_DAYS = 90;
const MAX_HEALTH_CHECKS_PER_DAY = 2880; // 1 check per 30 seconds
const INCIDENT_THRESHOLD = 3; // Consecutive failures before creating incident

export class UptimeTracker {
  private healthChecks: HealthCheckResult[] = [];
  private incidents: Incident[] = [];
  private consecutiveFailures = 0;
  private currentIncidentId: string | null = null;

  constructor() {
    // Initialize with empty state
  }

  /**
   * Record a health check result
   */
  recordHealthCheck(result: Omit<HealthCheckResult, 'timestamp'>): void {
    const check: HealthCheckResult = {
      ...result,
      timestamp: Date.now(),
    };

    this.healthChecks.push(check);

    // Trim old data (keep last 90 days worth)
    const cutoff = Date.now() - (MAX_HISTORY_DAYS * 24 * 60 * 60 * 1000);
    this.healthChecks = this.healthChecks.filter(c => c.timestamp > cutoff);

    // Also limit total count to prevent memory issues
    if (this.healthChecks.length > MAX_HISTORY_DAYS * MAX_HEALTH_CHECKS_PER_DAY) {
      this.healthChecks = this.healthChecks.slice(-MAX_HISTORY_DAYS * MAX_HEALTH_CHECKS_PER_DAY);
    }

    // Track consecutive failures for incident detection
    if (result.status === 'down') {
      this.consecutiveFailures++;
      
      if (this.consecutiveFailures >= INCIDENT_THRESHOLD && !this.currentIncidentId) {
        // Create new incident
        this.createIncident('API Service Degradation', 'major');
      }
    } else {
      if (this.consecutiveFailures > 0 && this.currentIncidentId) {
        // Resolve current incident
        this.resolveCurrentIncident();
      }
      this.consecutiveFailures = 0;
    }
  }

  /**
   * Create a new incident
   */
  private createIncident(title: string, severity: Incident['severity']): void {
    const id = `inc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const incident: Incident = {
      id,
      title,
      status: 'investigating',
      severity,
      startedAt: Date.now(),
      updates: [{
        timestamp: Date.now(),
        status: 'investigating',
        message: 'We are investigating reports of service issues.',
      }],
    };

    this.incidents.unshift(incident);
    this.currentIncidentId = id;

    // Keep only last 50 incidents
    if (this.incidents.length > 50) {
      this.incidents = this.incidents.slice(0, 50);
    }
  }

  /**
   * Resolve the current active incident
   */
  private resolveCurrentIncident(): void {
    if (!this.currentIncidentId) return;

    const incident = this.incidents.find(i => i.id === this.currentIncidentId);
    if (incident) {
      incident.status = 'resolved';
      incident.resolvedAt = Date.now();
      incident.updates.unshift({
        timestamp: Date.now(),
        status: 'resolved',
        message: 'The issue has been resolved. All systems are operational.',
      });
    }

    this.currentIncidentId = null;
  }

  /**
   * Manually add an incident (for scheduled maintenance, etc.)
   */
  addManualIncident(incident: Omit<Incident, 'id'>): Incident {
    const id = `inc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newIncident: Incident = { ...incident, id };
    this.incidents.unshift(newIncident);
    return newIncident;
  }

  /**
   * Update an existing incident
   */
  updateIncident(id: string, update: IncidentUpdate): boolean {
    const incident = this.incidents.find(i => i.id === id);
    if (!incident) return false;

    incident.updates.unshift(update);
    incident.status = update.status;
    
    if (update.status === 'resolved') {
      incident.resolvedAt = update.timestamp;
      if (this.currentIncidentId === id) {
        this.currentIncidentId = null;
      }
    }

    return true;
  }

  /**
   * Get uptime statistics for the last N days
   */
  getUptimeStats(days: number = 90): UptimeStats {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    const relevantChecks = this.healthChecks.filter(c => c.timestamp > cutoff);

    if (relevantChecks.length === 0) {
      return {
        uptimePercent: 100,
        totalChecks: 0,
        successfulChecks: 0,
        avgLatencyMs: 0,
        days: [],
      };
    }

    // Group by day
    const dayMap = new Map<string, HealthCheckResult[]>();
    
    for (const check of relevantChecks) {
      const dateParts = new Date(check.timestamp).toISOString().split('T');
      const date = dateParts[0] ?? '';
      if (!date) continue;
      const existing = dayMap.get(date) ?? [];
      existing.push(check);
      dayMap.set(date, existing);
    }

    // Build day summaries
    const uptimeDays: UptimeDay[] = [];
    
    // Generate all days in range
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateParts = date.toISOString().split('T');
      const dateStr = dateParts[0] ?? '';
      if (!dateStr) continue;
      const dayChecks = dayMap.get(dateStr) ?? [];

      if (dayChecks.length === 0) {
        // No data for this day - assume ok if we don't have checks yet
        uptimeDays.push({
          date: dateStr,
          checksTotal: 0,
          checksOk: 0,
          checksDegraded: 0,
          checksDown: 0,
          avgLatencyMs: 0,
          status: 'ok', // No data = assumed ok
        });
        continue;
      }

      const checksOk = dayChecks.filter(c => c.status === 'ok').length;
      const checksDegraded = dayChecks.filter(c => c.status === 'degraded').length;
      const checksDown = dayChecks.filter(c => c.status === 'down').length;
      const avgLatencyMs = Math.round(
        dayChecks.reduce((sum, c) => sum + c.latencyMs, 0) / dayChecks.length
      );

      // Determine day status
      const okPercent = (checksOk / dayChecks.length) * 100;
      let status: UptimeDay['status'] = 'ok';
      if (okPercent < 50) {
        status = 'down';
      } else if (okPercent < 99) {
        status = 'partial';
      }

      uptimeDays.push({
        date: dateStr,
        checksTotal: dayChecks.length,
        checksOk,
        checksDegraded,
        checksDown,
        avgLatencyMs,
        status,
      });
    }

    // Calculate overall stats
    const totalChecks = relevantChecks.length;
    const successfulChecks = relevantChecks.filter(c => c.status === 'ok').length;
    const uptimePercent = totalChecks > 0 
      ? Math.round((successfulChecks / totalChecks) * 10000) / 100 
      : 100;
    const avgLatencyMs = totalChecks > 0
      ? Math.round(relevantChecks.reduce((sum, c) => sum + c.latencyMs, 0) / totalChecks)
      : 0;

    return {
      uptimePercent,
      totalChecks,
      successfulChecks,
      avgLatencyMs,
      days: uptimeDays,
    };
  }

  /**
   * Get recent incidents
   */
  getIncidents(limit: number = 10): Incident[] {
    return this.incidents.slice(0, limit);
  }

  /**
   * Get active (unresolved) incidents
   */
  getActiveIncidents(): Incident[] {
    return this.incidents.filter(i => i.status !== 'resolved');
  }

  /**
   * Get current overall status
   */
  getCurrentStatus(): 'operational' | 'degraded' | 'down' {
    const activeIncidents = this.getActiveIncidents();
    
    if (activeIncidents.some(i => i.severity === 'critical')) {
      return 'down';
    }
    
    if (activeIncidents.length > 0) {
      return 'degraded';
    }

    // Check recent health
    const recentChecks = this.healthChecks.slice(-5);
    if (recentChecks.length === 0) {
      return 'operational';
    }

    const downCount = recentChecks.filter(c => c.status === 'down').length;
    if (downCount >= 3) {
      return 'down';
    }
    
    if (downCount >= 1 || recentChecks.some(c => c.status === 'degraded')) {
      return 'degraded';
    }

    return 'operational';
  }
}

// Singleton instance
let uptimeTrackerInstance: UptimeTracker | null = null;

export function getUptimeTracker(): UptimeTracker {
  if (!uptimeTrackerInstance) {
    uptimeTrackerInstance = new UptimeTracker();
  }
  return uptimeTrackerInstance;
}

export function createUptimeTracker(): UptimeTracker {
  return new UptimeTracker();
}
