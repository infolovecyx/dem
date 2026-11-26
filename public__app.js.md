const app = document.getElementById('app');
const cartBadge = document.getElementById('cart-badge');

const CART_KEY = 'lovecyx-cart';
const ADMIN_TOKEN_KEY = 'lovecyx-admin-token';

const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const fmtPrice = (cents) => eur.format(cents / 100);

let shopConfig = { free_shipping_threshold_cents: 4900, shipping_cents: 495, currency: 'EUR' };
async function loadConfig() {
  try { shopConfig = await api('/api/config'); } catch {}
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function loadCart() {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY) || '{}');
    const cart = {};
    for (const [id, qty] of Object.entries(raw)) {
      const n = Number(qty);
      if (Number.isInteger(n) && n > 0 && n <= 99) cart[id] = n;
    }
    return cart;
  } catch {
    return {};
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateBadge();
}

function updateBadge() {
  const cart = loadCart();
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  cartBadge.textContent = String(count);
}

function getAdminToken() {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY) || '';
}

async function api(pathname, { method = 'GET', body, admin = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (admin) headers['x-admin-token'] = getAdminToken();
  const res = await fetch(pathname, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) {
    const message = data && data.error ? data.error : `Erreur HTTP ${res.status}`;
    throw Object.assign(new Error(message), { status: res.status });
  }
  return data;
}

function alertHtml(type, message) {
  return `<div class="alert ${type}">${esc(message)}</div>`;
}

async function renderHome(query = '') {
  const [productsData, categoriesData] = await Promise.all([
    api('/api/products' + (query ? `?q=${encodeURIComponent(query)}` : '')),
    api('/api/products/categories')
  ]);
  const activeCategory = new URLSearchParams(location.hash.split('?')[1] || '').get('category') || '';
  const categories = categoriesData.categories;

  let categoryChips = `<button class="chip ${!activeCategory ? 'active' : ''}" data-category="">Toutes</button>`;
  for (const c of categories) {
    categoryChips += `<button class="chip ${activeCategory === c ? 'active' : ''}" data-category="${esc(c)}">${esc(c)}</button>`;
  }

  const cards = productsData.products.map((p) => `
    <div class="card">
      <div class="emoji">${esc(p.image)}</div>
      <span class="category">${esc(p.category)}</span>
      <h3><a href="#/produit/${p.id}" style="color:inherit;text-decoration:none">${esc(p.name)}</a></h3>
      <span class="price">${fmtPrice(p.price_cents)}</span>
      <span class="stock ${p.stock <= 5 ? 'low' : ''}">${p.stock > 0 ? `En stock : ${p.stock}` : 'Rupture de stock'}</span>
      <button class="btn small" data-add="${p.id}" ${p.stock === 0 ? 'disabled' : ''}>Ajouter au panier</button>
    </div>
  `).join('');

  app.innerHTML = `
    <h1 class="page-title">Nos produits</h1>
    <div class="usp-bar">
      <span>🩷 Testé en labo européen</span>
      <span>🚚 Livraison 2–4 j depuis l'UE</span>
      <span>🎁 Livraison offerte dès 49 €</span>
      <span>✅ 30 j satisfait ou remboursé</span>
    </div>
    <div class="toolbar">
      <input type="search" id="search" placeholder="Rechercher un produit…" value="${esc(query)}">
      <div id="chips" style="display:flex;gap:0.5rem;flex-wrap:wrap">${categoryChips}</div>
    </div>
    ${productsData.products.length === 0 ? '<div class="empty-state">Aucun produit ne correspond à votre recherche. 🛢</div>' : `<div class="grid">${cards}</div>`}
  `;

  let searchTimer;
  document.getElementById('search').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const q = e.target.value.trim();
      location.hash = q ? `#/?q=${encodeURIComponent(q)}` : '#/';
    }, 250);
  });
  document.getElementById('chips').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-category]');
    if (!btn) return;
    const cat = btn.dataset.category;
    location.hash = cat ? `#/?category=${encodeURIComponent(cat)}` : '#/';
  });
  app.addEventListener('click', handleAddToCart);
}

function handleAddToCart(e) {
  const btn = e.target.closest('[data-add]');
  if (!btn) return;
  const cart = loadCart();
  const id = btn.dataset.add;
  cart[id] = Math.min((cart[id] || 0) + 1, 99);
  saveCart(cart);
  btn.textContent = 'Ajouté ✓';
  setTimeout(() => { btn.textContent = 'Ajouter au panier'; }, 900);
}

