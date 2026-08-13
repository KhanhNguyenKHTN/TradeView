module.exports = {
  apps: [
    {
      name: 'family-be',
      cwd: '/home/data/TaiChinh/deploy/backend',
      script: 'src/main.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      merge_logs: false,
      out_file: '/opt/tradeview/logs/backend-out.log',
      error_file: '/opt/tradeview/logs/backend-error.log',
      time: true,
      env: {
        NODE_ENV: 'production',
        PORT: 7001,
      },
    },
  ],
}