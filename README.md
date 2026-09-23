# Booth Planner — réservations de photobooth sur iPhone

Petite application pour iPhone qui permet de gérer les réservations du
photobooth : pour chaque date, voir d'un coup d'œil si le photobooth est
**libre**, **en attente de réponse** ou **loué**, et enregistrer les
coordonnées du client.

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