async function renderProduct(id) {
  let product;
  try {
    product = await api(`/api/products/${id}`);
  } catch (err) {
    app.innerHTML = `<div class="empty-state">${esc(err.message)}</div><p style="text-align:center"><a class="btn secondary" href="#/">Retour à la boutique</a></p>`;
    return;
  }
  app.innerHTML = `
    <p><a href="#/" style="color:var(--primary)">← Retour à la boutique</a></p>
    <div class="product-detail">
      <div class="emoji">${esc(product.image)}</div>
      <div>
        <span class="category" style="color:var(--muted);font-size:0.85rem;text-transform:uppercase">${esc(product.category)}</span>
        <h1>${esc(product.name)}</h1>
        <p>${esc(product.description)}</p>
        <p class="price">${fmtPrice(product.price_cents)}</p>
        <p class="stock ${product.stock <= 5 ? 'low' : ''}" style="${product.stock <= 5 ? 'color:var(--danger);font-weight:600' : 'color:var(--muted)'}">${product.stock > 0 ? `En stock : ${product.stock}` : 'Rupture de stock'}</p>
        <div class="qty-row">
          <button id="qty-minus">−</button>
          <span id="qty" style="min-width:2ch;text-align:center;font-weight:600">1</span>
          <button id="qty-plus">+</button>
        </div>
        <button class="btn" id="add-btn" ${product.stock === 0 ? 'disabled' : ''}>Ajouter au panier</button>
        <div class="info-box">🩷 Testé en labo européen · 🚚 Livraison 2–4 j depuis l'UE · 🎁 Offerte dès 49 € · ✅ 30 j satisfait ou remboursé</div>
      </div>
    </div>
  `;
  let qty = 1;
  const qtyEl = document.getElementById('qty');
  document.getElementById('qty-minus').onclick = () => { qty = Math.max(1, qty - 1); qtyEl.textContent = qty; };
  document.getElementById('qty-plus').onclick = () => { qty = Math.min(product.stock, qty + 1); qtyEl.textContent = qty; };
  document.getElementById('add-btn').onclick = () => {
    const cart = loadCart();
    cart[product.id] = Math.min((cart[product.id] || 0) + qty, 99);
    saveCart(cart);
    location.hash = '#/panier';
  };
}

async function renderCart() {
  const cart = loadCart();
  const ids = Object.keys(cart);
  if (ids.length === 0) {
    app.innerHTML = `<div class="empty-state"><p style="font-size:3rem">🛢</p><p>Votre panier est vide.</p><p><a class="btn" href="#/">Voir la boutique</a></p></div>`;
    return;
  }
  const { products } = await api('/api/products');
  const rows = [];
  let total = 0;
  for (const p of products) {
    const qty = cart[p.id];
    if (!qty) continue;
    total += p.price_cents * qty;
    rows.push(`
      <tr>
        <td><span class="emoji">${esc(p.image)}</span></td>
        <td><a href="#/produit/${p.id}" style="color:inherit">${esc(p.name)}</a><br><small style="color:var(--muted)">${esc(p.category)}</small></td>
        <td>
          <button class="btn small secondary" data-dec="${p.id}">−</button>
          <span style="display:inline-block;min-width:2ch;text-align:center;font-weight:600">${qty}</span>
          <button class="btn small secondary" data-inc="${p.id}" ${qty >= p.stock ? 'disabled' : ''}>+</button>
        </td>
        <td class="num">${fmtPrice(p.price_cents)}</td>
        <td class="num"><strong>${fmtPrice(p.price_cents * qty)}</strong></td>
        <td><button class="btn small danger" data-del="${p.id}">✕</button></td>
      </tr>
    `);
  }
  await loadConfig();
  const shipping = total >= shopConfig.free_shipping_threshold_cents ? 0 : shopConfig.shipping_cents;
  app.innerHTML = `
    <h1 class="page-title">Votre panier</h1>
    <table class="cart-table">
      <thead><tr><th></th><th>Produit</th><th>Quantité</th><th class="num">Prix unitaire</th><th class="num">Sous-total</th><th></th></tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>
    <div class="summary" style="max-width:380px;margin-left:auto">
      <div class="row"><span>Sous-total</span><span>${fmtPrice(total)}</span></div>
      <div class="row"><span>Livraison UE (2–4 j)</span><span>${shipping === 0 ? 'Offerte 🎉' : fmtPrice(shipping)}</span></div>
      <div class="row total"><span>Total</span><span>${fmtPrice(total + shipping)}</span></div>
      ${shipping > 0 ? `<p style="font-size:0.85rem;color:var(--muted)">Plus que ${fmtPrice(shopConfig.free_shipping_threshold_cents - total)} pour la livraison offerte 🎁</p>` : ''}
      <a class="btn block" href="#/checkout">Passer commande</a>
    </div>
  `;
  app.onclick = (e) => {
    const cartNow = loadCart();
    const inc = e.target.closest('[data-inc]');
    const dec = e.target.closest('[data-dec]');
    const del = e.target.closest('[data-del]');
    if (inc) { cartNow[inc.dataset.inc] = Math.min((cartNow[inc.dataset.inc] || 0) + 1, 99); saveCart(cartNow); renderCart(); }
    if (dec) {
      const id = dec.dataset.dec;
      cartNow[id] = (cartNow[id] || 0) - 1;
      if (cartNow[id] <= 0) delete cartNow[id];
      saveCart(cartNow); renderCart();
    }
    if (del) { delete cartNow[del.dataset.del]; saveCart(cartNow); renderCart(); }
  };
}

