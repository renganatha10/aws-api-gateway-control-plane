const os = require("os");
const path = require("path");

const LOG_DIR = path.join(os.homedir(), "logs", "api-portal");

module.exports = {
  apps: [
    {
      name: "api-portal-local",
      script: "./node_modules/.bin/react-router-serve",
      args: "./build/server/index.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      error_file: path.join(LOG_DIR, "error.log"),
      out_file: path.join(LOG_DIR, "out.log"),
      merge_logs: true,
      node_args: "--import ./instrument.server.mjs",
      restart_delay: 1000,
      max_restarts: 5,
      watch: false,
    },
  ],
};
