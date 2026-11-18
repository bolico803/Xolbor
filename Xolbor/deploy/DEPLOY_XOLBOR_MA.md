# Deploiement web public sur xolbor.ma

Ce guide publie le site web Xolbor sur `https://xolbor.ma` sans afficher le port `5897`.

## DNS

Chez ton fournisseur de domaine, cree ces enregistrements:

```txt
A     xolbor.ma       IP_DE_TON_SERVEUR
A     www.xolbor.ma   IP_DE_TON_SERVEUR
```

Attends la propagation DNS, puis verifie:

```bash
dig xolbor.ma
dig www.xolbor.ma
```

## Serveur Node

Dans le dossier `Xolbor` sur le serveur:

```bash
npm install
PUBLIC_ORIGIN=https://xolbor.ma PORT=5897 node server.js
```

En production, utilise PM2:

```bash
npm install -g pm2
PUBLIC_ORIGIN=https://xolbor.ma PORT=5897 pm2 start server.js --name xolbor
pm2 save
pm2 startup
```

## Nginx

Copie `deploy/nginx_xolbor.conf` vers Nginx:

```bash
sudo cp deploy/nginx_xolbor.conf /etc/nginx/sites-available/xolbor.ma
sudo ln -s /etc/nginx/sites-available/xolbor.ma /etc/nginx/sites-enabled/xolbor.ma
sudo nginx -t
sudo systemctl reload nginx
```

## HTTPS

Installe Certbot puis genere le certificat:

```bash
sudo certbot --nginx -d xolbor.ma -d www.xolbor.ma
```

Apres Certbot, le site public doit etre:

```txt
https://xolbor.ma
https://www.xolbor.ma
```

Ne publie pas `:5897`: ce port doit rester interne au serveur.
