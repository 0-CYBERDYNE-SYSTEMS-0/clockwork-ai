/**
 * Natural Language Query Wrapper
 * Thin LLM wrapper that translates NL to structured filter functions.
 * Falls back to safe defaults if LLM unavailable.
 */
import { inDateRange, hasTag } from '@clockwork-ai/core';
import type { FilterFn } from '@clockwork-ai/core';

export interface NLQueryOptions {
  llmProvider?: 'openai' | 'anthropic';
  apiKey?: string;
}

export async function nlToFilters(
  naturalLanguage: string,
  _options?: NLQueryOptions
): Promise<FilterFn[]> {
  // TODO: LLM integration
  // For now, return safe fallback based on date keywords
  const today = new Date();
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  
  const filters: FilterFn[] = [];
  
  if (naturalLanguage.toLowerCase().includes('this month')) {
    filters.push(inDateRange(today, endOfMonth));
  }
  if (naturalLanguage.toLowerCase().includes('tomorrow')) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    filters.push(inDateRange(tomorrow, tomorrow));
  }
  
  // Fallback: return all events if no filters matched
  if (filters.length === 0) {
    filters.push(inDateRange(new Date(0), new Date(8640000000000000)));
  }
  
  return filters;
}
