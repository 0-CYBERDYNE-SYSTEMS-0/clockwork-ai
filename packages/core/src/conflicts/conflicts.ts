/**
 * Conflict Detector
 * Detects temporal overlaps between events and generates structured resolution options
 */

import type { Event, Conflict, ResolutionOption } from '../types.js';

export class ConflictDetector {
  /**
   * Detect all conflicts between events in a set
   */
  detectConflicts(events: Event[]): Conflict[] {
    const conflicts: Conflict[] = [];

    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        const eventA = events[i];
        const eventB = events[j];
        if (!eventA || !eventB) continue;

        // Skip cancelled events
        if (eventA.status === 'CANCELLED' || eventB.status === 'CANCELLED') continue;

        const overlap = this.getOverlap(eventA, eventB);
        if (overlap) {
          conflicts.push(this.buildConflict(eventA, eventB, overlap));
        }
      }
    }

    return conflicts;
  }

  /**
   * Check if a new proposed event conflicts with existing events
   */
  detectConflictsForNew(
    proposed: { start: Date; end: Date; duration: number },
    existing: Event[],
  ): Conflict[] {
    const conflicts: Conflict[] = [];

    for (const event of existing) {
      if (event.status === 'CANCELLED') continue;

      const overlapStart = Math.max(proposed.start.getTime(), event.start.date.getTime());
      const overlapEnd = Math.min(proposed.end.getTime(), event.end.date.getTime());

      if (overlapStart < overlapEnd) {
        conflicts.push(this.buildConflict(
          this.proposedToMinimalEvent(proposed),
          event,
          { start: new Date(overlapStart), end: new Date(overlapEnd) },
        ));
      }
    }

    return conflicts;
  }

  /**
   * Get temporal overlap between two events
   */
  private getOverlap(a: Event, b: Event): { start: Date; end: Date } | null {
    const startA = a.start.date;
    const endA = a.end.date;
    const startB = b.start.date;
    const endB = b.end.date;

    const overlapStart = Math.max(startA.getTime(), startB.getTime());
    const overlapEnd = Math.min(endA.getTime(), endB.getTime());

    if (overlapStart < overlapEnd) {
      return { start: new Date(overlapStart), end: new Date(overlapEnd) };
    }
    return null;
  }

  private buildConflict(
    eventA: Event,
    eventB: Event,
    overlap: { start: Date; end: Date },
  ): Conflict {
    const severity = this.assessSeverity(eventA, eventB);
    const resolutionOptions = this.generateResolutionOptions(eventA, eventB, overlap);

    return {
      eventA,
      eventB,
      overlapStart: overlap.start,
      overlapEnd: overlap.end,
      severity,
      resolutionOptions,
    };
  }

  private assessSeverity(a: Event, b: Event): 'critical' | 'warning' {
    // Same location = critical (resource contention)
    if (a.location && b.location && a.location === b.location) {
      return 'critical';
    }
    // Same categories = likely resource conflict
    if (a.categories.some(c => b.categories.includes(c))) {
      return 'critical';
    }
    // Same agent scope (for multi-agent)
    return 'warning';
  }

  private generateResolutionOptions(
    eventA: Event,
    eventB: Event,
    overlap: { start: Date; end: Date },
  ): ResolutionOption[] {
    const options: ResolutionOption[] = [];

    // How long is the overlap?
    const overlapMs = overlap.end.getTime() - overlap.start.getTime();
    const overlapMinutes = Math.round(overlapMs / 60000);

    // Option 1: Reschedule A after B
    options.push({
      type: 'reschedule',
      description: `Reschedule "${eventA.summary}" to start after "${eventB.summary}" ends`,
      newTime: {
        start: new Date(eventB.end.date.getTime()),
        end: new Date(eventB.end.date.getTime() + eventA.duration * 60000),
      },
      requiresReason: true,
    });

    // Option 2: Reschedule B after A
    options.push({
      type: 'reschedule',
      description: `Reschedule "${eventB.summary}" to start after "${eventA.summary}" ends`,
      newTime: {
        start: new Date(eventA.end.date.getTime()),
        end: new Date(eventA.end.date.getTime() + eventB.duration * 60000),
      },
      requiresReason: true,
    });

    // Option 3: Shorten one to fit
    if (overlapMinutes < Math.min(eventA.duration, eventB.duration)) {
      options.push({
        type: 'reschedule',
        description: `Shorten "${eventA.summary}" by ${overlapMinutes} minutes to avoid overlap`,
        newTime: {
          start: eventA.start.date,
          end: new Date(eventA.start.date.getTime() + (eventA.duration - overlapMinutes) * 60000),
        },
        requiresReason: true,
      });
    }

    // Option 4: Override with reason
    options.push({
      type: 'override',
      description: 'Override conflict — both events proceed as scheduled',
      requiresReason: true,
    });

    return options;
  }

  private proposedToMinimalEvent(proposed: { start: Date; end: Date; duration: number }): Event {
    return {
      uid: 'proposed',
      summary: 'Proposed Event',
      start: { date: proposed.start, timezone: 'UTC', isAllDay: false },
      end: { date: proposed.end, timezone: 'UTC', isAllDay: false },
      duration: proposed.duration,
      categories: [],
      xProperties: new Map(),
      created: new Date(),
      modified: new Date(),
    };
  }
}
