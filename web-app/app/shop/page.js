'use client';
import { useState, useEffect } from 'react';

const s = {
  root: { minHeight: '100dvh', background: '#0f172a', color: '#f1f5f9', fontFamily: '-apple-system, sans-serif', paddingBottom: 40 },
  header: { background: '#1e293b', padding: '16px 20px', borderBottom: '1px solid #334155' },
  title: { fontSize: 17, fontWeight: 700, margin: 0 },
  sub: { fontSize: 12, color: '#64748b', margin: '4px 0 0' },
  body: { padding: '20px 16px' },
  card: { background: '#1e293b', borderRadius: 12, padding: '14px 16px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 },
  name: { flex: 1, fontSize: 15, fontWeight: 500 },
  price: { fontSize: 13, color: '#94a3b8' },
  badge: (ok) => ({ width: 28, height: 28, borderRadius: '50%', background: ok ? '#16a34a' : '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }),
  notice: (color) => ({ background: color, borderRadius: 12, padding: '12px 16px', marginBottom: 16, fontSize: 14 }),
  btn: { display: 'block', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 14, padding: 16, width: '100%', fontSize: 16, fontWeight: 600, cursor: 'pointer', textAlign: 'center', textDecoration: 'none', marginTop: 20 },
  loader: { textAlign: 'center', padding: '80px 0', color: '#64748b', fontSize: 14 },
};

export default function ShopPage() {
  const [phase, setPhase] = useState('loading');
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q') || '';
    setQuery(q);
    if (q) run(q);
  }, []);

  async function run(q) {
    setPhase('working');
    try {
      // 1. Парсим список товаров через сервер
      const parseRes = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q }),
      });
      const { items: parsed } = await parseRes.json();

      const results = [];

      // 2. Для каждого товара — браузер сам вызывает API Ленты (домашний IP!)
      for (const item of parsed) {
        try {
          // Поиск товара
          const searchRes = await fetch('https://lenta.com/api-gateway/v1/catalog/items', {
            method: 'POST',
            headers: {
              'accept': 'application/json',
              'content-type': 'application/json',
              'origin': 'https://lenta.com',
              'referer': 'https://lenta.com/',
            },
            credentials: 'include',
            body: JSON.stringify({
              query: item.query,
              filters: { checkbox: [], multicheckbox: [], range: [] },
              limit: 3, offset: 0,
              sort: { type: 'popular', order: 'desc' },
            }),
          });

          const searchData = await searchRes.json();
          const products = searchData?.items || [];

          if (!products.length) {
            results.push({ name: item.query, ok: false });
            continue;
          }

          const best = products[0];

          // Добавляем в корзину
          const cartRes = await fetch('https://lenta.com/api/rest/cartItemModify', {
            method: 'POST',
            headers: {
              'content-type': 'application/x-www-form-urlencoded',
              'origin': 'https://lenta.com',
              'referer': 'https://lenta.com/',
            },
            credentials: 'include',
            body: new URLSearchParams({
              data: JSON.stringify({
                Head: {
                  Version: 'web-12.0.762',
                  Client: 'angular_web_0.0.2',
                  Method: 'cartItemModify',
                  RequestId: `cart_${Date.now()}`,
                  Domain: 'krsk',
                },
                Body: {
                  GoodsItemId: String(best.id || best.goodsId),
                  Quantity: item.quantity || 1,
                  Return: { Cart: 1, Goods: 1 },
                },
              }),
            }),
          });

          results.push({
            name: best.title || best.name || item.query,
            price: best.price,
            ok: cartRes.ok,
          });
        } catch {
          results.push({ name: item.query, ok: false });
        }
      }

      setItems(results);
      setPhase('done');
    } catch {
      setPhase('error');
    }
  }

  if (phase === 'loading' || phase === 'working') return (
    <div style={s.root}>
      <div style={s.header}>
        <p style={s.title}>🛒 Собираю корзину...</p>
        <p style={s.sub}>{query}</p>
      </div>
      <div style={s.loader}>
        <div style={{ fontSize: 32, marginBottom: 16 }}>⏳</div>
        Ищу товары в Ленте...
      </div>
    </div>
  );

  if (phase === 'error') return (
    <div style={s.root}>
      <div style={s.header}><p style={s.title}>❌ Ошибка</p></div>
      <div style={s.body}>
        <div style={s.notice('#7f1d1d')}>Не удалось обработать запрос. Попробуй ещё раз.</div>
      </div>
    </div>
  );

  const ok = items.filter(i => i.ok);
  const fail = items.filter(i => !i.ok);

  return (
    <div style={s.root}>
      <div style={s.header}>
        <p style={s.title}>🛒 {ok.length > 0 ? 'Корзина готова!' : 'Ничего не нашлось'}</p>
        <p style={s.sub}>{ok.length} из {items.length} товаров добавлено</p>
      </div>
      <div style={s.body}>
        {ok.length > 0 && <div style={s.notice('#14532d')}>✅ Товары добавлены в твою корзину</div>}
        {items.map((item, i) => (
          <div key={i} style={s.card}>
            <div style={s.badge(item.ok)}>{item.ok ? '✓' : '✗'}</div>
            <div style={s.name}>{item.name}</div>
            {item.price && <div style={s.price}>{item.price} ₽</div>}
          </div>
        ))}
        {fail.length > 0 && (
          <div style={{ ...s.notice('#7f1d1d'), marginTop: 8 }}>
            Не найдено: {fail.map(i => i.name).join(', ')}
          </div>
        )}
        {ok.length > 0 && (
          <a href="https://lenta.com/cart" target="_blank" style={s.btn}>
            Открыть корзину и оплатить →
          </a>
        )}
      </div>
    </div>
  );
}
