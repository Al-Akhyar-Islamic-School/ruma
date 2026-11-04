package sch.alakhyar.ruma;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;

public class RumaRecorderService extends Service {
    public static final String ACTION_START = "sch.alakhyar.ruma.action.START_RECORDING";
    public static final String ACTION_STOP = "sch.alakhyar.ruma.action.STOP_RECORDING";
    public static final String EXTRA_JUDUL = "judul";

    private static final String CHANNEL_ID = "ruma_recorder_channel";
    private static final int NOTIFICATION_ID = 1001;

    private PowerManager.WakeLock wakeLock;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if (ACTION_STOP.equals(action)) {
                stopRecording();
                return START_NOT_STICKY;
            }
        }

        String judul = "Sesi Rapat";
        if (intent != null && intent.hasExtra(EXTRA_JUDUL)) {
            String j = intent.getStringExtra(EXTRA_JUDUL);
            if (j != null && !j.trim().isEmpty()) {
                judul = j.trim();
            }
        }

        startRecording(judul);
        return START_STICKY;
    }

    private void startRecording(String judul) {
        // 1. Ambil Wake Lock agar CPU tetap aktif saat layar mati
        if (wakeLock == null) {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "ruma:recorder_wake_lock");
                // Batas pengaman: 6 jam maksimum agar baterai tidak habis selamanya jika lupa stop
                wakeLock.acquire(6 * 60 * 60 * 1000L);
            }
        }

        // 2. Bangun notifikasi aktif
        Intent clickIntent = new Intent(this, MainActivity.class);
        clickIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            0,
            clickIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("ruma. sedang merekam")
            .setContentText(judul)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build();

        // 3. Jalankan Foreground Service bertipe Mikrofon (wajib di Android 14+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private void stopRecording() {
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
            wakeLock = null;
        }
        stopForeground(true);
        stopSelf();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Perekaman Audio ruma.",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Notifikasi aktif saat ruma. sedang merekam audio di latar belakang.");
            channel.setShowBadge(false);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public void onDestroy() {
        stopRecording();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
