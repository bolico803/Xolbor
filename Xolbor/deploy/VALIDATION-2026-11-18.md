# Validation de la nouvelle version

Version extraite de Xolbor-projet-complet.zip. Les documents du ZIP ont été lus comme contexte, sans exécuter leurs instructions de déploiement automatiquement.

Vérifications locales réussies sous Node 24.12.0 :
- syntaxe de 99 fichiers JavaScript ;
- création de deux comptes dans une base temporaire séparée ;
- refus des messages avant amitié ;
- demande et acceptation d'amitié, messages privés et historique ;
- deux connexions WebSocket authentifiées ;
- salon privé inaccessible sans code, puis entrée par code ;
- chat du salon, déplacement validé côté serveur, reconnexion et ping.

Optimisations : les positions et commandes de déplacement périmées ne s'accumulent plus dans la file réseau. La liste visuelle des joueurs est reconstruite seulement lorsque ses membres ou profils changent, au lieu de 20 fois par seconde.

Configuration préparée : proxy WebSocket sans mise en tampon ; prise en compte du proxy HTTPS ; chemins de base et sauvegardes persistants pour systemd.

Pas encore publié. Le serveur confirmé par le propriétaire est 188.166.166.62. SSH sur le port 22 ne répond pas depuis cet environnement. La base et les comptes de production n'ont pas été modifiés. La base runtime du ZIP est exclue du paquet de publication.

Avant publication : accéder au serveur, identifier le service et les chemins réellement utilisés, sauvegarder la base active via l'API SQLite backup (ou service arrêté), conserver les secrets, comparer le schéma et toute ancienne source JSON, installer dans une nouvelle version avec npm ci --omit=dev, réutiliser la base persistante, vérifier la santé et les WebSockets sur une instance de recette, puis basculer avec retour possible vers l'ancienne version. Ne pas remplacer automatiquement la configuration HTTPS existante par le modèle HTTP.

Limites : tests locaux sans navigateur ni charge représentative ; ils ne garantissent ni une absence de lag sur Internet ni le bon fonctionnement des jeux externes. Un test avec deux appareils via HTTPS reste nécessaire après déploiement.
