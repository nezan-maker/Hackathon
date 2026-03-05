import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, CreditCard, Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { loadExternalScript } from '../lib/loadExternalScript';
import { PumpLoadingIndicator } from '../components/PumpLoadingIndicator';

const STRIPE_JS_CDN = 'https://js.stripe.com/v3/';

interface BackendPump {
  _id: string;
  name: string;
  serial_id: string;
  capacity: number;
  userId?: string | null;
  purchasedAt?: string | null;
  registeredAt?: string | null;
  installationConfirmedAt?: string | null;
  adminInstallationConfirmedAt?: string | null;
  price_usd?: number;
}

interface PurchaseResponse {
  message?: string;
  serial_id?: string;
  transaction_id?: string;
  amount_usd?: number;
  card_last4?: string;
  payment_provider?: string;
  registration_link?: string;
  installation_confirmation_link?: string;
  installation_confirmation_expires_at?: string;
}

interface CreateIntentResponse {
  message?: string;
  alreadyPurchased?: boolean;
  payment_provider?: string;
  payment_intent_id?: string;
  client_secret?: string;
  publishable_key?: string;
  amount_usd?: number;
  currency?: string;
  serial_id?: string;
}

interface StripeCardElement {
  mount: (domElement: HTMLElement) => void;
  unmount: () => void;
  destroy?: () => void;
  on: (event: string, callback: (event: { error?: { message?: string } }) => void) => void;
}

interface StripeElements {
  create: (type: 'card', options?: Record<string, unknown>) => StripeCardElement;
}

interface StripePaymentIntentResult {
  id: string;
  status: string;
}

interface StripeClient {
  elements: (options?: Record<string, unknown>) => StripeElements;
  confirmCardPayment: (
    clientSecret: string,
    data: {
      payment_method: {
        card: StripeCardElement;
        billing_details?: {
          name?: string;
          address?: {
            postal_code?: string;
          };
        };
      };
    },
  ) => Promise<{
    error?: { message?: string };
    paymentIntent?: StripePaymentIntentResult;
  }>;
}

declare global {
  interface Window {
    Stripe?: (publishableKey: string) => StripeClient;
  }
}

interface PurchaseForm {
  cardholderName: string;
  billingZip: string;
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
}

const initialForm: PurchaseForm = {
  cardholderName: '',
  billingZip: '',
  cardNumber: '',
  expiryMonth: '',
  expiryYear: '',
  cvv: '',
};

type OwnershipState =
  | 'available'
  | 'purchased-mine-awaiting-installation'
  | 'purchased-mine-awaiting-admin'
  | 'purchased-mine-ready-register'
  | 'registered-mine'
  | 'purchased-other';

const calculatePriceFallback = (capacity: number) => {
  const base = 199;
  const variable = Number(capacity) * 0.03;
  return Number((base + variable).toFixed(2));
};

const formatCardNumber = (value: string) =>
  value
    .replace(/\D/g, '')
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, '$1 ')
    .trim();

