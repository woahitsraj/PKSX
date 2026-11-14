package com.pksx.app;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.os.CancellationSignal;
import android.provider.DocumentsContract;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import org.json.JSONObject;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;

@CapacitorPlugin(name = "SaveFolders")
public class SaveFoldersPlugin extends Plugin {
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private volatile CancellationSignal signal;
    private static final int MAX_BYTES = 16 * 1024 * 1024;

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences("linked-save-folder", 0);
    }

    private JSArray folders() throws Exception { return linkedFolders(getContext()); }

    static JSArray linkedFolders(android.content.Context context) throws Exception {
        SharedPreferences preferences = context.getSharedPreferences("linked-save-folder", 0);
        String stored = preferences.getString("folders", null);
        if (stored != null) return new JSArray(stored);
        JSArray folders = new JSArray();
        String legacy = preferences.getString("tree", null);
        if (legacy != null) folders.put(new JSObject().put("tree", legacy)
            .put("name", preferences.getString("name", "Selected folder")));
        return folders;
    }

    private void persistFolders(JSArray folders) {
        if (!preferences().edit().putString("folders", folders.toString())
            .remove("tree").remove("mode").remove("name").commit()) {
            throw new IllegalStateException("Folder links could not be saved.");
        }
    }

    @PluginMethod
    public void status(PluginCall call) {
        try { call.resolve(new JSObject().put("folders", folders())); }
        catch (Exception e) { call.reject("Folder links could not be read.", e); }
    }

    @PluginMethod
    public void pick(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(call, intent, "picked");
    }

    @ActivityCallback
    private void picked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.resolve(new JSObject().put("cancelled", true));
            return;
        }
        Uri tree = result.getData().getData();
        try {
            String name = "Selected folder";
            Uri root = DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree));
            try (Cursor cursor = getContext().getContentResolver().query(root, new String[]{"_display_name"}, null, null, null)) {
                if (cursor == null || !cursor.moveToFirst()) throw new IllegalStateException("Folder is unavailable.");
                name = cursor.getString(0);
            }
            int flags = result.getData().getFlags() & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            if ((flags & Intent.FLAG_GRANT_READ_URI_PERMISSION) == 0) throw new SecurityException("Read access was not granted.");
            getContext().getContentResolver().takePersistableUriPermission(tree, flags);
            JSArray linked = folders();
            boolean exists = false;
            for (int i = 0; i < linked.length(); i++) {
                if (linked.getJSONObject(i).getString("tree").equals(tree.toString())) exists = true;
            }
            JSObject folder = new JSObject().put("tree", tree.toString()).put("name", name);
            if (!exists) linked.put(folder);
            persistFolders(linked);
            call.resolve(new JSObject().put("cancelled", false).put("folder", folder));
        } catch (Exception e) { call.reject("Folder access could not be retained. Choose the folder again.", e); }
    }

    private void release(String tree) {
        try { for (android.content.UriPermission permission : getContext().getContentResolver().getPersistedUriPermissions()) {
            if (permission.getUri().equals(Uri.parse(tree))) {
                int flags = (permission.isReadPermission() ? Intent.FLAG_GRANT_READ_URI_PERMISSION : 0) | (permission.isWritePermission() ? Intent.FLAG_GRANT_WRITE_URI_PERMISSION : 0);
                getContext().getContentResolver().releasePersistableUriPermission(permission.getUri(), flags);
            }
        } }
        catch (SecurityException ignored) { }
    }

    @PluginMethod
    public void unlink(PluginCall call) {
        try {
            String tree = call.getString("tree");
            JSArray remaining = new JSArray();
            JSArray linked = folders();
            for (int i = 0; i < linked.length(); i++) {
                JSONObject folder = linked.getJSONObject(i);
                if (!folder.getString("tree").equals(tree)) remaining.put(folder);
            }
            persistFolders(remaining);
            if (tree != null) release(tree);
            call.resolve();
        } catch (Exception e) { call.reject("Folder could not be unlinked.", e); }
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        CancellationSignal active = signal;
        if (active != null) active.cancel();
        call.resolve();
    }

    private Uri tree(PluginCall call) throws Exception {
        String value = call.getString("tree");
        JSArray linked = folders();
        for (int i = 0; i < linked.length(); i++) {
            if (linked.getJSONObject(i).getString("tree").equals(value)) return Uri.parse(value);
        }
        throw new SecurityException("Choose or relink this folder first.");
    }

    @PluginMethod
    public void list(PluginCall call) {
        worker.execute(() -> {
            CancellationSignal current = new CancellationSignal();
            signal = current;
            try {
                Uri tree = tree(call);
                String parent = call.getString("documentId", DocumentsContract.getTreeDocumentId(tree));
                Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, parent);
                String[] columns = {"document_id", "_display_name", "mime_type", "_size"};
                JSArray entries = new JSArray();
                boolean truncated = false;
                try (Cursor cursor = getContext().getContentResolver().query(children, columns, null, null, null, current)) {
                    if (cursor == null) throw new IllegalStateException("Folder is unavailable.");
                    while (cursor.moveToNext()) {
                        current.throwIfCanceled();
                        if (entries.length() >= 2000) { truncated = true; break; }
                        entries.put(new JSObject().put("id", cursor.getString(0)).put("name", cursor.getString(1))
                            .put("directory", DocumentsContract.Document.MIME_TYPE_DIR.equals(cursor.getString(2)))
                            .put("size", cursor.getLong(3)));
                    }
                }
                call.resolve(new JSObject().put("entries", entries).put("truncated", truncated));
            } catch (Exception e) { call.reject("Folder unavailable or scan cancelled. Relink if access was removed.", e); }
            finally { if (signal == current) signal = null; }
        });
    }

    @PluginMethod
    public void read(PluginCall call) {
        worker.execute(() -> {
            CancellationSignal current = new CancellationSignal();
            signal = current;
            try {
                Uri tree = tree(call);
                String id = call.getString("documentId");
                if (id == null) throw new IllegalArgumentException("Missing document identity.");
                Uri document = DocumentsContract.buildDocumentUriUsingTree(tree, id);
                try (android.os.ParcelFileDescriptor descriptor = getContext().getContentResolver().openFileDescriptor(document, "r", current);
                     InputStream input = new android.os.ParcelFileDescriptor.AutoCloseInputStream(descriptor);
                     ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                    byte[] buffer = new byte[32768];
                    int count;
                    while ((count = input.read(buffer)) != -1) {
                        current.throwIfCanceled();
                        if (output.size() + count > MAX_BYTES) throw new IllegalArgumentException("File exceeds 16 MiB scan limit.");
                        output.write(buffer, 0, count);
                    }
                    String identity = new JSArray().put(tree.getAuthority()).put(id).toString();
                    call.resolve(new JSObject().put("base64", Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP)).put("identity", identity));
                }
            } catch (Exception e) { call.reject("File unavailable or read cancelled. Relink if access was removed.", e); }
            finally { if (signal == current) signal = null; }
        });
    }

    @Override
    protected void handleOnDestroy() {
        if (signal != null) signal.cancel();
        worker.shutdownNow();
    }
}
