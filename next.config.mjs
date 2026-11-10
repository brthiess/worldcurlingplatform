import { eventEngineIdentity } from "./scripts/event-engine-identity.mjs";
import { overallEngineIdentity } from "./scripts/overall-engine-identity.mjs";
// Pin source evidence to the compiled production bundle. Workers independently hash their loaded source.
export default {
  env: {
    WCP_EVENT_ENGINE_BUILD_IDENTITY: JSON.stringify(eventEngineIdentity()),
    WCP_OVERALL_ENGINE_BUILD_IDENTITY: JSON.stringify(overallEngineIdentity()),
  },
};
