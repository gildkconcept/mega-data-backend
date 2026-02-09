FROM node:18-alpine

WORKDIR /app

# Copier package.json d'abord
COPY package*.json ./

# Installer les dépendances
RUN npm ci --only=production

# Copier le reste du code
COPY . .

# Créer le dossier /data pour SQLite
RUN mkdir -p /data && chmod 777 /data

# Exposer le port
EXPOSE 10000

# Démarrer l'application
CMD ["node", "start.js"]