async function renderCheckout() {
  const cart = loadCart();
  const ids = Object.keys(cart);
  if (ids.length === 0) {
    app.innerHTML = `<div class="empty-state"><p>Votre panier est vide.</p><p><a class="btn" href="#/">Voir la boutique</a></p></div>`;
    return;
  }
  const { products } = await api('/api/products');
  await loadConfig();
  let total = 0;
  const lines = [];
  for (const p of products) {
    const qty = cart[p.id];
    if (!qty) continue;
    if (qty > p.stock) {
      app.innerHTML = `<div class="empty-state">${alertHtml('error', `Stock insuffisant pour « ${p.name} » (disponible : ${p.stock}).`)}<p><a class="btn secondary" href="#/panier">Retour au panier</a></p></div>`;
      return;
    }
    total += p.price_cents * qty;
    lines.push(`<div class="row"><span>${esc(p.image)} ${esc(p.name)} × ${qty}</span><span>${fmtPrice(p.price_cents * qty)}</span></div>`);
  }
  const shipping = total >= shopConfig.free_shipping_threshold_cents ? 0 : shopConfig.shipping_cents;
  app.innerHTML = `
    <h1 class="page-title">Finaliser la commande</h1>
    <div class="alert info">💳 Mode MVP : le paiement est <strong>simulé</strong>, aucun paiement réel n'est effectué.</div>
    <div id="form-error"></div>
    <div class="checkout-layout">
      <form class="form-card" id="checkout-form">
        <h2>Vos coordonnées</h2>
        <div class="field"><label for="f-name">Nom complet</label><input id="f-name" name="name" required minlength="2" maxlength="100" autocomplete="name"></div>
        <div class="field"><label for="f-email">E-mail</label><input id="f-email" name="email" type="email" required autocomplete="email"></div>
        <div class="field"><label for="f-address">Adresse de livraison</label><textarea id="f-address" name="address" required minlength="5" maxlength="200" rows="3" autocomplete="street-address"></textarea></div>
        <button class="btn block" type="submit">Confirmer la commande (${fmtPrice(total + shipping)})</button>
      </form>
      <div class="summary">
        <h2 style="margin-top:0">Récapitulatif</h2>
        ${lines.join('')}
        <div class="row"><span>Livraison UE (2–4 j)</span><span>${shipping === 0 ? 'Offerte 🎉' : fmtPrice(shipping)}</span></div>
        <div class="row total"><span>Total</span><span>${fmtPrice(total + shipping)}</span></div>
      </div>
    </div>
  `;
  document.getElementById('checkout-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const errorBox = document.getElementById('form-error');
    errorBox.innerHTML = '';
    const items = Object.entries(loadCart()).map(([productId, qty]) => ({ productId: Number(productId), qty }));
    try {
      const order = await api('/api/orders', {
        method: 'POST',
        body: {
          items,
          customer: {
            name: form.name.value,
            email: form.email.value,
            address: form.address.value
          }
        }
      });
      saveCart({});
      location.hash = `#/commande/${order.id}`;
    } catch (err) {
      errorBox.innerHTML = alertHtml('error', err.message);
      window.scrollTo(0, 0);
    }
  });
}

