const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { openDatabase } = require('./db');

const PUBLIC_DIR = path.join(__dirname, 'public');
const DEFAULT_DB_PATH = path.join(__dirname, 'data', 'shop.db');
const DEFAULT_ADMIN_TOKEN = 'dev-admin-token-change-me';
const MAX_BODY_BYTES = 1024 * 1024;
const FREE_SHIPPING_THRESHOLD_CENTS = 4900;
const SHIPPING_CENTS = 495;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Corps de requête trop volumineux'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(Object.assign(new Error('JSON invalide'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function publicProduct(p) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    price_cents: p.price_cents,
    category: p.category,
    stock: p.stock,
    image: p.image
  };
}

function validateCustomer(customer) {
  if (!customer || typeof customer !== 'object') return 'Informations client manquantes';
  const { name, email, address } = customer;
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) return 'Nom invalide (2 à 100 caractères)';
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) return 'Adresse e-mail invalide';
  if (typeof address !== 'string' || address.trim().length < 5 || address.trim().length > 200) return 'Adresse invalide (5 à 200 caractères)';
  return null;
}

function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0) return 'Le panier est vide';
  if (items.length > 50) return 'Trop d\'articles dans la commande (50 max)';
  for (const item of items) {
    if (!item || typeof item !== 'object') return 'Article invalide';
    if (!Number.isInteger(item.productId) || item.productId <= 0) return 'Identifiant produit invalide';
    if (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > 99) return 'Quantité invalide (1 à 99)';
  }
  return null;
}

function createOrder(db, items, customer) {
  const itemError = validateItems(items);
  if (itemError) return { status: 400, error: itemError };
  const customerError = validateCustomer(customer);
  if (customerError) return { status: 400, error: customerError };

  const productStmt = db.prepare('SELECT * FROM products WHERE id = ?');
  const updateStock = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?');
  const insertOrder = db.prepare(
    'INSERT INTO orders (customer_name, customer_email, customer_address, total_cents, shipping_cents, status, payment) VALUES ($name, $email, $address, $total, $shipping, \'paid\', \'simulated\')'
  );
  const insertItem = db.prepare(
    'INSERT INTO order_items (order_id, product_id, name, unit_price_cents, qty) VALUES ($order_id, $product_id, $name, $unit_price_cents, $qty)'
  );

  db.exec('BEGIN');
  try {
    const lines = [];
    let total = 0;
    const seen = new Set();
    for (const item of items) {
      if (seen.has(item.productId)) {
        db.exec('ROLLBACK');
        return { status: 400, error: 'Produit en double dans la commande' };
      }
      seen.add(item.productId);
      const product = productStmt.get(item.productId);
      if (!product) {
        db.exec('ROLLBACK');
        return { status: 404, error: `Produit #${item.productId} introuvable` };
      }
      if (product.stock < item.qty) {
        db.exec('ROLLBACK');
        return { status: 409, error: `Stock insuffisant pour « ${product.name} » (disponible : ${product.stock})` };
      }
      const result = updateStock.run(item.qty, product.id, item.qty);
      if (result.changes !== 1) {
        db.exec('ROLLBACK');
        return { status: 409, error: `Stock insuffisant pour « ${product.name} »` };
      }
      total += product.price_cents * item.qty;
      lines.push({ product, qty: item.qty });
    }
    const shipping = total >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : SHIPPING_CENTS;
    total += shipping;
    const orderResult = insertOrder.run({
      name: customer.name.trim(),
      email: customer.email.trim().toLowerCase(),
      address: customer.address.trim(),
      total,
      shipping
    });
    const orderId = Number(orderResult.lastInsertRowid);
    for (const line of lines) {
      insertItem.run({
        order_id: orderId,
        product_id: line.product.id,
        name: line.product.name,
        unit_price_cents: line.product.price_cents,
        qty: line.qty
      });
    }
    db.exec('COMMIT');
    return { status: 201, orderId, total };
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch { /* transaction déjà annulée */ }
    throw err;
  }
}

function orderPayload(db, order) {
  const items = db.prepare(
    'SELECT product_id, name, unit_price_cents, qty FROM order_items WHERE order_id = ? ORDER BY id'
  ).all(order.id);
  return {
    id: order.id,
    customer_name: order.customer_name,
    customer_email: order.customer_email,
    customer_address: order.customer_address,
    total_cents: order.total_cents,
    shipping_cents: order.shipping_cents,
    status: order.status,
    payment: order.payment,
    created_at: order.created_at,
    items
  };
}

