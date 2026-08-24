module.exports = {
  apps: [
    {
      name: "divisas-backend",
      cwd: "./backend",
      script: "npm",
      args: "run start:dev",
      interpreter: "none",
      autorestart: true,
      watch: false
    },
    {
      name: "divisas-admin",
      cwd: "./apps/admin",
      script: "npx",
      args: "next dev -H 0.0.0.0 -p 3001",
      interpreter: "none",
      autorestart: true,
      watch: false,
      env: {
        NEXT_PUBLIC_API_URL: "https://tear-paxil-considered-foo.trycloudflare.com/api"
      }
    },
    {
      name: "divisas-cashier",
      cwd: "./apps/cashier",
      script: "npx",
      args: "next dev -H 0.0.0.0 -p 3002",
      interpreter: "none",
      autorestart: true,
      watch: false,
      env: {
        NEXT_PUBLIC_API_URL: "https://tear-paxil-considered-foo.trycloudflare.com/api"
      }
    },
    {
      name: "divisas-tunnel-backend",
      script: "/usr/local/bin/cloudflared",
      args: "tunnel --url http://localhost:3000",
      interpreter: "none",
      autorestart: true,
      watch: false
    },
    {
      name: "divisas-tunnel-admin",
      script: "/usr/local/bin/cloudflared",
      args: "tunnel --url http://localhost:3001",
      interpreter: "none",
      autorestart: true,
      watch: false
    },
    {
      name: "divisas-tunnel-cashier",
      script: "/usr/local/bin/cloudflared",
      args: "tunnel --url http://localhost:3002",
      interpreter: "none",
      autorestart: true,
      watch: false
    }
  ]
};
