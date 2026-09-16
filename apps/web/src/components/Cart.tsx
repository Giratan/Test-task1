import React, { useState, useCallback } from 'react';
import { useCart } from '../state/cart';
import Button from './ui/Button';

const Cart = React.memo(function Cart() {
  const { cart, loading, error, setItem, removeItem } = useCart();
  const [edits, setEdits] = useState<Record<string, number>>({});

  if (!cart) return <aside className="cart">Загрузка корзины...</aside>;

  function onChange(id: string, value: string) {
    const n = Number(value || 0);
    setEdits((s) => ({ ...s, [id]: n }));
  }

  return (
    <aside className="cart">
      <h3>Корзина</h3>
      {error && <div style={{ color: 'crimson' }}>{error}</div>}
      {cart.items.length === 0 ? (
        <div>Корзина пуста</div>
      ) : (
        <ul>
          {cart.items.map((it: (typeof cart.items)[number]) => (
            <li key={it.productId} style={{ marginBottom: 12 }}>
              <div>
                <strong>{it.title}</strong>
              </div>
              <div>Цена: {(it.unitPrice / 100).toLocaleString()} ₽</div>
              <div>
                Количество:{' '}
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={edits[it.productId] ?? it.quantity}
                  onChange={(e) => onChange(it.productId, e.target.value)}
                  style={{ width: 72 }}
                />
                <Button
                  onClick={() => setItem(it.productId, Number(edits[it.productId] ?? it.quantity))}
                  disabled={loading}
                >
                  Обновить
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => removeItem(it.productId)}
                  disabled={loading}
                  style={{ marginLeft: 8 }}
                >
                  Удалить
                </Button>
              </div>
              <div>Итого: {(it.lineTotal / 100).toLocaleString()} ₽</div>
            </li>
          ))}
        </ul>
      )}
      <div className="cart-summary">
        <div>Товаров: {cart.quantity}</div>
        <div>Промежуточно: {(cart.subtotal / 100).toLocaleString()} ₽</div>
      </div>
    </aside>
  );
});

export default Cart;
