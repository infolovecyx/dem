# 🩷 LoveCyx — boutique e-commerce (MVP)

Vitrine de la marque **LoveCyx** (culottes menstruelles, serviettes lavables, patchs chauffants,
bouillotte graines de lin, pochette étanche) : catalogue, panier, **livraison offerte dès 49 €**,
commande avec paiement **simulé**, gestion des stocks, panel admin, bannière cookies RGPD et
pages légales (mentions, CGV, confidentialité).

**Stack** : Node.js ≥ 22.5, zéro dépendance externe (HTTP natif + `node:sqlite` intégré),
frontend vanilla JS/CSS. Tout tourne en local.

## Démarrage

```bash
node server.js        # ou : npm start
```

- Boutique : [http://127.0.0.1:3000](http://127.0.0.1:3000)
- Panel admin : [http://127.0.0.1:3000/#/admin](http://127.0.0.1:3000/#/admin) — token par défaut : `dev-admin-token-change-me`

Le serveur n'écoute que sur `127.0.0.1` (boucle locale uniquement).

## Tests

```bash
npm test              # 12 tests d'API (node:test, base en mémoire)
```

## Configuration (variables d'environnement)

| Variable       | Défaut                  | Rôle                                  |
|----------------|-------------------------|---------------------------------------|
| `PORT`         | `3000`                  | Port d'écoute                         |
| `DB_PATH`      | `data/shop.db`          | Fichier SQLite                        |
| `ADMIN_TOKEN`  | `dev-admin-token-change-me` | Token requis pour les routes `/api/admin/*` (en-tête `x-admin-token`) |

## Fonctionnalités

- **Boutique** (`#/`) : recherche, filtre par catégorie, fiche produit, ajout au panier (persistant en `localStorage`)
- **Panier** (`#/panier`) : quantités, suppressions, totaux
- **Checkout** (`#/checkout`) : formulaire client, création de commande atomique (transaction SQLite), décrément de stock, paiement simulé
- **Confirmation** (`#/commande/:id`) : récapitulatif de commande
- **Admin** (`#/admin`) : CRUD produits, liste des commandes, changement de statut (`paid` → `shipped` / `cancelled`, l'annulation restaure le stock)

## API

| Méthode | Route                        | Description                              | Auth   |
|---------|------------------------------|------------------------------------------|--------|
| GET     | `/api/products?q=&category=` | Liste des produits (filtrable)           | non    |
| GET     | `/api/products/categories`   | Catégories distinctes                    | non    |
| GET     | `/api/products/:id`          | Détail d'un produit                      | non    |
| POST    | `/api/orders`                | Créer une commande `{items, customer}`   | non    |
| GET     | `/api/orders/:id`            | Détail d'une commande                    | non    |
| GET     | `/api/admin/orders`          | Toutes les commandes                     | oui    |
| PATCH   | `/api/admin/orders/:id`      | Changer le statut `{status}`             | oui    |
| POST    | `/api/admin/products`        | Créer un produit                         | oui    |
| PATCH   | `/api/admin/products/:id`    | Modifier un produit (champs partiels)    | oui    |
| DELETE  | `/api/admin/products/:id`    | Supprimer un produit                     | oui    |

Les prix sont stockés en centimes (`price_cents`) pour éviter les erreurs d'arrondi.

## Documents du projet (`docs/`)

- `analyse-marche.md` — étude de marché UE/BE (taille, concurrents, SWOT)
- `pricing-lovecyx.md` — prix, coûts, marges (cible 33 % nette, ≥10 % sous la concurrence)
- `kit-lancement-pub.md` — plan pub 3 mois, 5 scripts vidéo UGC, 10 annonces, KPIs
- `rfq-fournisseurs.md` — mail RFQ fournisseurs Chine + grille d'évaluation /20
- `emails-stakeholders.md` — 12 mails prêts (notaire, comptable, assureur, labos, transitaires, 3PL, Mollie, registrar, BOIP, banque, APD)

## Structure

```
money-online/
├── server.js          # Serveur HTTP + API REST + statique
├── db.js              # Schéma SQLite + données de démo
├── public/            # SPA (index.html, styles.css, app.js)
├── test/api.test.js   # Tests d'API
├── docs/              # Étude de marché, pricing, kit pub, RFQ, mails stakeholders
└── data/              # Base SQLite (créée au premier lancement)
```

## Limites du MVP

- Paiement simulé (aucune intégration Stripe/PayPal) — à brancher avant toute mise en production
- Pas de comptes clients (commande en tant qu'invité)
- Panel admin protégé par un simple token en en-tête — à remplacer par une vraie authentification
- Pas d'envoi d'e-mails réels