function validateProductInput(input, { partial = false } = {}) {
  const errors = [];
  const out = {};
  if (!partial || 'name' in input) {
    if (typeof input.name !== 'string' || input.name.trim().length < 2 || input.name.trim().length > 120) errors.push('Nom invalide (2 à 120 caractères)');
    else out.name = input.name.trim();
  }
  if (!partial || 'description' in input) {
    out.description = typeof input.description === 'string' ? input.description.trim().slice(0, 500) : '';
  }
  if (!partial || 'price_cents' in input) {
    if (!Number.isInteger(input.price_cents) || input.price_cents < 0 || input.price_cents > 100000000) errors.push('Prix invalide (entier en centimes, 0 à 1 000 000 €)');
    else out.price_cents = input.price_cents;
  }
  if (!partial || 'category' in input) {
    if (typeof input.category !== 'string' || input.category.trim().length < 2 || input.category.trim().length > 50) errors.push('Catégorie invalide (2 à 50 caractères)');
    else out.category = input.category.trim();
  }
  if (!partial || 'stock' in input) {
    if (!Number.isInteger(input.stock) || input.stock < 0 || input.stock > 1000000) errors.push('Stock invalide (entier positif)');
    else out.stock = input.stock;
  }
  if (!partial || 'image' in input) {
    if (typeof input.image !== 'string' || input.image.trim().length === 0 || input.image.trim().length > 8) errors.push('Image invalide (emoji, 8 caractères max)');
    else out.image = input.image.trim();
  }
  return { errors, out };
}

