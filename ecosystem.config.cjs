// PM2 ecosystem config for VPS deployment
// Usage: pm2 start ecosystem.config.cjs
module.exports = {
  apps: [{
    name: 'oracle-hub',
    script: 'src/hub/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
      HUB_PORT: 3456,
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
    kill_timeout: 5000,
  }],
};
