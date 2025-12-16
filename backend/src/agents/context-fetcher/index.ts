/**
 * Context Fetcher Agent
 * Database Intelligence Specialist for Multi-Claude 3.0
 *
 * Executes read-only queries to gather context and intelligence
 * about system state, agent history, and patterns.
 */

import { db } from '../../database/index.js';

/**
 * Context fetch request interface
 */
export interface ContextFetchRequest {
  requestType: 'context_fetch';
  sessionId: string;
  eventDetails?: {
    eventType: string;
    timestamp: string;
    payload: any;
  };
  investigationScope?: string[];
}

/**
 * Context fetch response interface
 */
export interface ContextFetchResponse {
  investigationId: string;
  timestamp: string;
  sessionId: string;
  findings: {
    sessionOverview?: any;
    eventSummary?: any;
    taskSummary?: any;
    fileActivity?: any;
    patterns?: any;
  };
  summary: string;
  recommendations: string[];
}

/**
 * Context Fetcher Agent
 */
export class ContextFetcher {
  /**
   * Fetch context for a given session
   */
  async fetchContext(request: ContextFetchRequest): Promise<ContextFetchResponse> {
    console.log(`[ContextFetcher] Starting investigation for session ${request.sessionId}`);

    const investigationId = `inv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const findings: any = {};

    try {
      // Step 1: Get session overview
      if (!request.investigationScope || request.investigationScope.includes('session')) {
        findings.sessionOverview = await this.getSessionOverview(request.sessionId);
      }

      // Step 2: Get event summary
      if (!request.investigationScope || request.investigationScope.includes('events')) {
        findings.eventSummary = await this.getEventSummary(request.sessionId);
      }

      // Step 3: Get task summary
      if (!request.investigationScope || request.investigationScope.includes('tasks')) {
        findings.taskSummary = await this.getTaskSummary(request.sessionId);
      }

      // Step 4: Get file activity
      if (!request.investigationScope || request.investigationScope.includes('files')) {
        findings.fileActivity = await this.getFileActivity(request.sessionId);
      }

      // Step 5: Detect patterns
      findings.patterns = await this.detectPatterns(request.sessionId, findings);

      // Generate summary and recommendations
      const summary = this.generateSummary(findings);
      const recommendations = this.generateRecommendations(findings);

      const response: ContextFetchResponse = {
        investigationId,
        timestamp: new Date().toISOString(),
        sessionId: request.sessionId,
        findings,
        summary,
        recommendations,
      };

      console.log(`[ContextFetcher] Investigation complete: ${investigationId}`);
      return response;
    } catch (error) {
      console.error(`[ContextFetcher] Error during investigation:`, error);
      throw error;
    }
  }

  /**
   * Get session overview
   */
  private async getSessionOverview(sessionId: string): Promise<any> {
    const result = await query(
      `SELECT session_id, agent_name, agent_type, status, started_at, completed_at,
              duration_ms, metadata, configuration
       FROM agent_sessions
       WHERE session_id = $1`,
      [sessionId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const session = result.rows[0];
    return {
      agentName: session.agent_name,
      agentType: session.agent_type,
      status: session.status,
      duration: session.duration_ms ? `${session.duration_ms}ms` : 'ongoing',
      startedAt: session.started_at,
      completedAt: session.completed_at,
      metadata: session.metadata,
    };
  }

  /**
   * Get event summary
   */
  private async getEventSummary(sessionId: string): Promise<any> {
    const result = await query(
      `SELECT
         COUNT(*) as total_events,
         COUNT(CASE WHEN status = 'failed' THEN 1 END) as error_count,
         COUNT(CASE WHEN status = 'processed' THEN 1 END) as processed_count,
         array_agg(DISTINCT event_type) as event_types
       FROM agent_events
       WHERE session_id = $1`,
      [sessionId]
    );

    const recentEvents = await query(
      `SELECT event_type, status, timestamp, payload
       FROM agent_events
       WHERE session_id = $1
       ORDER BY timestamp DESC
       LIMIT 10`,
      [sessionId]
    );

    return {
      totalEvents: parseInt(result.rows[0].total_events),
      errorCount: parseInt(result.rows[0].error_count),
      processedCount: parseInt(result.rows[0].processed_count),
      eventTypes: result.rows[0].event_types,
      recentEvents: recentEvents.rows,
    };
  }

  /**
   * Get task summary
   */
  private async getTaskSummary(sessionId: string): Promise<any> {
    const result = await query(
      `SELECT
         COUNT(*) as total_tasks,
         COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
         COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
         COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
         COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending
       FROM agent_tasks
       WHERE session_id = $1`,
      [sessionId]
    );

    const recentTasks = await query(
      `SELECT task_name, status, created_at, completed_at
       FROM agent_tasks
       WHERE session_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [sessionId]
    );

