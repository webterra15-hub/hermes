#!/bin/bash

# Démarrage de l'API (port 3001)
npm run server &
API_PID=$!

# Démarrage du frontend (port exposé pour la prévisualisation, port 5173)
npx vite --port 5173

# Nettoyage à la sortie
trap "kill $API_PID" EXIT
