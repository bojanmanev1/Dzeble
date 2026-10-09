package com.dzeble.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.IBinder;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class StepService extends Service implements SensorEventListener {

    public static final String CHANNEL_ID = "dzeble_step_channel";
    public static final String PREFS_NAME = "dzeble_step_prefs";

    private SensorManager sensorManager;
    private Sensor stepSensor;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager != null) {
            stepSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
            if (stepSensor != null) {
                sensorManager.registerListener(this, stepSensor, SensorManager.SENSOR_DELAY_NORMAL);
            }
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (stepSensor != null && sensorManager != null) {
            sensorManager.registerListener(this, stepSensor, SensorManager.SENSOR_DELAY_NORMAL);
        }
        return START_STICKY;
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
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {}

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
            // Check reboot
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
        int stepsToday = Math.max(0, (raw - baseline) + rebootOffset);

        SharedPreferences.Editor editor = prefs.edit();
        editor.putString("today_date", savedDate);
        editor.putInt("hardware_baseline", baseline);
        editor.putInt("last_raw_steps", lastRaw);
        editor.putInt("reboot_offset", rebootOffset);
        editor.putInt("today_steps", stepsToday);

        // Milestone notifications
        if (stepsToday >= 5000 && !notified5k) {
            sendMilestoneNotification(ctx, 5000, "🎉 5,000 Чекори!", "Одличен напредок! Достигнавте 5,000 чекори денес!");
            editor.putBoolean("notified_5k", true);
        }
        if (stepsToday >= 10000 && !notified10k) {
            sendMilestoneNotification(ctx, 10000, "🔥 10,000 Чекори!", "Честитки! Ја остваривте вашата дневна цел од 10,000 чекори!");
            editor.putBoolean("notified_10k", true);
        }
        if (stepsToday >= 15000 && !notified15k) {
            sendMilestoneNotification(ctx, 15000, "🏆 15,000 Чекори!", "Неверојатен успех! Соборивте 15,000 чекори денес - вистински шампион!");
            editor.putBoolean("notified_15k", true);
        }

        editor.apply();
        return stepsToday;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Dzeble Активност & Чекори",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            channel.setDescription("Известувања за постигнати дневни чекори и цели");
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) {
                nm.createNotificationChannel(channel);
            }
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
