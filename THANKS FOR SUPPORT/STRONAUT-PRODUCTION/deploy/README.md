# Production deployment

1. Install Node.js 22 LTS, npm, Nginx and PM2.
2. Extract this project to `/var/www/stronaut`.
3. `cp .env.example .env` and fill every required value. Use a NEW Discord token if the old token was exposed.
4. `npm ci`
5. `npm run check`
6. `pm2 start deploy/ecosystem.config.cjs`
7. `pm2 save` and run `pm2 startup` as instructed by PM2.
8. Copy `deploy/nginx.conf` to `/etc/nginx/sites-available/stronaut`, change the domain, symlink it into `sites-enabled`, then `nginx -t && systemctl reload nginx`.
9. Issue HTTPS with Certbot: `certbot --nginx -d dashboard.example.com`.

The Express dashboard listens on `127.0.0.1:4000`; Nginx is the public entry point.