async function renderOrder(id) {
  let order;
  try {
    order = await api(`/api/orders/${id}`);
  } catch (err) {
    app.innerHTML = `<div class="empty-state">${esc(err.message)}</div>`;
    return;
  }
  const items = order.items.map((i) => `
    <div class="row"><span>${esc(i.name)} × ${i.qty}</span><span>${fmtPrice(i.unit_price_cents * i.qty)}</span></div>
  `).join('');
  const statusLabel = { paid: 'Payée (simulé)', shipped: 'Expédiée', cancelled: 'Annulée' }[order.status] || order.status;
  app.innerHTML = `
    <div class="form-card confirmation">
      <div class="big-emoji">✅</div>
      <h1>Commande n°${order.id} confirmée !</h1>
      <p>Merci ${esc(order.customer_name)} ! Un e-mail de confirmation a été envoyé à <strong>${esc(order.customer_email)}</strong>.</p>
      <div class="summary" style="text-align:left;max-width:420px;margin:1rem auto">
        ${items}
        <div class="row"><span>Livraison</span><span>${order.shipping_cents === 0 ? 'Offerte 🎉' : fmtPrice(order.shipping_cents)}</span></div>
        <div class="row total"><span>Total</span><span>${fmtPrice(order.total_cents)}</span></div>
        <div class="row"><span>Statut</span><span class="status-pill status-${order.status}">${esc(statusLabel)}</span></div>
        <div class="row"><span>Livraison</span><span>${esc(order.customer_address)}</span></div>
        <div class="row"><span>Paiement</span><span>${order.payment === 'simulated' ? 'Simulé (MVP)' : esc(order.payment)}</span></div>
      </div>
      <p><a class="btn" href="#/">Continuer mes achats</a></p>
    </div>
  `;
}

function productFormHtml(editing) {
  const p = editing || {};
  return `
    <form class="form-card" id="product-form" style="margin-bottom:1.5rem">
      <h2>${p.id ? `Modifier le produit n°${p.id}` : 'Nouveau produit'}</h2>
      <input type="hidden" id="pf-id" value="${p.id || ''}">
      <div class="field"><label for="pf-name">Nom</label><input id="pf-name" required minlength="2" maxlength="120" value="${esc(p.name || '')}"></div>
      <div class="field"><label for="pf-desc">Description</label><textarea id="pf-desc" rows="2" maxlength="500">${esc(p.description || '')}</textarea></div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.75rem">
        <div class="field"><label for="pf-price">Prix (€)</label><input id="pf-price" type="number" step="0.01" min="0" required value="${p.price_cents != null ? (p.price_cents / 100).toFixed(2) : ''}"></div>
        <div class="field"><label for="pf-stock">Stock</label><input id="pf-stock" type="number" step="1" min="0" required value="${p.stock ?? 0}"></div>
        <div class="field"><label for="pf-image">Emoji</label><input id="pf-image" maxlength="8" required value="${esc(p.image || '📦')}"></div>
      </div>
      <div class="field"><label for="pf-cat">Catégorie</label><input id="pf-cat" required minlength="2" maxlength="50" value="${esc(p.category || '')}" list="category-list"></div>
      <datalist id="category-list"></datalist>
      <div style="display:flex;gap:0.5rem">
        <button class="btn" type="submit">${p.id ? 'Enregistrer' : 'Créer le produit'}</button>
        ${p.id ? '<button class="btn secondary" type="button" id="pf-cancel">Annuler</button>' : ''}
      </div>
    </form>
  `;
}

