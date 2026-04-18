# Guida Deploy Elemanager su Plesk

Deploy della webapp Elemanager su un server Plesk, usando Docker + reverse proxy nginx gestito da Plesk.

**Dominio target (esempio)**: `elemanager.robertodedomenico.it`

**Prerequisiti**
- Accesso SSH al server Plesk con utente sudoer
- Docker + Docker Compose installati sul server (solitamente già disponibili su Plesk moderno — `docker --version`)
- Istanza Supabase raggiungibile (self-hosted o cloud) con le credenziali `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
- Domino/sottodominio puntato sul server (record DNS `A`/`AAAA`)
- Porta 80/443 aperte verso internet; porta 8080 aperta **solo su localhost** (reverse proxy interno)

---

## 1. Clone del repo sul server

Accedi via SSH e clona:

```bash
ssh tuo-utente@tuo-server.it

# Scegli una cartella di lavoro (raccomandato fuori da /var/www e dai vhost Plesk)
mkdir -p ~/apps && cd ~/apps
git clone https://github.com/deduzzo/elemanager.git
cd elemanager
```

## 2. Configurazione env

Copia l'esempio e compila con i valori reali della tua istanza Supabase:

```bash
cp .env.example .env.local
nano .env.local
```

Contenuto `.env.local` (sostituisci con i tuoi valori):

```
VITE_SUPABASE_URL=https://supabase.tuo-dominio.it
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...   # anon key, safe per client
```

> `.env.local` è gitignorato — non viene tracciato né committato. Non usare MAI la `service_role` key qui: va solo lato server.

## 3. Build e start del container

```bash
# Carica env nella shell così docker-compose le inietta nel build
set -a
source .env.local
set +a

# Build + run detached
docker compose up -d --build
```

Verifica che il container risponda localmente:

```bash
docker compose ps
curl -sS -o /dev/null -w "%{http_code}\n" http://localhost:8080/
# Atteso: 200
```

Se vedi `200`, il container è live su `localhost:8080`.

## 4. Creazione sottodominio in Plesk

**Pannello Plesk** → **Websites & Domains** → **Add Subdomain**

- **Subdomain name**: `elemanager`
- **Parent domain**: `robertodedomenico.it` (o il tuo dominio)
- **Document root**: accetta default (non lo useremo, ma Plesk vuole un path)

Clicca **OK**. Il sottodominio ora esiste in Plesk con una cartella vuota.

## 5. Reverse proxy verso il container

Apri il sottodominio appena creato:

**Plesk** → clicca `elemanager.robertodedomenico.it` → **Apache & nginx Settings**

Scorri fino a **"Additional nginx directives"** e incolla:

```nginx
location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";

    # Bypass del cache Plesk per il service worker PWA
    proxy_buffering off;
}
```

**Flag da spuntare/togliere** nella stessa pagina:
- ✅ **"nginx as a reverse proxy server"** (ON)
- ❌ **"Smart static files processing"** (OFF — il container già serve static con cache headers corretti)
- ❌ **"Proxy mode"** per Apache (OFF — evita doppio proxy)

Clicca **OK** per applicare.

## 6. HTTPS con Let's Encrypt

**Plesk** → sottodominio → **SSL/TLS Certificates** → **Install via Let's Encrypt**

- Spunta il sottodominio `elemanager.robertodedomenico.it`
- Email di contatto
- **Get it free** / **Installa**

Plesk configurerà auto-renewal. Aspetta 10-30 secondi.

## 7. Verifica deploy

```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://elemanager.robertodedomenico.it/
# Atteso: 200

curl -sS https://elemanager.robertodedomenico.it/manifest.webmanifest | head -5
# Deve mostrare il manifest PWA con "Elemanager"
```

Apri il browser su `https://elemanager.robertodedomenico.it`. Se vedi la schermata di login, sei live.

## 8. Aggiornamenti futuri

Quando ci sono nuovi commit su `main`:

