import React, { useCallback, useEffect, useState } from 'react';
import * as api from './api/endpoints';
import { getErrorMessage } from './api/client';
import type { Product } from '@checkout/contracts';
import { CartProvider, useCart } from './state/cart';
import Cart from './components/Cart';
import Checkout from './components/Checkout';

function AppContent() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { refresh } = useCart();

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        // ensure session exists
        await api.ensureSession();
        const res = await api.getProducts();
        if (mounted) setProducts(res);
      } catch (e: unknown) {
        setError(getErrorMessage(e, 'Не удалось загрузить каталог.'));
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const add = useCallback(
    async (productId: string) => {
      setLoading(true);
      setError(null);
      try {
        await api.setCartItem(productId, 1);
        await refresh();
      } catch (e: unknown) {
        setError(getErrorMessage(e, 'Не удалось добавить товар в корзину.'));
      } finally {
        setLoading(false);
      }
    },
    [refresh],
  );

  return (
    <div className="app">
      <header>
        <h1>Checkout — Web</h1>
      </header>
      <main className="app-layout">
        <section className="catalog-panel">
          <p>
            Запустите локально: <code>npm run dev -w @checkout/web</code>
          </p>
          <h2>Каталог</h2>
          {loading && <div>Загрузка...</div>}
          {error && <div style={{ color: 'crimson' }}>{error}</div>}
          <ul>
            {products.map((p) => (
              <li key={p.id} style={{ marginBottom: 12 }}>
                <strong>{p.title}</strong> — {(p.price / 100).toLocaleString()} ₽
                <div>{p.description}</div>
                <div>
                  <button onClick={() => add(p.id)} disabled={p.stock <= 0 || loading}>
                    {p.stock > 0 ? 'Добавить в корзину' : 'Нет в наличии'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <aside className="cart-panel">
          <Cart />
        </aside>
      </main>
      <Checkout />
    </div>
  );
}

export default function App() {
  return (
    <CartProvider>
      <AppContent />
    </CartProvider>
  );
}
