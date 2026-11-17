# Deploying CV Maker Backend to EC2 (`51.21.14.17`)

Step-by-step instructions to deploy `cv-maker-backend` onto your Amazon EC2 instance.

---

## Step 1: Allow Inbound Port 5001 in AWS Security Group

Before requests from your browser can reach your EC2 backend, ensure AWS allows inbound traffic on port 5001:

1. Open **AWS Management Console** → **EC2** → **Instances**.
2. Select your instance (`51.21.14.17`) and click the **Security** tab below.
3. Click on the attached **Security Group**.
4. Click **Edit inbound rules** → **Add rule**:
   - **Type**: Custom TCP
   - **Port range**: `5001`
   - **Source**: `Anywhere-IPv4` (`0.0.0.0/0`)
5. Click **Save rules**.

*(Also ensure Port 22 is open for SSH).*

---

## Step 2: Connect to your EC2 Instance via SSH

From your local machine terminal:

```bash
# If using Ubuntu AMI:
ssh -i /path/to/your-key.pem ubuntu@51.21.14.17

# If using Amazon Linux AMI:
ssh -i /path/to/your-key.pem ec2-user@51.21.14.17
```

---

## Step 3: Install Node.js (v20+) and PM2 on EC2

Run these commands inside the EC2 terminal:

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y    # (For Ubuntu)
# sudo dnf update -y                     # (For Amazon Linux)

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git

# Verify installation
node -v
npm -v

# Install PM2 globally (Process Manager to keep the backend running 24/7)
sudo npm install -g pm2
```

---

## Step 4: Copy Backend Code to EC2

You can copy the code directly from your local machine using `rsync` or `scp`.

**Run this on your local machine** (from `/Users/harshitvasu/projects/cv-maker`):

```bash
rsync -avz --exclude 'node_modules' --exclude '.git' --exclude '.DS_Store' \
  cv-maker-backend/ ubuntu@51.21.14.17:~/cv-maker-backend/
```

*(Replace `ubuntu` with `ec2-user` if using Amazon Linux).*

---

## Step 5: Configure Environment & Install Dependencies on EC2

Inside the EC2 instance terminal:

```bash
cd ~/cv-maker-backend

# Install production dependencies
npm install --production

# Create your production .env file
nano .env
```

Paste your environment variables:

```env
PORT=5001
JWT_SECRET=cv_maker_super_secure_jwt_secret_2026_x99
GROQ_API_KEY=<KEY>
GROK_API_KEY=<KEY>
```

Press `Ctrl + O`, then `Enter` to save, and `Ctrl + X` to exit.

---

## Step 6: Start Backend with PM2

Start the backend service with automatic restart on reboots or crashes:

```bash
cd ~/cv-maker-backend

# Start using ecosystem configuration
pm2 start ecosystem.config.cjs

# Save PM2 process list
pm2 save

# Setup PM2 to launch on system boot
pm2 startup
# (Run the sudo env PATH=... command that PM2 outputs if prompted)
```

To check live logs anytime:
```bash
pm2 logs cv-maker-backend
pm2 status
```

---

## Step 7: Verify Backend is Live

From your local machine or browser:

```bash
curl http://51.21.14.17:5001/api/health
```

Expected response:
```json
{"status":"ok","service":"cv-maker-backend","uptime":10.2}
```
