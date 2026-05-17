import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SuperTokensWrapper } from "supertokens-auth-react";
import "./index.css";
import App from "./App";
import { AuthScreen } from "./auth/AuthScreen";
import BodygraphPoc from "./BodygraphPoc";
import { ensureFrontendAuthInit, isAuthRoute } from "./auth/config";

const authConfig = ensureFrontendAuthInit();
const isBodygraphPoc = window.location.pathname === "/bodygraph-poc";
const rootComponent = isBodygraphPoc
  ? <BodygraphPoc />
  : isAuthRoute()
    ? <AuthScreen />
    : <App />;

const app = (
  <StrictMode>
    {authConfig.enabled && !isBodygraphPoc ? (
      <SuperTokensWrapper>
        {rootComponent}
      </SuperTokensWrapper>
    ) : (
      rootComponent
    )}
  </StrictMode>
);

createRoot(document.getElementById("root")!).render(
  app
);
