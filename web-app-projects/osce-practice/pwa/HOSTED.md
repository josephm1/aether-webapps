# Aether hosted adapter

Use the matching Apps owner/host and standard web-app manifest. Source/resources
remain editable under the shared project source folder; data uses the web SDK in
the app's own data subtree. Generated assets are private and disposable. Read the
project README.md before changing workflows. No additional native code is needed.
Build through `app_project {action:"build",id:"aether-osce-practice"}` or Apps Open.
This compiles/validates source without performing a model call. For AI use the
existing complete/selection SDK; app-specific overrides are resolved by Apps.
