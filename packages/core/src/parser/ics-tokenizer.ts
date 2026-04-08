/**
 * RFC 5545 ICS Tokenizer
 * Handles line folding, parameter extraction, and value parsing
 */

export type TokenType =
  | 'BEGIN'
  | 'END'
  | 'PROPERTY'
  | 'VALUE'
  | 'PARAM'
  | 'CONTENTLINE'
  | 'EOF';

export interface Token {
  type: TokenType;
  name?: string;
  value?: string;
  params?: Map<string, string>;
  line: number;
}

export class ICSTokenizer {
  private input: string;
  private pos: number = 0;
  private line: number = 1;
  private tokens: Token[] = [];
  private currentLineStart: number = 0;

  constructor(input: string) {
    // Normalize line endings
    this.input = input.replace(/\r\n?/g, '\n');
  }

  /**
   * Tokenize the entire ICS input and return tokens
   */
  tokenize(): Token[] {
    while (this.pos < this.input.length) {
      this.readContentLine();
    }
    this.tokens.push({ type: 'EOF', line: this.line });
    return this.tokens;
  }

  private readContentLine(): void {
    this.currentLineStart = this.pos;
    const lineStart = this.pos;
    let lineContent = '';

    // Read until end of line
    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];
      if (ch === '\n') {
        this.line++;
        this.pos++;
        break;
      }
      lineContent += ch;
      this.pos++;
    }

    // Handle line folding (continuation)
    // A line starting with space or tab is a continuation of previous line
    while (this.pos < this.input.length && (this.input[this.pos] === ' ' || this.input[this.pos] === '\t')) {
      this.pos++; // skip whitespace
      while (this.pos < this.input.length) {
        const ch = this.input[this.pos];
        if (ch === '\n') {
          this.line++;
          this.pos++;
          break;
        }
        lineContent += ch;
        this.pos++;
      }
    }

    // Skip empty lines
    if (lineContent.trim() === '') return;

    // Parse the content line
    const token = this.parseContentLine(lineContent, this.line);
    if (token) {
      this.tokens.push(token);
    }
  }

  private parseContentLine(line: string, lineNum: number): Token | null {
    line = line.trim();

    // Handle BEGIN:VCALENDAR and END:VCALENDAR
    if (line.startsWith('BEGIN:')) {
      return { type: 'BEGIN', name: line.slice(6), line: lineNum };
    }
    if (line.startsWith('END:')) {
      return { type: 'END', name: line.slice(4), line: lineNum };
    }

    // Parse property: value
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) return null;

    const propertyPart = line.slice(0, colonIdx);
    const valuePart = line.slice(colonIdx + 1);

    // Split property name and parameters
    const semicolonIdx = propertyPart.indexOf(';');
    let name: string;
    let params: Map<string, string> = new Map();

    if (semicolonIdx !== -1) {
      name = propertyPart.slice(0, semicolonIdx);
      const paramStr = propertyPart.slice(semicolonIdx + 1);
      params = this.parseParameters(paramStr);
    } else {
      name = propertyPart;
    }

    return {
      type: 'CONTENTLINE',
      name: name.toUpperCase(),
      value: this.unescapeValue(valuePart),
      params,
      line: lineNum,
    };
  }

  private parseParameters(paramStr: string): Map<string, string> {
    const params = new Map<string, string>();
    const parts = paramStr.split(';');

    for (const part of parts) {
      const eqIdx = part.indexOf('=');
      if (eqIdx === -1) {
        params.set(part.toUpperCase(), '');
        continue;
      }
      const key = part.slice(0, eqIdx).toUpperCase();
      let value = part.slice(eqIdx + 1);

      // Handle quoted values
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }

      params.set(key, value);
    }

    return params;
  }

  /**
   * Unescape ICS text values per RFC 5545 Section 3.3.11
   */
  private unescapeValue(value: string): string {
    return value
      .replace(/\\n/gi, '\n')
      .replace(/\\,/g, ',')
      .replace(/\\;/g, ';')
      .replace(/\\\\/g, '\\');
  }

  /**
   * Escape text values for ICS output
   */
  static escapeValue(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  }
}
