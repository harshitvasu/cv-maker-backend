module.exports = {
  apps: [
    {
      name: 'cv-maker-backend',
      script: 'src/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 5001
      }
    }
  ]
};
