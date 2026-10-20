# ERP Backend API

A clean, function-based Express server built with TypeScript and live development with Nodemon.

## Folder Structure

```text
backend/
├── src/
│   ├── middlewares/
│   │   └── error.middleware.ts     # 404 and global error handlers
│   ├── routes/
│   │   └── index.ts                # Main API routes & health check
│   ├── app.ts                      # Express app configuration & middlewares
│   └── server.ts                   # Server entry point
├── .env                            # Local environment variables
├── .env.example                    # Sample environment variables
├── .gitignore                      # Git ignored files
├── nodemon.json                    # Nodemon watch configuration
├── package.json                    # Project metadata & scripts
├── tsconfig.json                   # TypeScript configuration
└── README.md
```

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Live Development (with Nodemon)
```bash
npm run dev
```

Nodemon will automatically reload whenever files in `src/` change.

### 3. Build for Production
```bash
npm run build
npm start
```
