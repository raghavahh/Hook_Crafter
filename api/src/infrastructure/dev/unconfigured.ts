import { UnavailableError } from '@hook/domain';
import type { BotVerifier, IdentityAdmin, PaymentGateway, ProviderPayment, ProviderSubscription, SubscriptionGateway } from '../../ports';

/** Used when Razorpay keys are missing: every call fails closed with a friendly 503. */
export class UnconfiguredPaymentGateway implements PaymentGateway, SubscriptionGateway {
  public readonly keyId = '';
  public createOrder(): Promise<{ orderId: string }> {
    return this.#fail();
  }
  public fetchPayment(): Promise<ProviderPayment> {
    return this.#fail();
  }
  public verifyCheckoutSignature(): Promise<boolean> {
    return Promise.resolve(false);
  }
  public verifyWebhookSignature(): Promise<boolean> {
    return Promise.resolve(false);
  }
  public createSubscription(): Promise<{ subscriptionId: string }> {
    return this.#fail();
  }
  public fetchSubscription(): Promise<ProviderSubscription> {
    return this.#fail();
  }
  public verifySubscriptionSignature(): Promise<boolean> {
    return Promise.resolve(false);
  }
  public cancelAtCycleEnd(): Promise<void> {
    return this.#fail();
  }
  public cancelNow(): Promise<void> {
    return Promise.resolve();
  }
  public changePlanAtCycleEnd(): Promise<void> {
    return this.#fail();
  }
  #fail(): Promise<never> {
    return Promise.reject(new UnavailableError('Payments are not configured yet.'));
  }
}

/** DEVELOPMENT ONLY: no Turnstile secret configured -> pass. */
export class DevBotVerifier implements BotVerifier {
  public verify(token: string): Promise<boolean> {
    return Promise.resolve(token.length > 0);
  }
}

export class NoopIdentityAdmin implements IdentityAdmin {
  public deleteUser(): Promise<void> {
    return Promise.resolve();
  }
}
