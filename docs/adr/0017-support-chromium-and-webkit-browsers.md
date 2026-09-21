# Support Chromium and WebKit browsers

PKSX supports Chromium 140 and Safari/WebKit 26. Firefox is unsupported and excluded from the automated browser test matrix because its maintenance cost and unreliable runs do not serve a product requirement. Chromium remains the full interaction and responsive gate, while WebKit covers the responsive floor and target cases plus mobile touch behavior. This supersedes the Firefox portion of ADR 0011 and leaves the native deployment floors unchanged.
