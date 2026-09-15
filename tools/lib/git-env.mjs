// Shared sanitized-Git-environment policy for staging, verification and closure scans.
const UNSET_ENV_KEYS = [
  "GIT_TEMPLATE_DIR",
  "GIT_OBJECT_DIRECTORY",
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_INDEX_FILE",
  "GIT_COMMON_DIR",
  "GIT_GRAFT_FILE",
  "GIT_CEILING_DIRECTORIES",
  "GIT_AUTHOR_NAME",
  "GIT_AUTHOR_EMAIL",
  "GIT_AUTHOR_DATE",
  "GIT_COMMITTER_NAME",
  "GIT_COMMITTER_EMAIL",
  "GIT_COMMITTER_DATE",
];

function isInjectedConfigKey(key) {
  if (key === "GIT_CONFIG_PARAMETERS") return true;
  return /^(?:GIT_CONFIG_(?:COUNT|KEY_|VALUE_))/u.test(key);
}

export function isolatedGitEnv(environment = {}) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (isInjectedConfigKey(key) || UNSET_ENV_KEYS.includes(key)) delete env[key];
  }
  return {
    ...env,
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_SYSTEM: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_TERMINAL_PROMPT: "0",
    GIT_PAGER: "cat",
    PAGER: "cat",
    GIT_EDITOR: ":",
    EDITOR: ":",
    ...environment,
  };
}
