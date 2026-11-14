package com.pksx.app;

import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.DocumentsContract;
import android.util.Base64;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.security.MessageDigest;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;

@CapacitorPlugin(name = "LinkedSaves")
public class LinkedSavesPlugin extends Plugin {
    private static final int MAX_BYTES = 16 * 1024 * 1024;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences("linked-save-folder", 0);
    }

    private JSONObject sources() throws Exception {
        return new JSONObject(preferences().getString("sources", "{}"));
    }

    private void persist(JSONObject sources) {
        if (!preferences().edit().putString("sources", sources.toString()).commit()) {
            throw new IllegalStateException("Source recovery information could not be saved.");
        }
    }

    private static String required(PluginCall call, String key) {
        String value = call.getString(key);
        if (value == null || value.isEmpty()) throw new IllegalArgumentException("Missing " + key);
        return value;
    }

    private static String hash(byte[] bytes) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(bytes);
        StringBuilder value = new StringBuilder();
        for (byte part : digest) value.append(String.format("%02x", part & 255));
        return value.toString();
    }

    private byte[] read(Uri uri) throws Exception {
        try (InputStream input = getContext().getContentResolver().openInputStream(uri);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            if (input == null) throw new IllegalStateException("Source is unavailable.");
            byte[] buffer = new byte[32768];
            int count;
            while ((count = input.read(buffer)) != -1) {
                if (output.size() + count > MAX_BYTES) throw new IllegalArgumentException("Source exceeds 16 MiB.");
                output.write(buffer, 0, count);
            }
            return output.toByteArray();
        }
    }

    private static class Document {
        Uri uri;
        byte[] bytes;
        String hash;
        String name;
    }

    private Document document(String identity) throws Exception {
        JSONArray parts = new JSONArray(identity);
        if (parts.length() != 2) throw new IllegalArgumentException("Invalid source identity.");
        String authority = parts.getString(0);
        String id = parts.getString(1);
        JSArray folders = SaveFoldersPlugin.linkedFolders(getContext());
        Exception last = new SecurityException("Source folder is not linked. Choose it again to restore access.");
        for (int i = 0; i < folders.length(); i++) {
            Uri tree = Uri.parse(folders.getJSONObject(i).getString("tree"));
            if (!authority.equals(tree.getAuthority())) continue;
            try {
                Document document = new Document();
                document.uri = DocumentsContract.buildDocumentUriUsingTree(tree, id);
                document.bytes = read(document.uri);
                document.hash = hash(document.bytes);
                try (Cursor cursor = getContext().getContentResolver().query(document.uri, new String[]{"_display_name"}, null, null, null)) {
                    if (cursor == null || !cursor.moveToFirst()) throw new IllegalStateException("Source is missing.");
                    document.name = cursor.getString(0);
                }
                return document;
            } catch (Exception error) { last = error; }
        }
        throw last;
    }

    private JSONObject source(JSONObject sources, PluginCall call) throws Exception {
        String identity = required(call, "identity");
        String saveFileId = required(call, "saveFileId");
        JSONObject source = sources.optJSONObject(identity);
        if (source == null || !source.getString("saveFileId").equals(saveFileId)) {
            if (source != null && source.has("pending")) throw new IllegalStateException("The previous source link needs Export recovery.");
            String baseline = required(call, "baselineHash");
            if (!baseline.matches("[0-9a-f]{64}")) throw new IllegalArgumentException("Invalid source baseline.");
            source = new JSONObject().put("saveFileId", saveFileId).put("baselineHash", baseline);
            sources.put(identity, source);
            persist(sources);
        }
        return source;
    }

    @PluginMethod
    public void inspect(PluginCall call) {
        worker.execute(() -> {
            try {
                String identity = required(call, "identity");
                JSONObject sources = sources();
                JSONObject source = source(sources, call);
                Document document = document(identity);
                String outcome = "none";
                JSONObject pending = source.optJSONObject("pending");
                if (pending != null) {
                    if (document.hash.equals(pending.getString("afterHash"))) {
                        source.put("baselineHash", document.hash).remove("pending");
                        outcome = "completed";
                    } else if (document.hash.equals(pending.getString("beforeHash")) && document.hash.equals(source.getString("baselineHash"))) {
                        source.remove("pending");
                        outcome = "not-written";
                    } else outcome = "recovery-required";
                    if (!outcome.equals("recovery-required")) persist(sources);
                }
                call.resolve(new JSObject().put("source", source).put("hash", document.hash)
                    .put("name", document.name).put("base64", Base64.encodeToString(document.bytes, Base64.NO_WRAP))
                    .put("outcome", outcome));
            } catch (Exception e) { call.reject("Source could not be checked. Relink its folder if access was removed. " + e.getMessage(), e); }
        });
    }

    @PluginMethod
    public void accept(PluginCall call) {
        worker.execute(() -> {
            try {
                String identity = required(call, "identity");
                JSONObject sources = sources();
                JSONObject source = sources.getJSONObject(identity);
                if (!source.getString("saveFileId").equals(required(call, "saveFileId"))) throw new IllegalStateException("Source owner changed.");
                if (source.has("pending")) throw new IllegalStateException("Resolve interrupted Export first.");
                String expected = required(call, "hash");
                if (!document(identity).hash.equals(expected)) throw new IllegalStateException("The emulator changed the source again. Rescan before continuing.");
                source.put("baselineHash", expected);
                persist(sources);
                call.resolve();
            } catch (Exception e) { call.reject(e.getMessage(), e); }
        });
    }

    @PluginMethod
    public void write(PluginCall call) {
        worker.execute(() -> {
            try {
                String identity = required(call, "identity");
                String expected = required(call, "expectedHash");
                String backupId = required(call, "backupId");
                JSONObject sources = sources();
                JSONObject source = sources.getJSONObject(identity);
                if (!source.getString("saveFileId").equals(required(call, "saveFileId"))) throw new IllegalStateException("Source owner changed.");
                String encoded = required(call, "base64");
                if (encoded.length() > (MAX_BYTES * 4 / 3) + 4) throw new IllegalArgumentException("Export exceeds 16 MiB.");
                byte[] bytes = Base64.decode(encoded, Base64.DEFAULT);
                if (bytes.length == 0 || bytes.length > MAX_BYTES) throw new IllegalArgumentException("Invalid Export size.");
                String target = hash(bytes);
                Document before = document(identity);
                if (!before.hash.equals(expected)) throw new IllegalStateException("The source changed. Both versions are preserved. Rescan before Export.");
                JSONObject oldPending = source.optJSONObject("pending");
                String recoveryBackup = backupId;
                String recoveryHash = before.hash;
                if (call.getBoolean("recover", false)) {
                    if (oldPending == null || !oldPending.getString("recoveryHash").equals(target)
                        || !oldPending.getString("recoveryBackupId").equals(required(call, "recoveryBackupId"))) {
                        throw new IllegalStateException("Recovery backup no longer matches this Export.");
                    }
                    recoveryBackup = oldPending.getString("recoveryBackupId");
                    recoveryHash = oldPending.getString("recoveryHash");
                } else {
                    if (oldPending != null) throw new IllegalStateException("An interrupted Export needs recovery first.");
                    if (!source.getString("baselineHash").equals(expected)) throw new IllegalStateException("The emulator changed the source. Load its version or export a separate copy.");
                }
                JSONObject pending = new JSONObject().put("beforeHash", before.hash).put("afterHash", target)
                    .put("backupId", backupId).put("recoveryBackupId", recoveryBackup).put("recoveryHash", recoveryHash);
                source.put("pending", pending);
                persist(sources);
                ParcelFileDescriptor descriptor = getContext().getContentResolver().openFileDescriptor(before.uri, "rwt");
                if (descriptor == null) throw new IllegalStateException("Provider refused write access. Relink for read/write access or export a copy.");
                try (OutputStream output = new ParcelFileDescriptor.AutoCloseOutputStream(descriptor)) {
                    output.write(bytes);
                    output.flush();
                    descriptor.getFileDescriptor().sync();
                }
                if (!hash(read(before.uri)).equals(target)) throw new IllegalStateException("Export verification failed. The external backup is available for recovery.");
                source.put("baselineHash", target).remove("pending");
                source.put("exportedAt", System.currentTimeMillis());
                persist(sources);
                call.resolve(new JSObject().put("name", before.name).put("hash", target));
            } catch (Exception e) { call.reject("Export did not complete with verified success. Source backup retained. " + e.getMessage(), e); }
        });
    }

    @Override
    protected void handleOnDestroy() {
        worker.shutdown();
    }
}
