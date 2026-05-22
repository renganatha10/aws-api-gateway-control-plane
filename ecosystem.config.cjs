module.exports = {
  apps: [
    {
      name: "api-portal",
      script: "./node_modules/.bin/react-router-serve",
      args: "./build/server/index.js",
      cwd: "/opt/api-portal/current",
      instances: 1,
      exec_mode: "fork",
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      error_file: "/var/log/api-portal/error.log",
      out_file: "/var/log/api-portal/out.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      restart_delay: 1000,
      max_restarts: 5,
      watch: false,
    },
  ],
};
