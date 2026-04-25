# 🎨 Media Nyeni

A modern, high-performance media sharing and storage platform built with **React 19**, **Vite**, and **Netlify Functions**. This application provides a seamless interface for managing files and folders stored in S3-compatible storage (like Cloudflare R2), featuring a premium dark-themed UI and integrated URL shortening.

![Screenshot Placeholder](https://via.placeholder.com/1200x600/0f172a/ffffff?text=Media+Nyeni+UI)

## ✨ Key Features

- **📂 Smart Directory Browsing**: Intuitive navigation through nested folders with breadcrumb support.
- **🚀 High-Speed Uploads**: Direct-to-storage uploads using Presigned URLs (supports files up to 100MB).
- **🖱️ Drag & Drop**: Effortless file management with full drag-and-drop support.
- **🔗 Advanced Sharing**:
  - **Single Files**: Generates secure, time-limited Presigned URLs.
  - **Folders**: Shares specific directory views via query parameters.
  - **URL Shortening**: Integrated with **Spoo.me** for clean, shareable links.
- **🔍 Real-time Search**: Quickly find files and folders within the current directory.
- **📱 Responsive Design**: Fully optimized for mobile, tablet, and desktop viewing.
- **🎨 Premium Aesthetics**: Custom "Media Nyeni" design system featuring glassmorphism, smooth animations, and a curated dark-navy palette.

## 🛠️ Tech Stack

### Frontend
- **Framework**: [React 19](https://react.dev/)
- **Bundler**: [Vite 8](https://vitejs.dev/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Styling**: Vanilla CSS (Media Nyeni Design System)

### Backend & Storage
- **Serverless**: [Netlify Functions](https://www.netlify.com/products/functions/)
- **Storage**: S3-Compatible (e.g., Cloudflare R2, AWS S3)
- **SDK**: [@aws-sdk/client-s3](https://github.com/aws/aws-sdk-js-v3)
- **Shortener API**: [Spoo.me](https://spoo.me/)

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or pnpm
- A Netlify account (for deployment)
- S3-compatible storage bucket (Cloudflare R2 recommended)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/media-share-frontend.git
   cd media-share-frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` file in the root directory and add the following:
   ```env
   # S3 / Cloudflare R2 Credentials
   S3_ACCESS_KEY_ID=your_access_key
   S3_SECRET_ACCESS_KEY=your_secret_key
   S3_ENDPOINT=https://your-account-id.r2.cloudflarestorage.com
   S3_BUCKET_NAME=your-bucket-name
   S3_REGION=auto

   # Public Site URL (for sharing links)
   VITE_SITE_URL=http://localhost:8888
   ```

### Local Development

This project uses Netlify Functions, so it's recommended to use the **Netlify CLI** for local development to simulate the serverless environment:

```bash
# Install Netlify CLI if you haven't
npm install netlify-cli -g

# Start the dev server
netlify dev
```
The application will be available at `http://localhost:8888`.

## 📐 Architecture

### Sharing Scheme
- **Files**: Requests to `/view/*` are redirected to a Netlify Function that generates a secure AWS S3 Presigned URL (1-hour expiry).
- **Folders**: Frontend routing handles folder states via the `?folder=` query parameter.
- **Shortening**: The `shortenUrl.js` utility handles API calls to Spoo.me with local caching to minimize API hits.

For more details, see [sharing-scheme.md](./sharing-scheme.md).

## 📦 Deployment

Deploy easily to **Netlify**:

1. Connect your GitHub repository to Netlify.
2. Set the build command to `npm run build`.
3. Set the publish directory to `dist`.
4. Add the environment variables from your `.env` file to the Netlify Site Settings.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

Built with 🎨 by [Media Nyeni]
