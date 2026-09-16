import React, { createContext, useContext, useEffect, useState } from 'react';
import * as api from '../api/endpoints';
import { getErrorMessage } from '../api/client';
import type { Cart } from '@checkout/contracts';

type CartContextValue = {
  cart: Cart | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setItem: (productId: string, quantity: number) => Promise<void>;
  removeItem: (productId: string) => Promise<void>;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getCart();
      setCart(res);
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Не удалось загрузить корзину.'));
    } finally {
      setLoading(false);
    }
  }

  async function setItem(productId: string, quantity: number) {
    setLoading(true);
    setError(null);
    try {
      await api.setCartItem(productId, quantity);
      await refresh();
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Не удалось обновить корзину.'));
    } finally {
      setLoading(false);
    }
  }

  async function removeItem(productId: string) {
    setLoading(true);
    setError(null);
    try {
      await api.deleteCartItem(productId);
      await refresh();
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Не удалось удалить товар из корзины.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

  return (
    <CartContext.Provider value={{ cart, loading, error, refresh, setItem, removeItem }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
