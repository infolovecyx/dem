const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('../server');

const ADMIN_TOKEN = 'test-token-123';

let server;
let base;
let db;

test.before(async () => {
  ({ server, db, port: base } = await startServer({ port: 0, dbPath: ':memory:', adminToken: ADMIN_TOKEN }));
  base = `http://127.0.0.1:${base}`;
});

test.after(() => {
  server.close();
  db.close();
});

async function call(pathname, { method = 'GET', body, admin = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (admin) headers['x-admin-token'] = ADMIN_TOKEN;
  const res = await fetch(base + pathname, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch { /* réponse vide */ }
  return { status: res.status, data };
}

test('GET / sert la page d\'accueil', async () => {
  const res = await fetch(base + '/');
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /LoveCyx/);
  assert.match(res.headers.get('content-type'), /text\/html/);
});

test('GET /api/products retourne les produits de démo', async () => {
  const { status, data } = await call('/api/products');
  assert.equal(status, 200);
  assert.ok(data.products.length >= 5);
  for (const p of data.products) {
    assert.ok(Number.isInteger(p.price_cents) && p.price_cents >= 0);
    assert.ok(p.name && p.category && typeof p.stock === 'number');
  }
});

test('GET /api/products filtre par catégorie et recherche', async () => {
  const byCat = await call('/api/products?category=' + encodeURIComponent('Culottes menstruelles'));
  assert.equal(byCat.status, 200);
  assert.ok(byCat.data.products.length > 0);
  assert.ok(byCat.data.products.every((p) => p.category === 'Culottes menstruelles'));

  const byQ = await call('/api/products?q=culotte');
  assert.ok(byQ.data.products.some((p) => p.name.toLowerCase().includes('culotte')));
});

test('GET /api/products/:id renvoie un produit, 404 sinon', async () => {
  const list = await call('/api/products');
  const first = list.data.products[0];
  const one = await call(`/api/products/${first.id}`);
  assert.equal(one.status, 200);
  assert.equal(one.data.id, first.id);
  const missing = await call('/api/products/999999');
  assert.equal(missing.status, 404);
  assert.ok(missing.data.error);
});

test('POST /api/orders crée une commande et décrémente le stock', async () => {
  const list = await call('/api/products');
  const p = list.data.products.find((x) => x.stock >= 5);
  const before = (await call(`/api/products/${p.id}`)).data.stock;

  const order = await call('/api/orders', {
    method: 'POST',
    body: {
      items: [{ productId: p.id, qty: 2 }],
      customer: { name: 'Jean Test', email: 'jean@example.com', address: '12 rue des Lilas, 75000 Paris' }
    }
  });
  assert.equal(order.status, 201);
  const expectedShipping = p.price_cents * 2 >= 4900 ? 0 : 495;
  assert.equal(order.data.shipping_cents, expectedShipping);
  assert.equal(order.data.total_cents, p.price_cents * 2 + expectedShipping);
  assert.equal(order.data.status, 'paid');
  assert.equal(order.data.payment, 'simulated');
  assert.equal(order.data.items.length, 1);
  assert.equal(order.data.items[0].qty, 2);

  const after = (await call(`/api/products/${p.id}`)).data.stock;
  assert.equal(after, before - 2);

  const fetched = await call(`/api/orders/${order.data.id}`);
  assert.equal(fetched.status, 200);
  assert.equal(fetched.data.id, order.data.id);
  assert.equal(fetched.data.customer_email, 'jean@example.com');
});

test('livraison : offerte au-delà de 49 €, sinon 4,95 €', async () => {
  const list = await call('/api/products');
  const customer = { name: 'Jean Test', email: 'jean@example.com', address: '12 rue des Lilas, 75000 Paris' };
  const cheap = list.data.products.find((x) => x.price_cents < 4900 && x.stock > 0);
  const small = await call('/api/orders', { method: 'POST', body: { items: [{ productId: cheap.id, qty: 1 }], customer } });
  assert.equal(small.status, 201);
  assert.equal(small.data.shipping_cents, 495);
  assert.equal(small.data.total_cents, cheap.price_cents + 495);
  const big = list.data.products.find((x) => x.price_cents >= 4900 && x.stock > 0);
  const large = await call('/api/orders', { method: 'POST', body: { items: [{ productId: big.id, qty: 1 }], customer } });
  assert.equal(large.status, 201);
  assert.equal(large.data.shipping_cents, 0);
  assert.equal(large.data.total_cents, big.price_cents);
});

test('POST /api/orders refuse un stock insuffisant (409)', async () => {
  const list = await call('/api/products');
  const p = list.data.products.find((x) => x.stock > 0 && x.stock + 10 <= 99);
  const res = await call('/api/orders', {
    method: 'POST',
    body: {
      items: [{ productId: p.id, qty: p.stock + 10 }],
      customer: { name: 'Jean Test', email: 'jean@example.com', address: '12 rue des Lilas, 75000 Paris' }
    }
  });
  assert.equal(res.status, 409);
  assert.match(res.data.error, /Stock insuffisant/);
});

test('POST /api/orders valide le payload (400)', async () => {
  const customer = { name: 'Jean Test', email: 'jean@example.com', address: '12 rue des Lilas, 75000 Paris' };
  const empty = await call('/api/orders', { method: 'POST', body: { items: [], customer } });
  assert.equal(empty.status, 400);

  const badQty = await call('/api/orders', { method: 'POST', body: { items: [{ productId: 1, qty: 0 }], customer } });
  assert.equal(badQty.status, 400);

  const badEmail = await call('/api/orders', { method: 'POST', body: { items: [{ productId: 1, qty: 1 }], customer: { ...customer, email: 'pas-un-email' } } });
  assert.equal(badEmail.status, 400);

  const shortName = await call('/api/orders', { method: 'POST', body: { items: [{ productId: 1, qty: 1 }], customer: { ...customer, name: 'A' } } });
  assert.equal(shortName.status, 400);

  const unknown = await call('/api/orders', { method: 'POST', body: { items: [{ productId: 424242, qty: 1 }], customer } });
  assert.equal(unknown.status, 404);
});

test('les routes admin exigent un token (401)', async () => {
  const noToken = await call('/api/admin/orders');
  assert.equal(noToken.status, 401);
  const wrongToken = await fetch(base + '/api/admin/orders', { headers: { 'x-admin-token': 'mauvais' } });
  assert.equal(wrongToken.status, 401);
});

test('CRUD admin des produits avec token', async () => {
  const created = await call('/api/admin/products', {
    method: 'POST',
    admin: true,
    body: { name: 'Produit test', description: 'desc', price_cents: 1234, category: 'Test', stock: 7, image: '🧪' }
  });
  assert.equal(created.status, 201);
  const id = created.data.id;
  assert.equal(created.data.price_cents, 1234);

  const updated = await call(`/api/admin/products/${id}`, {
    method: 'PATCH',
    admin: true,
    body: { price_cents: 999, stock: 3 }
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.data.price_cents, 999);
  assert.equal(updated.data.stock, 3);
  assert.equal(updated.data.name, 'Produit test');

  const badPatch = await call(`/api/admin/products/${id}`, { method: 'PATCH', admin: true, body: { price_cents: -5 } });
  assert.equal(badPatch.status, 400);

  const deleted = await call(`/api/admin/products/${id}`, { method: 'DELETE', admin: true });
  assert.equal(deleted.status, 200);
  const gone = await call(`/api/products/${id}`);
  assert.equal(gone.status, 404);
});

test('admin : liste des commandes et changement de statut avec restauration du stock', async () => {
  const list = await call('/api/products');
  const p = list.data.products.find((x) => x.stock >= 3);
  const stockBefore = (await call(`/api/products/${p.id}`)).data.stock;

  const order = await call('/api/orders', {
    method: 'POST',
    body: {
      items: [{ productId: p.id, qty: 3 }],
      customer: { name: 'Marie Test', email: 'marie@example.com', address: '5 avenue de la Paix, Lyon' }
    }
  });
  assert.equal(order.status, 201);

  const orders = await call('/api/admin/orders', { admin: true });
  assert.equal(orders.status, 200);
  assert.ok(orders.data.orders.some((o) => o.id === order.data.id));

  const cancelled = await call(`/api/admin/orders/${order.data.id}`, { method: 'PATCH', admin: true, body: { status: 'cancelled' } });
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.data.status, 'cancelled');

  const stockAfter = (await call(`/api/products/${p.id}`)).data.stock;
  assert.equal(stockAfter, stockBefore);

  const badStatus = await call(`/api/admin/orders/${order.data.id}`, { method: 'PATCH', admin: true, body: { status: 'pirate' } });
  assert.equal(badStatus.status, 400);
});

test('sécurité : le serveur statique refuse la traversée de répertoires', async () => {
  const res = await fetch(base + '/..%2f..%2fserver.js');
  assert.ok([403, 404].includes(res.status));
});

test('route API inconnue renvoie 404 JSON', async () => {
  const { status, data } = await call('/api/nexistepas');
  assert.equal(status, 404);
  assert.ok(data.error);
});
