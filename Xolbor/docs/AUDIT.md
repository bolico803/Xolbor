# Audit initial et limites — 4 novembre 2026

La copie source est le projet imbriqué Documents/GitHub/Xolbor/Xolbor, incluant les changements Stripe non enregistrés. Les scripts d'origine sont sauvegardés hors du livrable et leur empreinte est consignée dans SOURCE.json. Les fichiers privés, comptes et secrets ne sont pas copiés.

## État initial

- Frontend : grande page HTML/JS, Three.js r128 local, jeux Web, installateur Studio ; avatar d'origine géométrique, pas d'éditeur de personnages riggés.
- Backend : Node.js, Express, Socket.IO et serveur RPG séparé ; authentification bcrypt et jetons dans des fichiers JSON, sans base relationnelle.
- Fonctions existantes : catalogue, comptes, amis, chat HTTP, boutique, factions et jeux. Plusieurs états étaient simulés : scores de tournoi aléatoires, jeu Studio ajouté au catalogue, skins de secours et chiffre d'abonnés non vérifié.
- Failles critiques : publication statique de fichiers privés ; solde créditable directement ; prix transmis par le client ; pseudo Socket.IO usurpable ; ancienne session non révoquée ; privilèges tirés du classement ; scores clients pouvant attribuer des récompenses ; textes insérés dans le HTML. PayPal acceptait des prix client. Le serveur RPG accepte des positions et actions non vérifiées.
- Dépendances d'origine : audit npm initial de 13 vulnérabilités. Le lockfile a été mis à jour ; npm audit ne relevait aucune vulnérabilité lors de la vérification.

## Travail de phase 1

SQLite et migration non destructive, sessions révocables, restrictions d'accès aux fichiers, garde-fous HTTP et socket, prix fixés côté serveur, crédits libres bloqués, authentification socket, chat direct pour les amis, lobby multijoueur et personnalisation liée au compte. Paiements et tournois rémunérés sont désactivés. Des données héritées et certains affichages historiques restent à revoir ; la phase 1 n'est pas un audit de sécurité complet ni une autorisation de mise en production publique.

Le lobby simule les mouvements sur une seule instance serveur. Les salons ne sont pas isolés dans des processus, ne survivent pas au redémarrage et n'ont pas de réservation de place à la reconnexion. Le chat du salon n'a pas encore les protections de modération requises pour une plateforme ouverte.
