# Booth Planner — réservations de photobooth sur iPhone

Petite application pour iPhone qui permet de gérer les réservations du
photobooth : pour chaque date, voir d'un coup d'œil si le photobooth est
**libre**, **en attente de réponse** ou **loué**, et enregistrer les
coordonnées du client.

Elle contient **deux calendriers** : 📸 **Photobooth** (toutes les
prestations) et 💍 **Mariages** (fiches dédiées aux mariages), que l'on
consulte séparément ou **ensemble** grâce au sélecteur
`Tous · 📸 Photobooth · 💍 Mariages` en haut de l'écran.

C'est une *web-app installable* (PWA) : une fois ajoutée à l'écran d'accueil,
elle a sa propre icône, s'ouvre en plein écran comme une app de l'App Store
et fonctionne **sans connexion**. Pas besoin de Mac, de Xcode ni de compte
développeur Apple.

## Fonctionnalités

- **Calendrier mensuel** coloré : gris = libre, orange = en attente, rouge = loué.
  Balayez à gauche/droite pour changer de mois.
- Touchez une date → « Photobooth libre » + deux boutons **En attente** / **Loué**.
- **Fiche réservation** : dates (sur plusieurs jours possible), horaires,
  type d'événement, lieu, formule, nombre d'invités, prix, acompte, notes.
- **Coordonnées client** : nom, société, téléphone, email, adresse. Les
  coordonnées d'un client déjà connu se remplissent toutes seules.
- Raccourcis : **Appeler**, **SMS** (message de relance pré-rempli pour les
  demandes en attente), **Email**, **Itinéraire** (Plans), **Ajouter au
  calendrier** de l'iPhone, et **Confirmer la location** en un geste.
- Alerte si une date est déjà prise.
- Onglet **Réservations** (à venir / en attente / loués / passées + recherche)
  et onglet **Clients** (historique et total dépensé par client).
- Statistiques du mois : nombre de locations, demandes en attente, chiffre d'affaires.
- **Sauvegarde** : export/restauration d'un fichier `.json` (à garder dans
  Fichiers / iCloud Drive) et export **CSV** pour Excel / Numbers.
- Mode sombre automatique.

## 💍 Calendrier Mariages

