declare namespace NodeJS {
  interface ProcessEnv {
    CLOUDINARY_CLOUD_NAME: string;
    CLOUDINARY_API_KEY: string;
    CLOUDINARY_API_SECRET: string;
    CLOUDINARY_UPLOAD_PRESET: string;
    ALLOWED_EMAIL_DOMAINS: string;
    JWT_SECRET: string;
    DATABASE_URL: string;
    NODE_ENV: 'development' | 'production' | 'test';
    FE_ORIGIN: string;
  }
}
