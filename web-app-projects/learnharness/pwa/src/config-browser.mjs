// Static browser config only. No Node path helpers, auth file, CLI or provider setup.
export const ROOT='browser://learnharness';
export const PATHS={root:ROOT,teacherPrompt:ROOT+'/src/agent/system-prompt.md',data:'shared-records://learnharness',chats:'shared-records://chats',graph:'shared-records://graph',debug:'disabled'};
export const PROMPTS_OVERRIDE_DIR='shared-records://prompt-overrides';
