# Exploitation et limites du serveur

Ces réglages préparent une instance de recette. Ils ne prouvent pas une capacité de milliers de joueurs et ne rendent pas l'application prête pour une ouverture publique ; la modération, les contrôles pour mineurs, la récupération de compte et les autres points du plan restent nécessaires.

## Surveillance

- `GET /health/live` indique que le processus HTTP répond.
- `GET /health/ready` teste la disponibilité de SQLite et renvoie 503 pendant l'arrêt. Utiliser readiness pour retirer une instance du trafic ; ce contrôle ne vérifie pas les paiements ni les services externes.
- `ROOM_CAPACITY` vaut 2 à 32 joueurs (16 par défaut). `MAX_ROOMS` vaut 1 à 500 (100 par défaut). `MAX_SOCKETS_PER_USER` vaut 1 à 20 par namespace (4 par défaut). Valeurs invalides : retour à la valeur par défaut. Ce sont des limites de protection, pas des chiffres de capacité mesurés.
- L'authentification utilise une recherche indexée sur l'identifiant de session et l'utilisateur. Chaque message Socket.IO revérifie la validité de la session. Les positions du lobby restent simulées côté serveur.
- À SIGTERM/SIGINT, le serveur refuse les nouvelles connexions, arrête la simulation, ferme Socket.IO et la base. Un délai de 10 secondes déclenche un arrêt forcé si la fermeture échoue.
- Des limites en mémoire protègent les routes et sockets de cette instance. Elles ne sont pas partagées entre serveurs et ne remplacent pas une protection réseau ou une analyse de charge.

## Service Linux (exemple)

Installer Node.js 24.12+ dans la branche 24, créer un compte système `xolbor`, installer les fichiers dans `/opt/xolbor` puis exécuter `npm ci --omit=dev` dans ce dossier. Créer `/var/lib/xolbor` appartenant au compte `xolbor`. Créer `/etc/xolbor/xolbor.env` à partir de `.env.example`, avec `PUBLIC_ORIGIN=https://xolbor.ma`, `PUBLIC_WWW_ORIGIN=https://www.xolbor.ma`, `NODE_ENV=production`, `TRUST_PROXY=1`, `HOST=127.0.0.1` et `DATABASE_PATH=/var/lib/xolbor/xolbor.sqlite`. Restreindre la lecture du fichier d'environnement au compte du service et à l'administrateur. Adapter les chemins avant d'utiliser `deploy/xolbor.service`.

Placer Nginx devant Node, activer HTTPS et les mises à niveau WebSocket. La valeur `TRUST_PROXY=1` suppose exactement un proxy de confiance ; la changer si la topologie diffère. Ne pas exposer directement le port Node. Tester `nginx -t`, les deux contrôles de santé et le passage WebSocket en recette avant toute bascule DNS.

## Données et montée en charge

Une seule instance écrit dans SQLite sur un disque persistant local. Sauvegarder régulièrement avec `npm run backup` en configurant `DATABASE_PATH` et `BACKUP_DIR`, copier la sauvegarde chiffrée hors machine et tester les restaurations. Ne pas partager le fichier SQLite entre machines. Les salons sont en mémoire et disparaissent au redémarrage ; leur reprise sans interruption n'est pas encore disponible.

Pour plusieurs machines : passer à PostgreSQL, déployer Redis et l'adaptateur Socket.IO avec affinité pour les transports concernés, isoler les serveurs de jeu et utiliser des métriques, tests de charge, alertes et déploiements progressifs. Aucun de ces services n'est provisionné par ce projet.
