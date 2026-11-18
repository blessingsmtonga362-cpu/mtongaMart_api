import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PayChanguCharge {
  status?: string;
  message?: string;
  data?: Record<string, any>;
}

export class PayChanguHttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly operation: string,
    readonly providerMessage?: string,
  ) {
    super(`PayChangu ${operation} returned HTTP ${statusCode}`);
    this.name = 'PayChanguHttpError';
  }
}

@Injectable()
export class PayChanguService {
  private readonly logger = new Logger(PayChanguService.name);
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = (config.get<string>('PAYCHANGU_BASE_URL') || 'https://api.paychangu.com').replace(/\/$/, '');
  }

  operatorRef(operator: 'airtel' | 'tnm'): string {
    const ref = operator === 'airtel'
      ? this.config.get<string>('PAYCHANGU_AIRTEL_OPERATOR_REF_ID') || '20be6c20-adeb-4b5b-a7ba-0769820df4fb'
      : this.config.get<string>('PAYCHANGU_TNM_OPERATOR_REF_ID') || '27494cb5-ba9e-437f-a114-4e7a7686bcca';
    return ref;
  }

  webhookSecret(): string | undefined {
    return this.config.get<string>('PAYCHANGU_WEBHOOK_SECRET');
  }

  async initialize(input: {
    chargeId: string; mobile: string; operator: 'airtel' | 'tnm'; amount: number;
    email: string; name: string;
  }): Promise<PayChanguCharge> {
    return this.request('/mobile-money/payments/initialize', {
      method: 'POST',
      body: JSON.stringify({
        mobile: input.mobile,
        mobile_money_operator_ref_id: this.operatorRef(input.operator),
        amount: String(input.amount),
        charge_id: input.chargeId,
        email: input.email,
        first_name: input.name.trim().split(/\s+/)[0] || undefined,
        last_name: input.name.trim().split(/\s+/).slice(1).join(' ') || undefined,
      }),
    });
  }

  verify(chargeId: string): Promise<PayChanguCharge> {
    return this.request(`/mobile-money/payments/${encodeURIComponent(chargeId)}/verify`, { method: 'GET' });
  }

  private async request(path: string, options: RequestInit): Promise<PayChanguCharge> {
    const secret = this.config.get<string>('PAYCHANGU_SECRET_KEY');
    if (!secret?.trim()) {
      throw new ServiceUnavailableException('Payment provider is not configured: PAYCHANGU_SECRET_KEY is missing');
    }
    const operation = path.endsWith('/initialize') ? 'mobile-money initialization' : 'charge verification';
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secret}`,
        },
        signal: AbortSignal.timeout(15000),
      });
      const rawBody = await response.text();
      let body: PayChanguCharge = {};
      try {
        body = rawBody ? JSON.parse(rawBody) as PayChanguCharge : {};
      } catch {
        // Provider errors may be plain text or HTML. Never write their raw body to logs.
      }
      if (!response.ok) {
        const providerMessage = this.safeProviderMessage(body);
        this.logger.warn(
          `PayChangu ${operation} returned HTTP ${response.status}${providerMessage ? `: ${providerMessage}` : ''}`,
        );
        throw new PayChanguHttpError(response.status, operation, providerMessage);
      }
      return body;
    } catch (error) {
      if (error instanceof PayChanguHttpError || error instanceof ServiceUnavailableException) throw error;
      this.logger.warn(`PayChangu ${operation} timed out or was unreachable`);
      throw new ServiceUnavailableException('Payment provider is temporarily unavailable');
    }
  }

  private safeProviderMessage(body: PayChanguCharge): string | undefined {
    const candidate = [body.message, body.data?.message]
      .find((value): value is string => typeof value === 'string');
    if (!candidate) return undefined;
    return candidate
      .replace(/[\r\n\t\x00-\x1f\x7f]/g, ' ')
      .replace(/Bearer\s+\S+/gi, '[redacted]')
      .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[redacted email]')
      .replace(/\+?265\s?\d{9}|0\d{9}/g, '[redacted phone]')
      .replace(/\b(?:sec|pub|whk)-(?:test|live)-[A-Za-z0-9_-]+\b/gi, '[redacted credential]')
      .slice(0, 240);
  }
}
