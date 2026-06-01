# Split persistent status from toast feedback

PKSX will keep a persistent status strip for durable app and workspace state, such as empty-library guidance, busy state, dirty/restored workspace state, and controller connection context, while toast notifications will carry transient outcomes and errors from user actions. This preserves scanable controller-first context without turning short-lived feedback into permanent layout content, and it gives keyboard, gamepad, and pointer users immediate feedback when a requested action cannot be completed.

