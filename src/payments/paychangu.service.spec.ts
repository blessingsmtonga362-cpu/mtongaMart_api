import { ConfigService } from '@nestjs/config';
import { PayChanguHttpError, PayChanguService } from './paychangu.service';

describe('PayChanguService', () => {
  const secret = 'sec-test-unit-test-only';
  const config = {
    get: jest.fn((key: string) => ({
      PAYCHANGU_BASE_URL: 'https://api.paychangu.com/',
      PAYCHANGU_SECRET_KEY: secret,
      PAYCHANGU_AIRTEL_OPERATOR_REF_ID: 'airtel-reference',
      PAYCHANGU_TNM_OPERATOR_REF_ID: 'tnm-reference',
    })[key]),
  };
  let service: PayChanguService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock = jest.fn();
    global.fetch = fetchMock;
    service = new PayChanguService(config as unknown as ConfigService);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('posts the Direct Mobile Money contract with a Bearer key and configured operator', async () => {
    const providerResponse = { status: 'success', message: 'Payment initiated successfully.', data: { status: 'pending' } };
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify(providerResponse) });

    const response = await service.initialize({
      chargeId: 'PAY-reference', mobile: '0991234567', operator: 'airtel', amount: 5000,
      email: 'buyer@example.com', name: 'Test Buyer',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.paychangu.com/mobile-money/payments/initialize');
    expect(request.headers).toMatchObject({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${secret}`,
    });
    expect(JSON.parse(request.body)).toEqual({
      mobile: '0991234567',
      mobile_money_operator_ref_id: 'airtel-reference',
      amount: '5000',
      charge_id: 'PAY-reference',
      email: 'buyer@example.com',
      first_name: 'Test',
      last_name: 'Buyer',
    });
    expect(response).toEqual(providerResponse);
  });

  it('uses the verification endpoint and keeps HTTP errors typed and sanitized', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => JSON.stringify({ message: 'No charge exists for 0991234567' }),
    });

    await expect(service.verify('PAY-reference')).rejects.toMatchObject({
      statusCode: 404,
      operation: 'charge verification',
      providerMessage: 'No charge exists for [redacted phone]',
    } satisfies Partial<PayChanguHttpError>);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.paychangu.com/mobile-money/payments/PAY-reference/verify',
    );
  });
});
