import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useCart } from '../state/cart';
import * as api from '../api/endpoints';
import type {
  CreateOrder,
  Customer,
  Delivery,
  Order,
  Payment,
  Quote,
  Scenario,
} from '@checkout/contracts';
import type { CheckoutOptions, Sandbox } from '../api/endpoints';
import {
  getErrorMessage,
  setActivePaymentId,
  getActivePaymentId,
  setActiveOrderId,
} from '../api/client';
import { pollUntil } from '../utils/poll';
import Button from './ui/Button';

function uid() {
  // use crypto when available
  try {
    // @ts-ignore
    return typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now());
  } catch {
    return String(Date.now());
  }
}

export default function Checkout() {
  const { cart, refresh } = useCart();
  const [options, setOptions] = useState<CheckoutOptions | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [paymentNotice, setPaymentNotice] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [sandbox, setSandbox] = useState<Sandbox | null>(null);
  const [customer, setCustomer] = useState<Customer>({ name: '', email: '', phone: '' });
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<CreateOrder['paymentMethod']>('card');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const pollController = useRef<AbortController | null>(null);
  const orderKey = useRef<string | null>(null);
  const paymentKey = useRef<string | null>(null);

  const applyPaymentResult = useCallback(async (paymentResult: Payment) => {
    setPayment(paymentResult);
    if (paymentResult.status === 'succeeded') {
      const completed = await api.getOrder(paymentResult.orderId);
      setCompletedOrder(completed);
      setQuote(null);
      setCompletedOrder(null);
      setOrder(null);
      setPayment(null);
      setCustomer({ name: '', email: '', phone: '' });
      setDelivery(null);
      setFieldErrors({});
      setPaymentNotice({ type: 'success', message: 'Оплата успешно подтверждена.' });
      setActivePaymentId(null);
      setActiveOrderId(null);
    } else if (paymentResult.status === 'failed') {
      setPaymentNotice({
        type: 'error',
        message: 'Оплата не прошла. Можно повторить оплату или изменить заказ.',
      });
    } else if (paymentResult.status === 'cancelled') {
      setPaymentNotice({
        type: 'error',
        message: 'Оплата отменена. Можно повторить оплату или изменить заказ.',
      });
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await api.getCheckoutOptions();
        if (mounted) setOptions(res);
        const s = await api.getSandbox();
        if (mounted) setSandbox(s);
      } catch (e: unknown) {
        if (mounted)
          setOptionsError(getErrorMessage(e, 'Не удалось загрузить способы оплаты и доставки.'));
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const getQuote = useCallback(async () => {
    if (!cart) return;
    // validate basic fields before quote
    const errs: Record<string, string> = {};
    if (!customer.name || customer.name.trim().length < 2)
      errs.name = 'Укажите имя (не менее 2 символов)';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customer.email)) errs.email = 'Некорректный email';
    if (!/^\+[1-9]\d{9,14}$/.test(customer.phone)) errs.phone = 'Телефон в формате +79990000000';
    if (
      delivery?.method === 'courier' &&
      (!delivery.address.city.trim() ||
        !delivery.address.street.trim() ||
        !delivery.address.house.trim())
    ) {
      errs.delivery = 'Заполните город, улицу и дом';
    }
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setLoading(true);
    try {
      if (!delivery) return;
      const body = { cartVersion: cart.version, delivery };
      const q = await api.postQuotes(body);
      setQuote(q);
      setOrder(null);
      setPayment(null);
      setPaymentNotice(null);
    } catch (e: unknown) {
      setOptionsError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [cart, delivery, customer]);

  const createOrder = useCallback(async () => {
    if (!quote) return;
    // validate again before order
    const errs: Record<string, string> = {};
    if (!customer.name || customer.name.trim().length < 2) errs.name = 'Укажите имя (не менее 2 символов)';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customer.email)) errs.email = 'Некорректный email';
    if (!/^\+[1-9]\d{9,14}$/.test(customer.phone)) errs.phone = 'Телефон в формате +79990000000';
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setLoading(true);
    try {
      const idempotency = orderKey.current ?? uid();
      orderKey.current = idempotency;
      const o = await api.postOrders({ quoteId: quote.id, customer, paymentMethod }, idempotency);
      orderKey.current = null;
      if (paymentMethod === 'cash_on_delivery') {
        setCompletedOrder(o);
        setQuote(null);
        setOrder(null);
        setPayment(null);
        setPaymentNotice({ type: 'success', message: 'Заказ оформлен, оплата при получении.' });
        setCustomer({ name: '', email: '', phone: '' });
        setDelivery(null);
      } else {
        setOrder(o);
      }
    } catch (e: unknown) {
      setOptionsError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [quote, customer, paymentMethod]);

  const createPayment = useCallback(async () => {
    if (!order) return;
    setLoading(true);
    try {
      const idempotency = paymentKey.current ?? uid();
      paymentKey.current = idempotency;
      const p = await api.postOrderPayment(order.id, idempotency);
      paymentKey.current = null;
      setPayment(p);
      setActivePaymentId(p.id);
      setActiveOrderId(order.id);
    } catch (e: unknown) {
      setOptionsError(getErrorMessage(e, 'Не удалось создать попытку оплаты.'));
    } finally {
      setLoading(false);
    }
  }, [order]);

  const simulate = useCallback(
    async (s: Scenario) => {
      if (!payment) return;
      setLoading(true);
      try {
        await api.postPaymentSimulation(payment.id, { scenario: s });
        // after simulation is started, poll until final status
        const controller = new AbortController();
        pollController.current?.abort();
        pollController.current = controller;
        await pollUntil(
          () => api.getPayment(payment.id, controller.signal),
          (r) => ['succeeded', 'failed', 'cancelled'].includes(r.status),
          { initialDelay: 500, maxDelay: 5000 },
          controller.signal,
        );
        await applyPaymentResult(await api.getPayment(payment.id, controller.signal));
        await refresh();
      } catch (e: unknown) {
        if (!(e instanceof Error && e.name === 'AbortError')) {
          setOptionsError(getErrorMessage(e));
        }
      } finally {
        setLoading(false);
      }
    },
    [applyPaymentResult, payment, refresh],
  );

  // resume polling on mount if active payment stored
  useEffect(() => {
    const active = getActivePaymentId();
    if (active) {
      (async () => {
        try {
          const current = await api.getPayment(active);
          const restoredOrder = await api.getOrder(current.orderId);
          setOrder(restoredOrder);
          if (!['succeeded', 'failed', 'cancelled'].includes(current.status)) {
            // start background polling using util
            const controller = new AbortController();
            pollController.current = controller;
            pollUntil(
              () => api.getPayment(active, controller.signal),
              (r) => ['succeeded', 'failed', 'cancelled'].includes(r.status),
              { initialDelay: 500, maxDelay: 5000 },
              controller.signal,
            )
              .then(() => api.getPayment(active, controller.signal))
              .then(applyPaymentResult)
              .catch((error) => {
                if (error?.name !== 'AbortError') setOptionsError(getErrorMessage(error));
              });
          } else {
            await applyPaymentResult(current);
          }
        } catch (error: unknown) {
          const code =
            typeof error === 'object' && error !== null && 'error' in error
              ? (error as { error?: { code?: string } }).error?.code
              : undefined;
          if (code === 'PAYMENT_NOT_FOUND' || code === 'ORDER_NOT_FOUND') {
            setActivePaymentId(null);
            setActiveOrderId(null);
            setPayment(null);
            setOrder(null);
            return;
          }
          setOptionsError('Не удалось восстановить статус оплаты.');
        }
      })();
    }
    return () => {
      pollController.current?.abort();
    };
  }, [applyPaymentResult]);

  useEffect(() => () => pollController.current?.abort(), []);

  const editOrder = useCallback(() => {
    setQuote(null);
    setCompletedOrder(null);
    setOrder(null);
    setPayment(null);
    orderKey.current = null;
    paymentKey.current = null;
    setPaymentNotice(null);
    setActivePaymentId(null);
    setActiveOrderId(null);
  }, []);

  if (!cart) return <section>Загрузка...</section>;

  return (
    <section className="checkout-panel">
      <h2>Оформление</h2>
      {loading && <div>Обработка...</div>}
      {optionsError && <div style={{ color: 'crimson' }}>{optionsError}</div>}
      {paymentNotice && (
        <div
          role="status"
          style={{ color: paymentNotice.type === 'success' ? 'green' : 'crimson' }}
        >
          {paymentNotice.message}
        </div>
      )}

      {completedOrder && (
        <div className="quote-result" role="status">
          <h3>Заказ успешно оплачен</h3>
          <div>Номер заказа: {completedOrder.number}</div>
          <ul>
            {completedOrder.items.map((item) => (
              <li key={item.productId}>
                {item.title} × {item.quantity}
              </li>
            ))}
          </ul>
          <div>
            Доставка:{' '}
            {completedOrder.delivery.method === 'courier'
              ? `${completedOrder.delivery.address.city}, ${completedOrder.delivery.address.street}, ${completedOrder.delivery.address.house}`
              : 'Самовывоз'}
          </div>
          <div>Сумма: {(completedOrder.total / 100).toLocaleString()} ₽</div>
        </div>
      )}

      <div>
        <h3>Контакты</h3>
        <div>
          <input
            placeholder="Имя"
            value={customer.name}
            onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
            disabled={loading}
            className={loading ? 'input-disabled' : ''}
          />
          {fieldErrors.name && <div style={{ color: 'crimson' }}>{fieldErrors.name}</div>}
        </div>
        <div>
          <input
            placeholder="Email"
            value={customer.email}
            onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
            disabled={loading}
            className={loading ? 'input-disabled' : ''}
          />
          {fieldErrors.email && <div style={{ color: 'crimson' }}>{fieldErrors.email}</div>}
        </div>
        <div>
          <input
            placeholder="Телефон (+7999...)"
            value={customer.phone}
            onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
            disabled={loading}
            className={loading ? 'input-disabled' : ''}
          />
          {fieldErrors.phone && <div style={{ color: 'crimson' }}>{fieldErrors.phone}</div>}
        </div>
      </div>

      <div>
        <h3>Доставка</h3>
        {options?.deliveryMethods.map((d) => (
          <div key={d.id}>
            <label>
              <input
                type="radio"
                name="delivery"
                onChange={() =>
                  setDelivery(
                    d.id === 'pickup'
                      ? { method: 'pickup', pickupPointId: d.pickupPoints?.[0]?.id }
                      : { method: 'courier', address: { city: '', street: '', house: '' } },
                  )
                }
              />
              {d.title} — {(d.price / 100).toLocaleString()} ₽
            </label>
          </div>
        ))}
        {delivery?.method === 'courier' && (
          <div>
            <input
              placeholder="Город"
              value={delivery.address.city}
              onChange={(e) =>
                setDelivery({
                  ...delivery,
                  address: { ...delivery.address, city: e.target.value },
                })
              }
              disabled={loading}
            />
            <input
              placeholder="Улица"
              value={delivery.address.street}
              onChange={(e) =>
                setDelivery({
                  ...delivery,
                  address: { ...delivery.address, street: e.target.value },
                })
              }
              disabled={loading}
            />
            <input
              placeholder="Дом"
              value={delivery.address.house}
              onChange={(e) =>
                setDelivery({
                  ...delivery,
                  address: { ...delivery.address, house: e.target.value },
                })
              }
              disabled={loading}
            />
          </div>
        )}
        {fieldErrors.delivery && <div style={{ color: 'crimson' }}>{fieldErrors.delivery}</div>}
      </div>

      <div>
        <h3>Оплата</h3>
        {options?.paymentMethods.map((method) => (
          <label key={method.id}>
            <input
              type="radio"
              name="paymentMethod"
              value={method.id}
              checked={paymentMethod === method.id}
              onChange={() => setPaymentMethod(method.id)}
              disabled={loading}
            />
            {method.title}
          </label>
        ))}
      </div>

      <div style={{ marginTop: 12 }}>
        <button className="btn" onClick={getQuote} disabled={loading || !delivery}>
          {loading ? <span className="spinner" /> : null}
          Получить расчёт
        </button>
        {quote && (
          <div className="quote-result" role="status">
            <strong>Расчёт доставки создан</strong>
            <div>Товары: {(quote.subtotal / 100).toLocaleString()} ₽</div>
            <div>Доставка: {(quote.shipping / 100).toLocaleString()} ₽</div>
            <div>
              <strong>Итого: {(quote.total / 100).toLocaleString()} ₽</strong>
            </div>
            {cart && cart.version !== quote.cartVersion ? (
              <div style={{ color: 'crimson' }}>
                Расчёт устарел — измените корзину или получите новый расчёт
              </div>
            ) : (
              <Button className="btn" onClick={createOrder} disabled={!!order || loading}>
                Создать заказ
              </Button>
            )}
          </div>
        )}
        {order && (
          <div>
            <div>Заказ: {order.number}</div>
            <button
              className="btn"
              onClick={createPayment}
              disabled={
                loading || payment?.status === 'pending' || payment?.status === 'processing'
              }
            >
              {loading ? <span className="spinner" /> : null}
              {payment?.status === 'failed' || payment?.status === 'cancelled'
                ? 'Повторить оплату'
                : 'Создать попытку оплаты'}
            </button>
            <button className="btn secondary" onClick={editOrder} disabled={loading}>
              Изменить заказ
            </button>
          </div>
        )}
        {payment && (
          <div style={{ marginTop: 12 }}>
            <div>
              Попытка: {payment.id} — статус: {payment.status}
            </div>
            <div>
              <h4>Тестовые карты</h4>
              {sandbox?.cards.map((c) => (
                <div key={c.id} style={{ marginBottom: 6 }}>
                  <span>
                    {c.title} {c.maskedNumber}
                  </span>
                  <button
                    className="btn"
                    style={{ marginLeft: 8 }}
                    onClick={() => simulate(c.scenario)}
                    disabled={loading}
                  >
                    {loading ? <span className="spinner" /> : null}
                    Симулировать: {c.scenario}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
