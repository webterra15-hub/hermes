# Déploiement : GitHub + Supabase + Vercel

Guide pas à pas pour mettre edumanager en ligne avec la base PostgreSQL hébergée par
Supabase et l'application servie par Vercel.

## Architecture

- **Frontend** : React + Vite, dossier `src/`, construit par Vercel
- **Backend** : Express, fonctions serverless Vercel dans `api/index.js`
- **Base de données** : PostgreSQL Supabase (tables, RLS, storage pour les logos)
- **Auth** : JWT (`jsonwebtoken`) signé avec `JWT_SECRET`, rôles admin / secrétaire / professeur

## 1. Déjà fait (ne pas refaire)

- [x] Schéma Supabase créé et appliqué sur votre projet (SQL Editor)
- [x] Migration V2 appliquée : `supabase/migrations/0002_v2_init.sql` (cycles, moratoires, teacher_subjects, evaluations, appreciations, class_observations, coefficients par classe, verrouillage des périodes/évaluations) — elle est idempotente (IF NOT EXISTS) et peut être rejouée sans risque
- [x] Migration V3 : `supabase/migrations/0003_v3_settings.sql` (verrouillage automatique des notes après délai, coefficients par cycle `cycle_subjects`, date des périodes) — à appliquer dans le SQL Editor puis rejouer si nécessaire (idempotente)
- [x] `.env.example` fourni — les variables sont documentées
- [x] `vercel.json` (rewrites SPA + `/api`)
- [x] `api/index.js` (backend serverless, testé de bout en bout : 29/29 tests V1 + 45/45 tests V2)
- [x] Compte admin initial : `admin` / `admin123`

## 2. Pousser le code sur GitHub

1. Créez un dépôt privé sur GitHub (sans fichier README, sans `.gitignore`).
2. Depuis la racine du projet, exécutez :

```bash
# Enregistrer votre dépôt comme remote
git remote add origin git@github.com:<VOTRE-COMPTE>/<NOM-DU-REPO>.git

# Premier commit
git add .
git commit -m "feat: edumanager (frontend React + API Express + Supabase)"

# Pousser la branche principale
git branch -M main
git push -u origin main
```

> **Attention** : le fichier `.env` (vos vraies clés) est ignoré par git et ne doit
> jamais être poussé. Seul `.env.example` (avec des valeurs fictives) est versionné.

## 3. Configurer les variables sur Vercel

1. Allez sur https://vercel.com → **Add New** → **Project**.
2. Importez le dépôt GitHub créé à l'étape 2.
3. Vercel détecte automatiquement **Vite** :
   - **Framework Preset** : `Vite`
   - **Build Command** : `npm run build`
   - **Output Directory** : `dist`
4. Ouvrez **Environment Variables** et ajoutez :

| Variable | Valeur |
|---|---|
| `SUPABASE_URL` | `https://okawgpxwobaechcmjqgk.supabase.co` (Settings → API → Project URL) |
| `SUPABASE_SERVICE_ROLE_KEY` | la clé `service_role` (Settings → API) |
| `JWT_SECRET` | une longue chaîne aléatoire (ex. générée par `openssl rand -hex 32`) |

5. Cliquez sur **Deploy**. À la fin, Vercel vous donne une URL de production
   (`https://<projet>.vercel.app`).

## 4. Vérifier

1. Ouvrez l'URL de production fournie par Vercel.
2. Connectez-vous avec `admin` / `admin123`.
3. Changez immédiatement le mot de passe admin (Paramètres → Utilisateurs) et le nom
   de l'établissement (Paramètres).

## 5. Développement local

```bash
# Copier les vraies clés une seule fois
cp .env.example .env   # puis éditez .env avec vos valeurs réelles

# Lancer l'API (port 3001) et le frontend (port 5173) ensemble
npm run dev

# Ou séparément
npm run server   # API seule
npm run build    # build de production frontend
```

Le frontend de dev redirige `/api` vers `http://localhost:3001` via le proxy Vite.

## 6. Remarques

- La clé `service_role` **contourne la RLS** : elle ne doit être définie que côté
  serveur (Vercel), jamais dans le code frontend ni dans une clé exposée au navigateur.
- Les logos sont stockés dans le bucket public `logos` de Supabase Storage ; leurs URLs
  publiques sont renvoyées par l'API.
- La numérotation des reçus et factures est garantie par la fonction SQL
  `next_counter(text)` (table `counters`), sans risque de doublons.