- **Étapes** à la place de « En attente / Loué » :
  📩 Demande reçue → 📝 Devis envoyé → ✍️ Devis signé → 💶 Acompte reçu →
  💍 Mariage validé. Les deux premières apparaissent en orange dans le
  calendrier (en attente), les suivantes en rouge (date réservée). On
  change d'étape d'un geste depuis la fiche (« Passer à … » ou en touchant
  l'étape voulue).
- **Fiche mariage** : les deux mariés, téléphone, email, adresse ; lieu de
  réception et son adresse, nombre d'invités, organisateur / wedding
  planner et son téléphone ; formule, thème / couleurs, texte à mettre sur
  les photos (« Léa & Thomas · 12.06.2027 »).
- **Options** à cocher : impressions illimitées, livre d'or, template
  prénoms + date, fond personnalisé, accessoires, galerie en ligne / QR
  code, GIF / Boomerang, installation la veille.
- **À faire** : template photo validé par les mariés, solde réglé.
- **Compte à rebours** avant le jour J (« J-42 »), SMS de relance adapté
  aux mariés, itinéraire vers le lieu de réception.
- Thème doré quand seul le calendrier Mariages est affiché.

### Les deux calendriers ensemble

- **Une location et un mariage peuvent avoir lieu le même jour** : la
  fiche du jour propose d'ajouter l'un ou l'autre indépendamment.
- L'alerte de double réservation ne concerne que le **même** calendrier
  (deux locations, ou deux mariages, le même jour).
- **Tous** : les deux calendriers dans la même vue. Une pastille violette
  = Photobooth, dorée = Mariage.
- **📸 Photobooth** ou **💍 Mariages** seul : les jours où l'autre
  calendrier a une réservation sont marqués d'un petit rond vide, pour
  information.
- Une réservation peut changer de calendrier (choix « Calendrier » en haut
  du formulaire).
- Les réservations enregistrées avec une version précédente sont reprises
  telles quelles (les mariages reçoivent automatiquement l'étape
  correspondante).

## Confidentialité

Toutes les données restent **sur l'iPhone**, dans l'application. Rien n'est
envoyé sur Internet. Le serveur ne fait que fournir les fichiers de l'appli.
Pensez à exporter une sauvegarde de temps en temps (Réglages → Exporter).

## 🔐 Sécurité

**Il n'y a rien à pirater en ligne.** Pas de serveur, pas de compte, pas de
mot de passe stocké quelque part, pas d'espace « admin » : une adresse comme
`…/admin` affiche simplement « Page introuvable ». Le site ne fait que
distribuer les fichiers de l'appli ; les réservations ne quittent jamais
l'iPhone.

**Verrouillage par code** (Réglages → Sécurité → Protéger l'appli par un code) :
- code à 6 chiffres, codes trop simples refusés (123456, 111111, 121212…) ;
- les données sont **chiffrées sur l'iPhone** (AES-GCM 256 bits, clé dérivée
  du code par PBKDF2-SHA-256 avec 600 000 itérations et un sel aléatoire) ;
  la clé n'existe qu'en mémoire, pendant que l'appli est déverrouillée ;
- verrouillage automatique après 1 minute hors de l'appli, et bouton
  « Verrouiller maintenant » ;
- anti-essais : après 5 erreurs, attente de 30 s, doublée à chaque nouvelle
  erreur (15 min au maximum) ;
- changer ou désactiver le code demande le code actuel ;
- **code oublié = données irrécupérables** : la seule solution est de tout
  effacer puis de restaurer une sauvegarde. Gardez donc des sauvegardes.

**Sauvegardes** : quand le verrouillage est actif, les fichiers de
sauvegarde sont chiffrés avec le même code. L'export CSV (pour Excel) reste
en clair ; les cellules qui ressembleraient à une formule sont neutralisées.

**Protections techniques** :
- politique de sécurité du contenu (CSP) : seul le code de l'appli peut
  s'exécuter, et l'appli ne peut se connecter à aucun autre site ;
- tout ce qui est lu (stockage, fichier de sauvegarde) est validé, et tout ce
  qui est affiché est échappé : un fichier piégé ne peut rien injecter ;
- l'appli refuse de s'afficher dans le cadre d'un autre site, n'est pas
  indexée par les moteurs de recherche et ne transmet pas son adresse aux
  liens ouverts (Plans, etc.).

**Limites, à connaître** : un code à 6 chiffres protège très bien contre
quelqu'un qui prend votre iPhone en main. En revanche, une personne qui
mettrait la main sur un fichier de sauvegarde et disposerait de gros moyens
de calcul pourrait finir par tester les 1 000 000 de codes possibles :
rangez vos sauvegardes dans un endroit privé (Fichiers, iCloud). La première
protection reste le code de verrouillage de l'iPhone. Le code source de
l'appli est public, ce qui est normal : la sécurité repose sur votre code
secret, pas sur le secret du programme.

**Bonnes pratiques** : activer la double authentification sur GitHub (et
Netlify), ne jamais déposer de fichier de sauvegarde ou de jeton d'accès dans
le dépôt, et supprimer les jetons qui ne servent plus.

## Installation sur l'iPhone

L'iPhone doit pouvoir ouvrir l'appli une première fois via une adresse
`https://`. Le plus simple :

### Option A — GitHub Pages (automatique)

1. Sur GitHub, dans le dépôt : **Settings → Pages → Build and deployment →
   Source : « GitHub Actions »**.
2. Fusionnez cette branche dans `main` : le workflow
   `.github/workflows/deploy.yml` publie l'appli automatiquement.
3. L'adresse s'affiche dans **Settings → Pages** (du type
   `https://mescamaymeric-bot.github.io/calendrier-photobooth/`).

> GitHub Pages sur un dépôt **privé** nécessite un abonnement GitHub payant.
> Sinon, utilisez l'option B.

### Option B — Netlify Drop (2 minutes, gratuit)

1. Sur un ordinateur, allez sur <https://app.netlify.com/drop>.
2. Glissez-déposez le dossier du dépôt (téléchargé via **Code → Download ZIP**, puis dézippé).
3. Netlify vous donne une adresse `https://…netlify.app`.

### Puis, sur l'iPhone

1. Ouvrez l'adresse dans **Safari**.
2. Touchez **Partager** ⬆︎ → **« Sur l'écran d'accueil »** → **Ajouter**.
3. Lancez **Booth Planner** depuis l'écran d'accueil. 🎉

Après cette première ouverture, l'appli fonctionne même en mode avion.

## Tester une branche sans toucher à l'appli en service

L'appli publiée correspond à la branche `main`. Pour essayer une autre
branche (par exemple `claude/mariages`) sans rien changer à l'appli
installée :

1. Sur GitHub, choisissez la branche, puis **Code → Download ZIP** et
   dézippez.
2. Glissez le dossier sur <https://app.netlify.com/drop> : vous obtenez une
   adresse de test à part.
3. Ouvrez-la dans Safari sur l'iPhone. Cette version de test a ses propres
   données (vides) : vos vraies réservations ne sont pas touchées. Vous
   pouvez y restaurer une sauvegarde (Réglages → Restaurer) pour tester
   avec vos données.

Quand la version vous convient, fusionnez la branche dans `main` : l'appli
installée se met à jour et garde toutes ses réservations.

## Tester sur un ordinateur

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `index.html` | Structure de l'appli, barre d'onglets et politique de sécurité (CSP) |
| `styles.css` | Design (style iOS, clair / sombre) |
| `app.js` | Logique : calendrier, réservations, clients, sauvegardes |
| `404.html` | Page « introuvable » pour toute adresse inconnue (`/admin`…) |
| `sw.js` | Fonctionnement hors ligne (incrémenter `VERSION` à chaque mise à jour) |
| `manifest.webmanifest`, `icons/` | Nom, icône et affichage plein écran |
