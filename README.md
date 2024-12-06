# DreamGuard - Your Sleep Health Companion for Sleep Disorder Detection and Quality Improvement [Cloud Computing]

## Bangkit Capstone Team ID: C242-PS002

### Project Overview
DreamGuard is an innovative cloud-based solution for sleep health monitoring and disorder detection, leveraging advanced cloud computing technologies to provide comprehensive sleep analysis.

## 🌐 Cloud Architecture

![Cloud Architecture (Fix)](https://github.com/user-attachments/assets/5bad05bd-b7a6-4250-9f78-bf4d02cbf4bf)

## 📄 API Documentation
You can visit the full API docs here: [DreamGuard API Documentation](https://docs.google.com/document/d/133s3o1W67cHlY-0vP9QovpDPRiqHsLPHBT4rdFoN5A0/edit?usp=sharing)

## 🛠 Tech Stack

### Backend Technologies
- **Language:** JavaScript
- **Framework:** Express.js
- **Libraries:**
  - Express Validator
  - Google Cloud Storage
  - Firebase Admin
  - Luxon
  - Multer
  - Dotenv

### Cloud Services
- **Cloud Platform:** Google Cloud Platform (GCP)
- **Services Used:**
  - Cloud Run
  - Cloud Storage
  - Firebase Authentication
  - Firestore

## 📦 Prerequisites

Before getting started, ensure you have the following:
- Google Cloud Platform (GCP) Account
- Firebase Account
- Node.js (v18+ recommended)
- Google Cloud SDK
- Git

## 🚀 Project Setup

### 1. Google Cloud Platform Setup

#### 1.1 Create a New GCP Project
1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Create Project"
3. Name your project (e.g., `dreamguard-capstone`)
4. Select the project

#### 1.2 Enable Required APIs
```bash
gcloud services enable \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  firestore.googleapis.com \
  storage.googleapis.com
```

#### 1.3 Set Project Region
```bash
gcloud config set compute/region asia-southeast2
```

### 2. Google Cloud SDK Installation and Configuration

#### 2.1 Install Google Cloud SDK

##### For Windows:
1. Download installer from [Google Cloud SDK](https://cloud.google.com/sdk/docs/install#windows)
2. Run the installer and follow installation instructions
3. Open a new Command Prompt or PowerShell

##### For macOS:
```bash
brew install --cask google-cloud-sdk
```

##### For Linux:
```bash
sudo apt-get update
sudo apt-get install apt-transport-https ca-certificates gnupg
echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | sudo tee -a /etc/apt/sources.list.d/google-cloud-sdk.list
curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo apt-key --keyring /usr/share/keyrings/cloud.google.gpg add -
sudo apt-get update && sudo apt-get install google-cloud-sdk
```

#### 2.2 Initialize Google Cloud SDK
```bash
gcloud init
```
1. You will be prompted to log in to Google Cloud
2. Select the Google account linked to your GCP Project
3. Choose the project you will use
4. Confirm the selected project

#### 2.3 Setup Application Default Credentials

##### Method 1: Application Default Credentials
```bash
gcloud auth application-default login
```
- This will open a browser for authentication
- Select the appropriate Google account
- Grant necessary permissions

##### Method 2: Service Account Key
1. In Google Cloud Console, navigate to IAM & Admin > Service Accounts
2. Select the service account you will use
3. Create and download a JSON key
4. Set environment variable:
   
   For Windows (PowerShell):
   ```powershell
   $env:GOOGLE_APPLICATION_CREDENTIALS="path\to\service-account-key.json"
   ```

   For macOS/Linux:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"
   ```
   
5. Change the config in the firebase.js & bucket.js accordingly

#### 2.4 Verify Configuration
```bash
# Check active account
gcloud auth list

# Check active project
gcloud config list project

# Check application default credentials
gcloud auth application-default print-access-token
```

### 3. Service Account Configuration

#### 3.1 Create Service Account for DreamGuard
```bash
gcloud iam service-accounts create dreamguard-service-account \
  --display-name "DreamGuard Service Account"
```

#### 3.2 Assign IAM Roles (Least Privilege)
```bash
gcloud projects add-iam-policy-binding [YOUR-PROJECT-ID] \
  --member=serviceAccount:dreamguard-service-account@[YOUR-PROJECT-ID].iam.gserviceaccount.com \
  --role=roles/firebase.admin

gcloud projects add-iam-policy-binding [YOUR-PROJECT-ID] \
  --member=serviceAccount:dreamguard-service-account@[YOUR-PROJECT-ID].iam.gserviceaccount.com \
  --role=roles/storage.objectAdmin

gcloud projects add-iam-policy-binding [YOUR-PROJECT-ID] \
  --member=serviceAccount:dreamguard-service-account@[YOUR-PROJECT-ID].iam.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor
```

### 4. Cloud Storage Setup

#### 4.1 Create Storage Bucket
```bash
gsutil mb -p [YOUR-PROJECT-ID] -c standard -l asia-southeast2 gs://dreamguard-bucket/
```

#### 4.2 Make Bucket Public (Optional)
```bash
gsutil iam ch allUsers:objectViewer gs://dreamguard-bucket
```

### 5. Firebase Configuration

#### 5.1 Firebase Project Setup
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project linked to your GCP project
3. Enable Authentication (Email/Password, Google Sign-In)
4. Set up Firestore in Native mode
5. Configure Firestore location in asia-southeast2

### 6. Local Development Setup

#### 6.1 Clone Repository
```bash
git clone -b cloud-computing https://github.com/dreamguard-id/DreamGuard.git
cd DreamGuard
```

#### 6.2 Install Dependencies
```bash
npm install
```

#### 6.3 Environment Configuration
Create a `.env` file with the following:
```
GCLOUD_STORAGE_BUCKET=[YOUR-BUCKET-NAME]
```

### 7. Docker and Cloud Build

#### 7.1 Create Artifact Registry Repository
```bash
gcloud artifacts repositories create dreamguard-backend \
  --repository-format=docker \
  --location=asia-southeast2
```

#### 7.2 Build and Push Docker Image
```bash
gcloud builds submit \
  --tag asia-southeast2-docker.pkg.dev/[PROJECT_ID]/dreamguard-backend/dreamguard-api:v1.0.0
```

### 8. Cloud Run Deployment

#### 8.1 Deploy Service
```bash
gcloud run deploy dreamguard-api \
  --image asia-southeast2-docker.pkg.dev/[PROJECT_ID]/dreamguard-backend/dreamguard-api:latest \
  --set-secrets=CLOUD_STORAGE_BUCKET=[YOUR-BUCKET-SECRET-NAME]:latest
  --service-account dreamguard-service-account@[PROJECT_ID].iam.gserviceaccount.com \
  --platform managed \
  --region asia-southeast2 \
  --allow-unauthenticated \
```

### 9. GitHub Actions CI/CD

#### 9.1 Create Service Account Key & Add the Roles

```bash
# Buat service account key
gcloud iam service-accounts keys create service-account-key.json \
   --iam-account=dreamguard-service-account@[PROJECT_ID].iam.gserviceaccount.com

# Tambahkan role-role yang diperlukan
gcloud projects add-iam-policy-binding capstone-project-dreamguard \
    --member=serviceAccount:dreamguard-service-account@capstone-project-dreamguard.iam.gserviceaccount.com \
    --role=roles/iam.serviceAccountUser

gcloud projects add-iam-policy-binding capstone-project-dreamguard \
    --member=serviceAccount:dreamguard-service-account@capstone-project-dreamguard.iam.gserviceaccount.com \
    --role=roles/viewer

gcloud projects add-iam-policy-binding capstone-project-dreamguard \
    --member=serviceAccount:dreamguard-service-account@capstone-project-dreamguard.iam.gserviceaccount.com \
    --role=roles/cloudbuild.editor

gcloud projects add-iam-policy-binding capstone-project-dreamguard \
    --member=serviceAccount:dreamguard-service-account@capstone-project-dreamguard.iam.gserviceaccount.com \
    --role=roles/run.admin

gcloud projects add-iam-policy-binding capstone-project-dreamguard \
    --member=serviceAccount:dreamguard-service-account@capstone-project-dreamguard.iam.gserviceaccount.com \
    --role=roles/storage.objectAdmin

gcloud projects add-iam-policy-binding capstone-project-dreamguard \
    --member=serviceAccount:dreamguard-service-account@capstone-project-dreamguard.iam.gserviceaccount.com \
    --role=roles/artifactregistry.writer
```

#### 9.2 GitHub Secrets Configuration
Add the following secrets to your GitHub repository:
- `GCP_SA_KEY` (contents of service-account-key.json)

#### 9.2 Change the ENV Value Inside the deploy.yaml
Change following env in the .github/workflows/deploy.yaml according to your project info:
- `SERVICE_NAME`: (your cloud run service name)
- `PROJECT_ID`: (your google cloud project id)
- `DOCKER_IMAGE_URL`: (your docker image url)
