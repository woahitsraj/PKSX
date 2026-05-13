# Use an app-managed local library

PKSX treats its local library as the source of truth for imported saves, backups, and bank data. Direct file write-back may be added later where platform APIs support it, but the first milestone uses explicit import and export so browser, Capacitor, and future Electron builds share one durable storage model.
