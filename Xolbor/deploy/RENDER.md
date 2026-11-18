# Publication de cette version sur Render

Dépôt retrouvé dans les échanges précédents : `https://github.com/bolico803/Xolbor`, branche `main`, dossier `Xolbor`. Vérifier ces valeurs sur le service existant avant la bascule. GitHub Pages ne peut pas exécuter ce serveur Node/Socket.IO.

Réglages du Web Service existant :

```text
Root Directory: Xolbor
Build Command: npm ci --omit=dev
Start Command: npm start
Health Check Path: /health/ready
Node: 24.12.0 (fichier .node-version)
HOST=0.0.0.0
NODE_ENV=production
TRUST_PROXY=1
PUBLIC_ORIGIN=https://xolbor.ma
PUBLIC_WWW_ORIGIN=https://www.xolbor.ma
DATABASE_PATH=/var/data/xolbor.sqlite
BACKUP_DIR=/var/data/backups
ROOM_CAPACITY=16
```

`/var/data` doit être le point de montage d'un vrai disque persistant attaché au service. Adapter les deux chemins si le disque existant est monté ailleurs. Le démarrage sur Render est refusé si DATABASE_PATH n'est pas défini pour éviter une création accidentelle dans un répertoire éphémère. Ce contrôle ne prouve pas que le disque est effectivement attaché : vérifier aussi le tableau de bord.

Conserver une seule instance Node pour cette base SQLite. Conserver les secrets uniquement dans Render, jamais dans GitHub.

Avant de publier sur la branche suivie par Render : sauvegarder les données réellement actives (ne pas importer le fichier runtime du ZIP), identifier si la production utilise JSON ou SQLite, vérifier le nombre de comptes et leur format, puis préparer la migration hors ligne sur une copie. En cas de source JSON, utiliser `npm run migrate:legacy -- --source /chemin/sauvegarde-json --database /var/data/xolbor.sqlite` uniquement vers une base cible vide. Le script conserve les fichiers source et refuse une cible déjà présente.

Après publication : vérifier HTTPS, /health/ready, connexion à un compte existant, amis/messages, deux appareils dans un salon privé, déplacement, reconnexion, puis persistance après redémarrage. Ne basculer le domaine qu'après ces vérifications. Aucune garantie d'absence de latence n'est déduite des tests locaux.

Références : https://render.com/docs/web-services ; https://render.com/docs/disks ; https://render.com/docs/node-version
