# edumanager

Plateforme de gestion scolaire adaptable au **primaire** et au **secondaire** : gestion financière (scolarité, entrées, sorties, reçus) et administrative/pédagogique (élèves, classes, notes, bulletins, documents).

## Fonctionnalités

### Volet Finances
- **Scolarité** : paiements par élève (espèces), suivi des soldes, reçus de paiement automatiques, mise à jour temps réel
- **Entrées** : recettes hors scolarité (événements, dons, ventes) avec factures
- **Sorties** : dépenses de l'établissement avec factures
- **Balances** : journalière, hebdomadaire, mensuelle, annuelle
- **Tableau de bord** : recettes, dépenses, solde, paiements récents, graphique mensuel

### Volet Administration
- **Élèves** : inscription des nouveaux, réinscription des anciens, dossiers (parents, contacts)
- **Classes & Niveaux** : niveaux, classes, matières, professeurs principaux, frais de scolarité par classe
- **Notes & Bulletins** : saisie des notes sur 20, bulletins par classe et période, listes d'élèves imprimables

### Documents générés (imprimables / PDF)
- Reçus de paiement de scolarité
- Factures d'entrées et de sorties
- Bulletins de notes
- Listes des élèves par classe

Tous les documents reprennent le **logo et les informations de l'établissement** (configurables dans Paramètres).

## Rôles

| Rôle | Droits |
|------|--------|
| **Admin** | Tout : paramètres, utilisateurs, années scolaires, périodes, comptabilité complète |
| **Secrétaire** | Inscriptions, réinscriptions, paiements, entrées/sorties, reçus |
| **Professeur** | Consultation de sa classe, saisie des notes |

## Stack technique

- **Frontend** : React 18 + Vite
- **Backend** : Node.js + Express (fonctions serverless Vercel dans `api/`)
- **Base de données** : PostgreSQL **Supabase** (tables, RLS, Storage pour les logos)
- **Authentification** : JWT (rôles admin / secrétaire / professeur)

## Déploiement (GitHub + Supabase + Vercel)

Le guide complet se trouve dans [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md).

En résumé :
1. **Supabase** : créez un projet, exécutez `supabase/migrations/0001_init.sql` dans le SQL Editor
2. **GitHub** : poussez le code sur un dépôt (voir le guide)
3. **Vercel** : importez le dépôt, définissez les variables `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY` et `JWT_SECRET`, puis déployez

## Démarrage en local

```bash
# Copier les vraies clés une seule fois
cp .env.example .env   # éditez .env avec vos valeurs Supabase

# Script combiné (API sur 3001 + frontend sur 5173)
./start.sh
```

Ou séparément :

```bash
# API (port 3001)
npm run server

# Frontend (port 5173, proxy /api vers l'API)
npm run dev
```

### Compte par défaut

- Identifiant : `admin`
- Mot de passe : `admin123`

> Changez le mot de passe admin dès la première connexion (Paramètres → Utilisateurs).
