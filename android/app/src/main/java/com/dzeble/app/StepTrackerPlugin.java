package com.dzeble.app;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Logger;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "StepTracker",
    permissions = {
        @Permission(strings = { Manifest.permission.ACTIVITY_RECOGNITION }, alias = "activityRecognition"),
        @Permission(strings = { "android.permission.POST_NOTIFICATIONS" }, alias = "notifications")
    }
)
public class StepTrackerPlugin extends Plugin implements SensorEventListener {

    private SensorManager sensorManager;
    private Sensor stepCounterSensor;
    private Sensor stepDetectorSensor;
    private boolean isListening = false;

    @Override
    public void load() {
        Context context = getContext();
        sensorManager = (SensorManager) context.getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager != null) {
            stepCounterSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
            stepDetectorSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR);
        }
    }

    @PluginMethod
    public void getTodaySteps(PluginCall call) {
        Context ctx = getContext();
        if (sensorManager != null && isListening) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                    sensorManager.flush(this);
                }
            } catch (Exception e) {}
        }

        SharedPreferences prefs = ctx.getSharedPreferences(StepService.PREFS_NAME, Context.MODE_PRIVATE);

        int steps = prefs.getInt("today_steps", 0);
        int calories = Math.round(steps * 0.04f);
        float distanceKm = Math.round(steps * 0.000762f * 100.0f) / 100.0f;
        boolean isAvailable = (stepCounterSensor != null || stepDetectorSensor != null);

        JSObject ret = new JSObject();
        ret.put("steps", steps);
        ret.put("calories", calories);
        ret.put("distanceKm", distanceKm);
        ret.put("isAvailable", isAvailable);
        call.resolve(ret);
    }

    @PluginMethod
    public void setNotificationsEnabled(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", true);
        Context ctx = getContext();
        SharedPreferences prefs = ctx.getSharedPreferences(StepService.PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putBoolean("step_notifications_enabled", enabled).apply();
        call.resolve();
    }

    @PluginMethod
    public void setLanguage(PluginCall call) {
        String lang = call.getString("language", "mk");
        Context ctx = getContext();
        SharedPreferences prefs = ctx.getSharedPreferences(StepService.PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString("app_language", lang).apply();
        call.resolve();
    }

    public void startInternalTracking() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACTIVITY_RECOGNITION) != PackageManager.PERMISSION_GRANTED) {
                return;
            }
        }

        if (sensorManager != null && !isListening) {
            try {
                if (stepCounterSensor != null) {
                    sensorManager.registerListener(this, stepCounterSensor, SensorManager.SENSOR_DELAY_UI);
                    isListening = true;
                } else if (stepDetectorSensor != null) {
                    sensorManager.registerListener(this, stepDetectorSensor, SensorManager.SENSOR_DELAY_UI);
                    isListening = true;
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                    sensorManager.flush(this);
                }
            } catch (Exception e) {
                Logger.error("Failed to register sensor listener: " + e.getMessage());
            }
        }

        try {
            Context ctx = getContext();
            Intent serviceIntent = new Intent(ctx, StepService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(serviceIntent);
            } else {
                ctx.startService(serviceIntent);
            }
        } catch (Exception e) {
            Logger.warn("Failed to start StepService: " + e.getMessage());
        }
    }

    @PluginMethod
    public void startUpdates(PluginCall call) {
        if (stepCounterSensor == null && stepDetectorSensor == null) {
            JSObject ret = new JSObject();
            ret.put("started", false);
            ret.put("reason", "Sensor not available on device");
            call.resolve(ret);
            return;
        }

        startInternalTracking();

        JSObject ret = new JSObject();
        ret.put("started", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void stopUpdates(PluginCall call) {
        if (sensorManager != null && isListening) {
            try {
                sensorManager.unregisterListener(this);
            } catch (Exception e) {}
            isListening = false;
        }
        call.resolve();
    }

    @PluginMethod
    public void checkTrackerPermissions(PluginCall call) {
        boolean granted = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            granted = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED;
        }
        JSObject ret = new JSObject();
        ret.put("activityRecognition", granted ? "granted" : "prompt");
        call.resolve(ret);
    }

    @PluginMethod
    public void requestTrackerPermissions(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACTIVITY_RECOGNITION) != PackageManager.PERMISSION_GRANTED) {
                requestPermissionForAlias("activityRecognition", call, "permissionCallback");
                return;
            }
        }
        JSObject ret = new JSObject();
        ret.put("activityRecognition", "granted");
        startInternalTracking();
        call.resolve(ret);
    }

    @PermissionCallback
    public void permissionCallback(PluginCall call) {
        boolean granted = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            granted = ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED;
        }
        JSObject ret = new JSObject();
        ret.put("activityRecognition", granted ? "granted" : "denied");
        if (granted) {
            startInternalTracking();
        }
        call.resolve(ret);
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        int steps = 0;
        if (event.sensor.getType() == Sensor.TYPE_STEP_COUNTER) {
            int raw = (int) event.values[0];
            steps = StepService.processSteps(getContext(), raw);
        } else if (event.sensor.getType() == Sensor.TYPE_STEP_DETECTOR) {
            steps = StepService.incrementSingleStep(getContext());
        } else {
            return;
        }

        int calories = Math.round(steps * 0.04f);
        float distanceKm = Math.round(steps * 0.000762f * 100.0f) / 100.0f;

        JSObject data = new JSObject();
        data.put("steps", steps);
        data.put("calories", calories);
        data.put("distanceKm", distanceKm);
        notifyListeners("stepUpdate", data);
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {}

    @Override
    public void handleOnResume() {
        super.handleOnResume();
        if (isListening && sensorManager != null) {
            try {
                if (stepCounterSensor != null) {
                    sensorManager.registerListener(this, stepCounterSensor, SensorManager.SENSOR_DELAY_UI);
                } else if (stepDetectorSensor != null) {
                    sensorManager.registerListener(this, stepDetectorSensor, SensorManager.SENSOR_DELAY_UI);
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                    sensorManager.flush(this);
                }
            } catch (Exception e) {}
        }
    }
}
