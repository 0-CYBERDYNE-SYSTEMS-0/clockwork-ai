/**
 * Transaction Manager
 * Sequence-numbered transaction log with TTL-based dry-run and rollback support
 */

import type { Event, Operation, TransactionLog, DryRunResult, Conflict, AgentScope } from '../types.js';
import { ConflictDetector } from '../conflicts/conflicts.js';

export class TransactionManager {
  private transactions = new Map<string, TransactionLog>();
  private seqCounter = 0;
  private defaultTTLMs: number;

  constructor(defaultTTLMs: number = 5 * 60 * 1000) {
    this.defaultTTLMs = defaultTTLMs;
  }

  /**
   * Create a new dry-run transaction
   */
  createDryRun(
    agentId: string,
    operations: Operation[],
    existingEvents: Event[],
    ttlMs?: number,
  ): DryRunResult {
    const id = this.generateId();
    const seq = ++this.seqCounter;
    const now = new Date();
    const ttl = ttlMs ?? this.defaultTTLMs;

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

    // Detect conflicts
    const conflictDetector = new ConflictDetector();
    const allEvents = [...existingEvents];
    const newEvents = operations.filter(op => op.type === 'create').map(op => (op as { type: 'create'; event: Event }).event);

    const conflicts: Conflict[] = [];

    for (const op of operations) {
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

    return {
      transactionId: id,
      preview: operations,
      conflicts,
      canCommit: conflicts.filter(c => c.severity === 'critical').length === 0,
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