function createHandler({ db, adminToken, publicDir = PUBLIC_DIR }) {
  const routes = [];
  const route = (method, pattern, handler) => {
    const keys = [];
    const regex = new RegExp('^' + pattern.replace(/:[^/]+/g, (m) => { keys.push(m.slice(1)); return '([^/]+)'; }) + '$');
    routes.push({ method, regex, keys, handler });
  };

  const isAdmin = (req) => req.headers['x-admin-token'] === adminToken;
  const requireAdmin = (req, res) => {
    if (!isAdmin(req)) {
      sendError(res, 401, 'Token administrateur requis (en-tête x-admin-token)');
      return false;
    }
    return true;
  };

  route('GET', '/api/products', (req, res, params, body, url) => {
    const category = url.searchParams.get('category');
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();
    let rows = db.prepare('SELECT * FROM products ORDER BY created_at DESC, id DESC').all();
    if (category) rows = rows.filter((p) => p.category === category);
    if (q) rows = rows.filter((p) => (p.name + ' ' + p.description + ' ' + p.category).toLowerCase().includes(q));
    sendJson(res, 200, { products: rows.map(publicProduct) });
  });

  route('GET', '/api/products/categories', (req, res) => {
    const rows = db.prepare('SELECT DISTINCT category FROM products ORDER BY category').all();
    sendJson(res, 200, { categories: rows.map((r) => r.category) });
  });

  route('GET', '/api/config', (req, res) => {
    sendJson(res, 200, { free_shipping_threshold_cents: FREE_SHIPPING_THRESHOLD_CENTS, shipping_cents: SHIPPING_CENTS, currency: 'EUR' });
  });

  route('GET', '/api/products/:id', (req, res, params) => {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(params.id));
    if (!product) return sendError(res, 404, 'Produit introuvable');
    sendJson(res, 200, publicProduct(product));
  });

  route('POST', '/api/orders', async (req, res, params, body) => {
    const result = createOrder(db, body.items, body.customer);
    if (result.error) return sendError(res, result.status, result.error);
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(result.orderId);
    sendJson(res, 201, orderPayload(db, order));
  });

  route('GET', '/api/orders/:id', (req, res, params) => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(params.id));
    if (!order) return sendError(res, 404, 'Commande introuvable');
    sendJson(res, 200, orderPayload(db, order));
  });

  route('GET', '/api/admin/orders', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const rows = db.prepare('SELECT * FROM orders ORDER BY id DESC').all();
    sendJson(res, 200, { orders: rows.map((o) => orderPayload(db, o)) });
  });

  route('PATCH', '/api/admin/orders/:id', async (req, res, params, body) => {
    if (!requireAdmin(req, res)) return;
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(params.id));
    if (!order) return sendError(res, 404, 'Commande introuvable');
    const allowed = ['paid', 'shipped', 'cancelled'];
    if (!body || !allowed.includes(body.status)) return sendError(res, 400, `Statut invalide (attendu : ${allowed.join(', ')})`);
    if (body.status === 'cancelled' && order.status !== 'cancelled') {
      db.exec('BEGIN');
      try {
        const items = db.prepare('SELECT product_id, qty FROM order_items WHERE order_id = ?').all(order.id);
        const restore = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');
        for (const item of items) restore.run(item.qty, item.product_id);
        db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('cancelled', order.id);
        db.exec('COMMIT');
      } catch (err) {
        try { db.exec('ROLLBACK'); } catch { /* ignoré */ }
        throw err;
      }
    } else {
      db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(body.status, order.id);
    }
    const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
    sendJson(res, 200, orderPayload(db, updated));
  });

  route('POST', '/api/admin/products', async (req, res, params, body) => {
    if (!requireAdmin(req, res)) return;
    const { errors, out } = validateProductInput(body || {});
    if (errors.length > 0) return sendError(res, 400, errors.join(' ; '));
    const result = db.prepare(
      'INSERT INTO products (name, description, price_cents, category, stock, image) VALUES ($name, $description, $price_cents, $category, $stock, $image)'
    ).run(out);
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(result.lastInsertRowid));
    sendJson(res, 201, publicProduct(product));
  });

  route('PATCH', '/api/admin/products/:id', async (req, res, params, body) => {
    if (!requireAdmin(req, res)) return;
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(params.id));
    if (!product) return sendError(res, 404, 'Produit introuvable');
    const { errors, out } = validateProductInput(body || {}, { partial: true });
    if (errors.length > 0) return sendError(res, 400, errors.join(' ; '));
    const merged = { ...product, ...out };
    db.prepare('UPDATE products SET name = $name, description = $description, price_cents = $price_cents, category = $category, stock = $stock, image = $image WHERE id = $id')
      .run({
        name: merged.name,
        description: merged.description,
        price_cents: merged.price_cents,
        category: merged.category,
        stock: merged.stock,
        image: merged.image,
        id: product.id
      });
    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(product.id);
    sendJson(res, 200, publicProduct(updated));
  });

  route('DELETE', '/api/admin/products/:id', (req, res, params) => {
    if (!requireAdmin(req, res)) return;
    const result = db.prepare('DELETE FROM products WHERE id = ?').run(Number(params.id));
    if (result.changes !== 1) return sendError(res, 404, 'Produit introuvable');
    sendJson(res, 200, { deleted: Number(params.id) });
  });

  function serveStatic(req, res, pathname) {
    let rel = pathname === '/' ? '/index.html' : pathname;
    const filePath = path.normalize(path.join(publicDir, rel));
    if (!filePath.startsWith(publicDir + path.sep) && filePath !== publicDir) {
      res.writeHead(403); return res.end('Interdit');
    }
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Non trouvé');
      }
      const type = MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
      res.end(content);
    });
  }

  return async function handler(req, res) {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      const pathname = decodeURIComponent(url.pathname);
      if (!pathname.startsWith('/api/')) {
        if (req.method !== 'GET' && req.method !== 'HEAD') return sendError(res, 405, 'Méthode non autorisée');
        return serveStatic(req, res, pathname);
      }
      let body = {};
      if (req.method === 'POST' || req.method === 'PATCH' || req.method === 'PUT') {
        try {
          body = await readBody(req);
        } catch (err) {
          return sendError(res, err.status || 400, err.message);
        }
      }
      for (const r of routes) {
        if (r.method !== req.method) continue;
        const match = r.regex.exec(pathname);
        if (!match) continue;
        const params = {};
        r.keys.forEach((key, i) => { params[key] = decodeURIComponent(match[i + 1]); });
        return await r.handler(req, res, params, body, url);
      }
      sendError(res, 404, 'Route introuvable');
    } catch (err) {
      console.error(err);
      if (!res.headersSent) sendError(res, 500, 'Erreur interne du serveur');
    }
  };
}

function startServer({ port = Number(process.env.PORT) || 3000, host = '127.0.0.1', dbPath = process.env.DB_PATH || DEFAULT_DB_PATH, adminToken = process.env.ADMIN_TOKEN || DEFAULT_ADMIN_TOKEN } = {}) {
  const db = openDatabase(dbPath);
  const server = http.createServer(createHandler({ db, adminToken }));
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      resolve({ server, db, port: server.address().port, host, adminToken });
    });
  });
}

if (require.main === module) {
  startServer().then(({ port, host, adminToken }) => {
    console.log(`🩷 LoveCyx — boutique démarrée : http://${host}:${port}`);
    console.log(`Panel admin : http://${host}:${port}/#/admin (token : ${adminToken})`);
  }).catch((err) => {
    console.error('Échec du démarrage :', err);
    process.exit(1);
  });
}

module.exports = { startServer, createHandler };
