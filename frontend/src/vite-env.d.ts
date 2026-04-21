/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPPORT_HREF?: string;
  readonly VITE_SUPERTOKENS_API_BASE_PATH?: string;
  readonly VITE_SUPERTOKENS_API_DOMAIN?: string;
  readonly VITE_SUPERTOKENS_APP_NAME?: string;
  readonly VITE_SUPERTOKENS_AUTH_ENABLED?: string;
  readonly VITE_SUPERTOKENS_WEBSITE_BASE_PATH?: string;
  readonly VITE_SUPERTOKENS_WEBSITE_DOMAIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
