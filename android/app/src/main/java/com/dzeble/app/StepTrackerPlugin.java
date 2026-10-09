package com.dzeble.app;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
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
    private Sensor stepSensor;
    private boolean isListening = false;

    @Override
    public void load() {
        Context context = getContext();
        sensorManager = (SensorManager) context.getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager != null) {
            stepSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        }
    }

    @PluginMethod
    public void getTodaySteps(PluginCall call) {
        Context ctx = getContext();
        SharedPreferences prefs = ctx.getSharedPreferences(StepService.PREFS_NAME, Context.MODE_PRIVATE);

        int steps = prefs.getInt("today_steps", 0);
        int calories = Math.round(steps * 0.04f);
        float distanceKm = Math.round(steps * 0.000762f * 100.0f) / 100.0f;

        JSObject ret = new JSObject();
        ret.put("steps", steps);
        ret.put("calories", calories);
        ret.put("distanceKm", distanceKm);
        ret.put("isAvailable", stepSensor != null);
        call.resolve(ret);
    }

    @PluginMethod
    public void startUpdates(PluginCall call) {
        if (stepSensor == null) {
            JSObject ret = new JSObject();
            ret.put("started", false);
            ret.put("reason", "Sensor not available");
            call.resolve(ret);
            return;
        }

        if (sensorManager != null && !isListening) {
            sensorManager.registerListener(this, stepSensor, SensorManager.SENSOR_DELAY_UI);
            isListening = true;
        }

        try {
            Context ctx = getContext();
            Intent serviceIntent = new Intent(ctx, StepService.class);
            ctx.startService(serviceIntent);
        } catch (Exception e) {
            // Android 8+ background limits might apply
        }

        JSObject ret = new JSObject();
        ret.put("started", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void stopUpdates(PluginCall call) {
        if (sensorManager != null && isListening) {
            sensorManager.unregisterListener(this);
            isListening = false;
        }
        call.resolve();
    }

    @PluginMethod
    public void requestTrackerPermissions(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            if (getPermissionState("activityRecognition") != PermissionState.GRANTED) {
                requestPermissionForAlias("activityRecognition", call, "permissionCallback");
                return;
            }
        }
        JSObject ret = new JSObject();
        ret.put("activityRecognition", "granted");
        startUpdates(call);
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("activityRecognition", getPermissionState("activityRecognition"));
        if (getPermissionState("activityRecognition") == PermissionState.GRANTED) {
            startUpdates(call);
        } else {
            call.resolve(ret);
        }
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() == Sensor.TYPE_STEP_COUNTER) {
            int raw = (int) event.values[0];
            int steps = StepService.processSteps(getContext(), raw);
            int calories = Math.round(steps * 0.04f);
            float distanceKm = Math.round(steps * 0.000762f * 100.0f) / 100.0f;

            JSObject data = new JSObject();
            data.put("steps", steps);
            data.put("calories", calories);
            data.put("distanceKm", distanceKm);
            notifyListeners("stepUpdate", data);
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {}

    @Override
    public void handleOnResume() {
        super.handleOnResume();
        if (sensorManager != null && stepSensor != null) {
            sensorManager.registerListener(this, stepSensor, SensorManager.SENSOR_DELAY_UI);
            isListening = true;
        }
    }
}
