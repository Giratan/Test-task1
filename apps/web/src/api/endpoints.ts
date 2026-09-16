import api, { getToken, setToken } from './client';
import type {
  Cart,
  CreateOrder,
  Delivery,
  Order,
  Payment,
  Product,
  Quote,
} from '@checkout/contracts';

export type Session = { id: string; token: string; cart: Cart };
export type CheckoutOptions = {
  cart: Cart;
  deliveryMethods: Array<{
    id: Delivery['method'];
    title: string;
    price: number;
    freeFrom: number | null;
    pickupPoints: Array<{ id: string; title: string; address: string }>;
  }>;
  paymentMethods: Array<{ id: CreateOrder['paymentMethod']; title: string }>;
};
let sessionPromise: Promise<Session> | null = null;
export type Sandbox = {
  settlementDelayMs: number;
  cards: Array<{
    id: string;
    title: string;
    maskedNumber: string;
    scenario: 'success' | 'decline';
  }>;
};

export async function createSession() {
  const data = await api.post<Session>('/api/sessions', {});
  if (data.token) setToken(data.token);
  return data;
}

export function ensureSession() {
  if (getToken()) return Promise.resolve(null);
  if (!sessionPromise) {
    sessionPromise = createSession().finally(() => {
      sessionPromise = null;
    });
  }
  return sessionPromise;
}

async function withSession<T>(request: () => Promise<T>): Promise<T> {
  await ensureSession();
  try {
    return await request();
  } catch (error: unknown) {
    const apiError = error as { error?: { code?: string } };
    if (apiError.error?.code !== 'SESSION_INVALID') throw error;
    setToken(null);
    await ensureSession();
    return request();
  }
}

export async function getProducts() {
  return api.get<Product[]>('/api/products');
}

export async function getCart() {
  return withSession(() => api.get<Cart>('/api/cart'));
}

export async function setCartItem(productId: string, quantity: number) {
  return api.put(`/api/cart/items/${encodeURIComponent(productId)}`, { quantity });
}

export async function deleteCartItem(productId: string) {
  return api.del(`/api/cart/items/${encodeURIComponent(productId)}`);
}

export async function getCheckoutOptions() {
  return withSession(() => api.get<CheckoutOptions>('/api/checkout/options'));
}

export async function postQuotes(body: { cartVersion: number; delivery: Delivery }) {
  return api.post<Quote>('/api/quotes', body);
}

export async function postOrders(body: CreateOrder, idempotencyKey?: string) {
  const headers = idempotencyKey ? { 'idempotency-key': idempotencyKey } : undefined;
  return api.post<Order>('/api/orders', body, headers);
}

export async function getOrder(orderId: string) {
  return api.get<Order>(`/api/orders/${encodeURIComponent(orderId)}`);
}

export async function getSandbox() {
  return api.get<Sandbox>('/api/sandbox');
}

export async function postOrderPayment(orderId: string, idempotencyKey?: string) {
  const headers = idempotencyKey ? { 'idempotency-key': idempotencyKey } : undefined;
  return api.post<Payment>(`/api/orders/${encodeURIComponent(orderId)}/payments`, {}, headers);
}

export async function postPaymentSimulation(
  paymentId: string,
  body: { scenario: 'success' | 'decline' | 'cancel' },
) {
  return api.post(`/api/payments/${encodeURIComponent(paymentId)}/simulations`, body);
}

export async function getPayment(paymentId: string, signal?: AbortSignal) {
  return api.get<Payment>(`/api/payments/${encodeURIComponent(paymentId)}`, signal);
}

export default {
  createSession,
  ensureSession,
  getProducts,
  getCart,
  setCartItem,
  deleteCartItem,
  getCheckoutOptions,
  postQuotes,
  postOrders,
  getOrder,
  getSandbox,
  postOrderPayment,
  postPaymentSimulation,
  getPayment,
};
