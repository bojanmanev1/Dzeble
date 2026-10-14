package com.dzeble.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.IBinder;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class StepService extends Service implements SensorEventListener {

    public static final String CHANNEL_ID = "dzeble_step_channel";
    public static final String SILENT_CHANNEL_ID = "dzeble_step_service_channel";
    public static final String PREFS_NAME = "dzeble_step_prefs";
    private static final int FOREGROUND_NOTIFICATION_ID = 9001;

    private SensorManager sensorManager;
    private Sensor stepCounterSensor;
    private Sensor stepDetectorSensor;

    @Override
    public void onCreate() {
        super.onCreate();
        try {
            stopForeground(true);
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.cancel(FOREGROUND_NOTIFICATION_ID);
            }
        } catch (Exception ignored) {}
        stopSelf();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        try {
            stopForeground(true);
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.cancel(FOREGROUND_NOTIFICATION_ID);
            }
        } catch (Exception ignored) {}
        stopSelf();
        return START_NOT_STICKY;
    }

    private void startForegroundSafely() {
        // Disabled: persistent notification removed per user request
    }

    private void registerSensors() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACTIVITY_RECOGNITION) != PackageManager.PERMISSION_GRANTED) {
                return;
            }
        }

        if (sensorManager == null) return;

        try {
            stepCounterSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
            stepDetectorSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR);

            if (stepCounterSensor != null) {
                sensorManager.registerListener(this, stepCounterSensor, SensorManager.SENSOR_DELAY_NORMAL);
            } else if (stepDetectorSensor != null) {
                sensorManager.registerListener(this, stepDetectorSensor, SensorManager.SENSOR_DELAY_NORMAL);
            }
        } catch (Exception e) {
            // Sensor access exception guard
        }
    }

    @Override
    public void onDestroy() {
        if (sensorManager != null) {
            sensorManager.unregisterListener(this);
        }
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() == Sensor.TYPE_STEP_COUNTER) {
            int raw = (int) event.values[0];
            processSteps(this, raw);
        } else if (event.sensor.getType() == Sensor.TYPE_STEP_DETECTOR) {
            incrementSingleStep(this);
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {}

    public static synchronized int incrementSingleStep(Context ctx) {
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault());
        String today = sdf.format(new Date());

        String savedDate = prefs.getString("today_date", "");
        int stepsToday = prefs.getInt("today_steps", 0);
        boolean notified5k = prefs.getBoolean("notified_5k", false);
        boolean notified10k = prefs.getBoolean("notified_10k", false);
        boolean notified15k = prefs.getBoolean("notified_15k", false);

        if (!today.equals(savedDate)) {
            savedDate = today;
            stepsToday = 1;
            notified5k = false;
            notified10k = false;
            notified15k = false;
        } else {
            stepsToday += 1;
        }

        SharedPreferences.Editor editor = prefs.edit();
        editor.putString("today_date", savedDate);
        editor.putInt("today_steps", stepsToday);

        checkMilestones(ctx, editor, stepsToday, notified5k, notified10k, notified15k);

        editor.apply();
        return stepsToday;
    }

    public static synchronized void setRestoredSteps(Context ctx, int restoredSteps) {
        if (restoredSteps <= 0) return;

        SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault());
        String today = sdf.format(new Date());

        int currentSteps = prefs.getInt("today_steps", 0);
        if (restoredSteps > currentSteps) {
            SharedPreferences.Editor editor = prefs.edit();
            editor.putString("today_date", today);

            int baseline = prefs.getInt("hardware_baseline", -1);
            int lastRaw = prefs.getInt("last_raw_steps", -1);

            if (baseline != -1 && lastRaw != -1 && lastRaw >= baseline) {
                int sensorDelta = lastRaw - baseline;
                editor.putInt("reboot_offset", Math.max(0, restoredSteps - sensorDelta));
            } else {
                editor.putInt("reboot_offset", restoredSteps);
            }

            editor.putInt("today_steps", restoredSteps);

            // Avoid re-alerting milestones already achieved prior to reinstall
            if (restoredSteps >= 5000) {
                editor.putBoolean("notified_5k", true);
            }
            if (restoredSteps >= 10000) {
                editor.putBoolean("notified_10k", true);
            }
            if (restoredSteps >= 15000) {
                editor.putBoolean("notified_15k", true);
            }

            editor.apply();
        }
    }

    public static synchronized int processSteps(Context ctx, int raw) {
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault());
        String today = sdf.format(new Date());

        String savedDate = prefs.getString("today_date", "");
        int baseline = prefs.getInt("hardware_baseline", -1);
        int lastRaw = prefs.getInt("last_raw_steps", -1);
        int rebootOffset = prefs.getInt("reboot_offset", 0);
        boolean notified5k = prefs.getBoolean("notified_5k", false);
        boolean notified10k = prefs.getBoolean("notified_10k", false);
        boolean notified15k = prefs.getBoolean("notified_15k", false);

        // Midnight reset check
        if (!today.equals(savedDate)) {
            savedDate = today;
            baseline = raw;
            lastRaw = raw;
            rebootOffset = 0;
            notified5k = false;
            notified10k = false;
            notified15k = false;
        } else {
            // Check hardware reboot (hardware counter resets to 0 on reboot)
            if (lastRaw != -1 && raw < lastRaw) {
                int delta = Math.max(0, lastRaw - baseline);
                rebootOffset += delta;
                baseline = raw;
            }
            if (baseline == -1) {
                baseline = raw;
            }
        }

        lastRaw = raw;
        int savedSteps = prefs.getInt("today_steps", 0);
        int calculatedSteps = Math.max(0, (raw - baseline) + rebootOffset);
        int stepsToday = Math.max(savedSteps, calculatedSteps);

        SharedPreferences.Editor editor = prefs.edit();
        editor.putString("today_date", savedDate);
        editor.putInt("hardware_baseline", baseline);
        editor.putInt("last_raw_steps", lastRaw);
        editor.putInt("reboot_offset", rebootOffset);
        editor.putInt("today_steps", stepsToday);

        checkMilestones(ctx, editor, stepsToday, notified5k, notified10k, notified15k);

        editor.apply();
        return stepsToday;
    }

    private static void checkMilestones(Context ctx, SharedPreferences.Editor editor, int stepsToday, boolean n5k, boolean n10k, boolean n15k) {
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        boolean notifEnabled = prefs.getBoolean("step_notifications_enabled", true);
        if (!notifEnabled) return;

        String lang = prefs.getString("app_language", "mk");
        String title5k = "🎉 5,000 Чекори!";
        String body5k = "Одличен напредок! Достигнавте 5,000 чекори денес!";
        String title10k = "🔥 10,000 Чекори!";
        String body10k = "Честитки! Ја остваривте вашата дневна цел од 10,000 чекори!";
        String title15k = "🏆 15,000 Чекори!";
        String body15k = "Неверојатен успех! Соборивте 15,000 чекори денес - вистински шампион!";

        if ("en".equalsIgnoreCase(lang)) {
            title5k = "🎉 5,000 Steps!";
            body5k = "Great progress! You reached 5,000 steps today!";
            title10k = "🔥 10,000 Steps!";
            body10k = "Congratulations! You achieved your daily goal of 10,000 steps!";
            title15k = "🏆 15,000 Steps!";
            body15k = "Incredible achievement! You exceeded 15,000 steps today - champion!";
        } else if ("al".equalsIgnoreCase(lang) || "sq".equalsIgnoreCase(lang)) {
            title5k = "🎉 5,000 Hapa!";
            body5k = "Përparim i shkëlqyer! Keni arritur 5,000 hapa sot!";
            title10k = "🔥 10,000 Hapa!";
            body10k = "Urime! Keni arritur synimin ditor prej 10,000 hapash!";
            title15k = "🏆 15,000 Hapa!";
            body15k = "Sukses i jashtëzakonshëm! Kaluat 15,000 hapa sot - kampion i vërtetë!";
        }

        if (stepsToday >= 5000 && !n5k) {
            sendMilestoneNotification(ctx, 5000, title5k, body5k);
            editor.putBoolean("notified_5k", true);
        }
        if (stepsToday >= 10000 && !n10k) {
            sendMilestoneNotification(ctx, 10000, title10k, body10k);
            editor.putBoolean("notified_10k", true);
        }
        if (stepsToday >= 15000 && !n15k) {
            sendMilestoneNotification(ctx, 15000, title15k, body15k);
            editor.putBoolean("notified_15k", true);
        }
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm == null) return;

            // 1. Silent Channel for Foreground Service
            NotificationChannel silentChannel = new NotificationChannel(
                SILENT_CHANNEL_ID,
                "Dzeble Сервис за чекори",
                NotificationManager.IMPORTANCE_LOW
            );
            silentChannel.setDescription("Сервис за активно броење чекори во позадина");
            silentChannel.setShowBadge(false);
            nm.createNotificationChannel(silentChannel);

            // 2. High Priority Channel for Milestones
            NotificationChannel alertChannel = new NotificationChannel(
                CHANNEL_ID,
                "Dzeble Активност & Чекори",
                NotificationManager.IMPORTANCE_HIGH
            );
            alertChannel.setDescription("Известувања за постигнати дневни чекори и цели");
            nm.createNotificationChannel(alertChannel);
        }
    }

    public static void sendMilestoneNotification(Context ctx, int id, String title, String message) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Dzeble Активност & Чекори",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Известувања за постигнати дневни чекори и цели");
            nm.createNotificationChannel(channel);
        }

        Intent intent = new Intent(ctx, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(
            ctx,
            id,
            intent,
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE : PendingIntent.FLAG_UPDATE_CURRENT
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(ctx, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(message)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pi);

        nm.notify(id, builder.build());
    }
}
