# EduManager — Finalisation de la V2

Le projet est déployé sur Vercel + Supabase et fonctionne. La V1 (comptabilité) est déjà avancée. Maintenant je veux finaliser la V2 pour une application pleinement opérationnelle.

**Règle d'or : simplicité avant exhaustivité.** Chaque fonctionnalité doit être épurée, intuitive et utile. Ne pas surcharger l'interface. Préférer moins de fonctionnalités bien faites à beaucoup de fonctionnalités bâclées.

---

## 1. Corrections urgentes (à faire en premier)

### 1.1 Édition et suppression
Actuellement, aucune possibilité de corriger une erreur. Il faut pouvoir :
- Supprimer ou modifier une classe, un élève, une matière, une évaluation créée par erreur
- Confirmation avant suppression (dialogue "Êtes-vous sûr ?")
- Si des données sont liées (ex. : un élève a des paiements), bloquer la suppression et proposer "Archiver" à la place.
- Boutons d'édition (crayon) à côté de chaque élément dans les listes

### 1.2 Amélioration des documents générés
Les reçus de paiement actuels ne sont pas satisfaisants. Problème : la config des modèles de documents.
- Revoir le design du reçu de paiement (en-tête propre avec logo établissement, tableau clair : élève, classe, montant, mode de paiement, date, numéro de reçu unique, signature/cachet).
- Mettre en place un système de modèles cohérents (structure en-tête/corps/pied de page) réutilisable pour tous les futurs documents.
- M'expliquer comment je peux personnaliser les modèles si besoin.

---

## 2. Finaliser la section FINANCES (déjà partiellement faite)

Compléter pour avoir une comptabilité pleinement fonctionnelle :

### 2.1 Frais & Scolarité
- Configurer les frais par classe (chaque classe a son montant).
- Catégories de frais (scolarité, inscription, transport si applicable, autres)
- Délivrer des **moratoires** (dérogation de paiement accordée à un élève — avec raison et durée).
- Délivrer des **certificats de scolarité** (document PDF)

### 2.2 Transactions & Paiements
- Consulter toutes les transactions de paiement (vue liste avec filtres : date, élève, classe, mode de paiement).
- Encaisser un nouveau paiement (après l'inscription initiale – un élève vient payer une tranche supplémentaire).
- Générer le reçu à chaque encaissement

### 2.3 Journaux financiers
- Journal des entrées (toutes les entrées de caisse, pas seulement la scolarité)
- Journal des dépenses/sorties (avec catégories)

### 2.4 Rapports financiers
- Générer des rapports financiers avec filtres : par classe, par élève, par période (jour/semaine/mois/année).
- **Totaux toujours affichés à la fin** de chaque rapport
- Vue d'ensemble sur les frais : montant attendu vs payé vs restant (par élève, par classe, global).
- Export PDF de chaque rapport

---

## 3. Section PÉDAGOGIE (nouvelle — à développer)

### 3.1 Gestion académique

**Classes & structures :**
- Gérer les classes (créer, modifier, supprimer)
- Gérer les cycles/groupes de classes
- Les classes peuvent être groupées par cycle pour appliquer des configurations communes (mêmes matières, mêmes coefficients).

**Matières :**
- Gérer les matières (créer, modifier, supprimer)
- Affecter des matières à une classe ou à un groupe de classes
- Configurer le **coefficient** d'une matière : par classe, par groupe de classes, ou par établissement

### 3.2 Rôles, utilisateurs & affectations

**Rôles :**
- Créer un rôle et ses identifiants de connexion
- Gérer les accès par rôle (RBAC)

**Affectations enseignants :**
- Répartir les enseignants dans les classes.
- Désigner le **titulaire** (professeur principal) d'une classe
- Affecter une matière spécifique à un enseignant dans une classe
- Gérer l'emploi du temps des enseignants

**Règles d'accès :**
- Un enseignant voit et saisit uniquement les notes des matières/classes qui lui sont affectées.
- Le titulaire d'une classe voit toutes les notes/matières de sa classe.
- L'admin voit et modifie tout.

### 3.3 Évaluations & Bulletins

**Configuration pédagogique :**
- Configurer les périodes scolaires (5 séquences en 3 trimestres : T1 = seq 1+2, T2 = seq 3+4, T3 = seq 5)
- Configurer les matières et leurs coefficients par classe

**Création d'évaluations :**
- Créer une évaluation individuellement ou en groupe (même évaluation pour plusieurs classes d'un coup).
- Lister les évaluations créées
- Planning des évaluations (vue calendrier ou liste)

**Saisie des notes :**
- Saisir les notes par classe et par matière (notes sur /20).
- Saisir les appréciations par élève (texte libre)
- Ajouter des observations générales

**Contrôle & Verrouillage :**
- Vérifier les notes saisies.
- Verrouiller les notes (manuellement par l'admin, ou automatiquement après un délai configurable).
- Une fois verrouillées, les notes ne sont plus modifiables (sauf déverrouillage admin).

**Analyse des résultats :**
- Calcul automatique des moyennes pondérées (avec coefficients)
- Calcul des rangs par matière, par classe
- Mentions automatiques (Passable, Assez bien, Bien, Très bien, Félicitations)
- Distinctions et observations

**Bulletins :**
- Générer les bulletins à 3 niveaux : par séquence, par trimestre (compile les séquences), annuel.
- Format : en-tête établissement, notes par matière avec coefficients, moyennes, appréciations, rang, mention, total, pied de page avec signatures.
- Export PDF

**Rapports associés :**
- Procès-verbaux (PV) de classe après une évaluation
- Rapports de résultats par cycle, par classe
- Vue d'ensemble post-évaluation (synthèse de classe avec moyennes, rangs, mentions)
- Export PDF de tous ces rapports

---

## 4. Rappel des contraintes techniques

- **Déployable sur Vercel + Supabase** (déjà fait — conserver cette compatibilité)
- **API Routes Vercel** dans `/api/`, pas de serveur Express séparé
- **Supabase** pour la base de données (PostgreSQL)
- **Aucune dépendance propriétaire** — code standard npm
- **Desktop-first**, interface en français, devise FCFA

---

## 5. Ordre de priorité suggéré

1. Corrections urgentes (édition/suppression + reçu de paiement)
2. Finaliser les finances (frais par classe, moratoires, certificats, rapports complets)
3. Gestion académique (classes, cycles, matières, coefficients, affectations)
4. Évaluations (création, saisie, verrouillage, analyse)
5. Bulletins (génération par séquence/trimestre/année + rapports)
6. Rôles & accès (RBAC complet)

Garde l'interface **épurée et simple**. Mieux vaut peu de fonctionnalités bien exécutées que beaucoup de fonctionnalités incomplètes.