```bash
cd ~/apps/elemanager
git pull origin main
set -a; source .env.local; set +a
docker compose up -d --build
```

Il rebuild tipicamente dura 30-60 secondi. Durante il rebuild il vecchio container resta attivo; quando il nuovo è pronto, docker-compose fa lo swap.

Per azzerare cache client (PWA con service worker), gli utenti vedranno automaticamente l'update al prossimo refresh grazie a `registerType: 'autoUpdate'` configurato in `vite.config.ts`.

---

## Comandi di manutenzione

```bash
# Log del container in tempo reale
docker compose logs -f web

# Restart (senza rebuild)
docker compose restart web

# Stop completo
docker compose down

# Stato container
docker compose ps

# Accesso shell dentro il container (nginx alpine, shell limitata)
docker compose exec web sh

# Rebuild forzato (ignora cache layer)
docker compose build --no-cache && docker compose up -d
```

## Troubleshooting

### 502 Bad Gateway da Plesk

- Il container non è attivo: `docker compose ps` → se stopped, `docker compose up -d`
- Porta 8080 non ascolta: `ss -tlnp | grep 8080` → se vuoto, rebuild container
- SELinux/AppArmor blocca proxy_pass a localhost: verifica log Plesk (`/var/log/plesk/panel.log`)

### 404 su route SPA (es. `/admin/giornate`)

- Il `nginx.conf` dentro il container ha già il fallback `try_files $uri $uri/ /index.html;`. Se manca, rebuild.
- Eventuali regole Plesk che intercettano prima possono rompere — assicurati che "Additional nginx directives" punti **tutto** a `proxy_pass`.

### Service Worker vecchio rimane cachato

- Apri DevTools → Application → Service Workers → **Unregister** + **Update on reload**
- Hard reload (Cmd+Shift+R su macOS, Ctrl+Shift+R su Linux/Windows)

### Errori CORS dal browser

- La chiamata da `elemanager.robertodedomenico.it` a `supabase.robertodedomenico.it` dovrebbe passare (Supabase ha `access-control-allow-origin: *` di default sul self-hosted).
- Se ricevi CORS block, controlla che Kong di Supabase non abbia origin whitelist custom:
  ```bash
  cd ~/supabase/docker
  cat docker-compose.yml | grep -A 5 KONG
  ```

### Container si killa per OOM

- Docker stats: `docker stats elemanager-web`
- Nginx alpine usa < 20MB RAM a riposo. Se vedi spike, è il build stage di node che consuma 1GB+ temporaneamente. Build su macchina diversa se il server è piccolo, poi `docker save` + `scp` + `docker load`.

---

## Opzione avanzata: deploy con CI/CD

Se vuoi auto-deploy su ogni push a `main`:

1. Sul server, crea un utente deploy con chiave SSH dedicata
2. Aggiungi la chiave pubblica come `DEPLOY_SSH_KEY` in GitHub Secrets del repo
3. Crea `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Plesk
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: SSH deploy
        uses: appleboy/ssh-action@v1.2.0
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.DEPLOY_SSH_KEY }}
          script: |
            cd ~/apps/elemanager
            git pull origin main
            set -a; source .env.local; set +a
            docker compose up -d --build
```

Ogni push a `main` → SSH al server → pull + rebuild + restart. ~30s end-to-end.

---

## Note di sicurezza

- `.env.local` contiene la **anon key** (pubblica, safe per client). Non committarla comunque — usa sempre `.env.example` come template.
- `.env.server` (se usato) contiene la **service_role** key: NON va mai sul server di produzione della webapp, resta solo sul tuo computer per gli script di migrazione.
- Il container nginx espone solo la porta 80 verso `localhost`; Plesk + Let's Encrypt fanno HTTPS verso internet.
- Log degli errori frontend NON finiscono automaticamente in file — considera integrare Sentry o similar in Plan 5.
- Aggiorna Docker periodicamente (`apt update && apt upgrade docker-ce docker-compose-plugin`).
