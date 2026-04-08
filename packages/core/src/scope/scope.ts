/**
 * Scope Limiter
 * Per-agent read/write boundaries for safe multi-agent operation
 */

import type { Operation, AgentScope } from '../types.js';

export class ScopeLimiter {
  /**
   * Check if an operation is allowed within a given scope
   */
  enforce(operation: Operation, scope: AgentScope): { allowed: boolean; reason?: string } {
    switch (operation.type) {
      case 'create':
        return this.enforceCreate(operation.event.summary, scope);
      case 'update':
        return this.enforceUpdate(operation.uid, scope);
      case 'delete':
        return this.enforceDelete(operation.uid, scope);
      default:
        return { allowed: false, reason: 'Unknown operation type' };
    }
  }

  private enforceCreate(summary: string, scope: AgentScope): { allowed: boolean; reason?: string } {
    if (scope.maxEventsPerWrite === 0) {
      return { allowed: false, reason: `Agent ${scope.agentId} has no write permissions` };
    }
    return { allowed: true };
  }

  private enforceUpdate(uid: string, scope: AgentScope): { allowed: boolean; reason?: string } {
    // For now, allow update to any event if agent has write paths
    if (scope.writePaths.length === 0) {
      return { allowed: false, reason: `Agent ${scope.agentId} has no write permissions` };
    }
    return { allowed: true };
  }

  private enforceDelete(uid: string, scope: AgentScope): { allowed: boolean; reason?: string } {
    if (scope.writePaths.length === 0) {
      return { allowed: false, reason: `Agent ${scope.agentId} has no write permissions` };
    }
    return { allowed: true };
  }

  /**
   * Check if a file path is readable by this scope
   */
  canRead(path: string, scope: AgentScope): boolean {
    if (scope.readPaths.length === 0) return false;
    return scope.readPaths.some(pattern => this.matchesPattern(path, pattern));
  }

  /**
   * Check if a file path is writable by this scope
   */
  canWrite(path: string, scope: AgentScope): boolean {
    if (scope.writePaths.length === 0) return false;
    return scope.writePaths.some(pattern => this.matchesPattern(path, pattern));
  }

  /**
   * Simple glob pattern matching (supports * and **)
   */
  private matchesPattern(path: string, pattern: string): boolean {
    // Convert glob to regex
    const regexPattern = pattern
      .replace(/\./g, '\\.')
      .replace(/\*\*/g, '{{DOUBLE_STAR}}')
      .replace(/\*/g, '[^/]*')
      .replace(/\{\{DOUBLE_STAR\}\}/g, '.*');

    try {
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(path);
    } catch {
      return false;
    }
  }

  /**
   * Create a default scope for a single-agent use case
   */
  static defaultScope(agentId: string): AgentScope {
    return {
      agentId,
      readPaths: ['**/*.ics'],
      writePaths: ['**/*.ics'],
      maxEventsPerWrite: 100,
    };
  }
}
