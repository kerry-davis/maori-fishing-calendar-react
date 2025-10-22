-----

## **1. Create a Cloudflare API Token** 🔑

First, you'll need an API token to allow GitHub Actions to interact with your Cloudflare account.

1.  Navigate to the Cloudflare Dashboard: **My Profile** (top-right avatar) → **API Tokens** → **Create Token**.
2.  Use the **“Edit Cloudflare Workers”** or **“Pages”** template.
3.  Ensure the token has the following permissions:
      * **Account**: `Workers Scripts` (Edit), `Pages` (Edit)
4.  Scope the token to your specific account.
5.  Create the token and **copy it immediately**. You will only see it once.

-----

## **2. Find Your Account ID** 🆔

Your Account ID is required for the GitHub Action to target the correct Cloudflare account.

  * In the Cloudflare Dashboard, go to **Workers & Pages** → **Overview**.
  * Copy the **Account ID** shown on this page.

-----

## **3. Create a Pages Project (Direct Upload)** 🚀

Create a project in Cloudflare without connecting it to your Git repository. This prevents Cloudflare from creating its own deployments, ensuring only your GitHub Action does.

1.  Navigate to **Workers & Pages** → **Pages** → **Create a project**.

2.  Select **“Direct Upload”** (do not use “Connect to Git”).

3.  Enter a **Project name**, for example, `maori-fishing-calendar-react`. This must be unique within your account.

4.  To complete the project setup, you need to perform an initial manual upload. You can upload your local build folder. In your terminal, run:

    ```sh
    npm ci
    npm run build
    ```

5.  In the Pages GUI, drag and drop the `dist/` folder to upload it. This publishes a temporary version just so the project exists.

After creation, you'll get a `pages.dev` URL. Future deployments from your GitHub Action will update this URL.

-----

## **4. Add Environment Variables** ⚙️

Add any necessary secrets, like API keys, to your project's settings.

1.  Go to your Pages project → **Settings** → **Environment variables**.
2.  Add your `NIWA_API_KEY` (or other variables) under both:
      * **Production**
      * **Preview**
3.  Click **Save**.

-----

## **5. (Optional) Verify Functions Setting**

By default, Cloudflare Pages will automatically detect and deploy any serverless functions in your repository.

  * Go to your Pages project → **Functions**.
  * The default settings should be fine. The deploy action will automatically pick up files like `functions/api/niwa-tides.ts`.

-----

## **6. Add Secrets to Your GitHub Repo** 🤫

Store your Cloudflare credentials securely in your GitHub repository's secrets so the workflow can access them.

1.  In your GitHub repo, go to **Settings** → **Secrets and variables** → **Actions**.
2.  Click **New repository secret** and add the following:
      * `CLOUDFLARE_API_TOKEN`: The token you created in step 1.
      * `CLOUDFLARE_ACCOUNT_ID`: The Account ID from step 2.
      * `CLOUDFLARE_PAGES_PROJECT`: The project name from step 3.

-----

## **7. Commit Your Workflow and Deploy** 🚀

Commit the workflow file and any associated serverless functions to your repository.

1.  Ensure you have the following files in your branch:
      * `.github/workflows/deploy-cloudflare-pages.yml`
      * `functions/api/niwa-tides.ts` (your NIWA proxy function)
2.  Push your branch and open a pull request. The workflow is typically configured to:
      * Create a **Preview** deployment for pull requests.
      * Create a **Production** deployment on pushes to the `main` branch.

**Important**: Because the project is not connected to Git in the Cloudflare dashboard, **only this GitHub Action will publish deployments**, preventing duplicates.

-----

## **8. (Optional) Test and Switch DNS** 🌐

Once your changes are merged into `main`, you can test the production deployment and point a custom domain to it.

1.  Confirm the production deployment is live and working correctly at your `pages.dev` URL.
2.  To add a custom domain, go to your Pages project → **Custom domains** → **Add custom domain**.
3.  If your domain is managed by Cloudflare, DNS records will be configured automatically. Otherwise, add the CNAME record shown at your domain registrar.

-----

## **9. Remove Vercel to Prevent Duplicates** 🧹

If you are migrating from Vercel, remove its integration to stop it from creating conflicting deployments.

1.  Uninstall or disable the **Vercel GitHub App** for this repository. You can do this from the Vercel dashboard or under your GitHub account's **Installed GitHub Apps**.
2.  Delete any Vercel-specific files (e.g., `vercel.json` or Vercel workflow files) from your branch before merging.
3.  Consider running a cleanup workflow with an admin Personal Access Token (PAT) to remove old "Preview" and "Production" deployment environments from your GitHub repo.

### **Note**

If you prefer Cloudflare to build and deploy automatically from its own GitHub integration, you can choose **“Connect to Git”** instead of **“Direct Upload”** in step 3. However, if you do that, you must remove the custom `deploy-cloudflare-pages.yml` workflow to avoid duplicate deployments. The Action-only path described above provides finer control and keeps your GitHub Deployments tab clean.