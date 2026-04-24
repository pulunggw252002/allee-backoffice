# Deployment Guide — RumahWeb Linux VPS

Target: single-box deployment of the ALLEE Backoffice on a RumahWeb Linux
VPS (Ubuntu 22.04 / Debian 12, 2 vCPU / 2 GB RAM minimum). Stack: Next.js 15
on Node.js 20, SQLite via `better-sqlite3`, Better Auth for credentials,
PM2 as process manager, nginx as HTTPS reverse proxy, Let's Encrypt for TLS.

All commands assume you run as a non-root user in the `sudo` group.
Replace `app.example.com` with the hostname you point at the VPS.

---

## 1. Provision the box

```bash
# As root on first login
adduser allee
usermod -aG sudo allee
rsync --archive --chown=allee:allee ~/.ssh /home/allee

# Re-login as allee, then:
sudo apt update && sudo apt upgrade -y
sudo apt install -y build-essential git curl ufw nginx certbot python3-certbot-nginx

# Firewall: allow SSH + HTTP + HTTPS
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## 2. Node.js 20 (via NodeSource)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version   # should print v20.x
sudo npm install -g pm2
```

## 3. Application directory + database directory

```bash
sudo mkdir -p /var/www/allee-backoffice
sudo chown allee:allee /var/www/allee-backoffice

# SQLite DB lives outside the source tree so git pulls don't touch it.
sudo mkdir -p /var/lib/allee
sudo chown allee:allee /var/lib/allee
chmod 750 /var/lib/allee
```

## 4. Clone, install, build

```bash
cd /var/www/allee-backoffice
git clone <your-repo-url> .
npm ci
```

Create `/var/www/allee-backoffice/.env.production` with the real values:

```dotenv
# Flip the frontend to hit /api/* on this same origin.
NEXT_PUBLIC_USE_REAL_BACKEND=true
NEXT_PUBLIC_API_BASE_URL=
NEXT_PUBLIC_STORAGE_VERSION=v6
NEXT_PUBLIC_APP_VERSION=0.1.0
NEXT_PUBLIC_APP_CHANNEL=production

# Backend-only
DATABASE_URL=/var/lib/allee/app.db
BETTER_AUTH_SECRET=<paste output of: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
BETTER_AUTH_URL=https://app.example.com
NODE_ENV=production
```

Build + run first migration + optional seed:

```bash
npm run db:migrate
npm run db:seed          # OPTIONAL — only run once on a brand-new DB
npm run build
```

## 5. PM2 process manager

Create `/var/www/allee-backoffice/ecosystem.config.cjs`:

```js
module.exports = {
  apps: [
    {
      name: "allee-backoffice",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      cwd: "/var/www/allee-backoffice",
      instances: 1,
      exec_mode: "fork",
      env: { NODE_ENV: "production" },
      // Next.js reads .env.production automatically; PM2 just has to keep
      // the process alive.
      max_restarts: 10,
      restart_delay: 3000,
      max_memory_restart: "700M",
    },
  ],
};
```

Boot it:

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup systemd -u allee --hp /home/allee
# Copy-paste the `sudo env ...` line it prints.
```

## 6. nginx reverse proxy + HTTPS

Create `/etc/nginx/sites-available/allee-backoffice`:

```nginx
server {
    listen 80;
    server_name app.example.com;

    # Redirect-only server block — certbot will fill in 443 below.
    location / { return 301 https://$host$request_uri; }
}

server {
    listen 443 ssl http2;
    server_name app.example.com;

    # certbot fills these in:
    # ssl_certificate     /etc/letsencrypt/live/app.example.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/app.example.com/privkey.pem;

    # Upload limit for selfie/station photos (base64 in JSON can be ~1.3x raw).
    client_max_body_size 10m;

    # Standard hardening
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

Enable + issue the cert:

```bash
sudo ln -s /etc/nginx/sites-available/allee-backoffice /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d app.example.com --redirect --agree-tos -m ops@example.com -n
sudo systemctl enable certbot.timer    # auto-renew
```

## 7. First-login sanity check

1. Visit `https://app.example.com/login`.
2. Seed data ships 7 accounts. Example credentials (all password
   `password`):

   | Name | Role |
   |---|---|
   | Budi | Owner |
   | Andi | Kepala Toko (Dago) |
   | Dewi Barista | Barista |
   | Joni Kitchen | Kitchen |
   | Rudi Kasir | Kasir |
   | Mira Waiters | Waiters |

3. Log in as `Budi` — dashboard should render with seeded transactions.
4. **Immediately change the seed passwords via the Users page** (or disable
   the seed accounts and create production ones).

## 8. Backups

SQLite + WAL means you MUST back up `app.db`, `app.db-wal`, and
`app.db-shm` together while the app is running, or you get torn reads.
Easiest safe approach: `sqlite3 .backup`:

```bash
# /usr/local/bin/allee-backup.sh
set -e
BACKUP_DIR=/var/backups/allee
mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
sqlite3 /var/lib/allee/app.db ".backup $BACKUP_DIR/app-$STAMP.db"
find "$BACKUP_DIR" -name "app-*.db" -mtime +14 -delete
```

Cron it nightly:

```
0 2 * * * /usr/local/bin/allee-backup.sh >> /var/log/allee-backup.log 2>&1
```

Ship the backups off-box (rclone → Google Drive, rsync → another VPS,
BorgBackup → Hetzner Storage Box, etc.). A backup that lives on the same
machine doesn't survive a disk failure.

## 9. Updates / redeploys

```bash
cd /var/www/allee-backoffice
git pull
npm ci
npm run db:migrate     # applies any new migrations in `drizzle/`
npm run build
pm2 reload allee-backoffice
```

If a migration is destructive (drops a column, changes a constraint) run
the SQLite backup FIRST:

```bash
/usr/local/bin/allee-backup.sh
```

## 10. Troubleshooting

| Symptom | Fix |
|---|---|
| `pm2 logs` shows `SQLITE_CANTOPEN` | `DATABASE_URL` dir doesn't exist / wrong owner. `ls -la /var/lib/allee` and verify `allee:allee`. |
| Login returns 500 | `BETTER_AUTH_SECRET` missing or shorter than 32 chars. Regenerate and restart. |
| 404 on `/api/auth/*` | Build didn't include the catch-all route. Rerun `npm run build` and `pm2 reload`. |
| Cookie not set after login | `BETTER_AUTH_URL` scheme must match what the browser sees (`https://`, not `http://`). |
| DB locked under load | WAL mode is already on. If you still see contention, shrink long transactions; SQLite serializes writes. |
| Can't reach site | `sudo ufw status` — ports 80/443 allowed? `sudo nginx -t` — config valid? |

## 11. Hardening checklist

- [ ] Disable password SSH (`PasswordAuthentication no` in `/etc/ssh/sshd_config`), keys only.
- [ ] `fail2ban` installed for SSH + nginx auth.
- [ ] Unattended security upgrades: `sudo apt install unattended-upgrades && sudo dpkg-reconfigure -plow unattended-upgrades`.
- [ ] Rotate the seed passwords on day-one.
- [ ] Put a second off-box backup target in place before you treat the VPS as production.
- [ ] `BETTER_AUTH_SECRET` stored in a password manager; not in git.
