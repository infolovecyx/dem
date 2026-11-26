:root {
  --bg: #f4f6fb;
  --surface: #ffffff;
  --text: #1c2333;
  --muted: #667085;
  --primary: #d6336c;
  --primary-dark: #a61e4d;
  --accent: #16a34a;
  --danger: #dc2626;
  --border: #e2e8f0;
  --radius: 12px;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.site-header {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  padding: 0.8rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 10;
}

.brand {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text);
  text-decoration: none;
}

.main-nav { display: flex; gap: 1.25rem; align-items: center; }
.main-nav a { color: var(--muted); text-decoration: none; font-weight: 500; }
.main-nav a:hover { color: var(--primary); }

.badge {
  background: var(--primary);
  color: #fff;
  border-radius: 999px;
  padding: 0.1rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
}

.container {
  width: 100%;
  max-width: 1080px;
  margin: 0 auto;
  padding: 1.5rem;
  flex: 1;
}

.loading { color: var(--muted); text-align: center; padding: 3rem 0; }

.page-title { margin: 0.25rem 0 1rem; font-size: 1.6rem; }

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
  align-items: center;
}

.toolbar input[type="search"] {
  flex: 1;
  min-width: 220px;
  padding: 0.6rem 0.9rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  font-size: 0.95rem;
}

.chip {
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 999px;
  padding: 0.45rem 0.95rem;
  cursor: pointer;
  font-size: 0.9rem;
  color: var(--muted);
}
.chip.active { background: var(--primary); border-color: var(--primary); color: #fff; font-weight: 600; }

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1rem;
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  transition: box-shadow 0.15s ease, transform 0.15s ease;
}
.card:hover { box-shadow: 0 6px 18px rgba(28, 35, 51, 0.08); transform: translateY(-2px); }

.card .emoji {
  font-size: 2.6rem;
  text-align: center;
  background: var(--bg);
  border-radius: var(--radius);
  padding: 1rem 0;
}

.card h3 { margin: 0; font-size: 1.05rem; }
.card .category { color: var(--muted); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; }
.card .price { font-weight: 700; color: var(--primary-dark); font-size: 1.1rem; }
.card .stock { font-size: 0.8rem; color: var(--muted); }
.card .stock.low { color: var(--danger); font-weight: 600; }

.btn {
  display: inline-block;
  border: none;
  border-radius: var(--radius);
  background: var(--primary);
  color: #fff;
  padding: 0.6rem 1.1rem;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  text-align: center;
}
.btn:hover { background: var(--primary-dark); }
.btn:disabled { background: #b6c2d4; cursor: not-allowed; }
.btn.secondary { background: var(--surface); color: var(--text); border: 1px solid var(--border); }
.btn.secondary:hover { border-color: var(--primary); color: var(--primary); }
.btn.danger { background: var(--danger); }
.btn.small { padding: 0.35rem 0.7rem; font-size: 0.85rem; }
.btn.block { width: 100%; }

.product-detail {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 1.5rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.5rem;
}
.product-detail .emoji {
  font-size: 6rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  border-radius: var(--radius);
}
.product-detail h1 { margin: 0 0 0.5rem; }
.product-detail .price { font-size: 1.5rem; font-weight: 700; color: var(--primary-dark); }
.qty-row { display: flex; align-items: center; gap: 0.6rem; margin: 1rem 0; }
.qty-row button {
  width: 34px; height: 34px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  font-size: 1.1rem;
  cursor: pointer;
}

table.cart-table { width: 100%; border-collapse: collapse; background: var(--surface); border-radius: var(--radius); overflow: hidden; }
.cart-table th, .cart-table td { padding: 0.75rem 1rem; border-bottom: 1px solid var(--border); text-align: left; vertical-align: middle; }
.cart-table th { background: var(--bg); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
.cart-table .num { text-align: right; }
.cart-table .emoji { font-size: 1.6rem; }

.summary {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.25rem;
  margin-top: 1rem;
}
.summary .row { display: flex; justify-content: space-between; margin-bottom: 0.5rem; }
.summary .total { font-size: 1.2rem; font-weight: 700; border-top: 1px solid var(--border); padding-top: 0.6rem; }

.checkout-layout { display: grid; grid-template-columns: 1.4fr 1fr; gap: 1.5rem; align-items: start; }

.form-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1.25rem;
}
.form-card h2 { margin-top: 0; }
.field { margin-bottom: 0.9rem; }
.field label { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.3rem; color: var(--muted); }
.field input, .field textarea, .field select {
  width: 100%;
  padding: 0.6rem 0.8rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 0.95rem;
  font-family: inherit;
}
.field input:focus, .field textarea:focus, .field select:focus { outline: 2px solid rgba(47, 111, 237, 0.25); border-color: var(--primary); }

.alert { border-radius: var(--radius); padding: 0.8rem 1rem; margin-bottom: 1rem; font-size: 0.95rem; }
.alert.error { background: #fef2f2; color: var(--danger); border: 1px solid #fecaca; }
.alert.success { background: #f0fdf4; color: var(--accent); border: 1px solid #bbf7d0; }
.alert.info { background: #eff6ff; color: var(--primary-dark); border: 1px solid #bfdbfe; }

.confirmation { text-align: center; padding: 2rem 1rem; }
.confirmation .big-emoji { font-size: 4rem; }
.confirmation h1 { margin: 0.5rem 0; }

.admin-tabs { display: flex; gap: 0.5rem; margin-bottom: 1.25rem; }
.admin-tabs .chip.active { background: var(--text); border-color: var(--text); }

.admin-table { width: 100%; border-collapse: collapse; background: var(--surface); border-radius: var(--radius); overflow: hidden; }
.admin-table th, .admin-table td { padding: 0.6rem 0.8rem; border-bottom: 1px solid var(--border); text-align: left; font-size: 0.9rem; vertical-align: middle; }
.admin-table th { background: var(--bg); color: var(--muted); font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04em; }

.status-pill { border-radius: 999px; padding: 0.15rem 0.7rem; font-size: 0.8rem; font-weight: 600; }
.status-paid { background: #f0fdf4; color: var(--accent); }
.status-shipped { background: #eff6ff; color: var(--primary-dark); }
.status-cancelled { background: #fef2f2; color: var(--danger); }

.site-footer {
  border-top: 1px solid var(--border);
  background: var(--surface);
  color: var(--muted);
  text-align: center;
  font-size: 0.85rem;
  padding: 1rem;
}

.empty-state { text-align: center; color: var(--muted); padding: 3rem 0; }

@media (max-width: 760px) {
  .product-detail, .checkout-layout { grid-template-columns: 1fr; }
}

.usp-bar { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-bottom: 1.25rem; }
.usp-bar span { background: var(--surface); border: 1px solid var(--border); border-radius: 999px; padding: 0.35rem 0.8rem; font-size: 0.85rem; color: var(--muted); }

.cookie-banner { position: fixed; left: 0; right: 0; bottom: 0; background: var(--text); color: #fff; padding: 0.9rem 1.25rem; display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between; z-index: 100; font-size: 0.9rem; }
.cookie-banner a { color: #ffb3cd; }
.cookie-actions { display: flex; gap: 0.5rem; }

.prose { max-width: 760px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.5rem; }
.prose h2 { font-size: 1.05rem; margin: 1rem 0 0.4rem; }
.prose p, .prose li { font-size: 0.95rem; line-height: 1.55; }

.footer-links a { color: var(--muted); margin: 0 0.4rem; }
.info-box { margin-top: 1rem; font-size: 0.85rem; color: var(--muted); background: var(--bg); border-radius: 8px; padding: 0.7rem 0.9rem; }
