package it.studylog.app;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.SystemClock;

public final class TimerNotification extends BroadcastReceiver {
    private static final String SOUND = "timer_sound";
    private static final String SILENT = "timer_silent";

    static void record(Context context, String message) {
        context.getSharedPreferences("timer-diagnostics", Context.MODE_PRIVATE).edit()
            .putString("last", java.text.DateFormat.getTimeInstance().format(new java.util.Date())
                + " — " + message).apply();
    }

    static String diagnostic(Context context) {
        return context.getSharedPreferences("timer-diagnostics", Context.MODE_PRIVATE)
            .getString("last", "Nessun avviso programmato da questa installazione.");
    }

    static void createChannels(NotificationManager manager) {
        manager.createNotificationChannel(new NotificationChannel(
            SOUND, "Fine timer con suono", NotificationManager.IMPORTANCE_DEFAULT));
        NotificationChannel silent = new NotificationChannel(
            SILENT, "Fine timer silenzioso", NotificationManager.IMPORTANCE_LOW);
        silent.setSound(null, null);
        manager.createNotificationChannel(silent);
    }

    private static PendingIntent operation(Context context, long start, boolean sound, int flags) {
        Intent intent = new Intent(context, TimerNotification.class)
            .setData(Uri.parse("studylog:timer/" + start))
            .putExtra("sound", sound);
        return PendingIntent.getBroadcast(context, 0, intent, flags | PendingIntent.FLAG_IMMUTABLE);
    }

    static void schedule(Context context, long start, long remaining, boolean sound) {
        AlarmManager alarms = context.getSystemService(AlarmManager.class);
        alarms.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP,
            SystemClock.elapsedRealtime() + remaining,
            operation(context, start, sound, PendingIntent.FLAG_UPDATE_CURRENT));
    }

    static void cancel(Context context, long start) {
        PendingIntent pending = operation(context, start, false, PendingIntent.FLAG_NO_CREATE);
        if (pending != null) {
            context.getSystemService(AlarmManager.class).cancel(pending);
            pending.cancel();
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        record(context, "[SCADENZA_RICEVUTA] Android ha eseguito l’avviso.");
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        createChannels(manager);
        if (!manager.areNotificationsEnabled()) {
            record(context, "[NOTIFICHE_DISATTIVATE] Scadenza ricevuta, notifiche di StudyLog disattivate.");
            return;
        }
        String channel = intent.getBooleanExtra("sound", true) ? SOUND : SILENT;
        if (manager.getNotificationChannel(channel).getImportance() == NotificationManager.IMPORTANCE_NONE) {
            record(context, "[CANALE_DISATTIVATO] Scadenza ricevuta, categoria di notifica disattivata in Android.");
            return;
        }

        PendingIntent open = PendingIntent.getActivity(context, 0,
            new Intent(context, MainActivity.class), PendingIntent.FLAG_IMMUTABLE);
        Notification notification = new Notification.Builder(context, channel)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle("StudyLog · Timer scaduto")
            .setContentText("Il conto alla rovescia è terminato.")
            .setContentIntent(open)
            .setAutoCancel(true)
            .build();
        try {
            manager.notify(intent.getDataString(), 1, notification);
            record(context, "[NOTIFICA_PUBBLICATA] Notifica inviata al sistema Android. Controlla il pannello notifiche.");
        } catch (RuntimeException error) {
            android.util.Log.e("StudyLogTimer", "Notification failed", error);
            record(context, "[ERRORE_NOTIFICA] " + error.getClass().getSimpleName());
        }
    }
}