    return {
      totalTasks: parseInt(result.rows[0].total_tasks),
      completed: parseInt(result.rows[0].completed),
      failed: parseInt(result.rows[0].failed),
      inProgress: parseInt(result.rows[0].in_progress),
      pending: parseInt(result.rows[0].pending),
      recentTasks: recentTasks.rows,
    };
  }

  /**
   * Get file activity
   */
  private async getFileActivity(sessionId: string): Promise<any> {
    const result = await query(
      `SELECT
         COUNT(DISTINCT file_path) as files_modified,
         COUNT(*) as total_operations,
         array_agg(DISTINCT operation_type) as operation_types
       FROM file_operations
       WHERE session_id = $1`,
      [sessionId]
    );

    const recentOps = await query(
      `SELECT file_path, operation_type, timestamp, success
       FROM file_operations
       WHERE session_id = $1
       ORDER BY timestamp DESC
       LIMIT 20`,
      [sessionId]
    );

    return {
      filesModified: parseInt(result.rows[0].files_modified),
      totalOperations: parseInt(result.rows[0].total_operations),
      operationTypes: result.rows[0].operation_types,
      recentOperations: recentOps.rows,
    };
  }

  /**
   * Detect patterns in the data
   */
  private async detectPatterns(sessionId: string, findings: any): Promise<any> {
    const patterns: string[] = [];
    const anomalies: string[] = [];

    // Detect error patterns
    if (findings.eventSummary && findings.eventSummary.errorCount > 3) {
      patterns.push(`High error rate detected: ${findings.eventSummary.errorCount} errors`);
    }

    // Detect task failures
    if (findings.taskSummary && findings.taskSummary.failed > 2) {
      patterns.push(`Multiple task failures: ${findings.taskSummary.failed} failed tasks`);
    }

    // Detect file operation patterns
    if (findings.fileActivity && findings.fileActivity.filesModified > 50) {
      patterns.push(`High file activity: ${findings.fileActivity.filesModified} files modified`);
    }

    // Check for stuck sessions
    if (findings.sessionOverview &&
        findings.sessionOverview.status === 'active' &&
        findings.taskSummary &&
        findings.taskSummary.inProgress === 0 &&
        findings.taskSummary.pending === 0) {
      anomalies.push('Session is active but has no pending or in-progress tasks');
    }

    return {
      detectedPatterns: patterns,
      anomalies,
      relationships: [],
    };
  }

  /**
   * Generate natural language summary
   */
  private generateSummary(findings: any): string {
    const parts: string[] = [];

    if (findings.sessionOverview) {
      parts.push(`Session: ${findings.sessionOverview.agentName} (${findings.sessionOverview.status})`);
      parts.push(`Duration: ${findings.sessionOverview.duration}`);
    }

    if (findings.eventSummary) {
      parts.push(`Events: ${findings.eventSummary.totalEvents} total, ${findings.eventSummary.errorCount} errors`);
    }

    if (findings.taskSummary) {
      parts.push(`Tasks: ${findings.taskSummary.completed}/${findings.taskSummary.totalTasks} completed`);
    }

    if (findings.fileActivity) {
      parts.push(`Files: ${findings.fileActivity.filesModified} files modified`);
    }

    return parts.join(' | ');
  }

  /**
   * Generate recommendations based on findings
   */
  private generateRecommendations(findings: any): string[] {
    const recommendations: string[] = [];

    if (findings.eventSummary && findings.eventSummary.errorCount > 3) {
      recommendations.push('Investigate error patterns to identify root cause');
    }

    if (findings.taskSummary && findings.taskSummary.failed > 0) {
      recommendations.push('Review failed tasks and retry or escalate as needed');
    }

    if (findings.patterns && findings.patterns.anomalies.length > 0) {
      recommendations.push('Address detected anomalies to prevent issues');
    }

    if (recommendations.length === 0) {
      recommendations.push('No critical issues detected, continue monitoring');
    }

    return recommendations;
  }
}

/**
 * Create and export singleton instance
 */
export const contextFetcher = new ContextFetcher();
