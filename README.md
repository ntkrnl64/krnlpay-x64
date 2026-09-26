# krnlpay-x64

A small Alipay donation and product checkout app built with React, Cloudflare Workers, and D1. Manage the shop, products, and orders at `/admin`.

## Deploy

You need Node.js 24, Bun 1.3.14, a Cloudflare account, an Alipay app with payment access, and a Cloudflare Turnstile widget.

### Prepare Alipay

For a walkthrough with screenshots, see yczha's [个人开发者收款方案](https://zoz.cool/docs/tutorials/zpay/zpay.html), especially the **申请开通** section:

1. Create an app in the [Alipay Open Platform](https://open.alipay.com/platform/appManage.htm#/create/6-bcb9-7250e6fd2c431487669730456).
2. Apply for and enable **当面付** for the app.
3. Configure RSA2 signing and save your app ID, application private key, and Alipay public key.

For this project, enter the app ID as `ALIPAY_APP_ID` and the key contents as `ALIPAY_PRIVATE_KEY` and `ALIPAY_PUBLIC_KEY` in the secrets below. Set `ALIPAY_NOTIFY_URL` to your public HTTPS notification endpoint so Alipay can report payment results.

Follow the Cloudflare deployment steps below for this version. Alipay's current eligibility and payment limits are determined by your account and enabled product; check them in the Alipay console.

### 1. Install and create the database

```sh
git clone https://github.com/ntkrnl64/krnlpay-x64.git
cd krnlpay-x64
bun install --frozen-lockfile
bunx wrangler login
bunx wrangler d1 create krnlpay
```

In `wrangler.jsonc`, replace the placeholder `database_id` with the ID returned above. Keep the database binding named `DB`. Change the Worker `name` if needed.

### 2. Publish

```sh
bun test
bun run build
bunx wrangler d1 migrations apply DB --remote --config wrangler.jsonc
bunx wrangler deploy
```

Wrangler prints the deployed URL. You can also add a custom domain in the Worker's Cloudflare dashboard. Payments and admin login require the configuration below.

### 3. Configure the app

Add your deployed hostname to the Turnstile widget. In **Cloudflare → Workers & Pages → your Worker → Settings → Variables and Secrets**, add these values as secrets, or run `bunx wrangler secret put NAME` for each one:

| Name | Value |
| --- | --- |
| `ALIPAY_APP_ID` | Your Alipay app ID. |
| `ALIPAY_PRIVATE_KEY` | Your app's RSA private key. |
| `ALIPAY_PUBLIC_KEY` | Alipay's public key for verifying responses and notifications. |
| `ALIPAY_NOTIFY_URL` | `https://YOUR_HOST/api/v1/alipay/orders/notify` |
| `ADMIN_PASSWORD_HASH` | Password hash generated below. |
| `TURNSTILE_SITE_KEY` | Your widget's site key. |
| `TURNSTILE_SECRET` | Your widget's secret key. |
| `TURNSTILE_HOSTNAMES` | Comma-separated frontend hostnames, without schemes or paths. Use production hosts only. |

Generate the admin hash with `bun run hash-password`. It reads a 10–128 character password from standard input: enter your password, then end input with Ctrl+D on Unix, or Ctrl+Z followed by Enter on Windows. Save only the resulting hash as `ADMIN_PASSWORD_HASH`.

Open `/admin` to configure the shop and products. Keep credentials out of Git; `.dev.vars` is for local development and is not uploaded as production secrets.

## GitHub Actions

The [CI and Deploy workflow](.github/workflows/ci.yml) tests and builds every push and pull request. Successful pushes to `main` apply D1 migrations and deploy. You can also run it manually from **Actions → CI and Deploy → Run workflow** on `main`.

After the first deployment:

1. Commit your actual D1 database ID and Worker name in `wrangler.jsonc`.
2. Create a GitHub environment named `production` under **Settings → Environments**.
3. Add environment secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. The token needs **Account → Workers Scripts → Edit** and **Account → D1 → Edit** for the target account. If you add zone routes, grant the relevant zone's **Workers Routes → Edit** permission too.
4. Push to `main`. App secrets remain configured in Cloudflare; the workflow uses only the two deployment credentials.

Deployments run one at a time. Database migrations run before deployment, so future migrations must remain compatible with the running app. See [Cloudflare's GitHub Actions guide](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/) for authentication details.

## Local development

Copy `.dev.vars.example` to `.dev.vars` and fill in your local settings, including a Turnstile widget configured for your local hostname.

```sh
bun run db:migrate:local
bun run dev
```

Open `http://localhost:3000`. Run `bun test` for tests or `bun run build` for type checks and the production build.

## Credits

Thanks to **yczha** for the original [zpay project](https://gitee.com/yczha/zpay.git) and the [个人开发者收款方案 tutorial](https://zoz.cool/docs/tutorials/zpay/zpay.html). The Alipay setup guidance above references that tutorial.

## License

[GNU GPL 3.0 only](LICENSE).