export function PurchasePump() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [pump, setPump] = useState<BackendPump | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<PurchaseForm>(initialForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<PurchaseResponse | null>(null);
  const [intent, setIntent] = useState<CreateIntentResponse | null>(null);
  const [intentLoading, setIntentLoading] = useState(false);
  const [intentError, setIntentError] = useState('');
  const [cardElementError, setCardElementError] = useState('');

  const cardMountRef = useRef<HTMLDivElement | null>(null);
  const stripeClientRef = useRef<StripeClient | null>(null);
  const stripeCardElementRef = useRef<StripeCardElement | null>(null);

  useEffect(() => {
    const loadPump = async () => {
      if (!id) return;
      setLoading(true);
      setError('');
      try {
        const data = await apiFetch<{ pumps?: BackendPump[] }>('/home');
        const found = (data.pumps ?? []).find((item) => item._id === id);
        if (!found) {
          setError('Pump not found');
          setPump(null);
          return;
        }
        setPump(found);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load pump');
      } finally {
        setLoading(false);
      }
    };

    void loadPump();
  }, [id]);

  const ownership = useMemo<OwnershipState>(() => {
    if (!pump?.userId) return 'available';
    if (user?.id && String(pump.userId) === String(user.id)) {
      if (pump.registeredAt) return 'registered-mine';
      if (pump.installationConfirmedAt && pump.adminInstallationConfirmedAt) {
        return 'purchased-mine-ready-register';
      }
      if (pump.installationConfirmedAt) return 'purchased-mine-awaiting-admin';
      return 'purchased-mine-awaiting-installation';
    }
    return 'purchased-other';
  }, [
    pump?.adminInstallationConfirmedAt,
    pump?.installationConfirmedAt,
    pump?.registeredAt,
    pump?.userId,
    user?.id,
  ]);

  const price = useMemo(() => {
    if (!pump) return 0;
    return Number(pump.price_usd ?? calculatePriceFallback(pump.capacity));
  }, [pump]);

  const stripeEnabledForCheckout = Boolean(
    intent?.client_secret && intent?.publishable_key,
  );

  useEffect(() => {
    const createIntent = async () => {
      if (!pump || ownership !== 'available') return;

      setIntentLoading(true);
      setIntentError('');
      try {
        const response = await apiFetch<CreateIntentResponse>('/payments/create-intent', {
          method: 'POST',
          body: JSON.stringify({ serial_id: pump.serial_id }),
        });

        if (response.alreadyPurchased) {
          setIntent(null);
          return;
        }

        if (response.client_secret && response.publishable_key) {
          setIntent(response);
        } else {
          setIntent(null);
        }
      } catch (err) {
        setIntent(null);
        setIntentError(
          err instanceof Error ? err.message : 'Unable to initialize Stripe checkout',
        );
      } finally {
        setIntentLoading(false);
      }
    };

    void createIntent();
  }, [ownership, pump]);

  useEffect(() => {
    if (!stripeEnabledForCheckout || !cardMountRef.current) {
      return;
    }

    let isMounted = true;
    let localCardElement: StripeCardElement | null = null;

    const mountStripeElement = async () => {
      try {
        await loadExternalScript(STRIPE_JS_CDN);
        if (!isMounted) return;
        if (!window.Stripe || !intent?.publishable_key) {
          setIntentError('Stripe.js failed to load');
          return;
        }

        const stripe = window.Stripe(intent.publishable_key);
        const elements = stripe.elements();
        localCardElement = elements.create('card', {
          hidePostalCode: true,
          style: {
            base: {
              fontSize: '16px',
              color: '#0f172a',
              '::placeholder': {
                color: '#64748b',
              },
            },
          },
        });
        localCardElement.mount(cardMountRef.current);
        localCardElement.on('change', (event) => {
          setCardElementError(event.error?.message ?? '');
        });

        stripeClientRef.current = stripe;
        stripeCardElementRef.current = localCardElement;
      } catch (err) {
        setIntentError(err instanceof Error ? err.message : 'Unable to load Stripe checkout');
      }
    };

    void mountStripeElement();

    return () => {
      isMounted = false;
      if (localCardElement) {
        localCardElement.unmount();
        localCardElement.destroy?.();
      }
      stripeCardElementRef.current = null;
      stripeClientRef.current = null;
      setCardElementError('');
    };
  }, [intent?.client_secret, intent?.publishable_key, stripeEnabledForCheckout]);

  const handleChange = (key: keyof PurchaseForm, value: string) => {
    setForm((current) => ({
      ...current,
      [key]:
        key === 'cardNumber'
          ? formatCardNumber(value)
          : value,
    }));
  };

  const validateCommonBilling = () => {
    if (form.cardholderName.trim().length < 3) {
      return 'Cardholder name is required';
    }
    if (form.billingZip.trim().length < 4) {
      return 'Billing ZIP / postal code is required';
    }
    return null;
  };

  const validateFallbackForm = () => {
    const commonError = validateCommonBilling();
    if (commonError) return commonError;

    if (!form.cardNumber || !form.expiryMonth || !form.expiryYear || !form.cvv) {
      return 'All card fields are required';
    }

    const month = Number(form.expiryMonth);
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      return 'Expiry month must be between 1 and 12';
    }

    const year = Number(form.expiryYear);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return 'Expiry year is invalid';
    }

    if (!/^\d{3,4}$/.test(form.cvv.replace(/\D/g, ''))) {
      return 'CVV must be 3 or 4 digits';
    }

    return null;
  };

  const completePurchase = async (payload: Record<string, unknown>) => {
    if (!pump) return;
    const response = await apiFetch<PurchaseResponse>('/purchase', {
      method: 'POST',
      body: JSON.stringify({
        serial_id: pump.serial_id,
        ...payload,
      }),
    });
    setSuccess(response);
    setForm(initialForm);
    setIntent(null);
    setPump((current) => {
      if (!current) return current;
      return {
        ...current,
        userId: user?.id ?? current.userId ?? null,
        purchasedAt: current.purchasedAt ?? new Date().toISOString(),
        installationConfirmedAt: null,
        adminInstallationConfirmedAt: null,
        registeredAt: null,
      };
    });
  };

  const submitWithStripe = async () => {
    const commonError = validateCommonBilling();
    if (commonError) {
      setError(commonError);
      return;
    }

    if (!intent?.client_secret || !stripeClientRef.current || !stripeCardElementRef.current) {
      setError('Stripe checkout is not ready');
      return;
    }

    const confirmation = await stripeClientRef.current.confirmCardPayment(intent.client_secret, {
      payment_method: {
        card: stripeCardElementRef.current,
        billing_details: {
          name: form.cardholderName.trim(),
          address: {
            postal_code: form.billingZip.trim(),
          },
        },
      },
    });

    if (confirmation.error?.message) {
      setError(confirmation.error.message);
      return;
    }

    if (!confirmation.paymentIntent || confirmation.paymentIntent.status !== 'succeeded') {
      setError('Payment confirmation did not complete');
      return;
    }

    await completePurchase({
      payment_intent_id: confirmation.paymentIntent.id,
    });
  };

  const submitFallback = async () => {
    const validationError = validateFallbackForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    await completePurchase({
      cardNumber: form.cardNumber.replace(/\s/g, ''),
      cardholderName: form.cardholderName.trim(),
      expiryMonth: Number(form.expiryMonth),
      expiryYear: Number(form.expiryYear),
      cvv: form.cvv.replace(/\D/g, ''),
      billingZip: form.billingZip.trim(),
    });
  };

  const handlePurchase = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess(null);
    setSubmitting(true);

    try {
      if (stripeEnabledForCheckout) {
        await submitWithStripe();
      } else {
        await submitFallback();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-8">
      <button
        onClick={() => navigate('/pumps')}
        className="mb-6 flex items-center gap-2 text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-5 w-5" />
        Back to pumps
      </button>

      {loading && <PumpLoadingIndicator size="lg" label="Loading purchase details" />}

      {error && !success && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>
      )}

      {!loading && pump && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h1 className="mb-2 text-2xl font-bold text-slate-900">Checkout</h1>
              <p className="mb-6 text-slate-600">Complete payment to purchase this pump.</p>

              {intentLoading && ownership === 'available' && (
                <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-blue-700">
                  <PumpLoadingIndicator size="md" label="Initializing secure payment session" />
                </div>
              )}

              {intentError && ownership === 'available' && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
                  {intentError}. Falling back to local payment mode.
                </div>
              )}

              {ownership === 'purchased-other' && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
                  This pump has already been purchased by another account.
                </div>
              )}

              {ownership === 'purchased-mine-awaiting-installation' && (
                <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-900">
                  <p className="font-semibold">You already purchased this pump.</p>
                  <p className="text-sm">
                    Complete installation using the confirmation link sent to your email. After that, admin approval is required before registration.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to="/register-pump"
                      className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-medium hover:bg-amber-100"
                    >
                      Open Registration
                    </Link>
                    <Link
                      to="/pumps"
                      className="rounded-lg border border-amber-300 px-4 py-2 text-sm font-medium hover:bg-amber-100"
                    >
                      Back to Marketplace
                    </Link>
                  </div>
                </div>
              )}

              {ownership === 'purchased-mine-awaiting-admin' && (
                <div className="space-y-3 rounded-lg border border-indigo-200 bg-indigo-50 p-4 text-indigo-900">
                  <p className="font-semibold">Installation confirmed by you.</p>
                  <p className="text-sm">
                    Waiting for admin confirmation. Registration will be enabled once admin approves installation.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to="/register-pump"
                      className="rounded-lg border border-indigo-300 px-4 py-2 text-sm font-medium hover:bg-indigo-100"
                    >
                      Open Registration
                    </Link>
                    <Link
                      to="/pumps"
                      className="rounded-lg border border-indigo-300 px-4 py-2 text-sm font-medium hover:bg-indigo-100"
                    >
                      Back to Marketplace
                    </Link>
                  </div>
                </div>
              )}

              {ownership === 'purchased-mine-ready-register' && (
                <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-800">
                  <p className="font-semibold">
                    Installation is fully approved. You can register this pump now.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to={`/register-pump?serial_id=${encodeURIComponent(pump.serial_id)}`}
                      className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
                    >
                      Register Pump
                    </Link>
                    <Link
                      to="/pumps"
                      className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-medium hover:bg-blue-100"
                    >
                      Back to Marketplace
                    </Link>
                  </div>
                </div>
              )}

              {ownership === 'registered-mine' && (
                <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                  <p className="font-semibold">This pump is already registered.</p>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to={`/pumps/${pump._id}`}
                      className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
                    >
                      View Pump
                    </Link>
                    <Link
                      to="/control"
                      className="rounded-lg border border-emerald-300 px-4 py-2 text-sm font-medium hover:bg-emerald-100"
                    >
                      Open Remote Control
                    </Link>
                  </div>
                </div>
              )}

              {ownership === 'available' && !success && (
                <form onSubmit={handlePurchase} className="space-y-5">
                  <div>
                    <label htmlFor="cardholderName" className="mb-2 block text-sm font-semibold text-slate-900">
                      Cardholder Name
                    </label>
                    <input
                      id="cardholderName"
                      autoComplete="cc-name"
                      value={form.cardholderName}
                      onChange={(e) => handleChange('cardholderName', e.target.value)}
                      placeholder="Full name"
                      className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div>
                    <label htmlFor="billingZip" className="mb-2 block text-sm font-semibold text-slate-900">
                      Billing ZIP / Postal Code
                    </label>
                    <input
                      id="billingZip"
                      autoComplete="postal-code"
                      value={form.billingZip}
                      onChange={(e) => handleChange('billingZip', e.target.value.slice(0, 12))}
                      placeholder="12345"
                      className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  {stripeEnabledForCheckout ? (
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-slate-900">
                        Card Details
                      </label>
                      <div className="rounded-lg border border-slate-300 px-3 py-3">
                        <div ref={cardMountRef} />
                      </div>
                      {cardElementError && (
                        <p className="mt-2 text-sm text-red-600">{cardElementError}</p>
                      )}
                    </div>
                  ) : (
                    <>
                      <div>
                        <label htmlFor="cardNumber" className="mb-2 block text-sm font-semibold text-slate-900">
                          Card Number
                        </label>
                        <input
                          id="cardNumber"
                          autoComplete="cc-number"
                          value={form.cardNumber}
                          onChange={(e) => handleChange('cardNumber', e.target.value)}
                          placeholder="4242 4242 4242 4242"
                          className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-3">
                        <div>
                          <label htmlFor="expiryMonth" className="mb-2 block text-sm font-semibold text-slate-900">
                            Expiry Month
                          </label>
                          <input
                            id="expiryMonth"
                            inputMode="numeric"
                            value={form.expiryMonth}
                            onChange={(e) => handleChange('expiryMonth', e.target.value.replace(/\D/g, '').slice(0, 2))}
                            placeholder="MM"
                            className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>
                        <div>
                          <label htmlFor="expiryYear" className="mb-2 block text-sm font-semibold text-slate-900">
                            Expiry Year
                          </label>
                          <input
                            id="expiryYear"
                            inputMode="numeric"
                            value={form.expiryYear}
                            onChange={(e) => handleChange('expiryYear', e.target.value.replace(/\D/g, '').slice(0, 4))}
                            placeholder="YYYY"
                            className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>
                        <div>
                          <label htmlFor="cvv" className="mb-2 block text-sm font-semibold text-slate-900">
                            CVV
                          </label>
                          <input
                            id="cvv"
                            inputMode="numeric"
                            autoComplete="cc-csc"
                            value={form.cvv}
                            onChange={(e) => handleChange('cvv', e.target.value.replace(/\D/g, '').slice(0, 4))}
                            placeholder="123"
                            className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                  >
                    {submitting ? (
                      <PumpLoadingIndicator size="sm" label="Processing payment" />
                    ) : (
                      <>
                        <Lock className="h-4 w-4" />
                        <span>{`Pay $${price.toFixed(2)}`}</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {success && (
                <div className="space-y-4 rounded-lg border border-emerald-200 bg-emerald-50 p-5">
                  <div className="flex items-center gap-2 text-emerald-800">
                    <CheckCircle2 className="h-5 w-5" />
                    <p className="font-semibold">Purchase successful</p>
                  </div>
                  <p className="text-sm text-emerald-900">{success.message ?? 'Your purchase has been completed.'}</p>
                  <div className="grid gap-2 text-sm text-emerald-900">
                    {success.transaction_id && <p>Transaction: {success.transaction_id}</p>}
                    {success.serial_id && <p>Product key: {success.serial_id}</p>}
                    {typeof success.amount_usd === 'number' && <p>Amount: ${success.amount_usd.toFixed(2)}</p>}
                    {success.card_last4 && <p>Card: •••• {success.card_last4}</p>}
                    {success.payment_provider && <p>Provider: {success.payment_provider}</p>}
                    {success.installation_confirmation_expires_at && (
                      <p>
                        Installation link expires:{' '}
                        {new Date(success.installation_confirmation_expires_at).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {success.installation_confirmation_link ? (
                      <a
                        href={success.installation_confirmation_link}
                        className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                      >
                        Confirm Installation
                      </a>
                    ) : (
                      <Link
                        to="/register-pump"
                        className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                      >
                        Open Registration
                      </Link>
                    )}
                    <Link
                      to="/pumps"
                      className="rounded-lg border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-900 hover:bg-emerald-100"
                    >
                      Back to Marketplace
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          <aside className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-slate-900">Order Summary</h2>
            <div className="space-y-3 text-sm text-slate-700">
              <p>
                <span className="font-semibold text-slate-900">Pump:</span> {pump.name}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Product Key:</span> {pump.serial_id}
              </p>
              <p>
                <span className="font-semibold text-slate-900">Capacity:</span> {pump.capacity.toLocaleString()} L
              </p>
              <p>
                <span className="font-semibold text-slate-900">Price:</span> ${price.toFixed(2)}
              </p>
            </div>
            <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
              <p className="mb-2 flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Stripe is used for real card processing when configured.
              </p>
              <p className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                You must purchase, confirm installation, get admin approval, and register before remote control is enabled.
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
