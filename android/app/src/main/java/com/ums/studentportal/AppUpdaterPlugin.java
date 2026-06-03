package com.ums.studentportal;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;

@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {

    @PluginMethod
    public void downloadAndInstallApk(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("URL is required");
            return;
        }

        try {
            Context context = getContext();
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            request.setTitle("تحميل تحديث بوابة الدرجات");
            request.setDescription("جاري تحميل ملف التحديث الجديد...");
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            
            // Save to external files dir (shared via FileProvider)
            String fileName = "SGP-update.apk";
            File destinationFile = new File(context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), fileName);
            if (destinationFile.exists()) {
                destinationFile.delete();
            }
            request.setDestinationUri(Uri.fromFile(destinationFile));

            DownloadManager downloadManager = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
            final long downloadId = downloadManager.enqueue(request);

            // Register BroadcastReceiver to handle installation once download completes
            BroadcastReceiver onComplete = new BroadcastReceiver() {
                @Override
                public void onReceive(Context c, Intent intent) {
                    long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                    if (downloadId == id) {
                        try {
                            context.unregisterReceiver(this);
                        } catch (Exception e) {
                            // Already unregistered
                        }
                        installApk(context, destinationFile);
                        JSObject ret = new JSObject();
                        ret.put("success", true);
                        call.resolve(ret);
                    }
                }
            };
            
            context.registerReceiver(onComplete, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE));

            // Monitor download progress
            final Handler handler = new Handler(Looper.getMainLooper());
            final Runnable progressRunnable = new Runnable() {
                @Override
                public void run() {
                    DownloadManager.Query query = new DownloadManager.Query();
                    query.setFilterById(downloadId);
                    Cursor cursor = downloadManager.query(query);
                    if (cursor != null && cursor.moveToFirst()) {
                        int statusCol = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
                        int status = statusCol != -1 ? cursor.getInt(statusCol) : -1;

                        int bytesDownloadedCol = cursor.getColumnIndex(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR);
                        int bytesTotalCol = cursor.getColumnIndex(DownloadManager.COLUMN_TOTAL_SIZE_BYTES);
                        int bytesDownloaded = bytesDownloadedCol != -1 ? cursor.getInt(bytesDownloadedCol) : 0;
                        int bytesTotal = bytesTotalCol != -1 ? cursor.getInt(bytesTotalCol) : 0;

                        if (bytesTotal > 0) {
                            double progress = (bytesDownloaded * 100.0) / bytesTotal;
                            JSObject ret = new JSObject();
                            ret.put("progress", (int) progress);
                            notifyListeners("downloadProgress", ret);
                        }

                        if (status == DownloadManager.STATUS_SUCCESSFUL || status == DownloadManager.STATUS_FAILED) {
                            cursor.close();
                            return; // Stop polling
                        }
                        cursor.close();
                    }
                    handler.postDelayed(this, 500);
                }
            };
            handler.post(progressRunnable);

        } catch (Exception e) {
            call.reject("Error downloading APK: " + e.getMessage(), e);
        }
    }

    private void installApk(Context context, File file) {
        Intent intent = new Intent(Intent.ACTION_VIEW);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            Uri apkUri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", file);
            intent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } else {
            intent.setDataAndType(Uri.fromFile(file), "application/vnd.android.package-archive");
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(intent);
    }
}
