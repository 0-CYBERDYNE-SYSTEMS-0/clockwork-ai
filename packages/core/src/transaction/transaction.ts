/**
 * Transaction Manager
 * Sequence-numbered transaction log with TTL-based dry-run and rollback support
 */

import type { Event, Operation, TransactionLog, DryRunResult, Conflict, ScopeViolation, AgentScope } from '../types.js';
import { ConflictDetector } from '../conflicts/conflicts.js';
import { ScopeLimiter } from '../scope/scope.js';

export class TransactionManager {
  private transactions = new Map<string, TransactionLog>();
  private seqCounter = 0;
  private defaultTTLMs: number;
  private scopeLimiter: ScopeLimiter;

  constructor(defaultTTLMs: number = 5 * 60 * 1000) {
    this.defaultTTLMs = defaultTTLMs;
    this.scopeLimiter = new ScopeLimiter();
  }

  /**
   * Create a new dry-run transaction, optionally enforcing agent scope
   */
  createDryRun(
    agentId: string,
    operations: Operation[],
    existingEvents: Event[],
    ttlMs?: number,
    scope?: AgentScope,
  ): DryRunResult {
    const id = this.generateId();
    const seq = ++this.seqCounter;
    const now = new Date();
    const ttl = ttlMs ?? this.defaultTTLMs;

    // Enforce scope if provided
    const violations: ScopeViolation[] = [];
    if (scope) {
      for (const op of operations) {
        const result = this.scopeLimiter.enforce(op, scope);
        if (!result.allowed) {
          violations.push({ operation: op, reason: result.reason ?? 'Scope violation' });
        }
      }
    }

    const transaction: TransactionLog = {
      id,
      seq,
      operations,
      status: 'pending',
      createdAt: now,
      expiresAt: new Date(now.getTime() + ttl),
      agentId,
    };

    this.transactions.set(id, transaction);

    // Detect conflicts (only for allowed operations)
    const conflictDetector = new ConflictDetector();
    const allEvents = [...existingEvents];

    const conflicts: Conflict[] = [];

    // Only check conflicts for non-violating operations
    const allowedOps = violations.length > 0
      ? operations.filter(op => !violations.some(v => v.operation === op))
      : operations;

    for (const op of allowedOps) {
      if (op.type === 'create') {
        conflicts.push(...conflictDetector.detectConflictsForNew(
          { start: op.event.start.date, end: op.event.end.date, duration: op.event.duration },
          allEvents,
        ));
      } else if (op.type === 'update') {
        const existing = allEvents.find(e => e.uid === op.uid);
        if (existing) {
          const updated = { ...existing, ...op.patch };
          conflicts.push(...conflictDetector.detectConflictsForNew(
            { start: updated.start.date, end: updated.end.date, duration: updated.duration },
            allEvents.filter(e => e.uid !== op.uid),
          ));
        }
      }
    }

    const hasCriticalConflicts = conflicts.some(c => c.severity === 'critical');
    const canCommit = violations.length === 0 && !hasCriticalConflicts;

    return {
      transactionId: id,
      preview: operations,
      conflicts,
      violations,
      canCommit,
    };
  }

  /**
   * Commit a pending transaction
   */
  commit(transactionId: string): boolean {
    const tx = this.transactions.get(transactionId);
    if (!tx || tx.status !== 'pending') return false;
    if (new Date() > tx.expiresAt) return false;

    tx.status = 'committed';
    return true;
  }

  /**
   * Rollback a pending transaction
   */
  rollback(transactionId: string): boolean {
    const tx = this.transactions.get(transactionId);
    if (!tx || tx.status !== 'pending') return false;

    tx.status = 'rolled_back';
    return true;
  }

  /**
   * Get transaction by ID
   */
  getTransaction(id: string): TransactionLog | undefined {
    return this.transactions.get(id);
  }

  /**
   * Clean up expired transactions
   */
  cleanup(): void {
    const now = new Date();
    for (const [id, tx] of this.transactions) {
      if (tx.status === 'pending' && now > tx.expiresAt) {
        tx.status = 'rolled_back';
      }
    }
  }

  /**
   * Apply committed operations to a calendar
   */
  applyOperations(operations: Operation[], calendar: Event[]): Event[] {
    const result = [...calendar];

    for (const op of operations) {
      switch (op.type) {
        case 'create':
          result.push(op.event);
          break;
        case 'update': {
          const idx = result.findIndex(e => e.uid === op.uid);
          const existing = result[idx];
          if (idx !== -1 && existing) {
            result[idx] = { ...existing, ...op.patch, modified: new Date() };
          }
          break;
        }
        case 'delete':
          return result.filter(e => e.uid !== op.uid);
      }
    }

    return result;
  }

  private generateId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}
