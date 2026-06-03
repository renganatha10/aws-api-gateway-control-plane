# Connecting to the Production Database

The RDS PostgreSQL instance is in a private subnet and is not publicly accessible. To connect from your local machine you must open an SSM port-forward tunnel through the EC2 instance.

## Prerequisites

- AWS CLI configured with admin credentials (`aws sts get-caller-identity` should succeed)
- [AWS Session Manager plugin](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html) installed

  ```bash
  # Ubuntu / WSL
  curl "https://s3.amazonaws.com/session-manager-downloads/plugin/latest/ubuntu_64bit/session-manager-plugin.deb" \
    -o /tmp/session-manager-plugin.deb
  sudo dpkg -i /tmp/session-manager-plugin.deb
  ```

- The RDS CA certificate bundle (`global.pem`) downloaded from AWS:

  ```bash
  curl -o ~/global.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
  ```

---

## Step 1 — Start the SSM tunnel

Run the helper script in a dedicated terminal and leave it open:

```bash
./scripts/db-tunnel.sh
```

You should see:

```
Starting SSM port-forward: localhost:5433 → RDS:5432
Press Ctrl+C to stop the tunnel.

Starting session with SessionId: ...
Port 5433 opened for sessionId ...
Waiting for connections...
```

> Port `5433` is used on localhost to avoid conflicting with any local PostgreSQL instance running on `5432`.

---

## Step 2 — Fetch the database password

```bash
aws ssm get-parameter \
  --name /api-portal/prod/db-password \
  --with-decryption \
  --query Parameter.Value \
  --output text
```

---

## Step 3 — Connect via DBeaver

1. Open DBeaver → **New Database Connection** → choose **PostgreSQL**.

2. **Main tab**

   | Field    | Value        |
   |----------|--------------|
   | Host     | `localhost`  |
   | Port     | `5433`       |
   | Database | `apiportal`  |
   | Username | `apiportal`  |
   | Password | (from Step 2)|

3. **SSL tab**

   | Setting              | Value                        |
   |----------------------|------------------------------|
   | Use SSL              | ✅ checked                   |
   | SSL mode             | `require`                    |
   | CA Certificate       | path to your `global.pem`    |
   | Client Certificate   | *(leave blank)*              |
   | Client Private Key   | *(leave blank)*              |

   > Use `require` instead of `verify-full` — the cert is issued for the RDS hostname, not `localhost`, so hostname verification will fail through the tunnel.

4. Click **Test Connection** to verify, then **Finish**.

---

## Step 4 — Connect via psql (optional)

```bash
psql "postgresql://apiportal:<password>@localhost:5433/apiportal?sslmode=require&sslrootcert=$HOME/global.pem"
```

---

## Infrastructure reference

| Resource      | Value                                                                                              |
|---------------|----------------------------------------------------------------------------------------------------|
| EC2 instance  | `i-089e5c89e76cfa398` (`api-portal-prod-ec2`)                                                      |
| RDS endpoint  | `api-portal-prod-database-dbinstance-spw5n5gly5ow.cvyaikccmj3j.ap-south-1.rds.amazonaws.com:5432` |
| SSM parameter | `/api-portal/prod/db-password`                                                                     |
| CA bundle     | `https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem`                               |