async function renderAdmin() {
  if (!getAdminToken()) {
    app.innerHTML = `
      <h1 class="page-title">Administration</h1>
      <form class="form-card" id="admin-login" style="max-width:420px">
        <h2>Connexion admin</h2>
        <div class="field"><label for="admin-token">Token administrateur</label><input id="admin-token" type="password" required placeholder="x-admin-token"></div>
        <div id="login-error"></div>
        <button class="btn block" type="submit">Se connecter</button>
      </form>
    `;
    document.getElementById('admin-login').addEventListener('submit', async (e) => {
      e.preventDefault();
      const token = document.getElementById('admin-token').value;
      sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
      try {
        await api('/api/admin/orders', { admin: true });
        renderAdmin();
      } catch (err) {
        sessionStorage.removeItem(ADMIN_TOKEN_KEY);
        document.getElementById('login-error').innerHTML = alertHtml('error', err.message);
      }
    });
    return;
  }

  const tab = (location.hash.split('?')[1] ? new URLSearchParams(location.hash.split('?')[1]).get('tab') : null) || 'produits';
  const [productsData, categoriesData, ordersData] = await Promise.all([
    api('/api/products'),
    api('/api/products/categories'),
    api('/api/admin/orders', { admin: true })
  ]);

  const productRows = productsData.products.map((p) => `
    <tr>
      <td>${p.id}</td>
      <td><span class="emoji" style="font-size:1.4rem">${esc(p.image)}</span></td>
      <td>${esc(p.name)}<br><small style="color:var(--muted)">${esc(p.category)}</small></td>
      <td class="num">${fmtPrice(p.price_cents)}</td>
      <td class="num">${p.stock}</td>
      <td>
        <button class="btn small secondary" data-edit="${p.id}">Modifier</button>
        <button class="btn small danger" data-delete="${p.id}">Supprimer</button>
      </td>
    </tr>
  `).join('');

  const orderRows = ordersData.orders.map((o) => `
    <tr>
      <td>#${o.id}</td>
      <td>${esc(o.customer_name)}<br><small style="color:var(--muted)">${esc(o.customer_email)}</small></td>
      <td class="num">${fmtPrice(o.total_cents)}</td>
      <td><span class="status-pill status-${o.status}">${esc(o.status)}</span></td>
      <td>${esc(o.created_at)}</td>
      <td>
        <select class="status-select" data-order="${o.id}">
          <option value="paid" ${o.status === 'paid' ? 'selected' : ''}>paid</option>
          <option value="shipped" ${o.status === 'shipped' ? 'selected' : ''}>shipped</option>
          <option value="cancelled" ${o.status === 'cancelled' ? 'selected' : ''}>cancelled</option>
        </select>
      </td>
    </tr>
  `).join('');

  app.innerHTML = `
    <h1 class="page-title">Administration</h1>
    <div class="toolbar" style="justify-content:space-between">
      <div class="admin-tabs">
        <button class="chip ${tab === 'produits' ? 'active' : ''}" data-tab="produits">Produits (${productsData.products.length})</button>
        <button class="chip ${tab === 'commandes' ? 'active' : ''}" data-tab="commandes">Commandes (${ordersData.orders.length})</button>
      </div>
      <button class="btn small secondary" id="logout">Se déconnecter</button>
    </div>
    <div id="admin-message"></div>
    <div id="admin-content">
      ${tab === 'commandes' ? `
        ${ordersData.orders.length === 0 ? '<div class="empty-state">Aucune commande pour le moment.</div>' : `
        <table class="admin-table">
          <thead><tr><th>Commande</th><th>Client</th><th class="num">Total</th><th>Statut</th><th>Date</th><th>Changer le statut</th></tr></thead>
          <tbody>${orderRows}</tbody>
        </table>`}
      ` : `
        <div id="product-form-slot"></div>
        <table class="admin-table">
          <thead><tr><th>ID</th><th></th><th>Produit</th><th class="num">Prix</th><th class="num">Stock</th><th>Actions</th></tr></thead>
          <tbody>${productRows}</tbody>
        </table>
      `}
    </div>
  `;

  const catList = document.getElementById('category-list');
  if (catList) catList.innerHTML = categoriesData.categories.map((c) => `<option value="${esc(c)}">`).join('');

  document.getElementById('logout').onclick = () => {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    renderAdmin();
  };

  app.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.onclick = () => { location.hash = `#/admin?tab=${btn.dataset.tab}`; };
  });

  const showMsg = (type, msg) => {
    document.getElementById('admin-message').innerHTML = alertHtml(type, msg);
  };

  if (tab === 'produits') {
    const slot = document.getElementById('product-form-slot');
    const mountForm = (editing) => {
      slot.innerHTML = productFormHtml(editing);
      const form = document.getElementById('product-form');
      const cancelBtn = document.getElementById('pf-cancel');
      if (cancelBtn) cancelBtn.onclick = () => mountForm(null);
      form.onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('pf-id').value;
        const payload = {
          name: document.getElementById('pf-name').value,
          description: document.getElementById('pf-desc').value,
          price_cents: Math.round(parseFloat(document.getElementById('pf-price').value) * 100),
          stock: parseInt(document.getElementById('pf-stock').value, 10),
          image: document.getElementById('pf-image').value,
          category: document.getElementById('pf-cat').value
        };
        try {
          if (id) await api(`/api/admin/products/${id}`, { method: 'PATCH', body: payload, admin: true });
          else await api('/api/admin/products', { method: 'POST', body: payload, admin: true });
          renderAdmin();
        } catch (err) {
          showMsg('error', err.message);
        }
      };
    };
    mountForm(null);

    app.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.onclick = () => {
        const p = productsData.products.find((x) => x.id === Number(btn.dataset.edit));
        mountForm(p);
        slot.scrollIntoView({ behavior: 'smooth' });
      };
    });
    app.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.onclick = async () => {
        if (!confirm('Supprimer ce produit ?')) return;
        try {
          await api(`/api/admin/products/${btn.dataset.delete}`, { method: 'DELETE', admin: true });
          renderAdmin();
        } catch (err) {
          showMsg('error', err.message);
        }
      };
    });
  }

  if (tab === 'commandes') {
    app.querySelectorAll('.status-select').forEach((sel) => {
      sel.onchange = async () => {
        try {
          await api(`/api/admin/orders/${sel.dataset.order}`, { method: 'PATCH', body: { status: sel.value }, admin: true });
          showMsg('success', `Commande #${sel.dataset.order} mise à jour (${sel.value}).`);
        } catch (err) {
          showMsg('error', err.message);
        }
      };
    });
  }
}

