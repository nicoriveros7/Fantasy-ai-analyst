import { Injectable, ServiceUnavailableException } from '@nestjs/common';

interface AskResponse {
  answer: string;
  confidence: number;
  usedTools: string[];
  structuredContext: Record<string, unknown>;
}

@Injectable()
export class AiClientService {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = (process.env.AI_SERVICE_URL ?? 'http://localhost:8001').replace(/\/$/, '');
  }

  async ask(question: string): Promise<AskResponse> {
    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}/ask`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ question }),
      });
    } catch (error) {
      throw new ServiceUnavailableException('AI service unavailable');
    }

    if (!response.ok) {
      const detail = await this.extractErrorDetail(response);
      const lower = detail.toLowerCase();
      if (lower.includes('backend api unavailable') || lower.includes('request failed')) {
        throw new ServiceUnavailableException(`AI downstream failure: ${detail}`);
      }
      throw new ServiceUnavailableException(`AI request failed: ${detail}`);
    }

    const body = (await response.json()) as Partial<AskResponse>;
    return {
      answer: String(body.answer ?? ''),
      confidence: Number(body.confidence ?? 0),
      usedTools: Array.isArray(body.usedTools) ? body.usedTools.map(String) : [],
      structuredContext:
        body.structuredContext && typeof body.structuredContext === 'object'
          ? (body.structuredContext as Record<string, unknown>)
          : {},
    };
  }

  private async extractErrorDetail(response: Response): Promise<string> {
    try {
      const body = (await response.json()) as { detail?: unknown };
      if (typeof body.detail === 'string') {
        return body.detail;
      }
      return JSON.stringify(body);
    } catch {
      return `${response.status} ${response.statusText}`;
    }
  }
}
