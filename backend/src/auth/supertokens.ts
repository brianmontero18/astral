import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import SuperTokens, {
  Error as SuperTokensError,
  getAllCORSHeaders,
} from "supertokens-node";
import { errorHandler as createFastifyErrorHandler, plugin as fastifyPlugin } from "supertokens-node/framework/fastify";
import Dashboard from "supertokens-node/recipe/dashboard";
import Passwordless from "supertokens-node/recipe/passwordless";
import Session from "supertokens-node/recipe/session";
import UserRoles from "supertokens-node/recipe/userroles";
import { readSuperTokensConfig } from "./config.js";
import { createPasswordlessEmailService } from "./email-templates.js";

export interface AuthRuntime {
  corsHeaders: Array<string>;
  enabled: boolean;
  handleError(
    error: unknown,
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<boolean>;
  register(app: FastifyInstance): Promise<void>;
}

let isInitialised = false;

function initSuperTokens(): void {
  const config = readSuperTokensConfig();
  const passwordlessEmailService = createPasswordlessEmailService(
    config.emailDelivery,
  );

  if (!config.enabled || isInitialised) {
    return;
  }

  SuperTokens.init({
    framework: "fastify",
    supertokens: {
      connectionURI: config.connectionURI,
      ...(config.apiKey ? { apiKey: config.apiKey } : {}),
    },
    appInfo: config.appInfo,
    recipeList: [
      Session.init(),
      Passwordless.init({
        contactMethod: "EMAIL",
        ...(passwordlessEmailService
          ? {
              emailDelivery: {
                service: passwordlessEmailService,
              },
            }
          : {}),
        flowType: "USER_INPUT_CODE_AND_MAGIC_LINK",
      }),
      UserRoles.init(),
      Dashboard.init(
        config.dashboardApiKey
          ? {
              apiKey: config.dashboardApiKey,
            }
          : undefined,
      ),
    ],
  });

  isInitialised = true;
}

function createDisabledRuntime(): AuthRuntime {
  return {
    enabled: false,
    corsHeaders: [],
    register: async () => {},
    handleError: async () => false,
  };
}

export function createAuthRuntime(): AuthRuntime {
  const config = readSuperTokensConfig();

  if (config.missingEnv.length > 0) {
    throw new Error(`Incomplete SuperTokens config: ${config.missingEnv.join(", ")}`);
  }

  if (config.emailDelivery.missingEnv.length > 0) {
    throw new Error(
      `Incomplete SuperTokens email delivery config: ${config.emailDelivery.missingEnv.join(", ")}`,
    );
  }

  if (!config.enabled) {
    return createDisabledRuntime();
  }

  initSuperTokens();

  const fastifyErrorHandler = createFastifyErrorHandler();

  return {
    enabled: true,
    corsHeaders: getAllCORSHeaders(),
    register: async (app) => {
      await app.register(fastifyPlugin);
    },
    handleError: async (error, request, reply) => {
      if (!SuperTokensError.isErrorFromSuperTokens(error)) {
        return false;
      }

      await fastifyErrorHandler(error, request, reply);
      return true;
    },
  };
}