const LEGAL_PAGES = {
  mentions: {
    title: 'Mentions légales',
    html: `<p><strong>Éditeur du site :</strong> LoveCyx SRL — [adresse du siège, Belgique] — n° BCE : [à compléter] — TVA : [BE…] — EORI : [à compléter]</p>
<p><strong>Directeur de la publication :</strong> [Prénom Nom]</p>
<p><strong>Hébergement :</strong> [hébergeur, adresse]</p>
<p><strong>Contact :</strong> [email professionnel]</p>
<p>Modèle de mentions légales — à faire relire par un conseil juridique avant la mise en ligne.</p>`
  },
  cgv: {
    title: 'Conditions générales de vente',
    html: `<h2>1. Produits et prix</h2><p>Tous les prix sont affichés TTC en euros. La TVA du pays du client (UE) est collectée automatiquement et déclarée via l'OSS belge.</p>
<h2>2. Commande et paiement</h2><p>Le paiement est sécurisé via notre prestataire (Mollie : Bancontact, iDEAL, cartes, PayPal). En environnement de démonstration (MVP), le paiement est <strong>simulé</strong> : aucune donnée bancaire réelle n'est transmise ni traitée.</p>
<h2>3. Livraison</h2><p>Livraison dans l'UE27 en 2–4 jours ouvrés depuis notre stock européen. <strong>Livraison offerte dès 49 €</strong>, sinon 4,95 €. EEA, Suisse et Royaume-Uni : livraison DDP possible (déclaration douane + TVA gérées par le transporteur).</p>
<h2>4. Droit de rétractation</h2><p>Conformément au droit européen, vous disposez de 14 jours pour vous rétracter. Exception légale : les produits hygiéniques scellés (culottes menstruelles, serviettes) ne peuvent être repris une fois le sceau ouvert, pour des raisons d'hygiène.</p>
<h2>5. Garantie commerciale LoveCyx</h2><p><strong>30 jours satisfait ou remboursé</strong> sur tous les produits.</p>
<h2>6. Garantie légale</h2><p>Garantie légale de conformité de 2 ans (UE), indépendante de la garantie commerciale.</p>
<h2>7. Loi applicable</h2><p>Droit belge. Tribunaux de [ressort judiciaire]. Réclamations : [email pro].</p>
<p>Modèle de CGV — à faire relire par un conseil juridique avant la mise en ligne.</p>`
  },
  confidentialite: {
    title: 'Confidentialité & cookies (RGPD)',
    html: `<h2>1. Responsable du traitement</h2><p>LoveCyx SRL, [adresse], contact : [email]. DPO désigné : [à compléter le cas échéant].</p>
<h2>2. Données traitées</h2><p>Identité et coordonnées, historique de commandes, données de paiement (traitées uniquement par Mollie — nous ne stockons jamais les données bancaires), données de navigation (cookies, après consentement).</p>
<h2>3. Finalités et bases légales</h2><p>Exécution du contrat (commande, livraison) · obligations légales (comptabilité, TVA, douane) · consentement (cookies marketing et mesure d'audience) · intérêt légitime (sécurité, prévention de la fraude).</p>
<h2>4. Durées de conservation</h2><p>Compte : tant qu'il est actif. Données de commande : 10 ans (obligations légales). Cookies : 13 mois maximum.</p>
<h2>5. Destinataires et sous-traitants</h2><p>Hébergeur (UE), Mollie (paiement), prestataire e-mail, entrepôt 3PL (logistique), outils publicitaires (Meta, TikTok — uniquement après votre consentement).</p>
<h2>6. Transferts hors UE</h2><p>Certains prestataires sont situés hors UE : transferts encadrés par les clauses contractuelles types de la Commission européenne et des mesures supplémentaires.</p>
<h2>7. Vos droits</h2><p>Accès, rectification, effacement, limitation, opposition, portabilité, retrait du consentement à tout moment. Réclamation possible auprès de l'APD (Autorité de Protection des Données, apd.be).</p>
<h2>8. Cookies</h2><p>Une bannière vous informe au premier visite. Les cookies de mesure d'audience et les pixels publicitaires ne sont déposés <strong>qu'après votre acceptation</strong>. Vous pouvez refuser ou changer d'avis à tout moment.</p>
<h2>9. Sécurité</h2><p>Connexion HTTPS, accès restreints, mots de passe stockés de façon chiffrée.</p>
<p>Modèle de politique de confidentialité — à faire relire par un conseil juridique / le DPO avant la mise en ligne.</p>`
  }
};

