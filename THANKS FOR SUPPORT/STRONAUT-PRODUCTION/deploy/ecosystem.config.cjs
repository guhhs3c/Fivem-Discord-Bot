module.exports = {
  apps: [{
    name: 'stronaut',
    script: './src/index.js',
    cwd: '/var/www/stronaut',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    time: true,
    env: {
      NODE_ENV: 'production'
    }
  }]
};
