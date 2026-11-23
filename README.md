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
| `index.html` | Structure de l'appli et barre d'onglets |
| `styles.css` | Design (style iOS, clair / sombre) |
| `app.js` | Logique : calendrier, réservations, clients, sauvegardes |
| `sw.js` | Fonctionnement hors ligne (incrémenter `VERSION` à chaque mise à jour) |
| `manifest.webmanifest`, `icons/` | Nom, icône et affichage plein écran |