function renderLegal(key) {
  const page = LEGAL_PAGES[key];
  app.innerHTML = `<div class="prose"><h1 class="page-title">${page.title}</h1>${page.html}<p><a href="#/">← Retour à la boutique</a></p></div>`;
}

function initCookieBanner() {
  if (localStorage.getItem('lovecyx-cookie-consent')) return;
  const bar = document.createElement('div');
  bar.className = 'cookie-banner';
  bar.innerHTML = `<span>🍪 Ce site utilise des cookies de mesure d'audience et de publicité, uniquement avec votre consentement. <a href="#/confidentialite">Politique de confidentialité</a></span><span class="cookie-actions"><button class="btn small" id="ck-accept">Tout accepter</button><button class="btn small secondary" id="ck-refuse">Refuser</button></span>`;
  document.body.appendChild(bar);
  document.getElementById('ck-accept').onclick = () => { localStorage.setItem('lovecyx-cookie-consent', 'accepted'); bar.remove(); };
  document.getElementById('ck-refuse').onclick = () => { localStorage.setItem('lovecyx-cookie-consent', 'refused'); bar.remove(); };
}

async function router() {
  updateBadge();
  const hash = location.hash || '#/';
  const [pathPart, queryPart] = hash.slice(1).split('?');
  const params = new URLSearchParams(queryPart || '');
  const segments = pathPart.split('/').filter(Boolean);
  try {
    if (segments.length === 0) {
      await renderHome(params.get('q') || '');
    } else if (segments[0] === 'produit' && segments[1]) {
      await renderProduct(segments[1]);
    } else if (segments[0] === 'panier') {
      await renderCart();
    } else if (segments[0] === 'checkout') {
      await renderCheckout();
    } else if (segments[0] === 'commande' && segments[1]) {
      await renderOrder(segments[1]);
    } else if (segments[0] === 'cgv' || segments[0] === 'confidentialite' || segments[0] === 'mentions') {
      renderLegal(segments[0]);
    } else if (segments[0] === 'admin') {
      await renderAdmin();
    } else {
      app.innerHTML = `<div class="empty-state"><p>Page introuvable.</p><p><a class="btn" href="#/">Accueil</a></p></div>`;
    }
  } catch (err) {
    app.innerHTML = `<div class="empty-state">${alertHtml('error', err.message)}</div>`;
  }
}

window.addEventListener('hashchange', router);
initCookieBanner();
router();
