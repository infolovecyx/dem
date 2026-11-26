const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  category TEXT NOT NULL DEFAULT 'Divers',
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image TEXT NOT NULL DEFAULT '📦',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_address TEXT NOT NULL,
  total_cents INTEGER NOT NULL CHECK (total_cents >= 0),
  shipping_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid','shipped','cancelled')),
  payment TEXT NOT NULL DEFAULT 'simulated',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0)
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
`;

const SEED_PRODUCTS = [
  { name: 'Culotte menstruelle LoveCyx — flux moyen', description: "4 couches anti-fuite, coton bio, jusqu'à 8 h sans fuite. Tailles XS–3XL. Tissu certifié OEKO-TEX Standard 100.", price_cents: 2490, category: 'Culottes menstruelles', stock: 60, image: '🩷' },
  { name: 'Pack découverte — 3 culottes menstruelles', description: '3 modèles (flux léger / moyen / nuit) pour trouver le tien. 59 € au lieu de 74,70 €.", price_cents: 5900, category: 'Culottes menstruelles', stock: 25, image: '🎁' },
  { name: 'Pack 5 serviettes lavables', description: 'Coton bio + couche PUL imperméable, pressions inox. Jour, nuit et protège-slip inclus.', price_cents: 1690, category: 'Serviettes lavables', stock: 40, image: '🌿' },
  { name: 'Boîte 10 patchs chauffants', description: 'Chaleur réconfortante 8–12 h, température max 45 °C, testés dermatologiquement. À poser sous le ventre.', price_cents: 990, category: 'Confort & chaleur', stock: 80, image: '🔥' },
  { name: 'Bouillotte sèche graines de lin', description: 'Housse coton, remplissage graines de lin. 2 min au micro-ondes pour ~30 min de chaleur douce.', price_cents: 1290, category: 'Confort & chaleur', stock: 35, image: '🌾' },
  { name: 'Pochette étanche multi-usage', description: 'Polyester enduit PU (sans PVC), zip étanche. Pour culottes sales ou maillot mouillé. Tailles S/M/L.', price_cents: 790, category: 'Accessoires', stock: 100, image: '👜' }
];

function seed(db) {
  const insert = db.prepare(
    'INSERT INTO products (name, description, price_cents, category, stock, image) VALUES ($name, $description, $price_cents, $category, $stock, $image)'
  );
  db.exec('BEGIN');
  try {
    for (const p of SEED_PRODUCTS) insert.run(p);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function openDatabase(dbPath) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  try { db.exec('ALTER TABLE orders ADD COLUMN shipping_cents INTEGER NOT NULL DEFAULT 0'); } catch {}
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM products').get();
  if (n === 0) seed(db);
  return db;
}

module.exports = { openDatabase, SEED_PRODUCTS };
